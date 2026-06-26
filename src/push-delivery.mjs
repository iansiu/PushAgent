export function pushDeliveryHandled(delivery) {
  if (!delivery || delivery.accepted !== true) return false;
  if (delivery.duplicate === true) return true;
  return pushDeliveryReachedDevice(delivery) && Number(delivery.failed || 0) <= 0;
}

export function pushDeliveryReachedDevice(delivery) {
  if (!delivery) return false;
  return Number(delivery.sent || 0) > 0;
}

export function pushRetryExclusionDeviceIds(previous, eventStatus) {
  if (!previous || previous.pendingPushEventStatus !== eventStatus) return [];
  return normalizedDeviceIds(previous.pendingPushSucceededDeviceIds);
}

export function deliveryRetryState(previous, eventStatus, delivery) {
  const now = new Date().toISOString();
  const handled = pushDeliveryHandled(delivery);
  const previousDeviceIds = pushRetryExclusionDeviceIds(previous, eventStatus);
  const succeededDeviceIds = normalizedDeviceIds([
    ...previousDeviceIds,
    ...successfulDeliveryDeviceIds(delivery)
  ]);
  return {
    pendingPushEventStatus: handled ? "" : eventStatus,
    pendingPushSucceededDeviceIds: handled ? [] : succeededDeviceIds,
    lastPushAttemptAt: now,
    lastPushAcceptedAt: handled ? now : previous?.lastPushAcceptedAt || "",
    lastPushError: handled ? "" : delivery?.message || "Push event failed."
  };
}

export function taskStateAfterDelivery(next, previous, eventStatus, delivery) {
  const handled = pushDeliveryHandled(delivery);
  return {
    ...next,
    lastEventStatus: handled ? eventStatus : previous?.lastEventStatus || "",
    ...deliveryRetryState(previous, eventStatus, delivery)
  };
}

function successfulDeliveryDeviceIds(delivery) {
  return (Array.isArray(delivery?.results) ? delivery.results : [])
    .filter((item) => item?.ok === true)
    .map((item) => item.deviceId);
}

function normalizedDeviceIds(values) {
  return [...new Set((Array.isArray(values) ? values : [])
    .map((value) => String(value || "").trim())
    .filter(Boolean))];
}
