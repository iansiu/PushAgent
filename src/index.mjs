import http from "node:http";
import { TextDecoder } from "node:util";
import { Aria2EventClient, aria2WebSocketURL } from "./aria2-events.mjs";
import { loadConfig } from "./config.mjs";
import { JSONStore } from "./store.mjs";
import { diagnoseServer, fallbackAria2EventTask, fetchAria2TaskByGid, fetchTasks } from "./download-clients.mjs";
import { RelayClient } from "./relay-client.mjs";
import { AGENT_WEB_UI_HTML } from "./web-ui.mjs";
import {
  addYtDlpTask,
  appendYtDlpCookieFile,
  deleteYtDlpCookieFile,
  fetchYtDlpTasks,
  listYtDlpCookies,
  pauseYtDlpTask,
  removeYtDlpTask,
  resumeYtDlpTask,
  saveYtDlpCookieFile,
  setYtDlpTaskEventHandler
} from "./ytdlp-service.mjs";
import { checkForUpdate, publicAppInfo } from "./version.mjs";

const MAX_AGENT_BODY_BYTES = 128 * 1024;
const MAX_AGENT_COOKIE_BODY_BYTES = 2 * 1024 * 1024;
const UTF8_TEXT_DECODER = new TextDecoder("utf-8", { fatal: true });

const config = loadConfig();
const store = new JSONStore(config.dataDir);
const relay = new RelayClient(config.relay);
const sessionState = new Map();
const activeMonitorServers = new Set();
const aria2EventClients = new Map();
const runtimeEvents = [];
const recentPushEventKeys = new Map();
const PROCESS_STARTED_AT = new Date().toISOString();
const DEFAULT_INACTIVE_DOWNLOAD_NOTICE_SECONDS = 30 * 60;
const AGENT_FAVICON_ICO = createFaviconICO("agent");

logLoadedConfig();
setYtDlpTaskEventHandler(handleTask);
startServer();
await pairOnStartup();
startMonitor();
startAria2EventListeners();

function logLoadedConfig() {
  console.log(`Push Agent config: path=${config.configPath} exists=${config.configExists ? "yes" : "no"} cwd=${config.cwd}`);
  console.log(`Push Agent data dir: ${config.dataDir}`);
}

function startServer() {
  const server = http.createServer(async (request, response) => {
    try {
      if (request.method === "GET" && request.url === "/v1/health") {
        const identity = relayIdentity();
        return sendJSON(response, 200, {
          ok: true,
          app: publicAppInfo(config.updateCheck),
          version: publicAppInfo(config.updateCheck).version,
          paired: Boolean(identity),
          relayIdentitySource: identity?.source || "",
          relayIdentityUpdatedAt: identity?.updatedAt || "",
          servers: config.servers.length
        });
      }
      if (request.method === "GET" && isWebUIRequest(request.url)) {
        return sendHTML(response, AGENT_WEB_UI_HTML);
      }
      if (request.method === "GET" && request.url === "/favicon.ico") {
        return sendFavicon(response, AGENT_FAVICON_ICO);
      }
      if (!isAuthorized(request)) {
        return sendJSON(response, 401, {
          ok: false,
          message: authorizationMessage(request),
          requiresApiKey: true
        });
      }
      if (request.method === "GET" && request.url === "/v1/state") {
        const identity = relayIdentity();
        return sendJSON(response, 200, {
          ok: true,
          app: publicAppInfo(config.updateCheck),
          version: publicAppInfo(config.updateCheck).version,
          paired: Boolean(identity),
          relayIdentity: publicRelayIdentity(identity),
          startedAt: PROCESS_STARTED_AT,
          configPath: config.configPath,
          configExists: config.configExists,
          cwd: config.cwd,
          runtimeEvents: runtimeEvents.slice(0, 20),
          servers: config.servers.map((server) => {
            const stored = store.getServer(server.id);
            const state = sessionState.get(server.id) || {};
            return {
              id: server.id,
              name: server.name || server.id,
              type: server.type,
              online: stored.online !== false,
              lastError: stored.lastError || "",
              lastMonitorAt: stored.lastMonitorAt || "",
              lastSuccessfulMonitorAt: stored.lastSuccessfulMonitorAt || "",
              lastFailedMonitorAt: stored.lastFailedMonitorAt || "",
              lastWarning: state.lastFetchWarnings?.join("; ") || "",
              lastTaskSummary: state.lastTaskSummary || "",
              lastAria2LiveEventStatus: state.lastAria2LiveEventStatus || "",
              lastAria2StoppedSummary: state.lastAria2StoppedSummary || "",
              lastAria2StoppedTotal: Number.isFinite(state.lastAria2StoppedTotal) ? state.lastAria2StoppedTotal : null,
              lastEventSummary: state.lastEventSummary || "",
              lastPushSummary: state.lastPushSummary || "",
              initialScanComplete: state.initialScanComplete === true
            };
          })
        });
      }
      if (request.method === "GET" && request.url === "/v1/update-check") {
        return sendJSON(response, 200, await checkForUpdate(config.updateCheck));
      }
      if (request.method === "GET" && request.url === "/v1/relay/agent") {
        const identity = relayIdentity();
        if (!identity) {
          return sendJSON(response, 409, { ok: false, message: "Push Agent is not paired with Push Relay." });
        }
        try {
          const result = await relay.agentState(identity);
          updateRelayIdentityBaseURL(identity, result);
          return sendJSON(response, 200, result);
        } catch (error) {
          return sendRelayError(response, error);
        }
      }
      if (request.method === "DELETE" && request.url?.startsWith("/v1/relay/agent/devices/")) {
        const identity = relayIdentity();
        if (!identity) {
          return sendJSON(response, 409, { ok: false, message: "Push Agent is not paired with Push Relay." });
        }
        const deviceId = decodeURIComponent(request.url.slice("/v1/relay/agent/devices/".length));
        try {
          const result = await relay.removeAgentDevice(deviceId, identity);
          updateRelayIdentityBaseURL(identity, result);
          return sendJSON(response, 200, result);
        } catch (error) {
          return sendRelayError(response, error);
        }
      }
      if (request.method === "DELETE" && request.url?.startsWith("/v1/relay/agent/pairing-codes/")) {
        const identity = relayIdentity();
        if (!identity) {
          return sendJSON(response, 409, { ok: false, message: "Push Agent is not paired with Push Relay." });
        }
        const code = decodeURIComponent(request.url.slice("/v1/relay/agent/pairing-codes/".length));
        try {
          const result = await relay.removeAgentPairingCode(code, identity);
          updateRelayIdentityBaseURL(identity, result);
          return sendJSON(response, 200, result);
        } catch (error) {
          return sendRelayError(response, error);
        }
      }
      if (request.method === "GET" && request.url?.startsWith("/v1/diagnostics")) {
        const url = new URL(request.url, "http://127.0.0.1");
        const targetServerId = url.searchParams.get("server");
        const servers = targetServerId
          ? matchingServers(targetServerId)
          : config.servers;
        if (targetServerId && !servers.length) {
          return sendJSON(response, 404, { ok: false, message: `Unknown server: ${targetServerId}` });
        }
        const results = await Promise.all(servers.map((server) => diagnoseConfiguredServer(server)));
        return sendJSON(response, 200, {
          ok: results.every((result) => result.ok),
          servers: results
        });
      }
      if (request.method === "GET" && requestPath(request) === "/v1/ytdlp/diagnostics") {
        const selected = ytdlpServerForRequest(request);
        const server = selected.server;
        if (!server) {
          return sendJSON(response, selected.status || 404, { ok: false, message: selected.message });
        }
        const result = await diagnoseConfiguredServer(server);
        return sendJSON(response, 200, { ok: result.ok, ...result });
      }
      if (request.method === "GET" && requestPath(request) === "/v1/ytdlp/cookies") {
        const selected = ytdlpServerForRequest(request);
        const server = selected.server;
        if (!server) {
          return sendJSON(response, selected.status || 404, { ok: false, message: selected.message });
        }
        return sendJSON(response, 200, { ok: true, sites: listYtDlpCookies(server) });
      }
      if (request.method === "PUT" && requestPath(request).startsWith("/v1/ytdlp/cookies/")) {
        const selected = ytdlpServerForRequest(request);
        const server = selected.server;
        if (!server) {
          return sendJSON(response, selected.status || 404, { ok: false, message: selected.message });
        }
        const siteId = decodeURIComponent(requestPath(request).slice("/v1/ytdlp/cookies/".length));
        const content = await readText(request, MAX_AGENT_COOKIE_BODY_BYTES);
        const site = saveYtDlpCookieFile(server, siteId, content);
        recordRuntimeEvent("ytdlp_cookie_saved", `${server.name || server.id}: ${site.name} cookie updated.`, "info");
        return sendJSON(response, 200, { ok: true, site });
      }
      if (request.method === "POST" && requestPath(request).startsWith("/v1/ytdlp/cookies/") && requestPath(request).endsWith("/append")) {
        const selected = ytdlpServerForRequest(request);
        const server = selected.server;
        if (!server) {
          return sendJSON(response, selected.status || 404, { ok: false, message: selected.message });
        }
        const pathname = requestPath(request);
        const siteId = decodeURIComponent(pathname.slice("/v1/ytdlp/cookies/".length, -"/append".length));
        const content = await readText(request, MAX_AGENT_COOKIE_BODY_BYTES);
        const site = appendYtDlpCookieFile(server, siteId, content);
        recordRuntimeEvent("ytdlp_cookie_appended", `${server.name || server.id}: ${site.name} cookie appended.`, "info");
        return sendJSON(response, 200, { ok: true, site });
      }
      if (request.method === "DELETE" && requestPath(request).startsWith("/v1/ytdlp/cookies/")) {
        const selected = ytdlpServerForRequest(request);
        const server = selected.server;
        if (!server) {
          return sendJSON(response, selected.status || 404, { ok: false, message: selected.message });
        }
        const siteId = decodeURIComponent(requestPath(request).slice("/v1/ytdlp/cookies/".length));
        const site = deleteYtDlpCookieFile(server, siteId);
        recordRuntimeEvent("ytdlp_cookie_removed", `${server.name || server.id}: ${site.name} cookie removed.`, "info");
        return sendJSON(response, 200, { ok: true, site });
      }
      if (request.method === "GET" && requestPath(request) === "/v1/ytdlp/tasks") {
        const selected = ytdlpServerForRequest(request);
        const server = selected.server;
        if (!server) {
          return sendJSON(response, selected.status || 404, { ok: false, message: selected.message });
        }
        return sendJSON(response, 200, { ok: true, tasks: fetchYtDlpTasks(server) });
      }
      if (request.method === "POST" && requestPath(request) === "/v1/ytdlp/tasks") {
        const selected = ytdlpServerForRequest(request);
        const server = selected.server;
        if (!server) {
          return sendJSON(response, selected.status || 404, { ok: false, message: selected.message });
        }
        const payload = await readJSON(request);
        const task = addYtDlpTask(server, payload);
        recordRuntimeEvent("ytdlp_task_added", `${server.name || server.id}: ${task.name}`, "info");
        return sendJSON(response, 200, { ok: true, task });
      }
      if (request.method === "POST" && requestPath(request).startsWith("/v1/ytdlp/tasks/") && requestPath(request).endsWith("/pause")) {
        const selected = ytdlpServerForRequest(request);
        const server = selected.server;
        if (!server) {
          return sendJSON(response, selected.status || 404, { ok: false, message: selected.message });
        }
        const taskId = decodeURIComponent(requestPath(request).slice("/v1/ytdlp/tasks/".length, -"/pause".length));
        const task = pauseYtDlpTask(server, taskId);
        return task
          ? sendJSON(response, 200, { ok: true, task })
          : sendJSON(response, 404, { ok: false, message: "yt-dlp task not found." });
      }
      if (request.method === "POST" && requestPath(request).startsWith("/v1/ytdlp/tasks/") && requestPath(request).endsWith("/resume")) {
        const selected = ytdlpServerForRequest(request);
        const server = selected.server;
        if (!server) {
          return sendJSON(response, selected.status || 404, { ok: false, message: selected.message });
        }
        const taskId = decodeURIComponent(requestPath(request).slice("/v1/ytdlp/tasks/".length, -"/resume".length));
        const task = resumeYtDlpTask(server, taskId);
        return task
          ? sendJSON(response, 200, { ok: true, task })
          : sendJSON(response, 404, { ok: false, message: "yt-dlp task not found." });
      }
      if (request.method === "DELETE" && requestPath(request).startsWith("/v1/ytdlp/tasks/")) {
        const selected = ytdlpServerForRequest(request);
        const server = selected.server;
        if (!server) {
          return sendJSON(response, selected.status || 404, { ok: false, message: selected.message });
        }
        const url = requestURL(request);
        const taskId = decodeURIComponent(url.pathname.slice("/v1/ytdlp/tasks/".length));
        const result = removeYtDlpTask(server, taskId, {
          deleteFiles: isTruthyQueryValue(url.searchParams.get("deleteData") || url.searchParams.get("deleteFiles"))
        });
        return result
          ? sendJSON(response, 200, { ok: true, ...result })
          : sendJSON(response, 404, { ok: false, message: "yt-dlp task not found." });
      }
      if (request.method === "POST" && request.url === "/v1/agent/pair") {
        const payload = await readJSON(request);
        const result = await pairWithRelay({
          pairingCode: payload.pairingCode || payload.code,
          agentName: payload.agentName || payload.name || config.agentName
        });
        if (!result.ok) {
          recordRuntimeEvent("pairing_failed", result.message, "error");
          return sendJSON(response, result.status, { ok: false, message: result.message });
        }
        recordRuntimeEvent("pairing_succeeded", `Agent paired with Push Relay as ${result.identity.agentId}.`, "info");
        return sendJSON(response, 200, {
          ok: true,
          message: "Agent paired with Push Relay.",
          agentId: result.identity.agentId,
          updatedAt: result.identity.updatedAt
        });
      }
      if (request.method === "POST" && request.url === "/v1/push/test") {
        const payload = await readJSON(request).catch(() => ({}));
        const delivery = await sendPushEvent({
          type: "test",
          title: payload.title || "QiuyuRemote",
          body: payload.body || "Push Agent is connected.",
          server: { id: "agent", name: "Push Agent", type: "agent" }
        });
        if (!delivery.ok) {
          return sendJSON(response, 502, { ok: false, message: delivery.message });
        }
        return sendJSON(response, 200, {
          ok: true,
          message: "Test event sent to Relay.",
          sent: delivery.sent,
          failed: delivery.failed,
          relayMessage: delivery.relayMessage
        });
      }
      return sendJSON(response, 404, { ok: false, message: "Not found" });
    } catch (error) {
      console.error(error);
      return sendJSON(response, Number.isInteger(error?.statusCode) ? error.statusCode : 500, {
        ok: false,
        code: error?.code || "",
        message: error.message || "Internal error"
      });
    }
  });
  server.listen(config.port, config.host, () => {
    console.log(`QiuyuRemote Push Agent listening on ${config.host}:${config.port}`);
  });
}

function firstYtDlpServer() {
  return ytdlpServers()[0] || null;
}

function ytdlpServers() {
  return config.servers.filter((server) => server.type === "ytdlp" || server.type === "yt-dlp");
}

function ytdlpServerForRequest(request) {
  const servers = ytdlpServers();
  if (!servers.length) {
    return { server: null, status: 404, message: "yt-dlp service is not enabled in Agent config." };
  }
  const url = requestURL(request);
  const selector = firstNonEmpty(
    url.searchParams.get("server"),
    url.searchParams.get("serverId"),
    url.searchParams.get("ytdlpServer"),
    url.searchParams.get("endpoint"),
    url.searchParams.get("baseUrl")
  );
  if (!selector) {
    return { server: servers[0] };
  }
  const matches = matchingYtDlpServers(selector);
  if (!matches.length) {
    return { server: null, status: 404, message: `Unknown yt-dlp server: ${selector}` };
  }
  return { server: matches[0] };
}

function requestURL(request) {
  return new URL(request.url || "/", "http://127.0.0.1");
}

function requestPath(request) {
  return requestURL(request).pathname;
}

function firstNonEmpty(...values) {
  for (const value of values) {
    const text = String(value || "").trim();
    if (text) return text;
  }
  return "";
}

async function pairOnStartup() {
  if (relay.staticIdentity) {
    store.setRelayIdentity(relay.staticIdentity);
    console.log(`Push Agent is using static Relay identity ${relay.staticIdentity.agentId}.`);
    if (config.pairingCodes.length) {
      const message = "Push Agent ignored configured pairing code(s) because static Relay identity is already set.";
      console.warn(message);
      recordRuntimeEvent("pairing_codes_ignored", message, "warn");
    }
    return;
  }
  const savedIdentity = store.getRelayIdentity();
  if (savedIdentity) {
    console.log(`Push Agent is using saved Relay identity ${savedIdentity.agentId}.`);
    if (config.pairingCodes.length) {
      const message = "Push Agent ignored configured pairing code(s) because saved Relay identity already exists.";
      console.warn(message);
      recordRuntimeEvent("pairing_codes_ignored", message, "warn");
    }
    return;
  }
  if (!config.pairingCodes.length) {
    const message = "Push Agent is not paired with Push Relay. Generate a pairing code in QiuyuRemote settings.";
    console.warn(message);
    recordRuntimeEvent("pairing_required", message, "warn");
    return;
  }
  const seen = new Set();
  for (const pairingCode of config.pairingCodes) {
    if (seen.has(pairingCode)) {
      const message = `Push Agent skipped duplicate pairing code ${pairingCode}.`;
      console.warn(message);
      recordRuntimeEvent("pairing_code_duplicate", message, "warn");
      continue;
    }
    seen.add(pairingCode);
    const result = await pairWithRelay({ pairingCode, agentName: config.agentName });
    if (result.ok) {
      const message = `Push Agent paired with Push Relay as ${result.identity.agentId}.`;
      console.log(message);
      recordRuntimeEvent("pairing_succeeded", message, "info");
    } else {
      const message = `Push Agent pairing failed for ${pairingCode}: ${result.message}`;
      console.error(message);
      recordRuntimeEvent("pairing_failed", message, "error");
      if (isUsedPairingCodeMessage(result.message)) {
        const usedMessage = `Push Agent pairing code ${pairingCode} has already been redeemed. Remove it from config.json, or replace it with a fresh code generated in QiuyuRemote.`;
        console.error(usedMessage);
        recordRuntimeEvent("pairing_code_used", usedMessage, "error");
      }
    }
  }
}

function recordRuntimeEvent(type, message, level = "info") {
  runtimeEvents.unshift({
    id: `${Date.now()}:${Math.random().toString(36).slice(2)}`,
    type,
    level,
    message: String(message || ""),
    occurredAt: new Date().toISOString()
  });
  runtimeEvents.splice(50);
}

async function pairWithRelay({ pairingCode, agentName }) {
  const code = String(pairingCode || "").trim();
  if (!code) {
    return { ok: false, status: 400, message: "Missing pairing code." };
  }
  try {
    const currentIdentity = relayIdentity();
    const resolvedAgentName = agentName || config.agentName;
    let response;
    let recoveredMissingIdentity = false;
    try {
      response = await relay.pair({
        pairingCode: code,
        agentName: resolvedAgentName,
        identity: currentIdentity
      });
    } catch (error) {
      if (!currentIdentity?.agentId || !isUnknownAgentMessage(error.message, error.statusCode)) {
        throw error;
      }
      const message = `Saved Relay identity ${currentIdentity.agentId} is no longer known by Push Relay. Retrying pairing with a fresh Relay identity.`;
      console.warn(message);
      recordRuntimeEvent("relay_identity_missing", message, "warn");
      response = await relay.pair({
        pairingCode: code,
        agentName: resolvedAgentName,
        identity: null
      });
      recoveredMissingIdentity = true;
    }
    if (currentIdentity?.agentId && response.agentId && response.agentId !== currentIdentity.agentId && !recoveredMissingIdentity) {
      return {
        ok: false,
        status: 409,
        message: `Relay returned a different Agent ID (${response.agentId}) than the saved identity (${currentIdentity.agentId}). Refusing to replace the saved Agent identity.`
      };
    }
    const identity = store.setRelayIdentity({
      agentId: response.agentId,
      secret: response.secret,
      source: "pairing",
      agentName: resolvedAgentName,
      relayBaseURL: response.relayBaseURL || ""
    });
    return {
      ok: true,
      identity,
      message: recoveredMissingIdentity
        ? "Saved Relay identity was no longer known by Push Relay, so the Agent paired again with a fresh identity."
        : response.message
    };
  } catch (error) {
    const message = error.message || "Relay pairing failed.";
    return {
      ok: false,
      status: error.statusCode || 502,
      message: isUsedPairingCodeMessage(message)
        ? `Pairing code ${code} was already used. Generate a new code in QiuyuRemote, or clear this old code from config.json if this Agent is already paired.`
        : message
    };
  }
}

function isUsedPairingCodeMessage(message) {
  return /already\s+used|was\s+already\s+used|已.*使用/i.test(String(message || ""));
}

function isUnknownAgentMessage(message, statusCode) {
  return Number(statusCode) === 403 && /unknown agent/i.test(String(message || ""));
}

function matchingServers(value) {
  const target = String(value || "").trim().toLowerCase();
  if (!target) {
    return [];
  }
  return config.servers.filter((server) => {
    return serverMatchesSelector(server, target);
  });
}

function matchingYtDlpServers(value) {
  const target = String(value || "").trim().toLowerCase();
  if (!target) return [];
  return ytdlpServers().filter((server) => serverMatchesSelector(server, target));
}

function serverMatchesSelector(server, target) {
  const normalizedTarget = normalizedSelectorValue(target);
  return [
    server.id,
    server.name,
    server.type,
    server.storageKey,
    server.identityKey,
    server.baseUrl,
    server.endpoint,
    server.downloadDir
  ]
    .map((item) => normalizedSelectorValue(item))
    .some((item) => item && (item === normalizedTarget || item.toLowerCase() === target));
}

function normalizedSelectorValue(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw);
    url.hash = "";
    url.hostname = url.hostname.toLowerCase();
    url.pathname = url.pathname.replace(/\/+$/, "");
    return url.toString().replace(/\/+$/, "").toLowerCase();
  } catch {
    return raw.replace(/\/+$/, "").toLowerCase();
  }
}

function startMonitor() {
  const interval = Math.max(config.monitor.pollIntervalSeconds, 10) * 1000;
  console.log(`Push Agent monitoring ${config.servers.length} server(s) every ${interval / 1000}s.`);
  for (const server of config.servers) {
    console.log(`[${server.id}] configured ${server.type} server: ${server.name || server.id} endpoint=${describeServerEndpoint(server)}${serverSecuritySummary(server)}`);
  }
  runMonitorOnce();
  setInterval(runMonitorOnce, interval);
}

function startAria2EventListeners() {
  for (const server of config.servers.filter((item) => item.type === "aria2")) {
    if (server.liveEvents === false || server.websocketEvents === false) {
      console.log(`[${server.id}] aria2 live events disabled by config.`);
      continue;
    }
    let websocketURL;
    try {
      websocketURL = aria2WebSocketURL(server);
    } catch (error) {
      console.warn(`[${server.id}] aria2 live events disabled: invalid websocket URL (${error.message || error}).`);
      continue;
    }
    console.log(`[${server.id}] aria2 live events enabled endpoint=${websocketURL}`);
    const client = new Aria2EventClient(server, {
      onEvent: (event) => handleAria2LiveEvent(server, event),
      onStatus: (kind, detail) => logAria2EventStatus(server, kind, detail)
    });
    aria2EventClients.set(server.id, client);
    client.start();
  }
}

async function runMonitorOnce() {
  await Promise.all(config.servers.map((server) => runServerMonitorOnce(server)));
}

async function runServerMonitorOnce(server) {
  if (activeMonitorServers.has(server.id)) {
    console.warn(`[${server.id}] previous monitor cycle is still running; skipping this cycle.`);
    return;
  }
  activeMonitorServers.add(server.id);
  try {
    await monitorServer(server);
  } catch (error) {
    console.error(`[${server.id}] monitor failed:`, error.message || error);
  } finally {
    activeMonitorServers.delete(server.id);
  }
}

async function monitorServer(server) {
  const state = sessionState.get(server.id) || {};
  sessionState.set(server.id, state);
  const monitorStartedAt = new Date().toISOString();
  try {
    const tasks = await fetchTasks(server, state);
    const summary = summarizeMonitorStatus(server, tasks, state);
    const warnings = Array.isArray(state.lastFetchWarnings) ? state.lastFetchWarnings.filter(Boolean) : [];
    if (state.lastTaskSummary !== summary) {
      const taskLabel = server.type === "aria2" ? "polling task(s)" : "task(s)";
      console.log(`[${server.id}] monitor ok: ${tasks.length} ${taskLabel}, ${summary}`);
      state.lastTaskSummary = summary;
    }
    if (warnings.length) {
      console.warn(`[${server.id}] monitor warnings: ${warnings.join("; ")}`);
    }
    const previousServer = store.getServer(server.id);
    if (previousServer.online === false) {
      await sendPushEvent({
        type: "server_online",
        title: "QiuyuRemote",
        body: `${server.name || server.id} is online.`,
        server: publicServer(server)
      });
    }
    store.setServer(server.id, {
      online: true,
      lastError: "",
      lastMonitorAt: monitorStartedAt,
      lastSuccessfulMonitorAt: new Date().toISOString()
    });
    for (const task of tasks) {
      await handleTask(server, task);
    }
    if (state.initialScanComplete !== true) {
      state.initialScanComplete = true;
      console.log(`[${server.id}] initial scan complete; future completed or failed tasks will notify.`);
    }
  } catch (error) {
    const previousServer = store.getServer(server.id);
    const message = monitorErrorMessage(server, error);
    console.error(`[${server.id}] monitor failed (${server.type}) at ${describeServerEndpoint(server)}: ${message}`);
    store.setServer(server.id, {
      online: false,
      lastError: message,
      lastMonitorAt: monitorStartedAt,
      lastFailedMonitorAt: new Date().toISOString()
    });
    if (previousServer.online !== false) {
      await sendPushEvent({
        type: "server_offline",
        title: "QiuyuRemote",
        body: serverOfflineBody(server, message),
        server: publicServer(server)
      });
    }
  }
}

async function diagnoseConfiguredServer(server) {
  const startedAt = new Date().toISOString();
  try {
    const result = await diagnoseServer(server, sessionState.get(server.id) || {});
    return {
      id: server.id,
      name: server.name || server.id,
      type: server.type,
      endpoint: describeServerEndpoint(server),
      checkedAt: startedAt,
      ...result
    };
  } catch (error) {
    const message = monitorErrorMessage(server, error);
    return {
      id: server.id,
      name: server.name || server.id,
      type: server.type,
      endpoint: describeServerEndpoint(server),
      checkedAt: startedAt,
      ok: false,
      message
    };
  }
}

function monitorErrorMessage(server, error) {
  if (server.type === "ytdlp" || server.type === "yt-dlp") {
    return ytdlpErrorMessage(server, error);
  }
  return error?.message || String(error);
}

function serverOfflineBody(server, message) {
  if (server.type === "ytdlp" || server.type === "yt-dlp") {
    return `${server.name || server.id}: ${message}`;
  }
  return `${server.name || server.id} is offline: ${message}`;
}

function ytdlpErrorMessage(server, error) {
  const binaryPath = server.binaryPath || "yt-dlp";
  const raw = String(error?.message || error || "").toLowerCase();
  if (error?.code === "ffmpeg_missing" || raw.includes("ffmpeg is missing")) {
    return "yt-dlp is installed, but ffmpeg is missing on the server. Audio/video streams cannot be merged.";
  }
  if (error?.code === "ENOENT" || raw.includes("enoent")) {
    return `yt-dlp unavailable: install yt-dlp on this server or fix binaryPath (${binaryPath}).`;
  }
  if (raw.includes("timed out")) {
    return "yt-dlp unavailable: version check timed out.";
  }
  if (raw.includes("permission denied") || error?.code === "EACCES") {
    return `yt-dlp unavailable: ${binaryPath} is not executable.`;
  }
  return error?.message || String(error);
}

async function handleAria2LiveEvent(server, event) {
  if (!isAria2TerminalEvent(event?.method)) {
    return;
  }
  const gid = event?.params?.[0]?.gid || "";
  if (!gid) {
    console.warn(`[${server.id}] aria2 live event ${event.method} did not include a gid.`);
    return;
  }
  const fallbackStatus = event.method === "aria2.onDownloadError" ? "failed" : "completed";
  console.log(`[${server.id}] aria2 live event ${event.method} gid=${gid}`);
  let task;
  try {
    task = await fetchAria2TaskByGid(server, gid, fallbackStatus);
  } catch (error) {
    console.warn(`[${server.id}] aria2 live event ${event.method} gid=${gid} could not fetch task details: ${error.message || error}`);
    task = fallbackAria2EventTask(gid, event.method);
  }
  await handleTask(server, task, { liveEvent: true });
}

function isAria2TerminalEvent(method) {
  return method === "aria2.onDownloadComplete"
    || method === "aria2.onBtDownloadComplete"
    || method === "aria2.onDownloadError";
}

function logAria2EventStatus(server, kind, detail) {
  const state = sessionState.get(server.id) || {};
  sessionState.set(server.id, state);
  state.lastAria2LiveEventStatus = `${new Date().toISOString()} ${kind} ${detail}`;
  if (kind === "connected") {
    console.log(`[${server.id}] aria2 live events connected: ${detail}`);
  } else if (kind === "reconnect") {
    console.warn(`[${server.id}] aria2 live events reconnecting: ${detail}`);
  } else {
    console.warn(`[${server.id}] aria2 live events ${kind}: ${detail}`);
  }
}

async function handleTask(server, task, options = {}) {
  const key = `${server.id}:${task.id}`;
  const previous = store.getTask(key);
  const state = sessionState.get(server.id) || {};
  sessionState.set(server.id, state);
  const next = {
    id: task.id,
    name: task.name,
    status: task.status,
    progress: task.progress,
    completedBytes: finiteNumber(task.completedBytes, 0),
    totalBytes: finiteNumber(task.totalBytes, 0),
    downloadSpeed: finiteNumber(task.downloadSpeed, 0),
    rawStatus: String(task.rawStatus || ""),
    phase: task.phase || task.rawStatus || task.status || "",
    errorMessage: task.errorMessage || "",
    url: task.url || "",
    outputPath: task.outputPath || ""
  };
  Object.assign(next, observedDownloadActivity(task, previous));
  Object.assign(next, resolvedStopNoticeState(task, previous));
  if (!previous) {
    console.log(`[${server.id}] tracking task ${task.id}: status=${task.status} progress=${formatProgress(task.progress)} name="${task.name}"`);
  } else if (previous.status !== task.status) {
    console.log(`[${server.id}] task ${task.id} changed ${previous.status} -> ${task.status}: "${task.name}"`);
  }
  const previousLastEventStatus = previous?.lastEventStatus || "";
  const isInitialScan = state.initialScanComplete !== true && options.liveEvent !== true;
  if ((task.notificationBaseline === true || (!previous && isInitialScan)) && (task.status === "completed" || task.status === "failed")) {
    store.setTask(key, {
      ...next,
      lastEventStatus: task.status
    });
    state.lastEventSummary = `${new Date().toISOString()} baseline ${task.status} ${server.id}:${task.id} "${task.name}"`;
    console.log(`[${server.id}] baseline terminal task ${task.id}: status=${task.status} name="${task.name}"`);
    return;
  }
  store.setTask(key, { ...next, lastEventStatus: previousLastEventStatus });
  if (task.status === "completed" && previousLastEventStatus !== "completed") {
    state.lastEventSummary = `${new Date().toISOString()} download_completed ${server.id}:${task.id} "${task.name}"`;
    store.setTask(key, { ...next, lastEventStatus: "completed" });
    const delivery = await sendPushEvent({
      type: "download_completed",
      title: downloadNotificationTitle("completed"),
      body: completedTaskBody(server, task, next),
      server: publicServer(server),
      task: next
    });
    state.lastPushSummary = pushSummary("download_completed", delivery);
  } else if (task.status === "failed" && previousLastEventStatus !== "failed") {
    state.lastEventSummary = `${new Date().toISOString()} task_failed ${server.id}:${task.id} "${task.name}"`;
    store.setTask(key, { ...next, lastEventStatus: "failed" });
    const delivery = await sendPushEvent({
      type: "task_failed",
      title: downloadNotificationTitle("failed"),
      body: failedTaskBody(server, task),
      server: publicServer(server),
      task: next
    });
    state.lastPushSummary = pushSummary("task_failed", delivery);
  } else if (shouldSendTaskStoppedNotice(next, previous, previousLastEventStatus)) {
    const eventStatus = stopNoticeEventStatus(next.stopNotice);
    state.lastEventSummary = `${new Date().toISOString()} task_stopped ${server.id}:${task.id} "${task.name}"`;
    store.setTask(key, { ...next, lastEventStatus: eventStatus });
    const delivery = await sendPushEvent({
      type: "task_stopped",
      title: downloadNotificationTitle("stopped"),
      body: stoppedTaskBody(server, task, next),
      server: publicServer(server),
      task: next
    });
    state.lastPushSummary = pushSummary("task_stopped", delivery);
  } else if (shouldSendInactiveDownloadNotice(server, task, next, previous, state, options)) {
    const inactiveSeconds = inactiveDownloadNoticeSeconds();
    state.lastEventSummary = `${new Date().toISOString()} download_inactive ${server.id}:${task.id} "${task.name}"`;
    const delivery = await sendPushEvent({
      type: "download_inactive",
      title: downloadNotificationTitle("inactive"),
      body: inactiveTaskBody(server, task, inactiveSeconds),
      server: publicServer(server),
      task: {
        ...next,
        noticeMessage: "Downloading, but no data has been received for a while."
      }
    });
    state.lastPushSummary = pushSummary("download_inactive", delivery);
    recordRuntimeEvent("download_inactive", `${server.name || server.id}: ${task.name} has not received download data for ${formatDuration(inactiveSeconds)}.`, delivery.ok ? "warn" : "error");
    if (delivery.accepted) {
      store.setTask(key, {
        ...next,
        inactiveNoticeActive: true,
        lastInactiveNoticeAt: new Date().toISOString(),
        lastEventStatus: previousLastEventStatus
      });
    }
  }
}

function downloadNotificationTitle(kind) {
  if (kind === "completed") return "Download completed";
  if (kind === "failed") return "Download failed";
  if (kind === "stopped") return "Download stopped";
  if (kind === "inactive") return "No download activity";
  return "Download update";
}

function completedTaskBody(server, task, next) {
  return downloadTaskBody(server, task, String(next.noticeMessage || "").trim());
}

function failedTaskBody(server, task) {
  return downloadTaskBody(server, task);
}

function stoppedTaskBody(server, task, next) {
  return downloadTaskBody(server, task, String(next.noticeMessage || "").trim());
}

function inactiveTaskBody(server, task, inactiveSeconds) {
  return downloadTaskBody(server, task, `No data received for ${formatDuration(inactiveSeconds)}.`);
}

function downloadTaskBody(server, task, detail = "") {
  const lines = [
    readableTaskName(task)
  ];
  const normalizedDetail = compactNotificationLine(detail);
  if (normalizedDetail) {
    lines.push(normalizedDetail);
  }
  return lines.filter(Boolean).join("\n");
}

function serverDisplayName(server) {
  return String(server.name || server.id || "Download service").trim();
}

function readableTaskName(task) {
  const name = String(outputFileName(task?.outputPath) || task.name || task.url || task.id || "Download task").trim();
  return compactNotificationLine(shortURLLabel(name) || name, 120);
}

function outputFileName(value) {
  return String(value || "").split(/[\\/]/).filter(Boolean).pop() || "";
}

function shortURLLabel(value) {
  const text = String(value || "").trim();
  if (!/^https?:\/\//i.test(text)) return "";
  try {
    const url = new URL(text);
    const host = url.hostname.replace(/^www\./i, "");
    const path = decodeURIComponent(url.pathname || "").replace(/\/+$/, "");
    const readablePath = path && path !== "/" ? path : "";
    return compactNotificationLine(`${host}${readablePath}`, 120);
  } catch {
    return text.replace(/^https?:\/\//i, "").split(/[?#]/)[0];
  }
}

function compactNotificationLine(value, maxLength = 140) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function isTruthyQueryValue(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

function resolvedStopNoticeState(task, previous) {
  const candidate = normalizeStopNotice(task.stopNoticeCandidate);
  const isStopped = isStoppedTask(task);
  if (!isStopped) {
    return {
      stopNotice: null,
      pendingStopNotice: candidate ? pendingStopNotice(candidate) : null,
      noticeMessage: ""
    };
  }

  const locked = normalizeStopNotice(previous?.stopNotice);
  if (locked) {
    if (locked.kind === "manual" || locked.freshUntil || stopNoticeIsFresh(locked) || sameStopNotice(candidate, locked)) {
      return stopNoticeFields(locked);
    }
    return stopNoticeFields(lockStopNotice({ kind: "manual", value: "" }));
  }

  const pending = normalizeStopNotice(previous?.pendingStopNotice);
  if (pending && stopNoticeIsFresh(pending)) {
    return stopNoticeFields(lockStopNotice(pending));
  }

  if (candidate && stopNoticeIsFresh(candidate)) {
    return stopNoticeFields(lockStopNotice(candidate));
  }

  return stopNoticeFields(lockStopNotice({ kind: "manual", value: "" }));
}

function isStoppedTask(task) {
  if (task?.isStopped === true) {
    return true;
  }
  const rawStatus = String(task?.rawStatus || "").toLowerCase();
  return rawStatus.includes("pause")
    || rawStatus.includes("stop")
    || rawStatus === "removed"
    || rawStatus === "0";
}

function normalizeStopNotice(value) {
  if (!value || typeof value !== "object") {
    return null;
  }
  const kind = String(value.kind || "").trim();
  if (!["manual", "share_ratio", "seeding_idle", "download_idle"].includes(kind)) {
    return null;
  }
  return {
    kind,
    value: String(value.value || ""),
    observedAt: value.observedAt || "",
    lockedAt: value.lockedAt || "",
    triggeredAt: value.triggeredAt || "",
    freshUntil: value.freshUntil || ""
  };
}

function pendingStopNotice(candidate) {
  return {
    ...candidate,
    observedAt: candidate.observedAt || new Date().toISOString()
  };
}

function lockStopNotice(notice) {
  return {
    kind: notice.kind,
    value: String(notice.value || ""),
    observedAt: notice.observedAt || "",
    lockedAt: notice.lockedAt || new Date().toISOString(),
    triggeredAt: notice.triggeredAt || "",
    freshUntil: notice.freshUntil || ""
  };
}

function stopNoticeIsFresh(notice) {
  const freshUntil = Date.parse(notice?.freshUntil || "");
  if (Number.isFinite(freshUntil)) {
    return Date.now() <= freshUntil;
  }
  const observedAt = Date.parse(notice?.observedAt || "");
  if (Number.isFinite(observedAt)) {
    return Date.now() - observedAt <= automaticStopPendingFreshnessMs();
  }
  return true;
}

function automaticStopPendingFreshnessMs() {
  return 10 * 60 * 1000;
}

function stopNoticeFields(notice) {
  return {
    stopNotice: notice,
    pendingStopNotice: null,
    stopReason: notice.kind,
    stopReasonValue: notice.value,
    stopReasonLockedAt: notice.lockedAt || "",
    noticeMessage: stopNoticeMessage(notice)
  };
}

function stopNoticeMessage(notice) {
  if (!notice || notice.kind === "manual") {
    return "";
  }
  if (notice.kind === "share_ratio") {
    return `Stopped after reaching share ratio ${notice.value}.`;
  }
  if (notice.kind === "seeding_idle") {
    return `Stopped after ${notice.value} min seeding idle.`;
  }
  if (notice.kind === "download_idle") {
    return `Stopped after ${notice.value} min download idle.`;
  }
  return "";
}

function shouldSendTaskStoppedNotice(next, previous, previousLastEventStatus) {
  if (isCompletedTask(next) || previousLastEventStatus === "completed") {
    return false;
  }
  const notice = normalizeStopNotice(next.stopNotice);
  if (!notice || notice.kind === "manual") {
    return false;
  }
  if (previousLastEventStatus === stopNoticeEventStatus(notice)) {
    return false;
  }
  const previousNotice = normalizeStopNotice(previous?.stopNotice);
  return !sameStopNotice(previousNotice, notice);
}

function isCompletedTask(task) {
  const status = String(task?.status || "").toLowerCase();
  if (status === "completed" || status === "complete") {
    return true;
  }
  const progress = finiteNumber(task?.progress, 0);
  return progress >= 1;
}

function stopNoticeEventStatus(notice) {
  const normalized = normalizeStopNotice(notice);
  if (!normalized) {
    return "";
  }
  return `stopped:${normalized.kind}:${normalized.value}`;
}

function sameStopNotice(left, right) {
  const a = normalizeStopNotice(left);
  const b = normalizeStopNotice(right);
  return Boolean(a && b && a.kind === b.kind && a.value === b.value);
}

function observedDownloadActivity(task, previous) {
  if (!isObservableDownloadingTask(task)) {
    return {
      lastDataAt: "",
      inactiveNoticeActive: false,
      lastInactiveNoticeAt: previous?.lastInactiveNoticeAt || ""
    };
  }
  const now = new Date().toISOString();
  const dataReceived = taskReceivedDownloadData(task, previous);
  return {
    lastDataAt: dataReceived ? now : previous?.lastDataAt || now,
    inactiveNoticeActive: dataReceived ? false : previous?.inactiveNoticeActive === true,
    lastInactiveNoticeAt: previous?.lastInactiveNoticeAt || ""
  };
}

function taskReceivedDownloadData(task, previous) {
  if (finiteNumber(task.downloadSpeed, 0) > 0) {
    return true;
  }
  if (!previous) {
    return false;
  }
  const completedBytes = finiteNumber(task.completedBytes, 0);
  const previousCompletedBytes = finiteNumber(previous.completedBytes, 0);
  if (completedBytes > previousCompletedBytes) {
    return true;
  }
  const progress = finiteNumber(task.progress, 0);
  const previousProgress = finiteNumber(previous.progress, 0);
  return progress > previousProgress + 0.0001;
}

function shouldSendInactiveDownloadNotice(server, task, next, previous, state, options) {
  if (config.monitor.inactiveDownloadNoticeEnabled === false) {
    return false;
  }
  if (state.initialScanComplete !== true && options.liveEvent !== true) {
    return false;
  }
  if (!isObservableDownloadingTask(task)) {
    return false;
  }
  if (next.inactiveNoticeActive === true || previous?.inactiveNoticeActive === true) {
    return false;
  }
  if (finiteNumber(task.downloadSpeed, 0) > 0) {
    return false;
  }
  const lastDataAt = Date.parse(next.lastDataAt || "");
  if (!Number.isFinite(lastDataAt)) {
    return false;
  }
  return Date.now() - lastDataAt >= inactiveDownloadNoticeSeconds() * 1000;
}

function isObservableDownloadingTask(task) {
  if (task.status !== "running") {
    return false;
  }
  if (String(task.errorMessage || "").trim()) {
    return false;
  }
  if (task.isDownloading !== true) {
    return false;
  }
  const totalBytes = finiteNumber(task.totalBytes, 0);
  const completedBytes = finiteNumber(task.completedBytes, 0);
  return totalBytes > 0 && completedBytes < totalBytes;
}

function inactiveDownloadNoticeSeconds() {
  return Math.max(
    finiteNumber(config.monitor.inactiveDownloadNoticeSeconds, DEFAULT_INACTIVE_DOWNLOAD_NOTICE_SECONDS),
    Math.max(config.monitor.pollIntervalSeconds || 10, 10)
  );
}

async function sendPushEvent(event) {
  const identity = relayIdentity();
  if (!identity) {
    console.warn("Push Agent is not paired with Push Relay; skipping push event.");
    return { ok: false, message: "Push Agent is not paired with Push Relay." };
  }
  const eventKey = pushEventKey(event);
  if (!reserveRecentPushEvent(eventKey)) {
    console.log(`[${event.server.id}] duplicate push event suppressed: ${eventKey}`);
    return { ok: true, accepted: true, sent: 0, failed: 0, duplicate: true, message: "Duplicate push event suppressed." };
  }
  const eventId = eventKey;
  try {
    console.log(`[${event.server.id}] sending push event ${event.type}${event.task ? ` for "${event.task.name}"` : ""}.`);
    const result = await relay.sendEvent({
      eventId,
      collapseId: pushCollapseId(eventKey),
      deeplink: deeplinkForEvent(event),
      occurredAt: new Date().toISOString(),
      ...event
    }, identity);
    const sent = Number(result?.sent || 0);
    const failed = Number(result?.failed || 0);
    const relayMessage = result?.message || "";
    const relayMessageSuffix = relayMessage ? ` message="${relayMessage}"` : "";
    console.log(`[${event.server.id}] Push Relay accepted ${event.type}: sent=${sent} failed=${failed}${relayMessageSuffix}`);
    if (sent === 0) {
      console.warn(`[${event.server.id}] Push Relay accepted ${event.type}, but no paired device received it.`);
    }
    for (const item of result?.results || []) {
      if (item.ok) {
        const topic = item.topic ? ` topic=${item.topic}` : "";
        console.log(`[${event.server.id}] APNs delivered device=${item.deviceId || "unknown"}${topic}`);
      }
      if (!item.ok) {
        console.warn(`[${event.server.id}] APNs delivery failed device=${item.deviceId || "unknown"} status=${item.status || 0} reason=${item.reason || "unknown"}`);
      }
    }
    if (!relay.staticIdentity && result?.relayBaseURL && result.relayBaseURL !== identity.relayBaseURL) {
      store.setRelayIdentity({ ...identity, relayBaseURL: result.relayBaseURL });
    }
    return {
      ok: sent > 0,
      accepted: true,
      sent,
      failed,
      relayMessage,
      message: sent > 0 ? relayMessage : relayMessage || "Push Relay accepted the event, but no paired device received it."
    };
  } catch (error) {
    console.error(`[${event.server.id}] push event ${event.type} failed: ${error.message || error}`);
    return { ok: false, accepted: false, message: error.message || "Push event failed." };
  }
}

function pushEventKey(event) {
  return [
    event.type || "event",
    event.server?.id || "server",
    event.task?.id || "",
    event.type === "task_stopped" ? event.task?.noticeMessage || "" : ""
  ].map(pushEventKeyPart).filter(Boolean).join(":");
}

function pushEventKeyPart(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/:/g, "_")
    .slice(0, 96);
}

function reserveRecentPushEvent(eventKey) {
  const now = Date.now();
  const windowMs = 15_000;
  for (const [key, timestamp] of recentPushEventKeys) {
    if (now - timestamp > windowMs) {
      recentPushEventKeys.delete(key);
    }
  }
  const previous = recentPushEventKeys.get(eventKey);
  if (previous && now - previous <= windowMs) {
    return false;
  }
  recentPushEventKeys.set(eventKey, now);
  return true;
}

function pushCollapseId(eventKey) {
  return String(eventKey || "qiuyuremote")
    .replace(/[^A-Za-z0-9._:-]/g, "_")
    .slice(0, 64);
}

function deeplinkForEvent(event) {
  const params = new URLSearchParams();
  if (event.server?.id) params.set("server", event.server.id);
  if (event.server?.name) params.set("serverName", event.server.name);
  if (event.server?.type) params.set("type", event.server.type);
  if (event.task?.id) params.set("task", event.task.id);
  const query = params.toString();
  return `qiuyuremote://open${query ? `?${query}` : ""}`;
}

function pushSummary(type, delivery) {
  const status = delivery.ok ? "accepted" : "failed";
  const message = delivery.message || delivery.relayMessage || "";
  const suffix = message ? ` message="${message}"` : "";
  return `${new Date().toISOString()} ${type} ${status} sent=${delivery.sent || 0} failed=${delivery.failed || 0}${suffix}`;
}

function relayIdentity() {
  return relay.staticIdentity || store.getRelayIdentity();
}

function publicRelayIdentity(identity) {
  if (!identity) return null;
  return {
    agentId: identity.agentId || "",
    agentName: identity.agentName || "",
    relayBaseURL: identity.relayBaseURL || "",
    source: identity.source || "",
    updatedAt: identity.updatedAt || "",
    createdAt: identity.createdAt || ""
  };
}

function updateRelayIdentityBaseURL(identity, result) {
  if (!relay.staticIdentity && result?.relayBaseURL && result.relayBaseURL !== identity.relayBaseURL) {
    store.setRelayIdentity({ ...identity, relayBaseURL: result.relayBaseURL });
  }
}

function publicServer(server) {
  return {
    id: server.id,
    name: server.name || server.id,
    type: server.type
  };
}

function summarizeMonitorStatus(server, tasks, state) {
  const summary = summarizeTaskStatuses(tasks);
  if (server.type !== "aria2" || tasks.length > 0) {
    return summary;
  }
  if (String(state.lastAria2LiveEventStatus || "").includes(" connected ")) {
    return "no polling tasks; live events connected";
  }
  return summary;
}

function summarizeTaskStatuses(tasks) {
  const counts = new Map();
  for (const task of tasks) {
    counts.set(task.status, (counts.get(task.status) || 0) + 1);
  }
  if (!counts.size) {
    return "no tasks";
  }
  return [...counts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([status, count]) => `${status}=${count}`)
    .join(", ");
}

function formatProgress(value) {
  return `${Math.round(Number(value || 0) * 100)}%`;
}

function finiteNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatDuration(seconds) {
  const value = Math.max(Math.round(Number(seconds || 0)), 0);
  if (value >= 3600 && value % 3600 === 0) {
    return `${value / 3600}h`;
  }
  if (value >= 3600) {
    return `${Math.round(value / 3600)}h`;
  }
  if (value >= 60 && value % 60 === 0) {
    return `${value / 60}min`;
  }
  if (value >= 60) {
    return `${Math.round(value / 60)}min`;
  }
  return `${value}s`;
}

function describeServerEndpoint(server) {
  if (server.type === "ytdlp" || server.type === "yt-dlp") {
    return `${server.binaryPath || "yt-dlp"} downloadDir=${server.downloadDir || ""}`;
  }
  try {
    const url = new URL(server.baseUrl || "");
    return `${url.protocol}//${url.host}${url.pathname}`;
  } catch {
    return server.baseUrl || "missing baseUrl";
  }
}

function serverSecuritySummary(server) {
  if (!server.baseUrl || server.allowInvalidTLS !== true) {
    return "";
  }
  try {
    const url = new URL(server.baseUrl);
    return url.protocol === "https:" ? " tls=allow-invalid" : "";
  } catch {
    return "";
  }
}

function isAuthorized(request) {
  if (!config.apiKey) {
    return isLocalRequest(request);
  }
  const value = String(request.headers.authorization || "").trim();
  return value === config.apiKey || value === `Bearer ${config.apiKey}`;
}

function authorizationMessage(request) {
  if (!config.apiKey && !isLocalRequest(request)) {
    return "Remote access requires an Agent API key. Set apiKey in config.json, restart the Agent, then enter the same key in the Access section.";
  }
  return "Agent API key is missing or incorrect. Enter the apiKey from config.json. For curl, use: Authorization: Bearer <apiKey>.";
}

function isLocalRequest(request) {
  const address = request.socket?.remoteAddress || "";
  return address === "127.0.0.1" || address === "::1" || address === "::ffff:127.0.0.1";
}

async function readJSON(request) {
  const text = await readText(request, MAX_AGENT_BODY_BYTES);
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    const error = new Error("Request body must be valid JSON.");
    error.statusCode = 400;
    error.code = "invalid_json";
    throw error;
  }
}

async function readText(request, maxBytes = MAX_AGENT_BODY_BYTES) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBytes) {
      const error = new Error("Request body is too large.");
      error.statusCode = 413;
      error.code = "request_body_too_large";
      throw error;
    }
    chunks.push(chunk);
  }
  try {
    return UTF8_TEXT_DECODER.decode(Buffer.concat(chunks));
  } catch {
    const error = new Error("Request body must be UTF-8 text.");
    error.statusCode = 400;
    error.code = "request_body_invalid_utf8";
    throw error;
  }
}

function sendJSON(response, statusCode, value) {
  response.writeHead(statusCode, { "Content-Type": "application/json" });
  response.end(JSON.stringify(value));
}

function sendRelayError(response, error) {
  const status = Number.isInteger(error?.statusCode) ? error.statusCode : 502;
  return sendJSON(response, status, {
    ok: false,
    message: error?.message || "Push Relay request failed."
  });
}

function sendHTML(response, value) {
  response.writeHead(200, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(value);
}

function sendFavicon(response, value) {
  response.writeHead(200, {
    "Content-Type": "image/x-icon",
    "Cache-Control": "public, max-age=86400"
  });
  response.end(value);
}

function isWebUIRequest(url) {
  return url === "/" || url === "/ui" || url === "/index.html";
}

function createFaviconICO(kind) {
  const width = 32;
  const height = 32;
  const rgba = Buffer.alloc(width * height * 4);
  const background = kind === "relay" ? [22, 119, 255, 255] : [25, 135, 84, 255];
  const shade = kind === "relay" ? [9, 84, 196, 255] : [16, 105, 66, 255];
  const white = [255, 255, 255, 245];
  const faint = [255, 255, 255, 90];

  const setPixel = (x, y, color) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const offset = (Math.round(y) * width + Math.round(x)) * 4;
    rgba[offset] = color[0];
    rgba[offset + 1] = color[1];
    rgba[offset + 2] = color[2];
    rgba[offset + 3] = color[3];
  };
  const fillCircle = (cx, cy, radius, color) => {
    for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y += 1) {
      for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x += 1) {
        if ((x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2) setPixel(x, y, color);
      }
    }
  };
  const drawLine = (x0, y0, x1, y1, color, thickness = 1) => {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let step = 0; step <= steps; step += 1) {
      const ratio = step / steps;
      fillCircle(x0 + (x1 - x0) * ratio, y0 + (y1 - y0) * ratio, thickness / 2, color);
    }
  };

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const dx = x < 6 ? 6 - x : x > 25 ? x - 25 : 0;
      const dy = y < 6 ? 6 - y : y > 25 ? y - 25 : 0;
      if (dx * dx + dy * dy > 36) continue;
      setPixel(x, y, y > 17 ? shade : background);
    }
  }
  drawLine(8, 8, 24, 24, faint, 1.4);
  if (kind === "agent") {
    drawLine(16, 8, 16, 21, white, 2.6);
    drawLine(10, 16, 16, 22, white, 2.6);
    drawLine(22, 16, 16, 22, white, 2.6);
    drawLine(10, 25, 22, 25, white, 2.4);
  } else {
    drawLine(10, 17, 16, 10, white, 2);
    drawLine(16, 10, 22, 17, white, 2);
    drawLine(10, 17, 22, 17, white, 2);
    drawLine(16, 10, 16, 23, white, 1.8);
    fillCircle(16, 10, 3.2, white);
    fillCircle(10, 17, 3.2, white);
    fillCircle(22, 17, 3.2, white);
    fillCircle(16, 23, 2.7, white);
  }

  const xor = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const source = ((height - 1 - y) * width + x) * 4;
      const target = (y * width + x) * 4;
      xor[target] = rgba[source + 2];
      xor[target + 1] = rgba[source + 1];
      xor[target + 2] = rgba[source];
      xor[target + 3] = rgba[source + 3];
    }
  }
  const mask = Buffer.alloc(height * 4);
  const header = Buffer.alloc(40);
  header.writeUInt32LE(40, 0);
  header.writeInt32LE(width, 4);
  header.writeInt32LE(height * 2, 8);
  header.writeUInt16LE(1, 12);
  header.writeUInt16LE(32, 14);
  header.writeUInt32LE(xor.length, 20);
  const image = Buffer.concat([header, xor, mask]);
  const directory = Buffer.alloc(6);
  directory.writeUInt16LE(1, 2);
  directory.writeUInt16LE(1, 4);
  const entry = Buffer.alloc(16);
  entry[0] = width;
  entry[1] = height;
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(image.length, 8);
  entry.writeUInt32LE(directory.length + entry.length, 12);
  return Buffer.concat([directory, entry, image]);
}
