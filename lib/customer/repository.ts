import { Prisma, type PrismaClient } from "@prisma/client";
import { randomBytes, randomUUID } from "node:crypto";
import { db } from "@/lib/db/client";

export type CustomerRepositoryClient = PrismaClient | Prisma.TransactionClient;

type CustomerRecord = Prisma.CustomerGetPayload<Record<string, never>>;
type CredentialRecord = Prisma.CustomerCredentialGetPayload<Record<string, never>>;
type SessionRecord = Prisma.CustomerSessionGetPayload<{ include: { customer: true } }>;

export type CustomerRepository = {
  withTransaction<T>(work: (repository: CustomerRepository) => Promise<T>): Promise<T>;
  findCustomerById(customerId: string): Promise<CustomerRecord | null>;
  findCustomerByNormalizedEmail(email: string): Promise<CustomerRecord | null>;
  createCustomer(input: { email: string; status?: "ACTIVE" | "DISABLED" | "SUSPENDED" | "PENDING_VERIFICATION"; emailVerifiedAt?: Date | null }): Promise<CustomerRecord>;
  updateCustomerStatus(customerId: string, status: "ACTIVE" | "DISABLED" | "SUSPENDED" | "PENDING_VERIFICATION"): Promise<CustomerRecord>;
  updateCustomerStatusIfUnchanged(customerId: string, status: "ACTIVE" | "DISABLED" | "SUSPENDED" | "PENDING_VERIFICATION", expectedUpdatedAt: Date): Promise<{ count: number }>;
  updateCustomerProfile(customerId: string, input: { displayName: string | null }): Promise<CustomerRecord>;
  updateCustomerProfileIfUnchanged(customerId: string, displayName: string | null, expectedUpdatedAt: Date): Promise<{ count: number }>;
  createCredential(input: { customerId: string; passwordHash: string }): Promise<CredentialRecord>;
  findCredentialByCustomerId(customerId: string): Promise<CredentialRecord | null>;
  updateCredentialHash(customerId: string, passwordHash: string): Promise<CredentialRecord>;
  createSession(input: { customerId: string; sessionTokenHash: string; expiresAt: Date }): Promise<Prisma.CustomerSessionGetPayload<Record<string, never>>>;
  findSessionByTokenHash(sessionTokenHash: string): Promise<SessionRecord | null>;
  revokeSession(sessionId: string, revokedAt?: Date): Promise<Prisma.CustomerSessionGetPayload<Record<string, never>>>;
  touchSession(sessionId: string, lastUsedAt?: Date): Promise<Prisma.CustomerSessionGetPayload<Record<string, never>>>;
  listActiveSessions(customerId: string, now?: Date): Promise<Array<Prisma.CustomerSessionGetPayload<Record<string, never>>>>;
  revokeCustomerSession(customerId: string, sessionId: string, revokedAt?: Date): Promise<{ count: number }>;
  revokeAllCustomerSessions(customerId: string, exceptSessionId?: string, revokedAt?: Date): Promise<{ count: number }>;
  findCustomerCart(customerId: string): Promise<Prisma.CartGetPayload<Record<string, never>> | null>;
  createReferralRegistration?(input: { customerId: string; referralCode?: string | null; couponExpiresAt: Date }): Promise<void>;
};

function clientOrDefault(client?: CustomerRepositoryClient): CustomerRepositoryClient {
  return client ?? db;
}

export function createCustomerRepository(client?: CustomerRepositoryClient): CustomerRepository {
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

    updateCustomerStatusIfUnchanged(customerId: string, status: "ACTIVE" | "DISABLED" | "SUSPENDED" | "PENDING_VERIFICATION", expectedUpdatedAt: Date) {
      return database.customer.updateMany({ where: { id: customerId, updatedAt: expectedUpdatedAt }, data: { status } });
    },
    
    updateCustomerProfile(customerId: string, input: { displayName: string | null }) {
      return database.customer.update({
        where: { id: customerId },
        data: { displayName: input.displayName },
      });
    },

    updateCustomerProfileIfUnchanged(customerId: string, displayName: string | null, expectedUpdatedAt: Date) {
      return database.customer.updateMany({ where: { id: customerId, updatedAt: expectedUpdatedAt }, data: { displayName } });
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

    listActiveSessions(customerId: string, now = new Date()) {
      return database.customerSession.findMany({
        where: { customerId, revokedAt: null, expiresAt: { gt: now } },
        orderBy: [{ lastUsedAt: "desc" }, { createdAt: "desc" }, { id: "asc" }],
      });
    },

    revokeCustomerSession(customerId: string, sessionId: string, revokedAt = new Date()) {
      return database.customerSession.updateMany({
        where: { id: sessionId, customerId, revokedAt: null },
        data: { revokedAt },
      });
    },

    revokeAllCustomerSessions(customerId: string, exceptSessionId, revokedAt = new Date()) {
      return database.customerSession.updateMany({
        where: { customerId, revokedAt: null, ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}) },
        data: { revokedAt },
      });
    },

    async createReferralRegistration(input: { customerId: string; referralCode?: string | null; couponExpiresAt: Date }) {
      const profileCode = "4HRS" + randomBytes(8).toString("hex").toUpperCase();
      await database.referralProfile.upsert({
        where: { customerId: input.customerId },
        create: { id: randomUUID(), customerId: input.customerId, code: profileCode },
        update: {},
      });
      const incomingCode = input.referralCode?.trim().toUpperCase();
      if (!incomingCode || !/^[A-Z0-9_-]{3,32}$/.test(incomingCode)) return;
      const referrer = await database.referralProfile.findUnique({ where: { code: incomingCode } });
      if (!referrer || referrer.customerId === input.customerId) return;
      const referral = await database.referral.create({
        data: { id: randomUUID(), referrerCustomerId: referrer.customerId, invitedCustomerId: input.customerId, referralCodeSnapshot: referrer.code, status: "AWAITING_ORDER" },
      });
      for (const recipientCustomerId of [referrer.customerId, input.customerId]) {
        const coupon = await database.discountCoupon.create({
          data: {
            id: randomUUID(), code: "R14-" + randomBytes(12).toString("hex").toUpperCase(), discountPercent: 14,
            maxRedemptions: 1, perCustomerLimit: 1, startsAt: new Date(), expiresAt: input.couponExpiresAt, status: "ACTIVE",
            description: "Refer & Earn registration reward (14%).", recipientCustomerId, referralId: referral.id, referralRewardType: "REGISTRATION_14",
          },
        });
        await database.referralReward.create({
          data: { id: randomUUID(), referralId: referral.id, recipientCustomerId, couponId: coupon.id, type: "REGISTRATION_14", reason: "New referral registration reward." },
        });
      }
    },

    findCustomerCart(customerId: string) {
      return database.cart.findUnique({ where: { customerId } });
    },
  };
}

