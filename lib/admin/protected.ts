/**
 * Administrative authority is database-backed through AdminUser -> AdminRole -> AdminPermission.
 * This module intentionally contains no hardcoded privileged identities or bypasses.
 */
export function isPermanentSuperAdminEmail(_email: string): boolean { return false; }
