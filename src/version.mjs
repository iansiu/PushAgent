import fs from "node:fs";
import http from "node:http";
import https from "node:https";

export const AGENT_REPOSITORY_URL = "https://github.com/iansiu/PushAgent";
export const AGENT_UPDATE_CHECK_URL = "https://raw.githubusercontent.com/iansiu/PushAgent/main/package.json";

const PACKAGE_JSON = readPackageJSON();
export const APP_NAME = "QiuyuRemote Push Agent";
export const APP_VERSION = String(PACKAGE_JSON.version || "0.0.0");

const updateCache = new Map();

export function publicAppInfo(updateCheck = {}) {
  return {
    name: APP_NAME,
    version: APP_VERSION,
    repositoryURL: updateCheck.repositoryURL || AGENT_REPOSITORY_URL,
    updateCheck: {
      enabled: updateCheck.enabled !== false,
      url: updateCheck.url || AGENT_UPDATE_CHECK_URL
    }
  };
}

export async function checkForUpdate(updateCheck = {}) {
  const settings = normalizeUpdateCheck(updateCheck);
  const base = {
    ok: true,
    enabled: settings.enabled,
    name: APP_NAME,
    currentVersion: APP_VERSION,
    latestVersion: "",
    updateAvailable: false,
    repositoryURL: settings.repositoryURL,
    sourceURL: settings.url,
    checkedAt: new Date().toISOString(),
    message: ""
  };
  if (!settings.enabled || !settings.url) {
    return {
      ...base,
      enabled: false,
      message: "Update check is disabled."
    };
  }

  const cacheKey = `${settings.url}:${APP_VERSION}`;
  const cached = updateCache.get(cacheKey);
  const now = Date.now();
  if (cached && now - cached.cachedAt <= settings.intervalSeconds * 1000) {
    return { ...cached.result, cached: true };
  }

  try {
    const text = await fetchText(settings.url, {
      timeoutMs: settings.timeoutSeconds * 1000,
      maxBytes: 256 * 1024
    });
    const latestVersion = extractVersion(text);
    if (!latestVersion) {
      throw new Error("Update metadata does not include a version.");
    }
    const result = {
      ...base,
      latestVersion,
      updateAvailable: compareVersions(latestVersion, APP_VERSION) > 0,
      message: compareVersions(latestVersion, APP_VERSION) > 0
        ? "A newer Push Agent version is available."
        : "Push Agent is up to date."
    };
    updateCache.set(cacheKey, { cachedAt: now, result });
    return result;
  } catch (error) {
    const result = {
      ...base,
      ok: false,
      message: error.message || "Update check failed."
    };
    updateCache.set(cacheKey, { cachedAt: now, result });
    return result;
  }
}

function normalizeUpdateCheck(updateCheck) {
  return {
    enabled: updateCheck.enabled !== false,
    url: String(updateCheck.url || AGENT_UPDATE_CHECK_URL).trim(),
    repositoryURL: String(updateCheck.repositoryURL || AGENT_REPOSITORY_URL).trim(),
    intervalSeconds: positiveNumber(updateCheck.intervalSeconds, 3600),
    timeoutSeconds: positiveNumber(updateCheck.timeoutSeconds, 4)
  };
}

function readPackageJSON() {
  try {
    return JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  } catch {
    return {};
  }
}

function extractVersion(text) {
  const raw = String(text || "").trim();
  if (!raw) return "";
  try {
    const payload = JSON.parse(raw);
    return normalizeVersion(payload.version || payload.tag_name || payload.name || "");
  } catch {
    return normalizeVersion(raw);
  }
}

function normalizeVersion(value) {
  return String(value || "").trim().replace(/^v/i, "");
}

function compareVersions(left, right) {
  const a = versionParts(left);
  const b = versionParts(right);
  const length = Math.max(a.length, b.length, 3);
  for (let index = 0; index < length; index += 1) {
    const diff = (a[index] || 0) - (b[index] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function versionParts(value) {
  return normalizeVersion(value)
    .split(/[.+-]/)
    .map((part) => Number.parseInt(part, 10))
    .filter((part) => Number.isFinite(part));
}

function positiveNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function fetchText(urlString, options = {}, redirects = 0) {
  return new Promise((resolve, reject) => {
    let url;
    try {
      url = new URL(urlString);
    } catch {
      reject(new Error("Update check URL is invalid."));
      return;
    }
    const transport = url.protocol === "http:" ? http : https;
    const request = transport.get(url, {
      headers: {
        Accept: "application/json,text/plain;q=0.9,*/*;q=0.5",
        "User-Agent": `${APP_NAME}/${APP_VERSION}`
      }
    }, (response) => {
      const status = Number(response.statusCode || 0);
      const location = response.headers.location || "";
      if ([301, 302, 303, 307, 308].includes(status) && location && redirects < 3) {
        response.resume();
        const nextURL = new URL(location, url).toString();
        fetchText(nextURL, options, redirects + 1).then(resolve, reject);
        return;
      }
      if (status < 200 || status >= 300) {
        response.resume();
        reject(new Error(`Update check failed with HTTP ${status}.`));
        return;
      }
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        body += chunk;
        if (body.length > (options.maxBytes || 256 * 1024)) {
          request.destroy(new Error("Update metadata is too large."));
        }
      });
      response.on("end", () => resolve(body));
    });
    request.setTimeout(options.timeoutMs || 4000, () => {
      request.destroy(new Error("Update check timed out."));
    });
    request.on("error", reject);
  });
}
