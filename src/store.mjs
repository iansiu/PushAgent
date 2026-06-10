import fs from "node:fs";
import path from "node:path";

export class JSONStore {
  constructor(dataDir) {
    this.dataDir = dataDir;
    fs.mkdirSync(dataDir, { recursive: true });
    this.relayIdentityPath = path.join(dataDir, "relay-identity.json");
    this.taskStatePath = path.join(dataDir, "task-state.json");
    this.relayIdentity = this.#read(this.relayIdentityPath, {});
    this.taskState = this.#read(this.taskStatePath, { tasks: {}, servers: {} });
  }

  getRelayIdentity() {
    if (!this.relayIdentity.agentId || !this.relayIdentity.secret) {
      return null;
    }
    return this.relayIdentity;
  }

  setRelayIdentity(identity) {
    const now = new Date().toISOString();
    this.relayIdentity = {
      ...identity,
      updatedAt: now,
      createdAt: this.relayIdentity.createdAt || now
    };
    this.#write(this.relayIdentityPath, this.relayIdentity);
    return this.relayIdentity;
  }

  getTask(key) {
    return this.taskState.tasks[key];
  }

  setTask(key, value) {
    this.taskState.tasks[key] = { ...value, updatedAt: new Date().toISOString() };
    this.#write(this.taskStatePath, this.taskState);
  }

  getServer(id) {
    return this.taskState.servers[id] || {};
  }

  setServer(id, value) {
    this.taskState.servers[id] = { ...value, updatedAt: new Date().toISOString() };
    this.#write(this.taskStatePath, this.taskState);
  }

  #read(filePath, fallback) {
    if (!fs.existsSync(filePath)) {
      return fallback;
    }
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  }

  #write(filePath, value) {
    const tempPath = `${filePath}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(value, null, 2));
    fs.renameSync(tempPath, filePath);
  }
}
