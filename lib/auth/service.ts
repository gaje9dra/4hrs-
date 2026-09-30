import { Prisma } from "@prisma/client";
import { createCustomerRepository, type CustomerRepository } from "@/lib/customer/repository";
import { normalizeCustomerEmail } from "@/lib/customer/validation";
import { toCustomerDto, type CustomerDto } from "@/lib/customer/contracts";
import { AuthenticationError } from "@/lib/auth/errors";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSessionToken, hashSessionToken, CUSTOMER_SESSION_TTL_SECONDS } from "@/lib/auth/session";
import { logAuthenticationEvent } from "@/lib/auth/observability";

const LOGIN_LIMIT = 8;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const REGISTRATION_LIMIT = 5;
const REGISTRATION_WINDOW_MS = 60 * 60 * 1000;

type AuthDependencies = {
  repository?: CustomerRepository;
  rateLimiter?: { consume: (key: string, limit: number, windowMs: number) => { allowed: boolean; retryAfterSeconds: number } };
  now?: () => Date;
};

function safeDatabaseError(error: unknown): never {
  if (error instanceof AuthenticationError) throw error;
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    throw new AuthenticationError("INVALID_CREDENTIALS", "Authentication failed.");
  }
  throw new AuthenticationError("AUTH_DATABASE_ERROR", "Authentication is temporarily unavailable.", undefined, { cause: error });
}

function normalizeEmail(input: string): string {
  try {
    return normalizeCustomerEmail(input);
  } catch (error) {
    throw new AuthenticationError("INVALID_INPUT", "Authentication input is invalid.", undefined, { cause: error });
  }
}

function checkRateLimit(
  limiter: AuthDependencies["rateLimiter"],
  key: string,
  limit: number,
  windowMs: number,
) {
  const decision = limiter?.consume(key, limit, windowMs);
  if (decision && !decision.allowed) {
    throw new AuthenticationError("RATE_LIMITED", "Too many authentication attempts. Please try again later.");
  }
}

export type AuthSessionResult = {
  customer: CustomerDto;
  sessionToken: string;
  expiresAt: Date;
};

export function createAuthenticationService(dependencies: AuthDependencies = {}) {
  const repository = dependencies.repository ?? createCustomerRepository();
  const now = dependencies.now ?? (() => new Date());

  async function register(input: { email: string; password: string }, abuseKey: string): Promise<AuthSessionResult> {
    checkRateLimit(dependencies.rateLimiter, abuseKey, REGISTRATION_LIMIT, REGISTRATION_WINDOW_MS);
    const email = normalizeEmail(input.email);
    const passwordHash = await hashPassword(input.password);
    const sessionToken = createSessionToken();
    const sessionTokenHash = hashSessionToken(sessionToken);
    const expiresAt = new Date(now().getTime() + CUSTOMER_SESSION_TTL_SECONDS * 1000);

    try {
      const customer = await repository.withTransaction(async (tx) => {
        const existing = await tx.findCustomerByNormalizedEmail(email);
        if (existing) {
          throw new AuthenticationError("INVALID_CREDENTIALS", "Authentication failed.");
        }

        const created = await tx.createCustomer({ email, status: "ACTIVE" });
        await tx.createCredential({ customerId: created.id, passwordHash });
        await tx.createSession({ customerId: created.id, sessionTokenHash, expiresAt });
        return created;
      });

      logAuthenticationEvent({ event: "registration_success" });
      return { customer: toCustomerDto(customer), sessionToken, expiresAt };
    } catch (error) {
      logAuthenticationEvent({ event: "registration_failure", code: error instanceof AuthenticationError ? error.code : "AUTH_DATABASE_ERROR" });
      safeDatabaseError(error);
    }
  }

  async function login(input: { email: string; password: string }, abuseKey: string, rotateSessionTokenHash?: string): Promise<AuthSessionResult> {
    checkRateLimit(dependencies.rateLimiter, abuseKey, LOGIN_LIMIT, LOGIN_WINDOW_MS);
    const email = normalizeEmail(input.email);

    try {
      const customer = await repository.findCustomerByNormalizedEmail(email);
      if (!customer) {
        logAuthenticationEvent({ event: "login_failure", code: "INVALID_CREDENTIALS" });
        throw new AuthenticationError("INVALID_CREDENTIALS", "Authentication failed.");
      }

      const credential = await repository.findCredentialByCustomerId(customer.id);
      if (!credential || !(await verifyPassword(input.password, credential.passwordHash))) {
        logAuthenticationEvent({ event: "login_failure", code: "INVALID_CREDENTIALS" });
        throw new AuthenticationError("INVALID_CREDENTIALS", "Authentication failed.");
      }

      if (customer.status !== "ACTIVE") {
        logAuthenticationEvent({ event: "login_failure", code: "ACCOUNT_UNAVAILABLE" });
        throw new AuthenticationError("ACCOUNT_UNAVAILABLE", "Authentication failed.");
      }

      const sessionToken = createSessionToken();
      const sessionTokenHash = hashSessionToken(sessionToken);
      const expiresAt = new Date(now().getTime() + CUSTOMER_SESSION_TTL_SECONDS * 1000);

      const result = await repository.withTransaction(async (tx) => {
        if (rotateSessionTokenHash) {
          const previous = await tx.findSessionByTokenHash(rotateSessionTokenHash);
          if (previous?.customerId === customer.id && !previous.revokedAt) {
            await tx.revokeSession(previous.id, now());
          }
        }
        await tx.createSession({ customerId: customer.id, sessionTokenHash, expiresAt });
        return { customer, sessionToken, expiresAt };
      });

      logAuthenticationEvent({ event: "login_success" });
      return { customer: toCustomerDto(result.customer), sessionToken: result.sessionToken, expiresAt: result.expiresAt };
    } catch (error) {
      if (error instanceof AuthenticationError) throw error;
      safeDatabaseError(error);
    }
  }

  async function resolveSession(sessionToken: string): Promise<{ sessionId: string; customer: CustomerDto; expiresAt: Date }> {
    if (typeof sessionToken !== "string" || sessionToken.length < 32) {
      throw new AuthenticationError("SESSION_INVALID", "Authentication session is invalid.");
    }
    try {
      const tokenHash = hashSessionToken(sessionToken);
      const session = await repository.findSessionByTokenHash(tokenHash);
      if (!session || session.revokedAt) {
        throw new AuthenticationError("SESSION_INVALID", "Authentication session is invalid.");
      }
      if (session.expiresAt <= now()) {
        throw new AuthenticationError("SESSION_EXPIRED", "Authentication session has expired.");
      }
      if (session.customer.status !== "ACTIVE") {
        throw new AuthenticationError("SESSION_INVALID", "Authentication session is invalid.");
      }
      if (!session.lastUsedAt || now().getTime() - session.lastUsedAt.getTime() > 5 * 60 * 1000) {
        await repository.touchSession(session.id, now());
      }
      return { sessionId: session.id, customer: toCustomerDto(session.customer), expiresAt: session.expiresAt };
    } catch (error) {
      if (error instanceof AuthenticationError) throw error;
      safeDatabaseError(error);
    }
  }

  async function logout(sessionToken: string): Promise<void> {
    if (typeof sessionToken !== "string" || sessionToken.length < 32) return;
    try {
      const session = await repository.findSessionByTokenHash(hashSessionToken(sessionToken));
      if (session && !session.revokedAt) await repository.revokeSession(session.id, now());
      logAuthenticationEvent({ event: "logout" });
    } catch (error) {
      safeDatabaseError(error);
    }
  }

  return { register, login, resolveSession, logout };
}

export type AuthenticationService = ReturnType<typeof createAuthenticationService>;
