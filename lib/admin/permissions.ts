export const ADMIN_PERMISSIONS = [
  "catalog.read","catalog.create","catalog.update","catalog.publish","catalog.archive","catalog.category.manage","catalog.collection.manage","catalog.media.manage","catalog.provider_mapping.manage",
  "orders.read","orders.update","orders.cancel",
  "payments.read","payments.view_sensitive","payments.verify","payments.capture","payments.refund","payments.refund_partial","payments.reconcile","payments.retry","payments.audit.read",
  "fulfillment.read","fulfillment.manage",
  "shipping.read","shipping.manage",
  "returns.read","returns.manage",
  "customers.read","customers.manage",
  "cases.read","cases.manage",
  "analytics.read",
  "admin.users.read","admin.users.manage","admin.audit.read",
  "system.settings.read","system.settings.manage",
] as const;
export type AdminPermission = typeof ADMIN_PERMISSIONS[number];
export const ADMIN_ROLES = ["SUPER_ADMIN","ADMIN","OPERATIONS","VIEWER"] as const;
export type AdminRoleName = typeof ADMIN_ROLES[number];
export const HIGH_RISK_ADMIN_PERMISSIONS = new Set<AdminPermission>([
  "payments.refund","payments.refund_partial","payments.verify","payments.capture","payments.reconcile","payments.retry","customers.manage","fulfillment.manage","shipping.manage",
  "admin.users.manage","system.settings.manage",
]);
export function isAdminPermission(value: unknown): value is AdminPermission {
  return typeof value === "string" && (ADMIN_PERMISSIONS as readonly string[]).includes(value);
}
export function isAdminRoleName(value: unknown): value is AdminRoleName {
  return typeof value === "string" && (ADMIN_ROLES as readonly string[]).includes(value);
}