import assert from "node:assert/strict";
import test from "node:test";

import {
  deliveryRetryState,
  pushDeliveryHandled,
  pushDeliveryReachedDevice,
  pushRetryExclusionDeviceIds,
  taskStateAfterDelivery
} from "../src/push-delivery.mjs";

test("delivery with no target devices is not handled", () => {
  const delivery = {
    ok: true,
    accepted: true,
    sent: 0,
    failed: 0,
    message: "No target devices are paired for this event."
  };

  assert.equal(pushDeliveryHandled(delivery), false);
  assert.equal(pushDeliveryReachedDevice(delivery), false);
  const next = taskStateAfterDelivery({ id: "task-1", status: "completed" }, { lastEventStatus: "" }, "completed", delivery);
  assert.equal(next.lastEventStatus, "");
  assert.equal(next.lastPushAcceptedAt, "");
  assert.equal(next.lastPushError, delivery.message);
});

test("recent duplicate delivery is treated as handled", () => {
  assert.equal(pushDeliveryHandled({
    ok: true,
    accepted: true,
    duplicate: true,
    sent: 0,
    failed: 0
  }), true);
});

test("partial delivery retries only devices that have not succeeded", () => {
  const delivery = {
    ok: true,
    accepted: true,
    sent: 1,
    failed: 1,
    results: [
      { deviceId: "device-1", ok: true },
      { deviceId: "device-2", ok: false, reason: "APNs timeout" }
    ]
  };

  assert.equal(pushDeliveryHandled(delivery), false);
  assert.equal(pushDeliveryReachedDevice(delivery), true);
  const partial = taskStateAfterDelivery(
    { id: "task-1", status: "completed" },
    { lastEventStatus: "" },
    "completed",
    delivery
  );
  assert.equal(partial.lastEventStatus, "");
  assert.deepEqual(pushRetryExclusionDeviceIds(partial, "completed"), ["device-1"]);

  const retry = {
    ok: true,
    accepted: true,
    sent: 1,
    failed: 0,
    results: [{ deviceId: "device-2", ok: true }]
  };
  const completed = taskStateAfterDelivery(
    { id: "task-1", status: "completed" },
    partial,
    "completed",
    retry
  );
  assert.equal(pushDeliveryHandled(retry), true);
  assert.equal(completed.lastEventStatus, "completed");
  assert.deepEqual(completed.pendingPushSucceededDeviceIds, []);
  assert.deepEqual(pushRetryExclusionDeviceIds(completed, "completed"), []);
});

test("delivery retry state does not reuse exclusions for a different event", () => {
  const previous = {
    pendingPushEventStatus: "server_offline",
    pendingPushSucceededDeviceIds: ["device-1"]
  };
  assert.deepEqual(pushRetryExclusionDeviceIds(previous, "server_online"), []);
  const next = deliveryRetryState(previous, "server_online", {
    accepted: false,
    sent: 0,
    failed: 0,
    message: "Relay unavailable"
  });
  assert.deepEqual(next.pendingPushSucceededDeviceIds, []);
});
