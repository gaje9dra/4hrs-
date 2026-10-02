import { createCustomerRepository } from "@/lib/customer/repository";
import { assertCustomerStatusTransition, normalizeCustomerDisplayName, type CustomerStatus } from "@/lib/customer/domain";

export class CustomerApplicationError extends Error {
  constructor(public readonly code: "CUSTOMER_NOT_FOUND" | "INVALID_REQUEST" | "CONFLICT", message: string) {
    super(message);
    this.name = "CustomerApplicationError";
  }
}

export function createCustomerApplication() {
  const repository = createCustomerRepository();

  async function updateProfile(input: { customerId: string; displayName: unknown; expectedUpdatedAt: Date }) {
    const displayName = normalizeCustomerDisplayName(input.displayName);
    return repository.withTransaction(async (tx) => {
      const current = await tx.findCustomerById(input.customerId);
      if (!current) throw new CustomerApplicationError("CUSTOMER_NOT_FOUND", "Customer could not be found.");
      if (current.updatedAt.getTime() !== input.expectedUpdatedAt.getTime()) throw new CustomerApplicationError("CONFLICT", "Customer changed since it was loaded.");
      const updated = await tx.updateCustomerProfileIfUnchanged(input.customerId, displayName, input.expectedUpdatedAt);
      if (updated.count !== 1) throw new CustomerApplicationError("CONFLICT", "Customer changed since it was loaded.");
      return tx.findCustomerById(input.customerId);
    });
  }

  async function transitionStatus(input: { customerId: string; status: CustomerStatus; expectedUpdatedAt: Date }) {
    return repository.withTransaction(async (tx) => {
      const current = await tx.findCustomerById(input.customerId);
      if (!current) throw new CustomerApplicationError("CUSTOMER_NOT_FOUND", "Customer could not be found.");
      try {
        assertCustomerStatusTransition(current.status as CustomerStatus, input.status);
      } catch (error) {
        throw new CustomerApplicationError("INVALID_REQUEST", error instanceof Error ? error.message : "Customer status transition is invalid.");
      }
      if (current.updatedAt.getTime() !== input.expectedUpdatedAt.getTime()) throw new CustomerApplicationError("CONFLICT", "Customer changed since it was loaded.");
      if (current.status === input.status) return current;
      const updated = await tx.updateCustomerStatusIfUnchanged(input.customerId, input.status, input.expectedUpdatedAt);
      if (updated.count !== 1) throw new CustomerApplicationError("CONFLICT", "Customer changed since it was loaded.");
      return tx.findCustomerById(input.customerId);
    });
  }

  return { updateProfile, transitionStatus };
}
