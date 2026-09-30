import test from "node:test";
import assert from "node:assert/strict";
import { createInMemoryAuthenticationRateLimiter } from "../lib/auth/rate-limit.ts";
import { hashPassword, verifyPassword } from "../lib/auth/password.ts";
import { createAuthenticationService } from "../lib/auth/service.ts";
import { AuthenticationError } from "../lib/auth/errors.ts";

function createFakeRepository() {
  const customers = new Map<string, any>();
  const credentials = new Map<string, any>();
  const sessions = new Map<string, any>();
  let id = 0;
  const nextId = (prefix: string) => prefix + (++id);

  const repository: any = {
    async withTransaction(work: any) { return work(repository); },
    async findCustomerById(customerId: string) { return customers.get(customerId) ?? null; },
    async findCustomerByNormalizedEmail(email: string) {
      return [...customers.values()].find((customer) => customer.email === email) ?? null;
    },
    async createCustomer(input: any) {
      const customer = { id: nextId("customer-"), email: input.email, status: input.status ?? "ACTIVE", emailVerifiedAt: null, createdAt: new Date(), updatedAt: new Date() };
      customers.set(customer.id, customer);
      return customer;
    },
    async updateCustomerStatus(customerId: string, status: string) {
      const customer = customers.get(customerId);
      if (!customer) throw new Error("not found");
      customer.status = status;
      return customer;
    },
    async createCredential(input: any) {
      const credential = { id: nextId("credential-"), ...input, createdAt: new Date(), updatedAt: new Date() };
      credentials.set(input.customerId, credential);
      return credential;
    },
    async findCredentialByCustomerId(customerId: string) { return credentials.get(customerId) ?? null; },
    async updateCredentialHash(customerId: string, passwordHash: string) {
      const credential = credentials.get(customerId);
      credential.passwordHash = passwordHash;
      return credential;
    },
    async createSession(input: any) {
      const session = { id: nextId("session-"), ...input, createdAt: new Date(), revokedAt: null, lastUsedAt: null };
      sessions.set(input.sessionTokenHash, session);
      return session;
    },
    async findSessionByTokenHash(hash: string) {
      const session = sessions.get(hash);
      if (!session) return null;
      return { ...session, customer: customers.get(session.customerId) };
    },
    async revokeSession(sessionId: string, revokedAt = new Date()) {
      const session = [...sessions.values()].find((item) => item.id === sessionId);
      if (session) session.revokedAt = revokedAt;
      return session;
    },
    async touchSession(sessionId: string, lastUsedAt = new Date()) {
      const session = [...sessions.values()].find((item) => item.id === sessionId);
      if (session) session.lastUsedAt = lastUsedAt;
      return session;
    },
  };
  return repository;
}

test("password hashing uses a salted non-plaintext representation and verifies safely", async () => {
  const hash = await hashPassword("correct horse battery staple");
  assert.notEqual(hash, "correct horse battery staple");
  assert.match(hash, /^scrypt\$/);
  assert.equal(await verifyPassword("correct horse battery staple", hash), true);
  assert.equal(await verifyPassword("wrong password", hash), false);
  assert.notEqual(hash, await hashPassword("correct horse battery staple"));
});

test("registration creates customer, credential and session without exposing credential material", async () => {
  const service = createAuthenticationService({ repository: createFakeRepository(), rateLimiter: createInMemoryAuthenticationRateLimiter() });
  const result = await service.register({ email: " User@Example.COM ", password: "correct horse battery staple" }, "registration-test");
  assert.equal(result.customer.email, "user@example.com");
  assert.equal(result.customer.status, "ACTIVE");
  assert.ok(result.sessionToken);
  assert.equal("passwordHash" in result.customer, false);
});

test("duplicate registration is normalized to a generic authentication failure", async () => {
  const repository = createFakeRepository();
  const service = createAuthenticationService({ repository, rateLimiter: createInMemoryAuthenticationRateLimiter() });
  await service.register({ email: "duplicate@example.com", password: "correct horse battery staple" }, "a");
  await assert.rejects(
    service.register({ email: "DUPLICATE@example.com", password: "correct horse battery staple" }, "b"),
    (error: unknown) => error instanceof AuthenticationError && error.code === "INVALID_CREDENTIALS",
  );
});

test("login rejects invalid credentials and inactive accounts without credential enumeration", async () => {
  const repository = createFakeRepository();
  const service = createAuthenticationService({ repository, rateLimiter: createInMemoryAuthenticationRateLimiter() });
  await service.register({ email: "login@example.com", password: "correct horse battery staple" }, "register");
  await assert.rejects(service.login({ email: "login@example.com", password: "wrong password" }, "login"), /Authentication failed/);
  const customer = await repository.findCustomerByNormalizedEmail("login@example.com");
  await repository.updateCustomerStatus(customer.id, "DISABLED");
  await assert.rejects(service.login({ email: "login@example.com", password: "correct horse battery staple" }, "login2"), /Authentication failed/);
});

test("session resolution and logout invalidate the session", async () => {
  const repository = createFakeRepository();
  const service = createAuthenticationService({ repository, rateLimiter: createInMemoryAuthenticationRateLimiter() });
  const result = await service.register({ email: "session@example.com", password: "correct horse battery staple" }, "register");
  const current = await service.resolveSession(result.sessionToken);
  assert.equal(current.customer.email, "session@example.com");
  await service.logout(result.sessionToken);
  await assert.rejects(service.resolveSession(result.sessionToken), (error: unknown) =>
    error instanceof AuthenticationError && error.code === "SESSION_INVALID",
  );
});

test("login rotation revokes the prior session", async () => {
  const repository = createFakeRepository();
  const service = createAuthenticationService({ repository, rateLimiter: createInMemoryAuthenticationRateLimiter() });
  const first = await service.register({ email: "rotate@example.com", password: "correct horse battery staple" }, "register");
  const second = await service.login({ email: "rotate@example.com", password: "correct horse battery staple" }, "login", (await import("../lib/auth/session.ts")).hashSessionToken(first.sessionToken));
  assert.notEqual(first.sessionToken, second.sessionToken);
  await assert.rejects(service.resolveSession(first.sessionToken));
  assert.equal((await service.resolveSession(second.sessionToken)).customer.email, "rotate@example.com");
});

test("rate limiter blocks repeated attempts", () => {
  const limiter = createInMemoryAuthenticationRateLimiter();
  for (let i = 0; i < 2; i += 1) assert.equal(limiter.consume("key", 2, 60_000).allowed, true);
  assert.equal(limiter.consume("key", 2, 60_000).allowed, false);
});


test("expired sessions are rejected by the server", async () => {
  const repository = createFakeRepository();
  let current = new Date("2026-09-30T12:00:00.000Z");
  const service = createAuthenticationService({
    repository,
    rateLimiter: createInMemoryAuthenticationRateLimiter(),
    now: () => current,
  });
  const result = await service.register({ email: "expired@example.com", password: "correct horse battery staple" }, "register-expired");
  current = new Date("2026-10-01T12:00:00.000Z");
  await assert.rejects(service.resolveSession(result.sessionToken), (error: unknown) =>
    error instanceof AuthenticationError && error.code === "SESSION_EXPIRED",
  );
});

test("authentication public contracts contain no session or credential secrets", async () => {
  const { toCustomerDto } = await import("../lib/customer/contracts.ts");
  const dto = toCustomerDto({
    id: "customer-1",
    email: "safe@example.com",
    status: "ACTIVE",
    emailVerifiedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  assert.equal("passwordHash" in dto, false);
  assert.equal("sessionTokenHash" in dto, false);
  assert.equal("sessionToken" in dto, false);
});
