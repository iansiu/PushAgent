import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";

import { RelayClient } from "../src/relay-client.mjs";

test("pairing retries the next Relay when a node has the code but not the device yet", async () => {
  const first = await startRelayStub((request, response) => {
    assert.equal(request.url, "/v1/agents/pair");
    response.writeHead(404, { "Content-Type": "application/json" });
    response.end(JSON.stringify({
      ok: false,
      message: "QiuyuRemote device for this pairing code is no longer registered."
    }));
  });
  const second = await startRelayStub((request, response) => {
    assert.equal(request.url, "/v1/agents/pair");
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({
      ok: true,
      message: "Agent paired with Push Relay.",
      agentId: "agent_1",
      secret: "secret_1"
    }));
  });

  try {
    const client = new RelayClient({
      urls: [first.url, second.url]
    });
    const result = await client.pair({
      pairingCode: "EGVL-MZXD",
      agentName: "Home Agent",
      identity: null
    });

    assert.equal(result.agentId, "agent_1");
    assert.equal(result.relayBaseURL, second.url);
    assert.equal(first.requests, 1);
    assert.equal(second.requests, 1);
  } finally {
    await first.close();
    await second.close();
  }
});

async function startRelayStub(handler) {
  let requests = 0;
  const server = http.createServer((request, response) => {
    requests += 1;
    handler(request, response);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  return {
    get requests() {
      return requests;
    },
    url: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    })
  };
}
