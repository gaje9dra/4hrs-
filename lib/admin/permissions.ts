export const ADMIN_PERMISSIONS = [
  "catalog.read","catalog.create","catalog.update","catalog.publish","catalog.archive","catalog.category.manage","catalog.collection.manage","catalog.media.manage","catalog.provider_mapping.manage",
  "orders.read","orders.update","orders.cancel",
  "payments.read","payments.view_sensitive","payments.verify","payments.capture","payments.refund","payments.refund_partial","payments.reconcile","payments.retry","payments.audit.read",
  "fulfillment.read","fulfillment.view_sensitive","fulfillment.create","fulfillment.submit","fulfillment.retry","fulfillment.reconcile","fulfillment.cancel","fulfillment.provider.manage","fulfillment.audit.read","fulfillment.manage",
  "shipping.read","shipping.view_sensitive","shipping.create","shipping.reconcile","shipping.recovery","shipping.tracking.read","shipping.audit.read","shipping.manage",
  "returns.read","returns.manage","cancellation.read","cancellation.approve","cancellation.execute","cancellation.audit.read","return.read","return.review","return.approve","return.reject","return.inspect","return.resolve","return.shipment.manage","return.refund","return.audit.read",
  "customers.read","customers.manage",
  "cases.read","case.read","case.create","case.update","case.assign","case.respond","case.resolve","case.reopen","case.audit.read","cases.manage",
  "analytics.read","analytics.financial.read","analytics.operations.read","analytics.customer.read",
  "admin.users.read","admin.users.manage","admin.audit.read",
  "system.settings.read","system.settings.manage",
] as const;
export type AdminPermission = typeof ADMIN_PERMISSIONS[number];
export const ADMIN_ROLES = ["SUPER_ADMIN","ADMIN","OPERATIONS","VIEWER"] as const;
export type AdminRoleName = typeof ADMIN_ROLES[number];
export const HIGH_RISK_ADMIN_PERMISSIONS = new Set<AdminPermission>([
  "payments.refund","payments.refund_partial","payments.verify","payments.capture","payments.reconcile","payments.retry",
  "fulfillment.submit","fulfillment.retry","fulfillment.reconcile","fulfillment.cancel","fulfillment.provider.manage",
  "customers.manage","shipping.create","cancellation.execute","return.resolve","return.shipment.manage","return.refund","case.resolve","case.assign","shipping.reconcile","shipping.recovery","shipping.manage","admin.users.manage","system.settings.manage",
]);
export function isAdminPermission(value: unknown): value is AdminPermission {
  return typeof value === "string" && (ADMIN_PERMISSIONS as readonly string[]).includes(value);
}
export function isAdminRoleName(value: unknown): value is AdminRoleName {
  return typeof value === "string" && (ADMIN_ROLES as readonly string[]).includes(value);
}
