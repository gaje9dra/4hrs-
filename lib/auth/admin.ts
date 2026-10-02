import { AuthenticationError } from "@/lib/auth/errors";
import { requireCurrentCustomer } from "@/lib/auth/context";

function configuredAdminEmails(): Set<string> {
  return new Set(
    (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export async function requireAdmin(request?: Request) {
  const customer = await requireCurrentCustomer(request);
  if (!configuredAdminEmails().has(customer.customer.email.toLowerCase())) {
    throw new AuthenticationError("SESSION_INVALID", "Administrator access is required.");
  }
  return customer;
}
