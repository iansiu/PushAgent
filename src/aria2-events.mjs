import crypto from "node:crypto";
import http from "node:http";
import https from "node:https";

const DEFAULT_RECONNECT_MS = 5_000;
const MAX_RECONNECT_MS = 60_000;

export class Aria2EventClient {
  constructor(server, { onEvent, onStatus }) {
    this.server = server;
    this.onEvent = onEvent;
    this.onStatus = onStatus;
    this.socket = null;
    this.buffer = Buffer.alloc(0);
    this.stopped = false;
    this.reconnectMs = DEFAULT_RECONNECT_MS;
    this.reconnectTimer = null;
  }

  start() {
    if (this.stopped) {
      this.stopped = false;
    }
    this.connect();
  }

  stop() {
    this.stopped = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }
  }

  connect() {
    if (this.stopped) return;
    let websocketURL;
    try {
      websocketURL = aria2WebSocketURL(this.server);
    } catch (error) {
      this.scheduleReconnect(`invalid websocket URL: ${error.message || error}`);
      return;
    }
    const requestURL = websocketHandshakeURL(websocketURL);
    const key = crypto.randomBytes(16).toString("base64");
    const transport = requestURL.protocol === "https:" ? https : http;
    const request = transport.request(requestURL, {
      method: "GET",
      rejectUnauthorized: shouldAllowInvalidTLS(this.server) ? false : undefined,
      headers: {
        Upgrade: "websocket",
        Connection: "Upgrade",
        "Sec-WebSocket-Version": "13",
        "Sec-WebSocket-Key": key
      }
    });

    request.on("upgrade", (response, socket, head) => {
      if (response.statusCode !== 101) {
        socket.destroy();
        this.scheduleReconnect(`unexpected websocket status ${response.statusCode || 0}`);
        return;
      }
      this.socket = socket;
      this.buffer = Buffer.alloc(0);
      this.reconnectMs = DEFAULT_RECONNECT_MS;
      this.onStatus?.("connected", websocketURL.toString());
      socket.on("data", (chunk) => this.handleData(chunk));
      socket.on("close", () => this.scheduleReconnect("connection closed"));
      socket.on("error", (error) => this.scheduleReconnect(error.message || String(error)));
      if (head?.length) {
        this.handleData(head);
      }
    });

    request.on("response", (response) => {
      response.resume();
      this.scheduleReconnect(`websocket handshake failed (${response.statusCode || 0})`);
    });
    request.on("error", (error) => {
      this.scheduleReconnect(error.message || String(error));
    });
    request.end();
  }

  scheduleReconnect(reason) {
    if (this.stopped) return;
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }
    if (this.reconnectTimer) return;
    const delay = this.reconnectMs;
    this.reconnectMs = Math.min(this.reconnectMs * 2, MAX_RECONNECT_MS);
    this.onStatus?.("reconnect", `${reason}; retrying in ${Math.round(delay / 1000)}s`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  handleData(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    while (this.buffer.length >= 2) {
      const frame = readFrame(this.buffer);
      if (!frame) return;
      this.buffer = this.buffer.slice(frame.bytesRead);
      if (frame.opcode === 0x1) {
        this.handleText(frame.payload.toString("utf8"));
      } else if (frame.opcode === 0x8) {
        this.scheduleReconnect("server closed websocket");
        return;
      } else if (frame.opcode === 0x9) {
        this.sendFrame(0xA, frame.payload);
      }
    }
  }

  handleText(text) {
    let payload;
    try {
      payload = JSON.parse(text);
    } catch {
      this.onStatus?.("warning", "received non-JSON websocket message");
      return;
    }
    if (payload?.method) {
      this.onEvent?.(payload);
    }
  }

  sendFrame(opcode, payload = Buffer.alloc(0)) {
    if (!this.socket || this.socket.destroyed) return;
    const body = Buffer.isBuffer(payload) ? payload : Buffer.from(payload);
    const mask = crypto.randomBytes(4);
    const header = frameHeader(opcode, body.length, mask);
    const masked = Buffer.alloc(body.length);
    for (let index = 0; index < body.length; index += 1) {
      masked[index] = body[index] ^ mask[index % 4];
    }
    this.socket.write(Buffer.concat([header, masked]));
  }
}

export function aria2WebSocketURL(server) {
  const url = new URL(server.websocketUrl || server.wsUrl || server.baseUrl);
  if (url.protocol === "https:") {
    url.protocol = "wss:";
  } else if (url.protocol === "http:") {
    url.protocol = "ws:";
  }
  return url;
}

function websocketHandshakeURL(websocketURL) {
  const url = new URL(websocketURL);
  if (url.protocol === "wss:") {
    url.protocol = "https:";
  } else if (url.protocol === "ws:") {
    url.protocol = "http:";
  }
  return url;
}

function readFrame(buffer) {
  const first = buffer[0];
  const second = buffer[1];
  const opcode = first & 0x0f;
  const masked = (second & 0x80) !== 0;
  let length = second & 0x7f;
  let offset = 2;
  if (length === 126) {
    if (buffer.length < offset + 2) return null;
    length = buffer.readUInt16BE(offset);
    offset += 2;
  } else if (length === 127) {
    if (buffer.length < offset + 8) return null;
    const bigLength = buffer.readBigUInt64BE(offset);
    if (bigLength > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new Error("WebSocket frame is too large.");
    }
    length = Number(bigLength);
    offset += 8;
  }
  let mask = null;
  if (masked) {
    if (buffer.length < offset + 4) return null;
    mask = buffer.slice(offset, offset + 4);
    offset += 4;
  }
  if (buffer.length < offset + length) return null;
  const payload = Buffer.from(buffer.slice(offset, offset + length));
  if (mask) {
    for (let index = 0; index < payload.length; index += 1) {
      payload[index] ^= mask[index % 4];
    }
  }
  return { opcode, payload, bytesRead: offset + length };
}

function frameHeader(opcode, length, mask) {
  const lengthBytes = length < 126 ? 0 : length <= 0xffff ? 2 : 8;
  const header = Buffer.alloc(2 + lengthBytes + mask.length);
  header[0] = 0x80 | opcode;
  if (length < 126) {
    header[1] = 0x80 | length;
    mask.copy(header, 2);
  } else if (length <= 0xffff) {
    header[1] = 0x80 | 126;
    header.writeUInt16BE(length, 2);
    mask.copy(header, 4);
  } else {
    header[1] = 0x80 | 127;
    header.writeBigUInt64BE(BigInt(length), 2);
    mask.copy(header, 10);
  }
  return header;
}

function shouldAllowInvalidTLS(server) {
  return server.allowInvalidTLS === true
    || server.allowSelfSignedTLS === true
    || server.tlsRejectUnauthorized === false
    || server.rejectUnauthorized === false;
}
