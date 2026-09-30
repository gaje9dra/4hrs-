const EMAIL_MAX_LENGTH = 320;

export function normalizeCustomerEmail(email: string): string {
  if (typeof email !== "string") {
    throw new Error("Customer email must be a string.");
  }

  const normalized = email.trim().toLowerCase();
  if (!normalized || normalized.length > EMAIL_MAX_LENGTH || !normalized.includes("@")) {
    throw new Error("Customer email is invalid.");
  }

  return normalized;
}
