const DEFAULT_ENTITLEMENT_IDS = ['pro', 'pay-35 Pro', 'pay-35-pro', 'pay_35_pro'];

function resolveEntitlementIds(raw) {
  if (raw && String(raw).trim()) {
    const parsed = String(raw)
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
    if (parsed.length > 0) return parsed;
  }
  return [...DEFAULT_ENTITLEMENT_IDS];
}

function findActiveEntitlement(customerInfo, ids) {
  const active = customerInfo?.entitlements?.active || {};
  for (const id of ids) {
    if (Object.prototype.hasOwnProperty.call(active, id)) return id;
  }
  return null;
}

module.exports = {
  DEFAULT_ENTITLEMENT_IDS,
  resolveEntitlementIds,
  findActiveEntitlement,
};
