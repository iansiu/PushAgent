import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { AGENT_REPOSITORY_URL, AGENT_UPDATE_CHECK_URL } from "./version.mjs";

const DEFAULT_CONFIG_PATH = path.resolve(process.cwd(), "config.json");
const DEFAULT_YTDLP_OUTPUT_TEMPLATE = "%(title).80B.%(ext)s";
const DEFAULT_YTDLP_FORMAT = "bv*+ba/b";
const LEGACY_YTDLP_OUTPUT_TEMPLATES = new Set([
  "%(title).80B [%(id)s].%(ext)s"
]);
const DEFAULT_RELAY_URLS = [
  "https://push.qiuyu.org",
  "https://push1.qiuyu.org"
];

export function loadConfig() {
  const configPath = path.resolve(process.env.QIUYU_AGENT_CONFIG || DEFAULT_CONFIG_PATH);
  const configExists = fs.existsSync(configPath);
  const fileConfig = readJSON(configPath);
  const dataDir = path.resolve(process.env.QIUYU_AGENT_DATA_DIR || fileConfig.dataDir || "./data");
  const config = {
    configPath,
    configExists,
    cwd: process.cwd(),
    host: process.env.QIUYU_AGENT_HOST || fileConfig.host || "127.0.0.1",
    port: number(process.env.QIUYU_AGENT_PORT ?? fileConfig.port, 8765),
    apiKey: process.env.QIUYU_AGENT_API_KEY || fileConfig.apiKey || "",
    pairingCodes: pairingCodes({
      envCode: process.env.QIUYU_AGENT_PAIRING_CODE,
      envCodes: process.env.QIUYU_AGENT_PAIRING_CODES,
      configCode: fileConfig.pairingCode,
      configCodes: fileConfig.pairingCodes
    }),
    agentName: process.env.QIUYU_AGENT_NAME || fileConfig.agentName || "QiuyuRemote Agent",
    dataDir,
    relay: {
      urls: relayURLs({
        envURL: process.env.QIUYU_RELAY_URL,
        envURLs: process.env.QIUYU_RELAY_URLS,
        configURL: fileConfig.relay?.url,
        configURLs: fileConfig.relay?.urls
      }),
      agentId: process.env.QIUYU_RELAY_AGENT_ID || fileConfig.relay?.agentId || "",
      secret: process.env.QIUYU_RELAY_SECRET || fileConfig.relay?.secret || ""
    },
    monitor: {
      pollIntervalSeconds: number(
        process.env.QIUYU_AGENT_POLL_INTERVAL_SECONDS ?? fileConfig.monitor?.pollIntervalSeconds,
        30
      ),
      serviceStatusNoticeEnabled: boolean(
        process.env.QIUYU_AGENT_SERVICE_STATUS_NOTICE_ENABLED ?? fileConfig.monitor?.serviceStatusNoticeEnabled,
        true
      ),
      inactiveDownloadNoticeEnabled: boolean(
        process.env.QIUYU_AGENT_INACTIVE_DOWNLOAD_NOTICE_ENABLED ?? fileConfig.monitor?.inactiveDownloadNoticeEnabled,
        true
      ),
      inactiveDownloadNoticeSeconds: number(
        process.env.QIUYU_AGENT_INACTIVE_DOWNLOAD_NOTICE_SECONDS ?? fileConfig.monitor?.inactiveDownloadNoticeSeconds,
        30 * 60
      )
    },
    updateCheck: {
      enabled: boolean(
        process.env.QIUYU_AGENT_UPDATE_CHECK_ENABLED ?? fileConfig.updateCheck?.enabled,
        true
      ),
      url: process.env.QIUYU_AGENT_UPDATE_CHECK_URL || fileConfig.updateCheck?.url || AGENT_UPDATE_CHECK_URL,
      repositoryURL: process.env.QIUYU_AGENT_REPOSITORY_URL || fileConfig.updateCheck?.repositoryURL || AGENT_REPOSITORY_URL,
      intervalSeconds: number(
        process.env.QIUYU_AGENT_UPDATE_CHECK_INTERVAL_SECONDS ?? fileConfig.updateCheck?.intervalSeconds,
        3600
      ),
      timeoutSeconds: number(
        process.env.QIUYU_AGENT_UPDATE_CHECK_TIMEOUT_SECONDS ?? fileConfig.updateCheck?.timeoutSeconds,
        4
      )
    },
    servers: normalizeServers(fileConfig.servers, dataDir)
  };
  validateConfig(config);
  return config;
}

function normalizeServers(value, dataDir) {
  if (!Array.isArray(value)) {
    return [];
  }
  const enabledServers = value
    .filter((server) => server && typeof server === "object")
    .filter((server) => serverIsEnabled(server.enabled));
  const ytdlpTotal = enabledServers.filter((server) => canonicalServerType(server.type) === "ytdlp").length;
  const usedYtDlpSlots = new Set();
  let ytdlpIndex = 0;
  return enabledServers.map((server) => {
      const type = canonicalServerType(server.type);
      const ytdlpSlot = type === "ytdlp"
        ? uniqueYtDlpStorageSlot(ytdlpStorageSlot(server, ytdlpTotal, ytdlpIndex++), usedYtDlpSlots)
        : "";
      const normalized = {
        ...server,
        id: internalServerId({
          ...server,
          type,
          identityKey: type === "ytdlp" ? ytdlpIdentityKey(server, ytdlpSlot) : ""
        }),
        type,
        name: String(server.name || defaultServerName(type)).trim(),
        enabled: true
      };
      if (type === "ytdlp") {
        const legacyId = internalServerId({
          ...server,
          type,
          identityKey: legacyYtdlpIdentityKey(server, dataDir)
        });
        normalized.binaryPath = String(server.binaryPath || "yt-dlp").trim() || "yt-dlp";
        normalized.ffmpegPath = String(server.ffmpegPath || "ffmpeg").trim() || "ffmpeg";
        normalized.downloadDir = path.resolve(server.downloadDir || path.join(dataDir, "yt-dlp-downloads"));
        normalized.storageKey = ytdlpSlot;
        normalized.statePath = path.resolve(server.statePath || path.join(dataDir, "yt-dlp-tasks", `${ytdlpSlot}.json`));
        normalized.legacyStatePaths = uniqueResolvedPaths([
          path.join(dataDir, `yt-dlp-${legacyId}.json`),
          path.join(normalized.downloadDir, ".qiuyu-ytdlp-tasks.json")
        ]).filter((item) => item !== normalized.statePath);
        normalized.cookiesPath = server.cookiesPath ? path.resolve(server.cookiesPath) : "";
        normalized.cookiesDir = path.resolve(server.cookiesDir || path.join(dataDir, "ytdlp-cookies", ytdlpSlot));
        normalized.legacyCookiesDirs = uniqueResolvedPaths([
          path.join(dataDir, "ytdlp-cookies", legacyId),
          path.join(normalized.downloadDir, ".qiuyu-ytdlp-cookies")
        ]).filter((item) => item !== normalized.cookiesDir);
        normalized.format = String(server.format || DEFAULT_YTDLP_FORMAT).trim();
        normalized.proxy = String(server.proxy || "").trim();
        normalized.requireCookiesForYoutube = boolean(server.requireCookiesForYoutube, false);
        normalized.outputTemplate = normalizeYtDlpOutputTemplate(server.outputTemplate);
        normalized.cleanHashtags = boolean(server.cleanHashtags, true);
        normalized.maxConcurrent = boundedInteger(server.maxConcurrent, 10, 1, 10);
        normalized.historyLimit = boundedInteger(server.historyLimit, 1000, 20, 5000);
        normalized.noPlaylist = boolean(server.noPlaylist, true);
        normalized.restrictFilenames = boolean(server.restrictFilenames, false);
        normalized.extraArgs = stringArray(server.extraArgs);
      }
      return normalized;
    });
}

function serverIsEnabled(value) {
  if (value === undefined || value === null || value === "") {
    return true;
  }
  if (typeof value === "boolean") {
    return value;
  }
  const normalized = String(value).trim().toLowerCase();
  if (["0", "false", "no", "n", "off", "disabled"].includes(normalized)) {
    return false;
  }
  return true;
}

function normalizeServerType(value) {
  return String(value || "server").trim().toLowerCase() || "server";
}

function canonicalServerType(value) {
  const type = normalizeServerType(value);
  return type === "yt-dlp" ? "ytdlp" : type;
}

function defaultServerName(type) {
  switch (type) {
    case "qbit":
      return "qBittorrent";
    case "transmission":
      return "Transmission";
    case "aria2":
      return "aria2";
    case "ytdlp":
    case "yt-dlp":
      return "yt-dlp";
    default:
      return type || "Download Service";
  }
}

function ytdlpIdentityKey(server, storageSlot) {
  const explicit = String(server.identityKey || server.id || "").trim();
  if (explicit) return explicit;
  return `storage:${storageSlot}`;
}

function legacyYtdlpIdentityKey(server, dataDir) {
  const binaryPath = String(server.binaryPath || "yt-dlp").trim() || "yt-dlp";
  const downloadDir = path.resolve(server.downloadDir || path.join(dataDir, "yt-dlp-downloads"));
  return `${binaryPath}:${downloadDir}`;
}

function ytdlpStorageSlot(server, total, index) {
  const explicit = String(server.storageKey || server.historyKey || server.id || server.identityKey || "").trim();
  if (explicit) return safePathSegment(explicit);
  if (total <= 1) return "default";
  const name = String(server.name || "").trim();
  return safePathSegment(name || `server-${index + 1}`);
}

function uniqueYtDlpStorageSlot(value, usedSlots) {
  const base = value || "default";
  let slot = base;
  let suffix = 2;
  while (usedSlots.has(slot)) {
    slot = `${base}-${suffix++}`;
  }
  usedSlots.add(slot);
  return slot;
}

function safePathSegment(value) {
  const raw = String(value || "").trim();
  const ascii = raw
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  if (ascii) return ascii;
  return crypto.createHash("sha1").update(raw || "default").digest("hex").slice(0, 10);
}

function uniqueResolvedPaths(values) {
  const seen = new Set();
  const result = [];
  for (const value of values) {
    const resolved = path.resolve(String(value || "").trim());
    if (!resolved || seen.has(resolved)) continue;
    seen.add(resolved);
    result.push(resolved);
  }
  return result;
}

function normalizeYtDlpOutputTemplate(value) {
  const template = String(value || DEFAULT_YTDLP_OUTPUT_TEMPLATE).trim();
  if (!template || LEGACY_YTDLP_OUTPUT_TEMPLATES.has(template)) {
    return DEFAULT_YTDLP_OUTPUT_TEMPLATE;
  }
  return template;
}

function boundedInteger(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.round(parsed), min), max);
}

function stringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => String(item ?? "").trim())
    .filter(Boolean);
}

function internalServerId(server) {
  const type = normalizeServerType(server.type);
  const baseUrl = normalizeServerBaseURL(server.baseUrl);
  const identityKey = String(server.identityKey || "").trim().toLowerCase();
  const source = `${type}:${baseUrl || identityKey || String(server.name || "").trim().toLowerCase()}`;
  const hash = crypto.createHash("sha1").update(source).digest("hex").slice(0, 10);
  return `${type}-${hash}`;
}

function normalizeServerBaseURL(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }
  try {
    const url = new URL(raw);
    url.hash = "";
    url.search = "";
    url.hostname = url.hostname.toLowerCase();
    url.pathname = url.pathname.replace(/\/+$/, "");
    return url.toString().replace(/\/+$/, "");
  } catch {
    return raw.replace(/\/+$/, "").toLowerCase();
  }
}

function readJSON(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function number(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function boolean(value, fallback) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  if (typeof value === "boolean") {
    return value;
  }
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "y", "on", "enabled"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "n", "off", "disabled"].includes(normalized)) {
    return false;
  }
  return fallback;
}

function validateConfig(config) {
  if (!config.relay.urls.length) {
    throw new Error("Missing Relay URL.");
  }
  if ((config.relay.agentId && !config.relay.secret) || (!config.relay.agentId && config.relay.secret)) {
    throw new Error("Static Relay credentials must include both relay.agentId and relay.secret.");
  }
  const ids = new Set();
  for (const server of config.servers) {
    if (ids.has(server.id)) {
      throw new Error(`Duplicate download service config: ${server.type} ${server.baseUrl || ""}`);
    }
    ids.add(server.id);
  }
}

function relayURLs({ envURL, envURLs, configURL, configURLs }) {
  const values = [
    ...splitURLs(envURLs),
    ...splitURLs(envURL),
    ...(Array.isArray(configURLs) ? configURLs : []),
    ...splitURLs(configURL)
  ];
  const seen = new Set();
  const normalized = values
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .filter((value) => {
      const key = value.toLowerCase().replace(/\/+$/, "");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  return normalized.length ? normalized : DEFAULT_RELAY_URLS;
}

function splitURLs(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function pairingCodes({ envCode, envCodes, configCode, configCodes }) {
  const values = [
    ...splitPairingCodes(envCodes),
    ...splitPairingCodes(envCode),
    ...(Array.isArray(configCodes) ? configCodes : []),
    ...splitPairingCodes(configCode)
  ];
  const seen = new Set();
  return values
    .map(normalizePairingCode)
    .filter(Boolean)
    .filter((code) => {
      if (seen.has(code)) return false;
      seen.add(code);
      return true;
    });
}

function splitPairingCodes(value) {
  if (Array.isArray(value)) return value;
  return String(value || "")
    .split(/[,\s;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizePairingCode(value) {
  const input = String(value || "").trim().toUpperCase();
  if (!input) return "";
  const compact = input.replace(/[^0-9A-Z]/g, "");
  if (compact.length === 8) {
    return `${compact.slice(0, 4)}-${compact.slice(4)}`;
  }
  return input;
}
