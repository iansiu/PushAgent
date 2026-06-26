import crypto from "node:crypto";
import { APP_VERSION } from "./version.mjs";

const AGENT_USER_AGENT = `QiuyuRemote-PushAgent/${APP_VERSION}`;

export class RelayClient {
  constructor(relayConfig) {
    this.baseURLs = normalizeRelayBaseURLs(relayConfig.urls || relayConfig.url);
    this.staticIdentity = relayConfig.agentId && relayConfig.secret
      ? { agentId: relayConfig.agentId, secret: relayConfig.secret, source: "config", relayBaseURL: this.baseURLs[0] }
      : null;
  }

  async pair({ pairingCode, agentName, identity = this.staticIdentity }) {
    const body = JSON.stringify({ pairingCode, agentName, agentVersion: APP_VERSION });
    const preferredBaseURL = normalizeRelayBaseURL(identity?.relayBaseURL || "");
    return this.#withRelayFallback(async (baseURL) => {
      const headers = {
        "Content-Type": "application/json",
        "User-Agent": AGENT_USER_AGENT,
        "X-Qiuyu-Agent-Version": APP_VERSION,
        "X-Push-Agent-Version": APP_VERSION
      };
      if (identity?.agentId && identity?.secret) {
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const nonce = crypto.randomBytes(16).toString("hex");
        headers["X-Qiuyu-Agent-ID"] = identity.agentId;
        headers["X-Qiuyu-Timestamp"] = timestamp;
        headers["X-Qiuyu-Nonce"] = nonce;
        headers["X-Qiuyu-Signature"] = hmac(identity.secret, `${timestamp}.${nonce}.${body}`);
      }
      const response = await fetch(endpointURL(baseURL, "/v1/agents/pair"), {
        method: "POST",
        headers,
        body
      });
      const text = await response.text();
      const payload = parseRelayJSON(text, {
        baseURL,
        response,
        fallbackMessage: "Relay pairing failed"
      });
      if (!response.ok || payload.ok === false) {
        throw new RelayRequestError(payload.message || `Relay pairing failed (${response.status})`, response.status, {
          retryable: isPairingCodeLookupMiss(payload.message, response.status) || isPairingIdentitySyncMiss(payload.message, response.status),
          relayBaseURL: baseURL
        });
      }
      if (!payload.agentId || !payload.secret) {
        throw new RelayRequestError("Relay did not return Agent credentials.", 502, {
          retryable: true,
          relayBaseURL: baseURL
        });
      }
      return { ...payload, relayBaseURL: baseURL };
    }, preferredBaseURL ? [preferredBaseURL] : []);
  }

  async sendEvent(event, identity = this.staticIdentity) {
    if (!identity?.agentId || !identity?.secret) {
      throw new Error("Agent is not paired with Push Relay.");
    }
    const body = JSON.stringify(event);
    const preferredBaseURL = normalizeRelayBaseURL(identity.relayBaseURL || "");
    return this.#withRelayFallback(async (baseURL) => {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const nonce = crypto.randomBytes(16).toString("hex");
      const signature = hmac(identity.secret, `${timestamp}.${nonce}.${body}`);
      const response = await fetch(endpointURL(baseURL, "/v1/push/events"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": AGENT_USER_AGENT,
          "X-Qiuyu-Agent-Version": APP_VERSION,
          "X-Push-Agent-Version": APP_VERSION,
          "X-Qiuyu-Agent-ID": identity.agentId,
          "X-Qiuyu-Timestamp": timestamp,
          "X-Qiuyu-Nonce": nonce,
          "X-Qiuyu-Signature": signature
        },
        body
      });
      const text = await response.text();
      if (!response.ok) {
        throw new RelayRequestError(`Relay failed (${response.status}) at ${baseURL}: ${responseSnippet(text)}`, response.status, {
          retryable: response.status >= 500,
          relayBaseURL: baseURL
        });
      }
      const payload = parseRelayJSON(text, {
        baseURL,
        response,
        fallbackMessage: "Relay event delivery failed",
        emptyPayload: { ok: true }
      });
      return { ...payload, relayBaseURL: baseURL };
    }, preferredBaseURL ? [preferredBaseURL] : []);
  }

  async agentState(identity = this.staticIdentity) {
    return this.#signedAgentRequest({
      method: "GET",
      path: "/v1/agents/me",
      identity
    });
  }

  async removeAgentDevice(deviceId, identity = this.staticIdentity) {
    return this.#signedAgentRequest({
      method: "DELETE",
      path: `/v1/agents/me/devices/${encodeURIComponent(deviceId)}`,
      identity
    });
  }

  async removeAgentPairingCode(code, identity = this.staticIdentity) {
    return this.#signedAgentRequest({
      method: "DELETE",
      path: `/v1/agents/me/pairing-codes/${encodeURIComponent(code)}`,
      identity
    });
  }

  async #signedAgentRequest({ method, path, body = "", identity = this.staticIdentity }) {
    if (!identity?.agentId || !identity?.secret) {
      throw new Error("Agent is not paired with Push Relay.");
    }
    const rawBody = body ? JSON.stringify(body) : "";
    const preferredBaseURL = normalizeRelayBaseURL(identity.relayBaseURL || "");
    return this.#withRelayFallback(async (baseURL) => {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const nonce = crypto.randomBytes(16).toString("hex");
      const signature = hmac(identity.secret, `${timestamp}.${nonce}.${rawBody}`);
      const headers = {
        "Accept": "application/json",
        "User-Agent": AGENT_USER_AGENT,
        "X-Qiuyu-Agent-Version": APP_VERSION,
        "X-Push-Agent-Version": APP_VERSION,
        "X-Qiuyu-Agent-ID": identity.agentId,
        "X-Qiuyu-Timestamp": timestamp,
        "X-Qiuyu-Nonce": nonce,
        "X-Qiuyu-Signature": signature
      };
      if (rawBody) {
        headers["Content-Type"] = "application/json";
      }
      const response = await fetch(endpointURL(baseURL, path), {
        method,
        headers,
        body: rawBody || undefined
      });
      const text = await response.text();
      const payload = parseRelayJSON(text, {
        baseURL,
        response,
        fallbackMessage: "Relay Agent request failed"
      });
      if (!response.ok || payload.ok === false) {
        throw new RelayRequestError(payload.message || `Relay failed (${response.status})`, response.status, {
          relayBaseURL: baseURL
        });
      }
      return { ...payload, relayBaseURL: baseURL };
    }, preferredBaseURL ? [preferredBaseURL] : []);
  }

  async #withRelayFallback(operation, preferredBaseURLs = []) {
    let lastError;
    for (const baseURL of this.#candidateBaseURLs(preferredBaseURLs)) {
      try {
        return await operation(baseURL);
      } catch (error) {
        lastError = error;
        if (!shouldTryNextRelay(error)) {
          break;
        }
      }
    }
    throw lastError || new Error("No Push Relay URL is available.");
  }

  #candidateBaseURLs(preferredBaseURLs) {
    const seen = new Set();
    return [...preferredBaseURLs, ...this.baseURLs].map(normalizeRelayBaseURL).filter((normalized) => {
      if (!normalized || seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    });
  }
}

class RelayRequestError extends Error {
  constructor(message, statusCode, options = {}) {
    super(message);
    this.statusCode = statusCode;
    this.retryable = Boolean(options.retryable);
    this.relayBaseURL = options.relayBaseURL || "";
  }
}

function shouldTryNextRelay(error) {
  if (error instanceof RelayRequestError) {
    return error.retryable || error.statusCode >= 500;
  }
  return true;
}

function isPairingCodeLookupMiss(message, statusCode) {
  if (statusCode !== 404) return false;
  return /pairing code was not found|pairing code was not found or has expired|device for this pairing code is no longer registered/i.test(String(message || ""));
}

function isPairingIdentitySyncMiss(message, statusCode) {
  if (statusCode !== 403) return false;
  return /unknown agent/i.test(String(message || ""));
}

function parseRelayJSON(text, { baseURL, response, fallbackMessage, emptyPayload = {} }) {
  if (!text) return emptyPayload;
  try {
    return JSON.parse(text);
  } catch {
    throw new RelayRequestError(
      `${fallbackMessage}: Relay returned a non-JSON response at ${baseURL} (${response.status}). ${responseSnippet(text)}`,
      response.status || 502,
      {
        retryable: true,
        relayBaseURL: baseURL
      }
    );
  }
}

function responseSnippet(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180) || "empty response";
}

function normalizeRelayBaseURLs(value) {
  const values = Array.isArray(value) ? value : [value];
  const seen = new Set();
  const urls = values
    .map(normalizeRelayBaseURL)
    .filter(Boolean)
    .filter((baseURL) => {
      if (seen.has(baseURL)) return false;
      seen.add(baseURL);
      return true;
    });
  if (!urls.length) {
    throw new Error("Missing Relay URL.");
  }
  return urls;
}

function normalizeRelayBaseURL(value) {
  const input = String(value || "").trim();
  if (!input) {
    return "";
  }
  const url = new URL(input.includes("://") ? input : `https://${input}`);
  url.search = "";
  url.hash = "";
  url.pathname = url.pathname
    .replace(/\/v1\/push\/events\/?$/, "")
    .replace(/\/v1\/agents\/pair\/?$/, "")
    .replace(/\/v1\/agents\/me\/?$/, "")
    .replace(/\/+$/, "");
  return url.toString().replace(/\/+$/, "");
}

function hmac(secret, value) {
  return crypto.createHmac("sha256", secret).update(value).digest("base64url");
}

function endpointURL(baseURL, path) {
  const url = new URL(baseURL);
  url.pathname = `${url.pathname.replace(/\/+$/, "")}${path}`;
  return url;
}
