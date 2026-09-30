import { CustomerIdentityError } from "@/lib/customer/errors";

const EMAIL_MAX_LENGTH = 320;
const DISPLAY_NAME_MAX_LENGTH = 120;

export function normalizeCustomerEmail(email: string): string {
  if (typeof email !== "string") {
    throw new CustomerIdentityError("CUSTOMER_INVALID_EMAIL", "Customer email is invalid.");
  }
  const normalized = email.trim().toLowerCase();
  if (
    !normalized ||
    normalized.length > EMAIL_MAX_LENGTH ||
    /[\u0000-\u001F\u007F\\]/.test(normalized) ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)
  ) {
    throw new CustomerIdentityError("CUSTOMER_INVALID_EMAIL", "Customer email is invalid.");
  }
  return normalized;
}

export function validateDisplayName(value: unknown): string | null {
  if (value === undefined) return null;
  if (typeof value !== "string") {
    throw new CustomerIdentityError("CUSTOMER_INVALID_EMAIL", "Display name is invalid.");
  }
  const name = value.trim();
  if (name.length > DISPLAY_NAME_MAX_LENGTH || /[\u0000-\u001F\u007F]/.test(name)) {
    throw new CustomerIdentityError("CUSTOMER_INVALID_EMAIL", "Display name is invalid.");
  }
  return name || null;
}
