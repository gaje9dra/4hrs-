const PERMANENT_SUPER_ADMIN_EMAIL = "gaje9dra@gmail.com";

export function isPermanentSuperAdminEmail(email: string): boolean {
  return email.trim().toLowerCase() === PERMANENT_SUPER_ADMIN_EMAIL;
}

export { PERMANENT_SUPER_ADMIN_EMAIL };
