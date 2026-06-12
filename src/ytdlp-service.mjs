import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";

const activeTasks = new Map();
let taskEventHandler = null;
const DEFAULT_YTDLP_OUTPUT_TEMPLATE = "%(title).80B.%(ext)s";
const FFMPEG_MISSING_MESSAGE = "yt-dlp is installed, but ffmpeg is missing on the server. Audio/video streams cannot be merged.";
const MAX_COOKIE_FILE_BYTES = 2 * 1024 * 1024;
const YTDLP_COOKIE_SITES = [
  {
    id: "youtube",
    name: "YouTube",
    fileName: "youtube.txt",
    domains: ["youtube.com", "youtu.be", "youtube-nocookie.com"]
  },
  {
    id: "tiktok",
    name: "TikTok",
    fileName: "tiktok.txt",
    domains: ["tiktok.com", "vt.tiktok.com", "vm.tiktok.com"]
  },
  {
    id: "douyin",
    name: "Douyin",
    fileName: "douyin.txt",
    domains: ["douyin.com", "iesdouyin.com", "v.douyin.com"]
  },
  {
    id: "bilibili",
    name: "Bilibili",
    fileName: "bilibili.txt",
    domains: ["bilibili.com", "b23.tv"]
  },
  {
    id: "xiaohongshu",
    name: "Xiaohongshu",
    fileName: "xiaohongshu.txt",
    domains: ["xiaohongshu.com", "xhslink.com"]
  },
  {
    id: "instagram",
    name: "Instagram",
    fileName: "instagram.txt",
    domains: ["instagram.com", "instagr.am"]
  },
  {
    id: "x",
    name: "X",
    fileName: "x.txt",
    domains: ["x.com", "twitter.com", "t.co"]
  },
  {
    id: "threads",
    name: "Threads",
    fileName: "threads.txt",
    domains: ["threads.com", "threads.net"]
  },
  {
    id: "others",
    name: "Others",
    fileName: "others.txt",
    domains: []
  }
];
const YTDLP_COOKIE_SITE_BY_ID = new Map(YTDLP_COOKIE_SITES.map((site) => [site.id, site]));
const CONTROLLED_EXTRA_ARG_FLAGS = new Set([
  "--newline",
  "--progress",
  "--no-color",
  "--paths",
  "--output",
  "--format",
  "--cookies",
  "--proxy",
  "--no-playlist",
  "--restrict-filenames",
  "--replace-in-metadata",
  "--ffmpeg-location"
]);

export function setYtDlpTaskEventHandler(handler) {
  taskEventHandler = typeof handler === "function" ? handler : null;
}

export async function diagnoseYtDlpServer(server) {
  const version = await commandFirstLine(server.binaryPath || "yt-dlp", ["--version"], "yt-dlp version check timed out.");
  const ffmpeg = ffmpegStatus(server);
  const cookieInfo = inspectCookieFile(server.cookiesPath);
  const siteCookies = listYtDlpCookies(server);
  const cookieDiagnostic = cookieDiagnosticForServer(server, cookieInfo, siteCookies);
  const tasks = fetchYtDlpTasks(server);
  const needsFfmpeg = ytdlpNeedsFfmpeg(server.format, server.extraArgs);
  const warnings = [];
  if (cookieDiagnostic.warning) warnings.push(cookieDiagnostic.code);
  if (needsFfmpeg && !ffmpeg.available) warnings.push("ffmpeg_missing");
  warnings.push(...siteCookieWarnings(siteCookies));
  if (cookieDiagnostic.fatal) {
    return {
      ok: false,
      available: true,
      code: cookieDiagnostic.code,
      reason: cookieDiagnostic.code,
      message: cookieDiagnostic.message,
      version,
      ytDlpVersion: version,
      ffmpegAvailable: ffmpeg.available,
      ffmpegVersion: ffmpeg.version,
      formatRequiresFfmpeg: needsFfmpeg,
      cookieStatus: cookieInfo.status,
      cookieStatusDetail: publicCookieStatus(cookieInfo),
      siteCookies,
      taskCount: tasks.length,
      warnings
    };
  }
  if (needsFfmpeg && !ffmpeg.available) {
    return {
      ok: false,
      available: false,
      code: "ffmpeg_missing",
      reason: "ffmpeg_missing",
      message: FFMPEG_MISSING_MESSAGE,
      version,
      ytDlpVersion: version,
      ffmpegAvailable: false,
      ffmpegVersion: "",
      formatRequiresFfmpeg: true,
      cookieStatus: cookieInfo.status,
      cookieStatusDetail: publicCookieStatus(cookieInfo),
      siteCookies,
      taskCount: tasks.length,
      warnings
    };
  }
  return {
    ok: true,
    available: true,
    message: "yt-dlp is available.",
    version,
    ytDlpVersion: version,
    ffmpegAvailable: ffmpeg.available,
    ffmpegVersion: ffmpeg.version,
    formatRequiresFfmpeg: needsFfmpeg,
    cookieStatus: cookieInfo.status,
    cookieStatusDetail: publicCookieStatus(cookieInfo),
    siteCookies,
    taskCount: tasks.length,
    warnings
  };
}

export function fetchYtDlpTasks(server) {
  const state = readState(server);
  let didChange = false;
  const tasks = state.tasks.map((task) => {
    if (task.status === "running" && !activeTasks.has(taskKey(server, task.id))) {
      didChange = true;
      return {
        ...task,
        status: "failed",
        rawStatus: "lost",
        phase: "failed",
        errorMessage: task.errorMessage || "yt-dlp process is not running.",
        errorCode: task.errorCode || "",
        debugErrorMessage: task.debugErrorMessage || "",
        updatedAt: new Date().toISOString()
      };
    }
    return task;
  });
  if (didChange) {
    writeState(server, { ...state, tasks });
  }
  return tasks.map(publicTask);
}

export function listYtDlpCookies(server) {
  return YTDLP_COOKIE_SITES.map((site) => publicSiteCookieStatus(server, site));
}

export function saveYtDlpCookieFile(server, siteId, content) {
  const site = cookieSiteById(siteId);
  const text = String(content || "");
  const size = Buffer.byteLength(text, "utf8");
  validateCookieText(text, size);
  const filePath = cookieFilePath(server, site);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${crypto.randomUUID()}.tmp`;
  fs.writeFileSync(tempPath, text, { mode: 0o600 });
  fs.chmodSync(tempPath, 0o600);
  fs.renameSync(tempPath, filePath);
  console.log(`[${server.id}] yt-dlp cookie imported site=${site.id} file=${site.fileName} size=${size}`);
  return publicSiteCookieStatus(server, site);
}

export function appendYtDlpCookieFile(server, siteId, content) {
  const site = cookieSiteById(siteId);
  const text = String(content || "");
  const size = Buffer.byteLength(text, "utf8");
  validateCookieText(text, size);
  const filePath = cookieFilePath(server, site);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  let existing = "";
  try {
    existing = fs.readFileSync(filePath, "utf8");
  } catch {
    existing = "";
  }
  const combined = existing.trim()
    ? `${existing.replace(/\s*$/u, "")}\n${text.replace(/^\s*/u, "")}`
    : text;
  const combinedSize = Buffer.byteLength(combined, "utf8");
  if (combinedSize > MAX_COOKIE_FILE_BYTES) {
    const error = new Error("Cookie file is too large.");
    error.statusCode = 413;
    error.code = "cookie_file_too_large";
    throw error;
  }
  validateCookieText(combined, combinedSize);
  const tempPath = `${filePath}.${crypto.randomUUID()}.tmp`;
  fs.writeFileSync(tempPath, combined, { mode: 0o600 });
  fs.chmodSync(tempPath, 0o600);
  fs.renameSync(tempPath, filePath);
  console.log(`[${server.id}] yt-dlp cookie appended site=${site.id} file=${site.fileName} size=${size} combinedSize=${combinedSize}`);
  return publicSiteCookieStatus(server, site);
}

export function deleteYtDlpCookieFile(server, siteId) {
  const site = cookieSiteById(siteId);
  for (const filePath of cookieFilePaths(server, site)) {
    fs.rmSync(filePath, { force: true });
  }
  console.log(`[${server.id}] yt-dlp cookie removed site=${site.id} file=${site.fileName}`);
  return publicSiteCookieStatus(server, site);
}

export function addYtDlpTask(server, payload = {}) {
  const url = extractHTTPURL(payload.url || payload.source || "");
  if (!url) {
    const error = new Error("No HTTP/HTTPS media URL found.");
    error.statusCode = 400;
    error.code = "invalid_media_url";
    throw error;
  }
  const runningCount = [...activeTasks.keys()].filter((key) => key.startsWith(`${server.id}:`)).length;
  if (runningCount >= Number(server.maxConcurrent || 10)) {
    const error = new Error(`yt-dlp is already running ${runningCount} task(s).`);
    error.statusCode = 429;
    throw error;
  }
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const baseOutputTemplate = outputTemplateFromPayload(payload.filename) || String(server.outputTemplate || "").trim();
  const duplicateURL = readState(server).tasks.some((task) => normalizeTaskURL(task.url) === normalizeTaskURL(url));
  const cookieMatch = ytdlpCookieMatchForURL(server, url, payload.cookiesPath);
  const task = {
    id,
    url,
    name: String(payload.name || payload.filename || "").trim() || url,
    status: "running",
    rawStatus: "running",
    phase: "downloading",
    progress: 0,
    completedBytes: 0,
    totalBytes: 0,
    downloadSpeed: 0,
    eta: 0,
    errorMessage: "",
    outputPath: "",
    format: String(payload.format || server.format || "").trim(),
    outputTemplate: duplicateURL
      ? uniqueOutputTemplate(baseOutputTemplate, id)
      : baseOutputTemplate,
    downloadDir: resolvedDownloadDir(server, payload.downloadDirectory),
    proxy: String(payload.proxy || server.proxy || "").trim(),
    cookiesPath: cookieMatch.cookiesPath,
    cookieSite: cookieMatch.siteId,
    noPlaylist: payload.noPlaylist ?? server.noPlaylist,
    extraArgs: sanitizeExtraArgs(payload.extraArgs ?? server.extraArgs ?? []),
    errorCode: "",
    debugErrorMessage: "",
    createdAt: now,
    updatedAt: now
  };
  upsertTask(server, task);
  startYtDlpProcess(server, task);
  return publicTask(task);
}

function extractHTTPURL(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  const direct = normalizeHTTPURL(text);
  if (direct) return direct;
  const pattern = /https?:\/\/[^\s<>"'`“”‘’]+/giu;
  for (const match of text.matchAll(pattern)) {
    const normalized = normalizeHTTPURL(match[0]);
    if (normalized) return normalized;
  }
  return "";
}

function normalizeHTTPURL(value) {
  let candidate = String(value || "").trim();
  candidate = candidate
    .replace(/^[<({\["'`“‘]+/u, "")
    .replace(/[>"'`“”‘’，。！？、；;:：)\]}）】》]+$/u, "");
  try {
    const url = new URL(candidate);
    if ((url.protocol === "http:" || url.protocol === "https:") && url.hostname) {
      return url.toString();
    }
  } catch {
    return "";
  }
  return "";
}

export function pauseYtDlpTask(server, taskId) {
  const task = taskById(server, taskId);
  if (!task) return null;
  const key = taskKey(server, task.id);
  const active = activeTasks.get(key);
  if (active) {
    active.intent = "paused";
    active.child.kill("SIGTERM");
  }
  const paused = {
    ...task,
    status: "paused",
    rawStatus: "paused",
    phase: "paused",
    downloadSpeed: 0,
    eta: 0,
    updatedAt: new Date().toISOString()
  };
  upsertTask(server, paused);
  return publicTask(paused);
}

export function resumeYtDlpTask(server, taskId) {
  const task = taskById(server, taskId);
  if (!task) return null;
  if (activeTasks.has(taskKey(server, task.id))) {
    return publicTask(task);
  }
  const resumed = {
    ...task,
    status: "running",
    rawStatus: "running",
    phase: "downloading",
    errorMessage: "",
    errorCode: "",
    debugErrorMessage: "",
    downloadSpeed: 0,
    eta: 0,
    updatedAt: new Date().toISOString()
  };
  upsertTask(server, resumed);
  startYtDlpProcess(server, resumed);
  return publicTask(resumed);
}

export function removeYtDlpTask(server, taskId, options = {}) {
  const task = taskById(server, taskId);
  if (!task) return null;
  const key = taskKey(server, task.id);
  const active = activeTasks.get(key);
  if (active) {
    active.intent = "removed";
    active.child.kill("SIGTERM");
  }
  const deleteResult = options.deleteFiles === true ? deleteTaskOutputFiles(server, task) : { deletedFiles: [], skippedFiles: [] };
  const state = readState(server);
  writeState(server, { ...state, tasks: state.tasks.filter((item) => item.id !== task.id) });
  return {
    removed: true,
    deletedFiles: deleteResult.deletedFiles,
    skippedFiles: deleteResult.skippedFiles
  };
}

function startYtDlpProcess(server, task) {
  if (server.requireCookiesForYoutube && isYouTubeURL(task.url) && !task.cookiesPath) {
    finishTask(server, task.id, "failed", youtubeCookieRequiredError(""));
    return;
  }
  const cookieConfigError = cookieConfigErrorForTask(task);
  if (cookieConfigError) {
    finishTask(server, task.id, "failed", cookieConfigError);
    return;
  }
  if (ytdlpNeedsFfmpeg(task.format || server.format, task.extraArgs) && !ffmpegAvailableSync(server)) {
    finishTask(server, task.id, "failed", ffmpegMissingError(""));
    return;
  }
  fs.mkdirSync(task.downloadDir, { recursive: true });
  const args = ytdlpArgs(server, task);
  const child = spawn(server.binaryPath || "yt-dlp", args, {
    cwd: task.downloadDir,
    stdio: ["ignore", "pipe", "pipe"]
  });
  const key = taskKey(server, task.id);
  activeTasks.set(key, { child, intent: "" });
  let outputTail = "";
  let stderrTail = "";
  let fatalOutputSeen = false;

  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    outputTail = appendOutputTail(outputTail, chunk);
    for (const line of String(chunk).split(/\r?\n/)) {
      if (isFatalYtDlpLine(line)) fatalOutputSeen = true;
      processYtDlpLine(server, task.id, line);
    }
  });
  child.stderr.on("data", (chunk) => {
    outputTail = appendOutputTail(outputTail, chunk);
    stderrTail = `${stderrTail}${chunk}`.slice(-6000);
    for (const line of String(chunk).split(/\r?\n/)) {
      if (isFatalYtDlpLine(line)) fatalOutputSeen = true;
      processYtDlpLine(server, task.id, line);
    }
  });
  child.on("error", async (error) => {
    const active = activeTasks.get(key);
    if (active) active.intent = "errored";
    activeTasks.delete(key);
    await finishTask(server, task.id, "failed", error.message || "yt-dlp failed to start.", { emitEvent: true });
  });
  child.on("close", async (code) => {
    const active = activeTasks.get(key);
    activeTasks.delete(key);
    if (!active || active.intent === "paused" || active.intent === "removed" || active.intent === "errored") {
      return;
    }
    if (code === 0 && !fatalOutputSeen && !hasFatalYtDlpOutput(stderrTail)) {
      await finishTask(server, task.id, "completed", "", { emitEvent: true });
    } else {
      const errorMessage = stderrTail.trim() || outputTail.trim() || `yt-dlp exited with code ${code}.`;
      await finishTask(server, task.id, "failed", classifyYtDlpError(task, errorMessage), { emitEvent: true });
    }
  });
}

function appendOutputTail(current, chunk) {
  return `${current}${chunk}`.slice(-8000);
}

function ytdlpArgs(server, task) {
  const outputTemplate = String(task.outputTemplate || server.outputTemplate || DEFAULT_YTDLP_OUTPUT_TEMPLATE).trim();
  const args = [
    "--newline",
    "--progress",
    "--no-color",
    "--paths", task.downloadDir,
    "--output", outputTemplate
  ];
  if (server.cleanHashtags !== false) {
    args.push("--replace-in-metadata", "title", "\\s+#.*$", "");
  }
  if (task.format) args.push("--format", task.format);
  if (task.cookiesPath) args.push("--cookies", task.cookiesPath);
  if (task.proxy) args.push("--proxy", task.proxy);
  if (task.noPlaylist !== false) args.push("--no-playlist");
  if (server.restrictFilenames === true) args.push("--restrict-filenames");
  if (customFfmpegPath(server)) args.push("--ffmpeg-location", server.ffmpegPath);
  args.push(...sanitizeExtraArgs(task.extraArgs || server.extraArgs || []));
  args.push(task.url);
  return args;
}

function processYtDlpLine(server, taskId, line) {
  const text = String(line || "").trim();
  if (!text) return;
  const task = taskById(server, taskId);
  if (!task) return;
  const next = { ...task, updatedAt: new Date().toISOString() };
  const phase = phaseForYtDlpLine(text);
  if (phase) {
    next.phase = phase;
    next.rawStatus = phase;
  }
  const destination = text.match(/\[download\]\s+Destination:\s+(.+)$/i)
    || text.match(/\[download\]\s+(.+)\s+has already been downloaded/i)
    || text.match(/\[Merger\]\s+Merging formats into\s+"(.+)"$/i)
    || text.match(/\[MoveFiles\]\s+Moving file\s+".+"\s+to\s+"(.+)"$/i)
    || text.match(/\[ExtractAudio\]\s+Destination:\s+(.+)$/i);
  if (destination?.[1]) {
    next.outputPath = destination[1].trim();
    next.name = path.basename(next.outputPath);
  }
  const progress = text.match(/\[download\]\s+([0-9.]+)%\s+of\s+~?\s*([0-9.]+)([KMGTP]?i?B)?(?:\s+at\s+([0-9.]+)([KMGTP]?i?B)\/s)?(?:\s+ETA\s+([0-9:]+|--:--|Unknown))?/i)
    || text.match(/\[download\]\s+([0-9.]+)%/i);
  if (progress) {
    if (!next.phase || next.phase === "queued") {
      next.phase = "downloading";
      next.rawStatus = "downloading";
    }
    next.progress = clamp(Number(progress[1]) / 100, 0, 1);
    if (progress[2]) {
      next.totalBytes = parseSize(progress[2], progress[3]);
      next.completedBytes = Math.round(next.totalBytes * next.progress);
    }
    if (progress[4]) {
      next.downloadSpeed = parseSize(progress[4], progress[5]);
    }
    if (progress[6]) {
      next.eta = parseETA(progress[6]);
    } else if (next.totalBytes > next.completedBytes && next.downloadSpeed > 0) {
      next.eta = Math.round((next.totalBytes - next.completedBytes) / next.downloadSpeed);
    }
  }
  upsertTask(server, next);
}

async function finishTask(server, taskId, status, error, options = {}) {
  const task = taskById(server, taskId);
  if (!task) return;
  const completed = status === "completed";
  const normalizedError = normalizedTaskError(error);
  const next = {
    ...task,
    status,
    rawStatus: status,
    phase: completed ? "completed" : "failed",
    progress: completed ? 1 : task.progress,
    completedBytes: completed && task.totalBytes > 0 ? task.totalBytes : task.completedBytes,
    downloadSpeed: 0,
    eta: 0,
    errorCode: completed ? "" : normalizedError.code,
    errorMessage: completed ? "" : normalizedError.message,
    debugErrorMessage: completed ? "" : normalizedError.debugMessage,
    updatedAt: new Date().toISOString()
  };
  upsertTask(server, next);
  if (options.emitEvent === true) {
    if (completed) {
      await waitForStableOutputFile(server, next);
    }
    await emitTaskEvent(server, publicTask(taskById(server, taskId) || next));
  }
}

async function commandFirstLine(command, args, timeoutMessage) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    let errorOutput = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(timeoutMessage));
    }, 8000);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { output += chunk; });
    child.stderr.on("data", (chunk) => { errorOutput += chunk; });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve(firstLine(output));
      } else {
        reject(new Error(errorOutput.trim() || `yt-dlp exited with code ${code}.`));
      }
    });
  });
}

function ffmpegStatus(server) {
  const command = server.ffmpegPath || "ffmpeg";
  const result = spawnSync(command, ["-version"], {
    encoding: "utf8",
    timeout: 8000,
    stdio: ["ignore", "pipe", "pipe"]
  });
  if (result.error || result.status !== 0) {
    return { available: false, version: "" };
  }
  return {
    available: true,
    version: firstLine(`${result.stdout || ""}\n${result.stderr || ""}`)
  };
}

function ffmpegAvailableSync(server) {
  return ffmpegStatus(server).available;
}

function publicTask(task) {
  return {
    id: task.id,
    name: task.name || task.url || task.id,
    status: task.status,
    rawStatus: task.rawStatus || task.status,
    phase: task.phase || task.rawStatus || task.status,
    progress: clamp(Number(task.progress || 0), 0, 1),
    completedBytes: Number(task.completedBytes || 0),
    totalBytes: Number(task.totalBytes || 0),
    downloadSpeed: Number(task.downloadSpeed || 0),
    eta: Number(task.eta || 0),
    errorCode: task.errorCode || "",
    errorMessage: task.errorMessage || "",
    debugErrorMessage: task.debugErrorMessage || "",
    outputPath: task.outputPath || "",
    url: task.url || ""
  };
}

function phaseForYtDlpLine(text) {
  if (/\[download\]/i.test(text)) return "downloading";
  if (/\[(Merger|Fixup|Metadata|EmbedSubtitle|EmbedThumbnail|ExtractAudio|VideoRemuxer|VideoConvertor|SponsorBlock)\]/i.test(text)) {
    return "postprocessing";
  }
  if (/\[MoveFiles\]/i.test(text)) return "moving";
  return "";
}

async function emitTaskEvent(server, task) {
  if (!taskEventHandler) return;
  try {
    await taskEventHandler(server, task, { liveEvent: true, source: "ytdlp" });
  } catch (error) {
    console.error(`[${server.id}] yt-dlp task event failed: ${error.message || error}`);
  }
}

async function waitForStableOutputFile(server, task) {
  const outputPath = String(task.outputPath || "").trim();
  if (!outputPath) return;
  const downloadDir = resolvedDownloadDir(server, task.downloadDir);
  const resolvedOutputPath = path.isAbsolute(outputPath)
    ? path.resolve(outputPath)
    : path.resolve(downloadDir, outputPath);
  if (!isPathInside(downloadDir, resolvedOutputPath)) return;
  let previousSize = -1;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    let stat;
    try {
      stat = fs.statSync(resolvedOutputPath);
    } catch {
      await sleep(250);
      continue;
    }
    if (!stat.isFile()) return;
    if (stat.size === previousSize) return;
    previousSize = stat.size;
    await sleep(250);
  }
}

function classifyYtDlpError(task, rawMessage) {
  const debugMessage = String(rawMessage || "").trim();
  const site = siteFamily(task.url);
  if (isRateLimitedError(debugMessage)) {
    return ytdlpClassifiedError("rate_limited", "The current server is being rate limited by this site. Try again later, or configure a proxy or cookies.", debugMessage);
  }
  if (isPageLoadError(debugMessage)) {
    return ytdlpClassifiedError("webpage_unavailable", "yt-dlp could not load the page. Check the URL, network, proxy, or cookies.", debugMessage);
  }
  if (isCookieAuthError(debugMessage)) {
    return cookieAuthErrorForTask(task, site, debugMessage);
  }
  if (isChallengeOrFormatError(debugMessage)) {
    return ytdlpClassifiedError("challenge_or_format_failed", "Unable to get downloadable video formats. Update yt-dlp and check that browser simulation dependencies (deno / bun / node) are working.", debugMessage);
  }
  if (isJavaScriptRuntimeError(debugMessage)) {
    return ytdlpClassifiedError("javascript_runtime_missing", "A JavaScript runtime is missing on the server. Install Deno or Node.js, or configure yt-dlp jsRuntimes.", debugMessage);
  }
  if (isImpersonationError(debugMessage)) {
    return ytdlpClassifiedError("extractor_impersonation_unavailable", "yt-dlp needs a browser impersonation target for this site. Update yt-dlp, then retry with cookies or proxy if needed.", debugMessage);
  }
  if (isJSONParseError(debugMessage)) {
    return ytdlpClassifiedError(siteSpecificCode(site, "response_parse_failed"), siteParseFailedMessage(site), debugMessage);
  }
  if (isExtractorUpdateError(debugMessage)) {
    return ytdlpClassifiedError("extractor_update_required", "yt-dlp could not parse this site. Update yt-dlp and try again.", debugMessage);
  }
  if (isUnsupportedURLError(debugMessage)) {
    return ytdlpClassifiedError("unsupported_url", "yt-dlp does not support this URL.", debugMessage);
  }
  if (isPrivateOrUnavailableError(debugMessage)) {
    return ytdlpClassifiedError("private_or_permission_required", "This video is private, unavailable, or requires an account with permission to access it.", debugMessage);
  }
  if (isGeoRestrictedError(debugMessage)) {
    return ytdlpClassifiedError("geo_restricted", "This video is not available from the server region. Try a proxy in an allowed region.", debugMessage);
  }
  if (isNetworkError(debugMessage)) {
    return ytdlpClassifiedError("network_error", "Network request failed. Check the server network, DNS, proxy, or certificate settings.", debugMessage);
  }
  return ytdlpClassifiedError("download_failed", "yt-dlp download failed. Check Debug Info for the original stderr.", debugMessage);
}

function hasFatalYtDlpOutput(value) {
  const text = String(value || "");
  if (!text.trim()) return false;
  return text.split(/\r?\n/).some(isFatalYtDlpLine);
}

function isFatalYtDlpLine(line) {
  const trimmed = String(line || "").trim();
  if (!trimmed) return false;
  if (/^ERROR:/i.test(trimmed)) return true;
  if (/^Traceback \(most recent call last\):/i.test(trimmed)) return true;
  if (/\bDownloadError\b/i.test(trimmed)) return true;
  return false;
}

function normalizedTaskError(error) {
  if (error && typeof error === "object") {
    return {
      code: String(error.code || "").trim(),
      message: String(error.message || "").slice(0, 1000),
      debugMessage: String(error.debugMessage || "").slice(0, 4000)
    };
  }
  const message = String(error || "").slice(0, 1000);
  return { code: "", message, debugMessage: "" };
}

function youtubeCookieRequiredError(debugMessage) {
  return {
    code: "youtube_cookie_required",
    message: "YouTube requires cookie authentication",
    debugMessage: String(debugMessage || "").trim()
  };
}

function cookieAuthErrorForTask(task, site, debugMessage) {
  const cookiesPath = String(task?.cookiesPath || "").trim();
  if (!cookiesPath) {
    if (site === "youtube") {
      return youtubeCookieRequiredError(debugMessage);
    }
    return ytdlpClassifiedError(siteSpecificCode(site, "cookie_required"), siteCookieRequiredMessage(site), debugMessage);
  }
  const cookieInfo = inspectCookieFile(cookiesPath);
  if (cookieInfo.status === "file_missing") {
    return ytdlpClassifiedError(siteSpecificCode(site, "cookie_file_missing"), "Configured cookiesPath does not exist. Check PushAgent config.json and the file path.", debugMessage);
  }
  if (cookieInfo.status === "unreadable" || cookieInfo.status === "empty" || cookieInfo.status === "no_cookie_records") {
    return ytdlpClassifiedError(siteSpecificCode(site, "cookie_file_invalid"), "Configured cookiesPath cannot be read or does not look like a valid cookies.txt file.", debugMessage);
  }
  if (cookieInfo.status === "all_persistent_cookies_expired") {
    return ytdlpClassifiedError(siteSpecificCode(site, "cookie_expired"), siteCookieExpiredMessage(site), debugMessage);
  }
  return ytdlpClassifiedError(siteSpecificCode(site, "cookie_invalid_or_expired"), siteCookieInvalidOrExpiredMessage(site), debugMessage);
}

function cookieConfigErrorForTask(task) {
  const cookiesPath = String(task?.cookiesPath || "").trim();
  if (!cookiesPath) return null;
  const site = siteFamily(task?.url);
  const cookieInfo = inspectCookieFile(cookiesPath);
  if (cookieInfo.status === "file_missing") {
    return ytdlpClassifiedError(siteSpecificCode(site, "cookie_file_missing"), "Configured cookiesPath does not exist. Check PushAgent config.json and the file path.", "");
  }
  if (cookieInfo.status === "unreadable" || cookieInfo.status === "empty" || cookieInfo.status === "no_cookie_records") {
    return ytdlpClassifiedError(siteSpecificCode(site, "cookie_file_invalid"), "Configured cookiesPath cannot be read or does not look like a valid cookies.txt file.", "");
  }
  if (cookieInfo.status === "all_persistent_cookies_expired") {
    return ytdlpClassifiedError(siteSpecificCode(site, "cookie_expired"), siteCookieExpiredMessage(site), "");
  }
  return null;
}

function ffmpegMissingError(debugMessage) {
  return {
    code: "ffmpeg_missing",
    message: FFMPEG_MISSING_MESSAGE,
    debugMessage: String(debugMessage || "").trim()
  };
}

function ytdlpClassifiedError(code, message, debugMessage) {
  return {
    code,
    message,
    debugMessage: String(debugMessage || "").trim()
  };
}

function inspectCookieFile(cookiesPath) {
  const configuredPath = String(cookiesPath || "").trim();
  if (!configuredPath) {
    return cookieInfo("not_configured", configuredPath);
  }
  const resolvedPath = path.resolve(configuredPath);
  let stat;
  try {
    stat = fs.statSync(resolvedPath);
  } catch {
    return cookieInfo("file_missing", resolvedPath);
  }
  if (!stat.isFile()) {
    return cookieInfo("file_missing", resolvedPath);
  }
  if (stat.size <= 0) {
    return cookieInfo("empty", resolvedPath, { size: stat.size });
  }
  let content = "";
  try {
    content = fs.readFileSync(resolvedPath, "utf8");
  } catch {
    return cookieInfo("unreadable", resolvedPath, { size: stat.size });
  }
  return inspectCookieContent(content, resolvedPath, stat.size);
}

function inspectCookieContent(content, cookiesPath = "", size = 0, options = {}) {
  const records = parseCookieRecords(content, { allowJSON: options.allowJSON !== false });
  if (!records.length) {
    return cookieInfo("no_cookie_records", cookiesPath, { size });
  }
  const now = Math.floor(Date.now() / 1000);
  let expiredCount = 0;
  let validCount = 0;
  let sessionCount = 0;
  let expiresAt = 0;
  for (const record of records) {
    const expiry = Number(record.expires || 0);
    if (!Number.isFinite(expiry) || expiry <= 0) {
      sessionCount += 1;
    } else if (expiry <= now) {
      expiredCount += 1;
    } else {
      validCount += 1;
      expiresAt = Math.max(expiresAt, expiry);
    }
  }
  const counters = {
    size,
    totalCookieCount: records.length,
    expiredCookieCount: expiredCount,
    validCookieCount: validCount,
    sessionCookieCount: sessionCount,
    expiresAt: expiresAt > 0 ? new Date(expiresAt * 1000).toISOString() : ""
  };
  if (validCount > 0) {
    return cookieInfo("probably_valid", cookiesPath, counters);
  }
  if (sessionCount > 0) {
    return cookieInfo("session_only", cookiesPath, counters);
  }
  return cookieInfo("all_persistent_cookies_expired", cookiesPath, counters);
}

function validateCookieText(text, size) {
  if (size <= 0) {
    const error = new Error("Cookie file is empty.");
    error.statusCode = 400;
    error.code = "cookie_file_invalid";
    throw error;
  }
  if (size > MAX_COOKIE_FILE_BYTES) {
    const error = new Error("Cookie file is too large.");
    error.statusCode = 413;
    error.code = "cookie_file_too_large";
    throw error;
  }
  if (hasUnsupportedCookieTextCharacters(text) || !looksLikeNetscapeCookieText(text)) {
    const error = new Error("Cookie file must use UTF-8 Netscape cookies.txt format.");
    error.statusCode = 400;
    error.code = "cookie_file_invalid";
    throw error;
  }
  const validation = inspectCookieContent(text, "", size, { allowJSON: false });
  if (["empty", "no_cookie_records"].includes(validation.status)) {
    const error = new Error("Cookie file must use Netscape cookies.txt format.");
    error.statusCode = 400;
    error.code = "cookie_file_invalid";
    throw error;
  }
}

function hasUnsupportedCookieTextCharacters(text) {
  return /[\u0000\uFFFD]/u.test(text) || /[\x01-\x08\x0B\x0C\x0E-\x1F]/u.test(text);
}

function looksLikeNetscapeCookieText(text) {
  let hasCookieRecord = false;
  for (const rawLine of String(text || "").split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith("#") && !line.startsWith("#HttpOnly_")) continue;
    if (!parseNetscapeCookieLine(line)) {
      return false;
    }
    hasCookieRecord = true;
  }
  return hasCookieRecord;
}

function cookieInfo(status, cookiesPath, extra = {}) {
  return {
    status,
    pathConfigured: Boolean(String(cookiesPath || "").trim()),
    cookiesPath: String(cookiesPath || ""),
    ...extra
  };
}

function parseCookieRecords(content, options = {}) {
  const text = String(content || "").trim();
  if (!text) return [];
  if (options.allowJSON !== false) {
    const jsonRecords = parseJSONCookieRecords(text);
    if (jsonRecords.length) return jsonRecords;
  }
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && (!line.startsWith("#") || line.startsWith("#HttpOnly_")))
    .map(parseNetscapeCookieLine)
    .filter(Boolean);
}

function parseJSONCookieRecords(text) {
  if (!text.startsWith("[") && !text.startsWith("{")) return [];
  try {
    const parsed = JSON.parse(text);
    const items = Array.isArray(parsed) ? parsed : Array.isArray(parsed.cookies) ? parsed.cookies : [];
    return items
      .filter((item) => item && typeof item === "object")
      .map((item) => ({
        domain: String(item.domain || item.host || ""),
        name: String(item.name || ""),
        expires: Number(item.expirationDate ?? item.expires ?? item.expiry ?? 0)
      }))
      .filter((item) => item.name || item.domain);
  } catch {
    return [];
  }
}

function parseNetscapeCookieLine(line) {
  const parts = String(line || "").split(/\t/);
  if (parts.length < 7) return null;
  const domain = parts[0].startsWith("#HttpOnly_") ? parts[0].slice("#HttpOnly_".length) : parts[0];
  const includeSubdomains = String(parts[1] || "").trim().toUpperCase();
  const cookiePath = String(parts[2] || "").trim();
  const secure = String(parts[3] || "").trim().toUpperCase();
  const expiry = Number(parts[4]);
  const name = String(parts[5] || "").trim();
  if (
    !domain.trim() ||
    !["TRUE", "FALSE"].includes(includeSubdomains) ||
    !cookiePath.startsWith("/") ||
    !["TRUE", "FALSE"].includes(secure) ||
    !Number.isFinite(expiry) ||
    !name
  ) {
    return null;
  }
  return {
    domain,
    name,
    expires: expiry
  };
}

function publicCookieStatus(info) {
  return {
    status: info.status || "unknown",
    pathConfigured: info.pathConfigured === true,
    cookiesPath: info.cookiesPath || "",
    totalCookieCount: Number(info.totalCookieCount || 0),
    validCookieCount: Number(info.validCookieCount || 0),
    expiredCookieCount: Number(info.expiredCookieCount || 0),
    sessionCookieCount: Number(info.sessionCookieCount || 0),
    expiresAt: info.expiresAt || ""
  };
}

function publicSiteCookieStatus(server, site) {
  const filePath = cookieFilePath(server, site);
  migrateLegacyCookieFile(server, site, filePath);
  const info = inspectCookieFile(filePath);
  const imported = !["file_missing", "not_configured"].includes(info.status);
  let updatedAt = "";
  if (imported) {
    try {
      updatedAt = fs.statSync(filePath).mtime.toISOString();
    } catch {
      updatedAt = "";
    }
  }
  return {
    id: site.id,
    name: site.name,
    domains: site.domains,
    fileName: site.fileName,
    imported,
    status: imported ? info.status : "not_imported",
    updatedAt,
    expiresAt: info.expiresAt || "",
    totalCookieCount: Number(info.totalCookieCount || 0),
    validCookieCount: Number(info.validCookieCount || 0),
    expiredCookieCount: Number(info.expiredCookieCount || 0),
    sessionCookieCount: Number(info.sessionCookieCount || 0)
  };
}

function siteCookieWarnings(siteCookies) {
  return siteCookies
    .filter((item) => item.imported && ["all_persistent_cookies_expired", "no_cookie_records", "empty", "unreadable"].includes(item.status))
    .map((item) => `${item.id}_cookie_${item.status === "all_persistent_cookies_expired" ? "expired" : "invalid"}`);
}

function cookieDiagnosticForServer(server, cookieInfo, siteCookies = []) {
  if (cookieInfo.status === "not_configured") {
    if (server.requireCookiesForYoutube) {
      const youtubeCookie = siteCookies.find((item) => item.id === "youtube");
      if (youtubeCookie?.imported && !["all_persistent_cookies_expired", "no_cookie_records", "empty"].includes(youtubeCookie.status)) {
        return { fatal: false, warning: false, code: "", message: "" };
      }
      return {
        fatal: true,
        warning: true,
        code: "youtube_cookie_required",
        message: "YouTube cookies are required by config, but cookiesPath is not configured."
      };
    }
    return { fatal: false, warning: false, code: "", message: "" };
  }
  if (cookieInfo.status === "file_missing") {
    return {
      fatal: true,
      warning: true,
      code: "cookie_file_missing",
      message: "Configured cookiesPath does not exist. Check PushAgent config.json and the file path."
    };
  }
  if (cookieInfo.status === "unreadable" || cookieInfo.status === "empty" || cookieInfo.status === "no_cookie_records") {
    return {
      fatal: true,
      warning: true,
      code: "cookie_file_invalid",
      message: "Configured cookiesPath cannot be read or does not look like a valid cookies.txt file."
    };
  }
  if (cookieInfo.status === "all_persistent_cookies_expired") {
    return {
      fatal: true,
      warning: true,
      code: "cookie_expired",
      message: "Configured cookiesPath appears to be expired. Re-export browser cookies and update PushAgent."
    };
  }
  return { fatal: false, warning: false, code: "", message: "" };
}

function ytdlpCookieMatchForURL(server, url, explicitCookiesPath = "") {
  const explicitPath = String(explicitCookiesPath || "").trim();
  if (explicitPath) {
    return { siteId: "", cookiesPath: explicitPath };
  }
  const site = cookieSiteForURL(url);
  if (site) {
    const filePath = cookieFilePath(server, site);
    const info = inspectCookieFile(filePath);
    if (!["file_missing", "not_configured"].includes(info.status)) {
      return { siteId: site.id, cookiesPath: filePath };
    }
  } else {
    const fallbackSite = YTDLP_COOKIE_SITE_BY_ID.get("others");
    if (fallbackSite) {
      const filePath = cookieFilePath(server, fallbackSite);
      const info = inspectCookieFile(filePath);
      if (!["file_missing", "not_configured"].includes(info.status)) {
        return { siteId: fallbackSite.id, cookiesPath: filePath };
      }
    }
  }
  return {
    siteId: site?.id || "",
    cookiesPath: String(server.cookiesPath || "").trim()
  };
}

function cookieSiteById(siteId) {
  const id = String(siteId || "").trim().toLowerCase();
  const site = YTDLP_COOKIE_SITE_BY_ID.get(id);
  if (!site) {
    const error = new Error(`Unsupported cookie site: ${siteId}`);
    error.statusCode = 404;
    error.code = "cookie_site_not_supported";
    throw error;
  }
  return site;
}

function cookieSiteForURL(value) {
  let hostname = "";
  try {
    hostname = new URL(String(value || "")).hostname.toLowerCase();
  } catch {
    return null;
  }
  return YTDLP_COOKIE_SITES.find((site) => site.domains.some((domain) => hostnameMatches(hostname, domain))) || null;
}

function cookieFilePath(server, site) {
  return path.resolve(ytdlpCookiesDir(server), site.fileName);
}

function cookieFilePaths(server, site) {
  return uniquePaths([cookieFilePath(server, site), ...legacyCookieFilePaths(server, site)]);
}

function ytdlpCookiesDir(server) {
  return path.resolve(server.cookiesDir || path.join(server.downloadDir || process.cwd(), ".qiuyu-ytdlp-cookies"));
}

function legacyCookieFilePaths(server, site) {
  const dirs = Array.isArray(server.legacyCookiesDirs) ? server.legacyCookiesDirs : [];
  return dirs
    .map((dir) => path.resolve(String(dir || ""), site.fileName))
    .filter((filePath) => filePath && filePath !== cookieFilePath(server, site));
}

function migrateLegacyCookieFile(server, site, targetPath = cookieFilePath(server, site)) {
  if (fs.existsSync(targetPath)) return;
  for (const legacyPath of legacyCookieFilePaths(server, site)) {
    if (!fs.existsSync(legacyPath)) continue;
    try {
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      fs.copyFileSync(legacyPath, targetPath);
      fs.chmodSync(targetPath, 0o600);
      console.log(`[${server.id}] migrated yt-dlp cookie site=${site.id} from ${legacyPath}`);
      return;
    } catch (error) {
      console.warn(`[${server.id}] failed to migrate yt-dlp cookie site=${site.id}: ${error.message || error}`);
    }
  }
}

function hostnameMatches(hostname, domain) {
  const normalizedHost = String(hostname || "").toLowerCase().replace(/\.$/, "");
  const normalizedDomain = String(domain || "").toLowerCase().replace(/\.$/, "");
  return normalizedHost === normalizedDomain || normalizedHost.endsWith(`.${normalizedDomain}`);
}

function isCookieAuthError(message) {
  const text = String(message || "").toLowerCase();
  return text.includes("sign in to confirm") ||
    text.includes("not a bot") ||
    text.includes("use --cookies") ||
    text.includes("use --cookies-from-browser") ||
    text.includes("cookies-from-browser") ||
    text.includes("login required") ||
    text.includes("youtube requires login") ||
    text.includes("cookie authentication") ||
    text.includes("requires login") ||
    text.includes("please login") ||
    text.includes("login to view") ||
    text.includes("this video is only available for registered users") ||
    text.includes("passport login");
}

function isJavaScriptRuntimeError(message) {
  const text = String(message || "").toLowerCase();
  return text.includes("no supported javascript runtime") ||
    text.includes("js runtime") ||
    text.includes("js-runtimes");
}

function isImpersonationError(message) {
  const text = String(message || "").toLowerCase();
  return text.includes("attempting impersonation") ||
    text.includes("no impersonate target is available") ||
    text.includes("impersonate target");
}

function isJSONParseError(message) {
  const text = String(message || "").toLowerCase();
  return text.includes("failed to parse json") ||
    text.includes("expecting value: line 1 column 1") ||
    text.includes("jsondecodeerror") ||
    text.includes("invalid json");
}

function isExtractorUpdateError(message) {
  const text = String(message || "").toLowerCase();
  return text.includes("unable to extract") ||
    text.includes("please report this issue") ||
    text.includes("please update to the latest version") ||
    text.includes("extractor failed") ||
    text.includes("no title found") ||
    text.includes("player responses") ||
    text.includes("metadata may also be missing");
}

function isUnsupportedURLError(message) {
  return String(message || "").toLowerCase().includes("unsupported url");
}

function isPageLoadError(message) {
  const text = String(message || "").toLowerCase();
  return text.includes("unable to download webpage") ||
    text.includes("unable to download api page") ||
    text.includes("unable to download json metadata") ||
    text.includes("unable to retrieve webpage") ||
    text.includes("failed to download m3u8 information");
}

function isPrivateOrUnavailableError(message) {
  const text = String(message || "").toLowerCase();
  return text.includes("private video") ||
    text.includes("members-only") ||
    text.includes("members only") ||
    text.includes("age-restricted") ||
    text.includes("age restricted") ||
    text.includes("requires payment") ||
    text.includes("premium subscribers") ||
    text.includes("permission to access") ||
    text.includes("video unavailable") ||
    text.includes("this video is unavailable") ||
    text.includes("this content is unavailable") ||
    text.includes("has been removed") ||
    text.includes("deleted video");
}

function isGeoRestrictedError(message) {
  const text = String(message || "").toLowerCase();
  return text.includes("not available in your country") ||
    text.includes("not available from your location") ||
    text.includes("geo restricted") ||
    text.includes("geo-restricted") ||
    text.includes("country");
}

function isRateLimitedError(message) {
  const text = String(message || "").toLowerCase();
  return text.includes("too many requests") ||
    text.includes("http error 429") ||
    text.includes("429:") ||
    text.includes("rate limit") ||
    text.includes("rate-limit");
}

function isChallengeOrFormatError(message) {
  const text = String(message || "").toLowerCase();
  return text.includes("signature solving failed") ||
    text.includes("n challenge solving failed") ||
    text.includes("challenge solving failed") ||
    text.includes("missing required data sync id") ||
    text.includes("missing data sync id") ||
    text.includes("requested format is not available") ||
    text.includes("only images are available") ||
    text.includes("some formats may be missing") ||
    text.includes("no video formats found") ||
    text.includes("no formats found");
}

function isNetworkError(message) {
  const text = String(message || "").toLowerCase();
  return text.includes("connection timed out") ||
    text.includes("timed out") ||
    text.includes("connection refused") ||
    text.includes("network is unreachable") ||
    text.includes("temporary failure in name resolution") ||
    text.includes("certificate verify failed") ||
    text.includes("ssl") ||
    text.includes("http error 403") ||
    text.includes("http error 502") ||
    text.includes("http error 503") ||
    text.includes("http error 504");
}

function isYouTubeURL(value) {
  return siteFamily(value) === "youtube";
}

function siteFamily(value) {
  return cookieSiteForURL(value)?.id || "generic";
}

function siteSpecificCode(site, suffix) {
  return site && site !== "generic" ? `${site}_${suffix}` : suffix;
}

function siteCookieRequiredMessage(site) {
  switch (site) {
    case "tiktok":
      return "TikTok requires login or cookie authentication. Export browser cookies and configure cookiesPath in PushAgent.";
    case "douyin":
      return "Douyin requires login or cookie authentication. Export browser cookies and configure cookiesPath in PushAgent.";
    case "bilibili":
      return "Bilibili requires login or cookie authentication. Export browser cookies and configure cookiesPath in PushAgent.";
    default:
      return "This site requires login or cookie authentication. Export browser cookies and configure cookiesPath in PushAgent.";
  }
}

function siteCookieExpiredMessage(site) {
  switch (site) {
    case "youtube":
      return "YouTube cookies appear to be expired. Re-export browser cookies and update cookiesPath in PushAgent.";
    case "tiktok":
      return "TikTok cookies appear to be expired. Re-export browser cookies and update cookiesPath in PushAgent.";
    case "douyin":
      return "Douyin cookies appear to be expired. Re-export browser cookies and update cookiesPath in PushAgent.";
    case "bilibili":
      return "Bilibili cookies appear to be expired. Re-export browser cookies and update cookiesPath in PushAgent.";
    default:
      return "Cookies appear to be expired. Re-export browser cookies and update cookiesPath in PushAgent.";
  }
}

function siteCookieInvalidOrExpiredMessage(site) {
  switch (site) {
    case "youtube":
      return "YouTube cookies may be expired or invalid. Re-export browser cookies and update cookiesPath in PushAgent.";
    case "tiktok":
      return "TikTok cookies may be expired or invalid. Re-export browser cookies and update cookiesPath in PushAgent.";
    case "douyin":
      return "Douyin cookies may be expired or invalid. Re-export browser cookies and update cookiesPath in PushAgent.";
    case "bilibili":
      return "Bilibili cookies may be expired or invalid. Re-export browser cookies and update cookiesPath in PushAgent.";
    default:
      return "Cookies may be expired or invalid. Re-export browser cookies and update cookiesPath in PushAgent.";
  }
}

function siteParseFailedMessage(site) {
  switch (site) {
    case "tiktok":
      return "TikTok returned data that yt-dlp could not parse. Update yt-dlp, then check cookies, proxy, or the shared link.";
    case "douyin":
      return "Douyin returned data that yt-dlp could not parse. Update yt-dlp, then check cookies, proxy, or the shared link.";
    case "bilibili":
      return "Bilibili returned data that yt-dlp could not parse. Update yt-dlp, then check cookies, proxy, or the shared link.";
    default:
      return "The site returned data that yt-dlp could not parse. Update yt-dlp, then check cookies, proxy, or the link.";
  }
}

function taskById(server, taskId) {
  const id = String(taskId || "");
  return readState(server).tasks.find((task) => task.id === id) || null;
}

function upsertTask(server, task) {
  const state = readState(server);
  const tasks = state.tasks.filter((item) => item.id !== task.id);
  tasks.unshift(task);
  writeState(server, { ...state, tasks: tasks.slice(0, Number(server.historyLimit || 1000)) });
}

function readState(server) {
  const filePath = statePath(server);
  const currentExists = fs.existsSync(filePath);
  const currentMtimeMs = fileMtimeMs(filePath);
  const currentState = readStateFile(filePath);
  const legacyPaths = legacyStatePaths(server).filter((legacyPath) => fs.existsSync(legacyPath));
  if (!legacyPaths.length || currentState.legacyStateMigratedAt) {
    return currentState;
  }
  const newestLegacyMtimeMs = Math.max(...legacyPaths.map(fileMtimeMs));
  if (currentExists && newestLegacyMtimeMs <= currentMtimeMs) {
    const migratedState = markLegacyStateMigrated(currentState, legacyPaths);
    writeState(server, migratedState);
    return migratedState;
  }
  const legacyTasks = legacyPaths.flatMap((legacyPath) => readStateFile(legacyPath).tasks);
  const migratedState = markLegacyStateMigrated(currentState, legacyPaths);
  if (!legacyTasks.length) {
    writeState(server, migratedState);
    return migratedState;
  }
  const merged = mergeTaskLists(currentState.tasks, legacyTasks).slice(0, Number(server.historyLimit || 1000));
  const mergedState = { ...migratedState, tasks: merged };
  if (!taskListsEqualByUpdate(currentState.tasks, merged) || !currentState.legacyStateMigratedAt) {
    writeState(server, mergedState);
  }
  return mergedState;
}

function writeState(server, state) {
  const filePath = statePath(server);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.tmp`;
  const payload = {
    tasks: Array.isArray(state.tasks) ? state.tasks : []
  };
  if (state.legacyStateMigratedAt) {
    payload.legacyStateMigratedAt = state.legacyStateMigratedAt;
  }
  if (Array.isArray(state.legacyStatePaths) && state.legacyStatePaths.length) {
    payload.legacyStatePaths = state.legacyStatePaths;
  }
  fs.writeFileSync(tempPath, JSON.stringify(payload, null, 2));
  fs.renameSync(tempPath, filePath);
}

function statePath(server) {
  return path.resolve(server.statePath || path.join(server.downloadDir || process.cwd(), ".qiuyu-ytdlp-tasks.json"));
}

function legacyStatePaths(server) {
  const values = Array.isArray(server.legacyStatePaths) ? server.legacyStatePaths : [];
  return uniquePaths(values.map((value) => path.resolve(String(value || ""))).filter((item) => item && item !== statePath(server)));
}

function readStateFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return { tasks: [] };
  }
  try {
    const payload = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return {
      tasks: Array.isArray(payload.tasks) ? payload.tasks : [],
      legacyStateMigratedAt: typeof payload.legacyStateMigratedAt === "string" ? payload.legacyStateMigratedAt : "",
      legacyStatePaths: Array.isArray(payload.legacyStatePaths) ? payload.legacyStatePaths.filter(Boolean) : []
    };
  } catch {
    return { tasks: [] };
  }
}

function markLegacyStateMigrated(state, legacyPaths) {
  return {
    ...state,
    legacyStateMigratedAt: new Date().toISOString(),
    legacyStatePaths: uniquePaths([...(state.legacyStatePaths || []), ...legacyPaths])
  };
}

function fileMtimeMs(filePath) {
  try {
    return fs.statSync(filePath).mtimeMs;
  } catch {
    return 0;
  }
}

function mergeTaskLists(primaryTasks, fallbackTasks) {
  const tasksById = new Map();
  for (const task of [...fallbackTasks, ...primaryTasks]) {
    const id = String(task?.id || "").trim();
    if (!id) continue;
    const previous = tasksById.get(id);
    tasksById.set(id, newerTask(previous, task));
  }
  return [...tasksById.values()].sort((left, right) => taskSortTimestamp(right) - taskSortTimestamp(left));
}

function newerTask(left, right) {
  if (!left) return right;
  if (!right) return left;
  return taskSortTimestamp(right) >= taskSortTimestamp(left) ? { ...left, ...right } : { ...right, ...left };
}

function taskSortTimestamp(task) {
  for (const key of ["updatedAt", "completedAt", "finishedAt", "createdAt"]) {
    const value = Date.parse(task?.[key] || "");
    if (Number.isFinite(value)) return value;
  }
  return 0;
}

function taskListsEqualByUpdate(left, right) {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (String(left[index]?.id || "") !== String(right[index]?.id || "")) return false;
    if (String(left[index]?.updatedAt || "") !== String(right[index]?.updatedAt || "")) return false;
  }
  return true;
}

function uniquePaths(values) {
  const seen = new Set();
  const result = [];
  for (const value of values) {
    const resolved = path.resolve(String(value || ""));
    if (!resolved || seen.has(resolved)) continue;
    seen.add(resolved);
    result.push(resolved);
  }
  return result;
}

function resolvedDownloadDir(server, value) {
  const raw = String(value || server.downloadDir || "./downloads").trim();
  return path.resolve(raw);
}

function outputTemplateFromPayload(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const base = path.basename(raw);
  if (base.includes("%(")) return base;
  if (path.extname(base)) return base;
  return `${base}.%(ext)s`;
}

function uniqueOutputTemplate(template, taskId) {
  const suffix = ` [${String(taskId || "").slice(0, 8)}]`;
  const raw = String(template || DEFAULT_YTDLP_OUTPUT_TEMPLATE).trim() || DEFAULT_YTDLP_OUTPUT_TEMPLATE;
  if (raw.includes(suffix)) return raw;
  const extTokenIndex = raw.lastIndexOf(".%(ext)s");
  if (extTokenIndex >= 0) {
    return `${raw.slice(0, extTokenIndex)}${suffix}${raw.slice(extTokenIndex)}`;
  }
  return `${raw}${suffix}`;
}

function deleteTaskOutputFiles(server, task) {
  const outputPath = String(task.outputPath || "").trim();
  if (!outputPath) {
    return { deletedFiles: [], skippedFiles: [] };
  }
  const downloadDir = resolvedDownloadDir(server, task.downloadDir);
  const resolvedOutputPath = path.isAbsolute(outputPath)
    ? path.resolve(outputPath)
    : path.resolve(downloadDir, outputPath);
  if (!isPathInside(downloadDir, resolvedOutputPath)) {
    return { deletedFiles: [], skippedFiles: [resolvedOutputPath] };
  }
  try {
    const stat = fs.statSync(resolvedOutputPath);
    if (!stat.isFile()) {
      return { deletedFiles: [], skippedFiles: [resolvedOutputPath] };
    }
    fs.rmSync(resolvedOutputPath, { force: true });
    return { deletedFiles: [resolvedOutputPath], skippedFiles: [] };
  } catch (error) {
    if (error?.code === "ENOENT") {
      return { deletedFiles: [], skippedFiles: [] };
    }
    return { deletedFiles: [], skippedFiles: [resolvedOutputPath] };
  }
}

function isPathInside(parent, child) {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return Boolean(relative) && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeTaskURL(value) {
  return String(value || "").trim();
}

function ytdlpNeedsFfmpeg(format, extraArgs = []) {
  const normalizedFormat = String(format || "").trim().toLowerCase();
  if (normalizedFormat.includes("+")) {
    return true;
  }
  const args = Array.isArray(extraArgs) ? extraArgs.map((item) => String(item || "").trim()) : [];
  return args.some((item) => item === "--merge-output-format" ||
    item === "--recode-video" ||
    item === "--embed-thumbnail" ||
    item === "--embed-metadata" ||
    item === "--extract-audio");
}

function sanitizeExtraArgs(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  const args = [];
  for (const item of value) {
    const text = String(item ?? "").trim();
    if (!text || text.includes("\0")) {
      continue;
    }
    if (text.startsWith("--") && CONTROLLED_EXTRA_ARG_FLAGS.has(text.split("=")[0])) {
      continue;
    }
    args.push(text);
  }
  return args.slice(0, 40);
}

function customFfmpegPath(server) {
  const value = String(server.ffmpegPath || "").trim();
  return value && value !== "ffmpeg";
}

function firstLine(value) {
  return String(value || "").split(/\r?\n/).map((line) => line.trim()).find(Boolean) || "";
}

function taskKey(server, taskId) {
  return `${server.id}:${taskId}`;
}

function parseSize(value, unit = "B") {
  const number = Number(value || 0);
  const normalized = String(unit || "B").toLowerCase();
  const powers = {
    b: 0,
    kb: 1,
    kib: 1,
    mb: 2,
    mib: 2,
    gb: 3,
    gib: 3,
    tb: 4,
    tib: 4,
    pb: 5,
    pib: 5
  };
  return Math.round(number * Math.pow(1024, powers[normalized] ?? 0));
}

function parseETA(value) {
  const text = String(value || "").trim();
  if (!text || text === "--:--" || text.toLowerCase() === "unknown") return 0;
  const parts = text.split(":").map((part) => Number(part));
  if (!parts.length || parts.some((part) => !Number.isFinite(part))) return 0;
  if (parts.length === 3) return Math.round(parts[0] * 3600 + parts[1] * 60 + parts[2]);
  if (parts.length === 2) return Math.round(parts[0] * 60 + parts[1]);
  return Math.round(parts[0]);
}

function clamp(value, min, max) {
  return Math.min(Math.max(Number(value) || 0, min), max);
}
