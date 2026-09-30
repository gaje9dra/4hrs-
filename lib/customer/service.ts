import { Prisma } from "@prisma/client";
import { createCustomerRepository, type CustomerRepository } from "@/lib/customer/repository";
import { CustomerIdentityError } from "@/lib/customer/errors";
import { normalizeCustomerEmail } from "@/lib/customer/validation";
import { toCustomerDto, type CustomerDto, type CustomerStatus } from "@/lib/customer/contracts";

function mapPersistenceError(error: unknown): never {
  if (error instanceof CustomerIdentityError) throw error;
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      throw new CustomerIdentityError("CUSTOMER_DUPLICATE_EMAIL", "Customer identity already exists.");
    }
    if (error.code === "P2025") {
      throw new CustomerIdentityError("CUSTOMER_NOT_FOUND", "Customer identity was not found.");
    }
  }
  throw new CustomerIdentityError("CUSTOMER_DATABASE_ERROR", "Customer identity persistence operation failed.", { cause: error });
}

function assertPasswordHash(passwordHash: string) {
  if (typeof passwordHash !== "string" || passwordHash.trim().length < 20) {
    throw new CustomerIdentityError("CUSTOMER_DATABASE_ERROR", "A password hash is required for credential persistence.");
  }
}

function assertSessionTokenHash(sessionTokenHash: string) {
  if (typeof sessionTokenHash !== "string" || sessionTokenHash.trim().length < 32) {
    throw new CustomerIdentityError("CUSTOMER_DATABASE_ERROR", "A hashed session identifier is required.");
  }
}

export function createCustomerIdentityService(dependencies: { repository?: CustomerRepository } = {}) {
  const repository = dependencies.repository ?? createCustomerRepository();

  async function createCustomer(input: {
    email: string;
    status?: CustomerStatus;
    emailVerifiedAt?: Date | null;
    passwordHash?: string;
  }): Promise<CustomerDto> {
    let email: string;
    try {
      email = normalizeCustomerEmail(input.email);
    } catch (error) {
      throw new CustomerIdentityError("CUSTOMER_INVALID_EMAIL", "Customer email is invalid.", { cause: error });
    }

    if (input.passwordHash !== undefined) assertPasswordHash(input.passwordHash);

    try {
      const customer = await repository.withTransaction(async (tx) => {
        const existing = await tx.findCustomerByNormalizedEmail(email);
        if (existing) {
          throw new CustomerIdentityError("CUSTOMER_DUPLICATE_EMAIL", "Customer identity already exists.");
        }

        const created = await tx.createCustomer({
          email,
          status: input.status,
          emailVerifiedAt: input.emailVerifiedAt,
        });

        if (input.passwordHash !== undefined) {
          await tx.createCredential({ customerId: created.id, passwordHash: input.passwordHash });
        }

        return created;
      });

      return toCustomerDto(customer);
    } catch (error) {
      mapPersistenceError(error);
    }
  }

  async function getCustomerById(customerId: string): Promise<CustomerDto> {
    try {
      const customer = await repository.findCustomerById(customerId);
      if (!customer) throw new CustomerIdentityError("CUSTOMER_NOT_FOUND", "Customer identity was not found.");
      return toCustomerDto(customer);
    } catch (error) {
      mapPersistenceError(error);
    }
  }

  async function getCustomerByEmail(emailInput: string): Promise<CustomerDto> {
    let email: string;
    try {
      email = normalizeCustomerEmail(emailInput);
    } catch (error) {
      throw new CustomerIdentityError("CUSTOMER_INVALID_EMAIL", "Customer email is invalid.", { cause: error });
    }

    try {
      const customer = await repository.findCustomerByNormalizedEmail(email);
      if (!customer) throw new CustomerIdentityError("CUSTOMER_NOT_FOUND", "Customer identity was not found.");
      return toCustomerDto(customer);
    } catch (error) {
      mapPersistenceError(error);
    }
  }

  async function updateAccountStatus(customerId: string, status: CustomerStatus): Promise<CustomerDto> {
    try {
      return toCustomerDto(await repository.updateCustomerStatus(customerId, status));
    } catch (error) {
      mapPersistenceError(error);
    }
  }

  async function createSession(input: { customerId: string; sessionTokenHash: string; expiresAt: Date }) {
    assertSessionTokenHash(input.sessionTokenHash);
    try {
      const session = await repository.createSession(input);
      return {
        id: session.id,
        customerId: session.customerId,
        createdAt: session.createdAt,
        expiresAt: session.expiresAt,
        revokedAt: session.revokedAt,
        lastUsedAt: session.lastUsedAt,
      };
    } catch (error) {
      mapPersistenceError(error);
    }
  }

  async function revokeSession(sessionId: string) {
    try {
      return await repository.revokeSession(sessionId);
    } catch (error) {
      mapPersistenceError(error);
    }
  }

  async function resolveSession(sessionTokenHash: string) {
    assertSessionTokenHash(sessionTokenHash);
    try {
      const session = await repository.findSessionByTokenHash(sessionTokenHash);
      if (!session || session.revokedAt || session.expiresAt <= new Date()) {
        throw new CustomerIdentityError("CUSTOMER_SESSION_NOT_FOUND", "Customer session was not found.");
      }
      if (session.customer.status !== "ACTIVE") {
        throw new CustomerIdentityError("CUSTOMER_SESSION_NOT_FOUND", "Customer session was not found.");
      }
      return { sessionId: session.id, customer: toCustomerDto(session.customer) };
    } catch (error) {
      mapPersistenceError(error);
    }
  }

  return {
    createCustomer,
    getCustomerById,
    getCustomerByEmail,
    updateAccountStatus,
    createSession,
    resolveSession,
    revokeSession,
  };
}

export type CustomerIdentityService = ReturnType<typeof createCustomerIdentityService>;
