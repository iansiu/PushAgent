import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";

const activeTasks = new Map();
let taskEventHandler = null;
const DEFAULT_YTDLP_OUTPUT_TEMPLATE = "%(title).80B.%(ext)s";
const FFMPEG_MISSING_MESSAGE = "yt-dlp is installed, but ffmpeg is missing on the server. Audio/video streams cannot be merged.";
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
  const tasks = fetchYtDlpTasks(server);
  const needsFfmpeg = ytdlpNeedsFfmpeg(server.format, server.extraArgs);
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
      taskCount: tasks.length,
      warnings: ["ffmpeg_missing"]
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
    taskCount: tasks.length,
    warnings: []
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
    cookiesPath: String(payload.cookiesPath || server.cookiesPath || "").trim(),
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
  child.on("error", (error) => {
    activeTasks.delete(key);
    finishTask(server, task.id, "failed", error.message || "yt-dlp failed to start.");
  });
  child.on("close", async (code) => {
    const active = activeTasks.get(key);
    activeTasks.delete(key);
    if (active?.intent === "paused" || active?.intent === "removed") {
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
  if (site === "youtube" && isCookieAuthError(debugMessage)) {
    return youtubeCookieRequiredError(debugMessage);
  }
  if (isCookieAuthError(debugMessage)) {
    return ytdlpClassifiedError(siteSpecificCode(site, "cookie_required"), siteCookieRequiredMessage(site), debugMessage);
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
  try {
    const url = new URL(String(value || ""));
    const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    if (hostname === "youtube.com" || hostname.endsWith(".youtube.com") || hostname === "youtu.be" || hostname.endsWith(".youtu.be")) {
      return "youtube";
    }
    if (hostname === "tiktok.com" || hostname.endsWith(".tiktok.com") || hostname === "vt.tiktok.com") {
      return "tiktok";
    }
    if (hostname === "douyin.com" || hostname.endsWith(".douyin.com") || hostname === "iesdouyin.com" || hostname.endsWith(".iesdouyin.com")) {
      return "douyin";
    }
    if (hostname === "bilibili.com" || hostname.endsWith(".bilibili.com") || hostname === "b23.tv") {
      return "bilibili";
    }
    return "generic";
  } catch {
    return "generic";
  }
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
  writeState(server, { ...state, tasks: tasks.slice(0, Number(server.historyLimit || 300)) });
}

function readState(server) {
  const filePath = statePath(server);
  if (!fs.existsSync(filePath)) {
    return { tasks: [] };
  }
  try {
    const payload = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return { tasks: Array.isArray(payload.tasks) ? payload.tasks : [] };
  } catch {
    return { tasks: [] };
  }
}

function writeState(server, state) {
  const filePath = statePath(server);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify({ tasks: state.tasks || [] }, null, 2));
  fs.renameSync(tempPath, filePath);
}

function statePath(server) {
  return path.resolve(server.statePath || path.join(server.downloadDir || process.cwd(), ".qiuyu-ytdlp-tasks.json"));
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
