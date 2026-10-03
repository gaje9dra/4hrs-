import test from "node:test";
import assert from "node:assert/strict";
import { createAuthenticationService } from "../lib/auth/service.ts";
import { createInMemoryAuthenticationRateLimiter } from "../lib/auth/rate-limit.ts";
import { hashSessionToken } from "../lib/auth/session.ts";
import type { CustomerRepository } from "../lib/customer/repository.ts";

function fakeRepository(): CustomerRepository {
  const now = () => new Date("2026-10-03T10:00:00.000Z");
  const customer = { id: "customer-1", email: "customer@example.com", displayName: null, status: "ACTIVE" as const, emailVerifiedAt: null, createdAt: now(), updatedAt: now() };
  const credential = { id: "credential-1", customerId: customer.id, passwordHash: "", createdAt: now(), updatedAt: now() };
  const sessions = new Map<string, { id: string; customerId: string; sessionTokenHash: string; createdAt: Date; expiresAt: Date; revokedAt: Date | null; lastUsedAt: Date | null }>();
  let sequence = 0;
  const repo: CustomerRepository = {
    async withTransaction<T>(work) { return work(repo); },
    async findCustomerById(id) { return id === customer.id ? customer : null; },
    async findCustomerByNormalizedEmail(email) { return email === customer.email ? customer : null; },
    async createCustomer() { return customer; },
    async updateCustomerStatus() { return customer; },
    async updateCustomerStatusIfUnchanged() { return { count: 1 }; },
    async updateCustomerProfile() { return customer; },
    async updateCustomerProfileIfUnchanged() { return { count: 1 }; },
    async createCredential(input) { Object.assign(credential, input); return credential; },
    async findCredentialByCustomerId(id) { return id === customer.id ? credential : null; },
    async updateCredentialHash(_id, passwordHash) { credential.passwordHash = passwordHash; return credential; },
    async createSession(input) {
      const session = { id: `session-${++sequence}`, ...input, createdAt: now(), revokedAt: null, lastUsedAt: null };
      sessions.set(session.id, session);
      return session;
    },
    async findSessionByTokenHash(hash) {
      const session = [...sessions.values()].find((item) => item.sessionTokenHash === hash);
      return session ? { ...session, customer } : null;
    },
    async revokeSession(id, revokedAt = now()) {
      const session = sessions.get(id);
      if (!session) throw new Error("not found");
      session.revokedAt = revokedAt;
      return session;
    },
    async touchSession(id, lastUsedAt = now()) {
      const session = sessions.get(id);
      if (!session) throw new Error("not found");
      session.lastUsedAt = lastUsedAt;
      return session;
    },
    async listActiveSessions(customerId, at = now()) {
      return [...sessions.values()].filter((session) => session.customerId === customerId && !session.revokedAt && session.expiresAt > at);
    },
    async revokeCustomerSession(customerId, sessionId, revokedAt = now()) {
      const session = sessions.get(sessionId);
      if (!session || session.customerId !== customerId || session.revokedAt) return { count: 0 };
      session.revokedAt = revokedAt;
      return { count: 1 };
    },
    async revokeAllCustomerSessions(customerId, exceptSessionId, revokedAt = now()) {
      let count = 0;
      for (const session of sessions.values()) {
        if (session.customerId === customerId && !session.revokedAt && session.id !== exceptSessionId) {
          session.revokedAt = revokedAt;
          count += 1;
        }
      }
      return { count };
    },
    async findCustomerCart() { return null; },
  };
  return repo;
}

test("active session listing exposes only safe metadata and marks the current session", async () => {
  const repository = fakeRepository();
  const authentication = createAuthenticationService({ repository, rateLimiter: createInMemoryAuthenticationRateLimiter() });
  const first = await authentication.register({ email: "customer@example.com", password: "correct horse battery staple" }, "register");
  const second = await authentication.login({ email: "customer@example.com", password: "correct horse battery staple" }, "login");
  const current = await authentication.resolveSession(second.sessionToken);
  const sessions = await authentication.listActiveSessions(current.customer.id, current.sessionId);
  assert.equal(sessions.length, 2);
  assert.equal(sessions.filter((item) => item.current).length, 1);
  assert.equal("sessionTokenHash" in sessions[0], false);
  assert.equal("sessionToken" in sessions[0], false);
  await authentication.logout(first.sessionToken);
});

test("password change preserves the current session and revokes other sessions", async () => {
  const repository = fakeRepository();
  const authentication = createAuthenticationService({ repository, rateLimiter: createInMemoryAuthenticationRateLimiter() });
  const first = await authentication.register({ email: "customer@example.com", password: "correct horse battery staple" }, "register");
  const second = await authentication.login({ email: "customer@example.com", password: "correct horse battery staple" }, "login");
  const current = await authentication.resolveSession(second.sessionToken);
  const result = await authentication.changePassword({
    customerId: current.customer.id,
    currentPassword: "correct horse battery staple",
    newPassword: "new correct horse battery staple",
    currentSessionId: current.sessionId,
  });
  assert.equal(result.sessionsRevoked, 1);
  await assert.rejects(authentication.resolveSession(first.sessionToken));
  assert.equal((await authentication.resolveSession(second.sessionToken)).customer.email, "customer@example.com");
  await assert.rejects(authentication.login({ email: "customer@example.com", password: "correct horse battery staple" }, "old-password"));
  const relogin = await authentication.login({ email: "customer@example.com", password: "new correct horse battery staple" }, "new-password");
  assert.ok(relogin.sessionToken);
});

test("session revocation is ownership scoped and rejects another customer's session id", async () => {
  const repository = fakeRepository();
  const authentication = createAuthenticationService({ repository, rateLimiter: createInMemoryAuthenticationRateLimiter() });
  const result = await authentication.register({ email: "customer@example.com", password: "correct horse battery staple" }, "register");
  const current = await authentication.resolveSession(result.sessionToken);
  await assert.rejects(
    authentication.revokeCustomerSession(current.customer.id, "session-from-another-customer", current.sessionId),
    /session is no longer active/i,
  );
  assert.equal(hashSessionToken(result.sessionToken).length, 64);
});
