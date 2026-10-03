export const ADMIN_PERMISSIONS = [
  "catalog.read","catalog.create","catalog.update","catalog.publish","catalog.archive","catalog.category.manage","catalog.collection.manage","catalog.media.manage","catalog.provider_mapping.manage",
  "orders.read","orders.update","orders.cancel",
  "payments.read","payments.view_sensitive","payments.verify","payments.capture","payments.refund","payments.refund_partial","payments.reconcile","payments.retry","payments.audit.read",
  "fulfillment.read","fulfillment.view_sensitive","fulfillment.create","fulfillment.submit","fulfillment.retry","fulfillment.reconcile","fulfillment.cancel","fulfillment.provider.manage","fulfillment.audit.read","fulfillment.manage",
  "shipping.read","shipping.view_sensitive","shipping.create","shipping.reconcile","shipping.recovery","shipping.tracking.read","shipping.audit.read","shipping.manage",
  "returns.read","returns.manage","cancellation.read","cancellation.approve","cancellation.execute","cancellation.audit.read","return.read","return.review","return.approve","return.reject","return.inspect","return.resolve","return.shipment.manage","return.refund","return.audit.read",
  "customers.read","customers.search","customers.update","customers.status.manage","customers.address.read","customers.financial.read","customers.case.read","customers.case.create","customers.audit.read","customers.manage",
  "cases.read","case.read","case.create","case.update","case.assign","case.respond","case.resolve","case.reopen","case.audit.read","cases.manage",
  "analytics.read","merchandising.read","merchandising.manage","discovery.read","analytics.financial.read","analytics.operations.read","analytics.customer.read","notifications.read","notifications.manage","communication.preference.read","communication.preference.manage","communication.preference.audit.read",
  "admin.users.read","admin.users.manage","admin.audit.read","content.read","content.create","content.update","content.review","content.approve","content.publish","content.schedule","content.rollback","content.archive","content.preview","feature_flags.read","feature_flags.manage","experiments.read","experiments.manage",
  "system.settings.read","system.settings.manage",
  "governance.read","governance.verify","governance.manage","governance.evidence.manage","governance.exceptions.manage","governance.export",
] as const;
export type AdminPermission = typeof ADMIN_PERMISSIONS[number];
export const ADMIN_ROLES = ["SUPER_ADMIN","ADMIN","OPERATIONS","VIEWER"] as const;
export type AdminRoleName = typeof ADMIN_ROLES[number];
export const HIGH_RISK_ADMIN_PERMISSIONS = new Set<AdminPermission>([
  "payments.refund","payments.refund_partial","payments.verify","payments.capture","payments.reconcile","payments.retry",
  "fulfillment.submit","fulfillment.retry","fulfillment.reconcile","fulfillment.cancel","fulfillment.provider.manage",
  "customers.manage","customers.status.manage","communication.preference.manage","customers.update","shipping.create","cancellation.execute","return.resolve","return.shipment.manage","return.refund","case.resolve","case.assign","shipping.reconcile","shipping.recovery","shipping.manage","admin.users.manage","content.publish","content.schedule","content.rollback","content.archive","system.settings.manage","governance.verify","governance.manage","governance.evidence.manage","governance.exceptions.manage","governance.export",
]);
export function isAdminPermission(value: unknown): value is AdminPermission {
  return typeof value === "string" && (ADMIN_PERMISSIONS as readonly string[]).includes(value);
}
export function isAdminRoleName(value: unknown): value is AdminRoleName {
  return typeof value === "string" && (ADMIN_ROLES as readonly string[]).includes(value);
}
