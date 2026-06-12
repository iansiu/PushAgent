import http from "node:http";
import https from "node:https";
import { diagnoseYtDlpServer, fetchYtDlpTasks } from "./ytdlp-service.mjs";

const COMPLETE_STATUSES = new Set(["complete", "completed", "seeding"]);
const ERROR_STATUSES = new Set(["error", "missingFiles"]);
const QBIT_LOGIN_COOLDOWN_MS = 5 * 60 * 1000;
const DEFAULT_REQUEST_TIMEOUT_MS = 15_000;
const ARIA2_TASK_FIELDS = ["gid", "status", "totalLength", "completedLength", "downloadSpeed", "uploadLength", "errorMessage", "files"];

export async function fetchTasks(server, sessionState) {
  sessionState.lastFetchWarnings = [];
  switch (server.type) {
    case "qbit":
      return fetchQbitTasks(server, sessionState);
    case "transmission":
      return fetchTransmissionTasks(server, sessionState);
    case "aria2":
      return fetchAria2Tasks(server, sessionState);
    case "ytdlp":
    case "yt-dlp":
      {
        const diagnostic = await diagnoseYtDlpServer(server);
        if (!diagnostic.ok) {
          const error = new Error(diagnostic.message || "yt-dlp diagnostics failed.");
          error.code = diagnostic.code || diagnostic.reason || "";
          throw error;
        }
      }
      return fetchYtDlpTasks(server, sessionState);
    default:
      throw new Error(`Unsupported server type: ${server.type}`);
  }
}

export async function diagnoseServer(server, sessionState = {}) {
  const state = { ...sessionState, lastFetchWarnings: [] };
  switch (server.type) {
    case "qbit": {
      return diagnoseQbitServer(server, state);
    }
    case "transmission": {
      const tasks = await fetchTransmissionTasks(server, state);
      return {
        ok: true,
        message: "Transmission RPC is reachable.",
        taskCount: tasks.length,
        warnings: state.lastFetchWarnings || []
      };
    }
    case "aria2": {
      const fields = ARIA2_TASK_FIELDS;
      const stoppedLimit = boundedInteger(server.stoppedTaskLimit ?? server.stoppedLimit, 300, 1, 5000);
      const version = await aria2Call(server, "aria2.getVersion", []);
      const stat = await aria2Call(server, "aria2.getGlobalStat", []);
      const recentStopped = await fetchRecentAria2StoppedTasks(server, fields, stoppedLimit);
      return {
        ok: true,
        message: "aria2 JSON-RPC is reachable.",
        version: version?.version || "",
        active: Number(stat?.numActive || 0),
        waiting: Number(stat?.numWaiting || 0),
        stopped: Number(stat?.numStopped || 0),
        stoppedTotal: Number(stat?.numStoppedTotal || 0),
        recentStoppedCount: recentStopped.length,
        recentStoppedSummary: summarizeAria2Stopped(recentStopped),
        warnings: state.lastFetchWarnings || []
      };
    }
    case "ytdlp":
    case "yt-dlp":
      return diagnoseYtDlpServer(server);
    default:
      throw new Error(`Unsupported server type: ${server.type}`);
  }
}

async function diagnoseQbitServer(server, sessionState) {
  const baseUrl = stripSlash(server.baseUrl);
  const login = await diagnoseQbitLogin(baseUrl, server);
  const info = await diagnoseQbitTorrentInfo(server, baseUrl, login.cookie);
  const warnings = [...(sessionState.lastFetchWarnings || [])];
  if (login.status >= 200 && login.status < 300 && !login.hasSIDCookie) {
    warnings.push("qBittorrent login returned no session cookie.");
  }
  if ((info.status === 401 || info.status === 403) && !login.hasSIDCookie) {
    warnings.push("Torrents API rejected the request without a session cookie.");
  }
  const ok = info.ok;
  return {
    ok,
    message: ok ? "qBittorrent API is reachable." : qbitDiagnosticMessage(login, info),
    loginStatus: login.status,
    loginAccepted: login.accepted,
    loginBody: login.body,
    hasSIDCookie: login.hasSIDCookie,
    setCookieNames: login.setCookieNames,
    torrentsInfoStatus: info.status,
    taskCount: info.taskCount,
    warnings
  };
}

async function fetchQbitTasks(server, sessionState, didRetryAuth = false) {
  const baseUrl = stripSlash(server.baseUrl);
  let cookie = sessionState.qbitCookie;
  if (!cookie && server.username && sessionState.qbitNoCookieAuth !== true) {
    cookie = await loginQbit(baseUrl, server, sessionState);
    if (cookie) {
      sessionState.qbitCookie = cookie;
    } else {
      sessionState.qbitNoCookieAuth = true;
    }
  }
  const response = await fetchWithTimeout(server, `${baseUrl}/api/v2/torrents/info`, {
    headers: cookie ? { Cookie: cookie } : {}
  }, "qBittorrent torrents info");
  if (response.status === 401 || response.status === 403) {
    const text = await response.text().catch(() => "");
    if (text.includes("Your IP address has been banned temporarily")) {
      sessionState.qbitLoginBlockedUntil = Date.now() + QBIT_LOGIN_COOLDOWN_MS;
      throw new Error("qBittorrent temporary IP ban is active.");
    }
    if (didRetryAuth) {
      throw new Error(`qBittorrent authentication failed (${response.status})`);
    }
    if (sessionState.qbitNoCookieAuth === true) {
      sessionState.qbitNoCookieAuth = false;
      throw new Error(`qBittorrent login returned no SID cookie and torrents API rejected unauthenticated access (${response.status}). Check Web UI authentication or reverse proxy Set-Cookie forwarding.`);
    }
    sessionState.qbitCookie = await loginQbit(baseUrl, server, sessionState);
    return fetchQbitTasks(server, sessionState, true);
  }
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`qBittorrent torrents info failed (${response.status})${responseTextSuffix(text)}`);
  }
  const torrents = await response.json();
  const stopSettings = await fetchQbitStopSettings(server, baseUrl, cookie).catch(() => ({}));
  return torrents.map((torrent) => {
    const progress = clamp(Number(torrent.progress || 0), 0, 1);
    const state = String(torrent.state || "");
    const normalizedState = state.toLowerCase();
    const failed = ERROR_STATUSES.has(state) || state.toLowerCase().includes("error");
    const completedBytes = Number(torrent.completed || 0);
    const totalBytes = Number(torrent.size || 0);
    const isStopped = normalizedState.includes("paused") || normalizedState.includes("stopped");
    return {
      id: torrent.hash,
      name: torrent.name || torrent.hash,
      status: failed ? "failed" : progress >= 1 || COMPLETE_STATUSES.has(state) ? "completed" : "running",
      progress,
      completedBytes,
      totalBytes,
      downloadSpeed: Number(torrent.dlspeed || 0),
      uploadSpeed: Number(torrent.upspeed || 0),
      isDownloading: !failed
        && progress < 1
        && (normalizedState.includes("downloading")
          || normalizedState.includes("forceddl")
          || normalizedState.includes("stalleddl")
          || normalizedState.includes("metadl")),
      isStopped,
      isComplete: progress >= 1 || Number(torrent.amount_left || 0) <= 0,
      rawStatus: state,
      errorMessage: failed ? state : "",
      stopNoticeCandidate: qbitStopNoticeCandidate(torrent, stopSettings)
    };
  });
}

async function fetchQbitStopSettings(server, baseUrl, cookie) {
  const response = await fetchWithTimeout(server, `${baseUrl}/api/v2/app/preferences`, {
    headers: cookie ? { Cookie: cookie } : {}
  }, "qBittorrent preferences");
  if (!response.ok) {
    return {};
  }
  return response.json();
}

async function diagnoseQbitLogin(baseUrl, server) {
  const params = new URLSearchParams();
  params.set("username", server.username || "");
  params.set("password", server.password || "");
  const response = await fetchWithTimeout(server, `${baseUrl}/api/v2/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params
  }, "qBittorrent login diagnostics");
  const body = await response.text().catch(() => "");
  const cookies = responseCookieHeaders(response);
  const cookieHeader = qbitCookieHeader(response);
  return {
    status: response.status,
    accepted: response.ok && !body.toLowerCase().includes("fails"),
    body: body.replace(/\s+/g, " ").trim().slice(0, 120),
    setCookieNames: cookieNames(cookies),
    cookie: cookieHeader,
    hasSIDCookie: Boolean(cookieHeader)
  };
}

async function diagnoseQbitTorrentInfo(server, baseUrl, cookie) {
  const response = await fetchWithTimeout(server, `${baseUrl}/api/v2/torrents/info`, {
    headers: cookie ? { Cookie: cookie } : {}
  }, "qBittorrent torrents info diagnostics");
  const text = response.ok ? "" : await response.text().catch(() => "");
  let taskCount = 0;
  if (response.ok) {
    const payload = await response.json();
    taskCount = Array.isArray(payload) ? payload.length : 0;
  }
  return {
    ok: response.ok,
    status: response.status,
    taskCount,
    body: text.replace(/\s+/g, " ").trim().slice(0, 120)
  };
}

function qbitDiagnosticMessage(login, info) {
  if (!login.accepted) {
    return `qBittorrent login was rejected (${login.status}). Check the username, password, and Web UI ban status.`;
  }
  if (!login.hasSIDCookie && (info.status === 401 || info.status === 403)) {
    return `qBittorrent login was accepted (${login.status}) but returned no session cookie, and torrents API rejected the request (${info.status}). Check Web UI authentication settings or reverse proxy Set-Cookie forwarding.`;
  }
  if (info.status === 401 || info.status === 403) {
    return `qBittorrent torrents API rejected the request (${info.status}). Check the session cookie, Web UI authentication, or reverse proxy headers.`;
  }
  return `qBittorrent torrents API failed (${info.status}).`;
}

async function loginQbit(baseUrl, server, sessionState) {
  if (sessionState.qbitLoginBlockedUntil && Date.now() < sessionState.qbitLoginBlockedUntil) {
    throw new Error("qBittorrent authentication is cooling down after a failed login.");
  }
  const params = new URLSearchParams();
  params.set("username", server.username || "");
  params.set("password", server.password || "");
  const response = await fetchWithTimeout(server, `${baseUrl}/api/v2/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params
  }, "qBittorrent login");
  const text = await response.text().catch(() => "");
  if (response.status !== 200 && response.status !== 204) {
    sessionState.qbitLoginBlockedUntil = Date.now() + QBIT_LOGIN_COOLDOWN_MS;
    if (text.includes("Your IP address has been banned temporarily")) {
      throw new Error("qBittorrent temporary IP ban is active.");
    }
    throw new Error(`qBittorrent login failed (${response.status})${responseTextSuffix(text)}`);
  }
  if (text.toLowerCase().includes("fails")) {
    sessionState.qbitLoginBlockedUntil = Date.now() + QBIT_LOGIN_COOLDOWN_MS;
    throw new Error("qBittorrent login rejected the configured username or password.");
  }
  const cookie = qbitCookieHeader(response);
  if (!cookie) {
    sessionState.qbitLoginBlockedUntil = 0;
    recordWarning(sessionState, "qBittorrent login returned no session cookie; trying torrents API without a cookie.");
    return "";
  }
  sessionState.qbitLoginBlockedUntil = 0;
  return cookie;
}

async function fetchTransmissionTasks(server, sessionState) {
  const body = {
    method: "torrent-get",
    arguments: {
      fields: [
        "id", "name", "status", "percentDone", "totalSize", "leftUntilDone",
        "rateDownload", "rateUpload", "error", "errorString", "doneDate",
        "activityDate", "uploadRatio", "seedRatioMode", "seedRatioLimit",
        "seedIdleMode", "seedIdleLimit"
      ]
    }
  };
  const response = await transmissionRequest(server, sessionState, body);
  const torrents = response.arguments?.torrents || [];
  const stopSettings = await transmissionStopSettings(server, sessionState).catch(() => ({}));
  return torrents.map((torrent) => {
    const failed = Number(torrent.error || 0) > 0;
    const progress = clamp(Number(torrent.percentDone || 0), 0, 1);
    const totalBytes = Number(torrent.totalSize || 0);
    const completedBytes = Math.max(totalBytes - Number(torrent.leftUntilDone || 0), 0);
    const rawStatus = Number(torrent.status || 0);
    const isStopped = rawStatus === 0;
    return {
      id: String(torrent.id),
      name: torrent.name || String(torrent.id),
      status: failed ? "failed" : progress >= 1 ? "completed" : "running",
      progress,
      completedBytes,
      totalBytes,
      downloadSpeed: Number(torrent.rateDownload || 0),
      uploadSpeed: Number(torrent.rateUpload || 0),
      isDownloading: !failed && progress < 1 && rawStatus === 4,
      isStopped,
      isComplete: Number(torrent.leftUntilDone || 0) <= 0,
      rawStatus: String(rawStatus),
      errorMessage: failed ? torrent.errorString || "Transmission error" : "",
      stopNoticeCandidate: transmissionStopNoticeCandidate(torrent, stopSettings)
    };
  });
}

async function transmissionStopSettings(server, sessionState) {
  const response = await transmissionRequest(server, sessionState, { method: "session-get", arguments: {} });
  return response.arguments || {};
}

async function transmissionRequest(server, sessionState, body) {
  const headers = { "Content-Type": "application/json" };
  if (sessionState.transmissionSessionId) {
    headers["X-Transmission-Session-Id"] = sessionState.transmissionSessionId;
  }
  if (server.username || server.password) {
    headers.Authorization = `Basic ${Buffer.from(`${server.username || ""}:${server.password || ""}`).toString("base64")}`;
  }
  const response = await fetchWithTimeout(server, server.baseUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  }, "Transmission RPC");
  if (response.status === 409) {
    sessionState.transmissionSessionId = response.headers.get("x-transmission-session-id");
    return transmissionRequest(server, sessionState, body);
  }
  if (!response.ok) {
    throw new Error(`Transmission failed (${response.status})`);
  }
  return response.json();
}

async function fetchAria2Tasks(server, sessionState = {}) {
  const fields = ARIA2_TASK_FIELDS;
  const stoppedLimit = boundedInteger(server.stoppedTaskLimit ?? server.stoppedLimit, 300, 1, 5000);
  const waitingLimit = boundedInteger(server.waitingTaskLimit ?? server.waitingLimit, 1000, 1, 5000);
  const activeResult = await settleAria2Step("tellActive", () => aria2Call(server, "aria2.tellActive", [fields]));
  const waitingResult = await settleAria2Step("tellWaiting", () => aria2Call(server, "aria2.tellWaiting", [0, waitingLimit, fields]));
  const stoppedResult = await settleAria2Step("tellStopped", () => fetchRecentAria2StoppedSnapshot(server, fields, stoppedLimit));
  const globalOptionsResult = await settleAria2Step("getGlobalOption", () => aria2Call(server, "aria2.getGlobalOption", []));
  const active = activeResult.value || [];
  const waiting = waitingResult.value || [];
  const stoppedSnapshot = stoppedResult.value || {};
  const stopped = stoppedSnapshot.tasks || [];
  const failures = [activeResult, waitingResult, stoppedResult]
    .filter((result) => !result.ok)
    .map((result) => `${result.label}: ${result.message}`);
  if (failures.length) {
    sessionState.lastFetchWarnings = failures;
  }
  const stoppedSummary = summarizeAria2Stopped(stopped);
  if (stoppedSummary && stoppedSummary !== sessionState.lastAria2StoppedSummary) {
    sessionState.lastAria2StoppedSummary = stoppedSummary;
    recordWarning(sessionState, `aria2 recent stopped: ${stoppedSummary}`);
  }
  recordAria2StoppedCounterWarning(sessionState, stoppedSnapshot.stoppedTotal, stopped.length);
  if (failures.length === 3) {
    throw new Error(`aria2 monitor failed: ${failures.join("; ")}`);
  }
  const globalOptions = globalOptionsResult.ok ? globalOptionsResult.value || {} : {};
  if (!globalOptionsResult.ok) {
    recordWarning(sessionState, `aria2 getGlobalOption: ${globalOptionsResult.message}`);
  }
  return [...active, ...waiting, ...stopped].map((item) => normalizeAria2Task(item, "", globalOptions));
}

export async function fetchAria2TaskByGid(server, gid, fallbackStatus = "") {
  const item = await aria2Call(server, "aria2.tellStatus", [gid, ARIA2_TASK_FIELDS]);
  const globalOptions = await aria2Call(server, "aria2.getGlobalOption", []).catch(() => ({}));
  return normalizeAria2Task(item, fallbackStatus, globalOptions);
}

export function fallbackAria2EventTask(gid, method) {
  const failed = method === "aria2.onDownloadError";
  return {
    id: gid,
    name: gid,
    status: failed ? "failed" : "completed",
    progress: failed ? 0 : 1,
    errorMessage: failed ? "aria2 download error" : "",
    notificationBaseline: false
  };
}

async function fetchRecentAria2StoppedTasks(server, fields, limit) {
  const snapshot = await fetchRecentAria2StoppedSnapshot(server, fields, limit);
  return snapshot.tasks;
}

async function fetchRecentAria2StoppedSnapshot(server, fields, limit) {
  const total = await fetchAria2StoppedTotal(server).catch(() => null);
  const initialLimit = Number.isFinite(total) && total > 0 ? Math.min(limit, total) : limit;
  let lastError;
  for (const queryCount of stoppedQueryLimits(initialLimit)) {
    try {
      const tasks = await aria2Call(server, "aria2.tellStopped", [-queryCount, queryCount, fields]);
      return { tasks, stoppedTotal: total };
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(`aria2 stopped task query failed: ${lastError?.message || lastError || "unknown error"}`);
}

async function fetchAria2StoppedTotal(server) {
  const stat = await aria2Call(server, "aria2.getGlobalStat", []);
  return boundedInteger(stat?.numStoppedTotal, 0, 0, 1_000_000);
}

function normalizeAria2Task(item, fallbackStatus = "", globalOptions = {}) {
  const total = Number(item?.totalLength || 0);
  const completed = Number(item?.completedLength || 0);
  const progress = total > 0 ? clamp(completed / total, 0, 1) : fallbackStatus === "completed" ? 1 : 0;
  const name = item?.files?.[0]?.path?.split("/").filter(Boolean).pop() || item?.gid;
  const status = fallbackStatus || (item?.status === "complete" ? "completed" : item?.status === "error" ? "failed" : "running");
  const rawStatus = String(item?.status || fallbackStatus || "");
  const uploaded = Number(item?.uploadLength || 0);
  return {
    id: item?.gid,
    name: name || item?.gid,
    status,
    progress,
    completedBytes: completed,
    totalBytes: total,
    downloadSpeed: Number(item?.downloadSpeed || 0),
    isDownloading: status === "running" && rawStatus === "active" && progress < 1,
    isStopped: rawStatus === "paused" || rawStatus === "removed",
    isComplete: progress >= 1 || rawStatus === "complete",
    rawStatus,
    errorMessage: item?.errorMessage || "",
    stopNoticeCandidate: aria2StopNoticeCandidate(item, globalOptions),
    notificationBaseline: item?.notificationBaseline === true
  };
}

function qbitStopNoticeCandidate(torrent, stopSettings = {}) {
  const progress = clamp(Number(torrent?.progress || 0), 0, 1);
  const isComplete = progress >= 1 || Number(torrent?.amount_left || 0) <= 0;
  if (!isComplete) {
    return null;
  }
  const ratio = Math.max(Number(torrent?.ratio || 0), 0);
  const ratioLimit = qbitRatioLimit(torrent, stopSettings);
  if (ratioLimit > 0 && ratio >= ratioLimit) {
    const notice = recentAutomaticStopNotice("share_ratio", formatRatio(ratioLimit), torrent?.last_activity);
    if (notice) return notice;
  }
  const idleLimit = qbitInactiveSeedingLimitMinutes(torrent, stopSettings);
  if (idleLimit > 0) {
    const notice = idleAutomaticStopNotice("seeding_idle", String(idleLimit), torrent?.last_activity, idleLimit);
    if (notice) return notice;
  }
  return null;
}

function qbitRatioLimit(torrent, stopSettings = {}) {
  const torrentLimit = Number(torrent?.ratio_limit ?? 0);
  if (torrentLimit > 0) return torrentLimit;
  if (torrentLimit < 0 && truthy(stopSettings.max_ratio_enabled)) {
    const globalLimit = Number(stopSettings.max_ratio || 0);
    if (globalLimit > 0) return globalLimit;
  }
  return 0;
}

function qbitInactiveSeedingLimitMinutes(torrent, stopSettings = {}) {
  const torrentLimit = Number(torrent?.inactive_seeding_time_limit ?? 0);
  if (torrentLimit > 0) return Math.round(torrentLimit);
  if (torrentLimit < 0 && truthy(stopSettings.max_inactive_seeding_time_enabled)) {
    const globalLimit = Number(stopSettings.max_inactive_seeding_time || 0);
    if (globalLimit > 0) return Math.round(globalLimit);
  }
  return 0;
}

function transmissionStopNoticeCandidate(torrent, stopSettings = {}) {
  const left = Number(torrent?.leftUntilDone || 0);
  const isComplete = left <= 0;
  if (!isComplete) {
    return null;
  }
  const ratio = Math.max(Number(torrent?.uploadRatio || 0), 0);
  const ratioLimit = transmissionRatioLimit(torrent, stopSettings);
  if (ratioLimit > 0 && ratio >= ratioLimit) {
    const notice = recentAutomaticStopNotice("share_ratio", formatRatio(ratioLimit), torrent?.activityDate);
    if (notice) return notice;
  }
  const idleLimit = transmissionIdleLimitMinutes(torrent, stopSettings);
  if (idleLimit > 0) {
    const notice = idleAutomaticStopNotice("seeding_idle", String(idleLimit), torrent?.activityDate, idleLimit);
    if (notice) return notice;
  }
  return null;
}

function transmissionRatioLimit(torrent, stopSettings = {}) {
  const mode = Number(torrent?.seedRatioMode ?? -1);
  if (mode === 1) {
    const limit = Number(torrent?.seedRatioLimit || 0);
    return limit > 0 ? limit : 0;
  }
  if (mode === 0 && truthy(stopSettings.seedRatioLimited)) {
    const limit = Number(stopSettings.seedRatioLimit || 0);
    return limit > 0 ? limit : 0;
  }
  return 0;
}

function transmissionIdleLimitMinutes(torrent, stopSettings = {}) {
  const mode = Number(torrent?.seedIdleMode ?? -1);
  if (mode === 1) {
    const limit = Number(torrent?.seedIdleLimit || 0);
    return limit > 0 ? Math.round(limit) : 0;
  }
  if (mode === 0 && truthy(stopSettings["idle-seeding-limit-enabled"])) {
    const limit = Number(stopSettings["idle-seeding-limit"] || 0);
    return limit > 0 ? Math.round(limit) : 0;
  }
  return 0;
}

function aria2StopNoticeCandidate(item, globalOptions = {}) {
  const rawStatus = String(item?.status || "").toLowerCase();
  const completed = Number(item?.completedLength || 0);
  const total = Number(item?.totalLength || 0);
  const uploaded = Number(item?.uploadLength || 0);
  const ratioLimit = Number(item?.stopSeedingRatio ?? globalOptions["seed-ratio"] ?? 0);
  if (ratioLimit > 0 && completed > 0 && uploaded / completed >= ratioLimit) {
    return stopNotice("share_ratio", formatRatio(ratioLimit));
  }
  const idleSeconds = Number(item?.stopIncompleteIdleSeconds ?? globalOptions["bt-stop-timeout"] ?? 0);
  if (idleSeconds > 0 && total > completed && (rawStatus === "paused" || rawStatus === "removed")) {
    return stopNotice("download_idle", String(Math.max(Math.round(idleSeconds / 60), 1)));
  }
  return null;
}

function stopNotice(kind, value, metadata = {}) {
  return {
    kind,
    value: String(value || ""),
    triggeredAt: metadata.triggeredAt || "",
    freshUntil: metadata.freshUntil || ""
  };
}

function idleAutomaticStopNotice(kind, value, lastActivityUnixSeconds, limitMinutes) {
  const timestamp = Number(lastActivityUnixSeconds || 0);
  const limitMs = Number(limitMinutes || 0) * 60 * 1000;
  if (!timestamp || limitMs <= 0) {
    return null;
  }
  const triggeredAtMs = timestamp * 1000 + limitMs;
  const freshUntilMs = triggeredAtMs + automaticStopFreshnessMs(limitMs);
  const now = Date.now();
  if (now < triggeredAtMs || now > freshUntilMs) {
    return null;
  }
  return stopNotice(kind, value, {
    triggeredAt: new Date(triggeredAtMs).toISOString(),
    freshUntil: new Date(freshUntilMs).toISOString()
  });
}

function recentAutomaticStopNotice(kind, value, lastActivityUnixSeconds) {
  const timestamp = Number(lastActivityUnixSeconds || 0);
  if (!timestamp) {
    return null;
  }
  const triggeredAtMs = timestamp * 1000;
  const freshUntilMs = triggeredAtMs + automaticStopFreshnessMs();
  const now = Date.now();
  if (now < triggeredAtMs || now > freshUntilMs) {
    return null;
  }
  return stopNotice(kind, value, {
    triggeredAt: new Date(triggeredAtMs).toISOString(),
    freshUntil: new Date(freshUntilMs).toISOString()
  });
}

function automaticStopFreshnessMs(limitMs = 0) {
  const value = Number(limitMs || 0);
  if (!Number.isFinite(value) || value <= 0) {
    return 10 * 60 * 1000;
  }
  return Math.min(Math.max(value * 0.25, 2 * 60 * 1000), 10 * 60 * 1000);
}

function stoppedAfterIdleUnixSeconds(value, limitMinutes) {
  const timestamp = Number(value || 0);
  if (!timestamp || limitMinutes <= 0) {
    return false;
  }
  const limitMs = limitMinutes * 60 * 1000;
  const elapsed = Date.now() - timestamp * 1000;
  return elapsed >= limitMs && elapsed <= limitMs + automaticStopFreshnessMs(limitMs);
}

function formatRatio(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number.toFixed(2) : String(value || "");
}

function truthy(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  return ["1", "true", "yes", "on", "enabled"].includes(String(value || "").trim().toLowerCase());
}

async function aria2Call(server, method, params) {
  const requestParams = server.token ? [`token:${server.token}`, ...params] : params;
  const response = await fetchWithTimeout(server, server.baseUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Connection": "close" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Date.now().toString(),
      method,
      params: requestParams
    })
  }, `aria2 ${method}`);
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`aria2 ${method} failed (${response.status})${responseTextSuffix(text)}`);
  }
  const payload = await response.json();
  if (payload.error) {
    const code = payload.error.code !== undefined ? ` ${payload.error.code}` : "";
    throw new Error(`aria2 ${method} error${code}: ${payload.error.message || "aria2 error"}`);
  }
  return payload.result || [];
}

async function fetchWithTimeout(server, url, options, label) {
  const timeoutMs = boundedInteger(server.requestTimeoutMs ?? server.timeoutMs, DEFAULT_REQUEST_TIMEOUT_MS, 1000, 120_000);
  const retries = boundedInteger(server.requestRetries, 1, 0, 3);
  const useNodeRequest = shouldAllowInvalidTLS(server) && isHTTPSURL(url);
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      if (useNodeRequest) {
        return await requestWithNodeHTTP(url, options, timeoutMs, true);
      }
      return await fetch(url, { ...options, signal: controller.signal });
    } catch (error) {
      lastError = error;
      if (attempt >= retries) {
        if (error?.name === "AbortError") {
          throw new Error(`${label} timed out after ${timeoutMs}ms`);
        }
        throw new Error(`${label} request failed: ${networkErrorMessage(error)}${connectionHint(label, error)}`);
      }
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error(`${label} request failed: ${networkErrorMessage(lastError)}`);
}

function stripSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(value, min), max);
}

function boundedInteger(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(Math.max(Math.trunc(parsed), min), max);
}

function stoppedQueryLimits(limit) {
  const maxLimit = Math.max(Math.trunc(limit), 0);
  const values = [maxLimit, 300, 100, 30, 10, 1].filter((value) => value > 0 && value <= maxLimit);
  return [...new Set(values)];
}

async function settleAria2Step(label, operation) {
  try {
    return { ok: true, label, value: await operation() };
  } catch (error) {
    return { ok: false, label, message: error.message || String(error) };
  }
}

function recordWarning(sessionState, message) {
  if (!Array.isArray(sessionState.lastFetchWarnings)) {
    sessionState.lastFetchWarnings = [];
  }
  sessionState.lastFetchWarnings.push(message);
}

function recordAria2StoppedCounterWarning(sessionState, stoppedTotal, stoppedCount) {
  if (!Number.isFinite(stoppedTotal)) {
    return;
  }
  const previous = sessionState.lastAria2StoppedTotal;
  sessionState.lastAria2StoppedTotal = stoppedTotal;
  if (!Number.isFinite(previous) || stoppedTotal <= previous || stoppedCount > 0) {
    return;
  }
  const delta = stoppedTotal - previous;
  recordWarning(sessionState, `aria2 stopped counter increased by ${delta}, but tellStopped returned no task details. Increase aria2 max-download-result so fast completed tasks can be notified.`);
}

function responseTextSuffix(text) {
  const value = String(text || "").replace(/\s+/g, " ").trim();
  return value ? `: ${value.slice(0, 180)}` : "";
}

function networkErrorMessage(error) {
  const parts = [
    error?.message,
    error?.cause?.code,
    error?.cause?.message
  ].filter(Boolean);
  return parts.length ? [...new Set(parts)].join(" / ") : "unknown network error";
}

function connectionHint(label, error) {
  const code = String(error?.cause?.code || "");
  if (label.toLowerCase().includes("aria2") && isTLSErrorCode(code)) {
    return ". The TLS certificate does not match the host. Use the certificate hostname in baseUrl, or set allowInvalidTLS to true for this local aria2 server.";
  }
  if (!label.toLowerCase().includes("aria2") || code !== "UND_ERR_SOCKET") {
    return "";
  }
  return ". The connection was closed before JSON-RPC replied; verify baseUrl points to aria2 HTTP JSON-RPC, usually http://127.0.0.1:6800/jsonrpc, and not to a Web UI, WebSocket-only endpoint, or TLS endpoint using http://.";
}

function isTLSErrorCode(code) {
  return new Set([
    "DEPTH_ZERO_SELF_SIGNED_CERT",
    "ERR_TLS_CERT_ALTNAME_INVALID",
    "SELF_SIGNED_CERT_IN_CHAIN",
    "UNABLE_TO_GET_ISSUER_CERT",
    "UNABLE_TO_VERIFY_LEAF_SIGNATURE"
  ]).has(code);
}

function shouldAllowInvalidTLS(server) {
  return server.allowInvalidTLS === true
    || server.allowSelfSignedTLS === true
    || server.tlsRejectUnauthorized === false
    || server.rejectUnauthorized === false;
}

function isHTTPSURL(value) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function requestWithNodeHTTP(url, options, timeoutMs, allowInvalidTLS) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const transport = parsed.protocol === "https:" ? https : http;
    const body = requestBody(options?.body);
    const requestOptions = {
      method: options?.method || "GET",
      headers: requestHeaders(options?.headers, body),
      rejectUnauthorized: allowInvalidTLS ? false : undefined
    };
    const request = transport.request(parsed, requestOptions, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => {
        const body = Buffer.concat(chunks);
        resolve({
          status: response.statusCode || 0,
          ok: response.statusCode >= 200 && response.statusCode < 300,
          headers: {
            get(name) {
              const value = response.headers[String(name || "").toLowerCase()];
              return Array.isArray(value) ? value.join("; ") : value || "";
            }
          },
          async text() {
            return body.toString("utf8");
          },
          async json() {
            return JSON.parse(body.toString("utf8") || "null");
          }
        });
      });
    });
    request.setTimeout(timeoutMs, () => {
      request.destroy(new Error(`request timed out after ${timeoutMs}ms`));
    });
    request.on("error", reject);
    if (body !== undefined) {
      request.write(body);
    }
    request.end();
  });
}

function requestBody(body) {
  if (body === undefined || body === null) return undefined;
  if (Buffer.isBuffer(body)) return body;
  if (typeof body === "string") return Buffer.from(body);
  if (body instanceof URLSearchParams) return Buffer.from(body.toString());
  return Buffer.from(String(body));
}

function requestHeaders(headers, body) {
  const next = { ...(headers || {}) };
  if (body !== undefined && !hasHeader(next, "content-length")) {
    next["Content-Length"] = String(body.length);
  }
  return next;
}

function hasHeader(headers, name) {
  const target = String(name || "").toLowerCase();
  return Object.keys(headers || {}).some((key) => key.toLowerCase() === target);
}

function qbitCookieHeader(response) {
  const cookies = responseCookieHeaders(response)
    .map((value) => String(value || "").split(";")[0].trim())
    .filter((value) => {
      const name = value.split("=", 1)[0]?.trim() || "";
      return name && value.includes("=");
    });
  if (!cookies.length) {
    return "";
  }
  const preferred = cookies.filter((value) => isQbitSessionCookieName(value.split("=", 1)[0]));
  const ordered = preferred.length ? [...preferred, ...cookies.filter((value) => !preferred.includes(value))] : cookies;
  return [...new Set(ordered)].join("; ");
}

function isQbitSessionCookieName(value) {
  const name = String(value || "").trim();
  return /^SID$/i.test(name) || /^QBT_SID(?:_\d+)?$/i.test(name) || /qbt/i.test(name);
}

function responseCookieHeaders(response) {
  if (typeof response.headers?.getSetCookie === "function") {
    return response.headers.getSetCookie();
  }
  const value = response.headers?.get("set-cookie") || "";
  return splitSetCookieHeader(value);
}

function splitSetCookieHeader(value) {
  const text = String(value || "").trim();
  if (!text) return [];
  const parts = [];
  let start = 0;
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] !== ",") continue;
    const rest = text.slice(index + 1);
    if (/^\s*[A-Za-z0-9_-]+=/.test(rest)) {
      parts.push(text.slice(start, index).trim());
      start = index + 1;
    }
  }
  parts.push(text.slice(start).trim());
  return parts.filter(Boolean);
}

function cookieNames(cookies) {
  return cookies
    .map((cookie) => String(cookie || "").split("=", 1)[0].trim())
    .filter(Boolean);
}

function summarizeAria2Stopped(tasks) {
  if (!Array.isArray(tasks) || tasks.length === 0) {
    return "";
  }
  const counts = tasks.reduce((result, task) => {
    const status = String(task?.status || "unknown");
    result[status] = (result[status] || 0) + 1;
    return result;
  }, {});
  const countSummary = Object.entries(counts)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([status, count]) => `${status}=${count}`)
    .join(", ");
  const sample = tasks.slice(-5).map((task) => {
    const status = String(task?.status || "unknown");
    const name = task?.files?.[0]?.path?.split("/").filter(Boolean).pop() || task?.gid || "unknown";
    return `${task?.gid || "unknown"}:${status}:${name}`;
  }).join(" | ");
  return `${tasks.length} task(s), ${countSummary}, sample=${sample}`;
}
