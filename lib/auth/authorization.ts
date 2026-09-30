import { AuthenticationError } from "@/lib/auth/errors";
import type { CustomerIdentityContext } from "@/lib/customer/contracts";

export type AuthenticatedCustomer = CustomerIdentityContext;

export function requireCustomerIdentity(context: AuthenticatedCustomer | null): AuthenticatedCustomer {
  if (!context?.customerId) {
    throw new AuthenticationError("SESSION_INVALID", "Authentication is required.");
  }
  return context;
}

export function assertCustomerOwnsResource(ownerCustomerId: string, resourceCustomerId: string): void {
  if (ownerCustomerId !== resourceCustomerId) {
    throw new AuthenticationError("SESSION_INVALID", "The requested resource is not available.");
  }
}
