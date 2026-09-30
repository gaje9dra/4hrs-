import { Prisma, type PrismaClient } from "@prisma/client";
import { db } from "@/lib/db/client";

export type CustomerRepositoryClient = PrismaClient | Prisma.TransactionClient;

function clientOrDefault(client?: CustomerRepositoryClient): CustomerRepositoryClient {
  return client ?? db;
}

export function createCustomerRepository(client?: CustomerRepositoryClient) {
  const database = clientOrDefault(client);

  return {
    withTransaction<T>(work: (repository: CustomerRepository) => Promise<T>) {
      if ("$transaction" in database) {
        return database.$transaction((tx) => work(createCustomerRepository(tx)), {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        });
      }
      return work(createCustomerRepository(database));
    },

    findCustomerById(customerId: string) {
      return database.customer.findUnique({ where: { id: customerId } });
    },

    findCustomerByNormalizedEmail(email: string) {
      return database.customer.findUnique({ where: { email } });
    },

    createCustomer(input: { email: string; status?: "ACTIVE" | "DISABLED" | "SUSPENDED" | "PENDING_VERIFICATION"; emailVerifiedAt?: Date | null }) {
      return database.customer.create({
        data: {
          email: input.email,
          ...(input.status ? { status: input.status } : {}),
          ...(input.emailVerifiedAt !== undefined ? { emailVerifiedAt: input.emailVerifiedAt } : {}),
        },
      });
    },

    updateCustomerStatus(customerId: string, status: "ACTIVE" | "DISABLED" | "SUSPENDED" | "PENDING_VERIFICATION") {
      return database.customer.update({ where: { id: customerId }, data: { status } });
    },
    
    updateCustomerProfile(customerId: string, input: { displayName: string | null }) {
      return database.customer.update({
        where: { id: customerId },
        data: { displayName: input.displayName },
      });
    },

    createCredential(input: { customerId: string; passwordHash: string }) {
      return database.customerCredential.create({
        data: { customerId: input.customerId, passwordHash: input.passwordHash },
      });
    },

    findCredentialByCustomerId(customerId: string) {
      return database.customerCredential.findUnique({ where: { customerId } });
    },

    updateCredentialHash(customerId: string, passwordHash: string) {
      return database.customerCredential.update({
        where: { customerId },
        data: { passwordHash },
      });
    },

    createSession(input: {
      customerId: string;
      sessionTokenHash: string;
      expiresAt: Date;
    }) {
      return database.customerSession.create({ data: input });
    },

    findSessionByTokenHash(sessionTokenHash: string) {
      return database.customerSession.findUnique({
        where: { sessionTokenHash },
        include: { customer: true },
      });
    },

    revokeSession(sessionId: string, revokedAt = new Date()) {
      return database.customerSession.update({
        where: { id: sessionId },
        data: { revokedAt },
      });
    },

    touchSession(sessionId: string, lastUsedAt = new Date()) {
      return database.customerSession.update({
        where: { id: sessionId },
        data: { lastUsedAt },
      });
    },

    findCustomerCart(customerId: string) {
      return database.cart.findUnique({ where: { customerId } });
    },
  };
}

export type CustomerRepository = ReturnType<typeof createCustomerRepository>;
