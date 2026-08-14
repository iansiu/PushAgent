import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { loadConfig } from "../src/config.mjs";

test("monitor service status notices can be disabled", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pushagent-config-"));
  const configPath = path.join(dir, "config.json");
  fs.writeFileSync(configPath, JSON.stringify({
    relay: { urls: ["https://push.example.com"] },
    monitor: { serviceStatusNoticeEnabled: false },
    servers: []
  }));
  const previousConfig = process.env.QIUYU_AGENT_CONFIG;
  delete process.env.QIUYU_AGENT_SERVICE_STATUS_NOTICE_ENABLED;
  process.env.QIUYU_AGENT_CONFIG = configPath;
  try {
    const config = loadConfig();
    assert.equal(config.monitor.serviceStatusNoticeEnabled, false);
  } finally {
    if (previousConfig === undefined) {
      delete process.env.QIUYU_AGENT_CONFIG;
    } else {
      process.env.QIUYU_AGENT_CONFIG = previousConfig;
    }
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
