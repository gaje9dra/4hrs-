# Authentication Boundary

Customer authentication is isolated under `lib/auth/` and customer persistence remains under `lib/customer/`.

- `lib/auth/service.ts` owns registration, login, password verification, session creation/rotation, session resolution, and logout.
- `lib/auth/password.ts` owns password hashing and verification.
- `lib/auth/session.ts` owns opaque session-token generation, hashing, and cookie policy.
- `lib/auth/context.ts` is the canonical server-side current-customer resolver.
- `lib/auth/authorization.ts` provides customer authorization primitives.
- `lib/auth/rate-limit.ts` provides the provider-neutral abuse-control abstraction.
- `lib/auth/contracts.ts` and `lib/auth/http.ts` define safe application/API boundaries.
- `lib/customer/repository.ts` owns Prisma persistence.
- `lib/customer/contracts.ts` owns customer-safe DTO mapping.

Customer and administrator identity domains remain separate. A customer session never grants administrative capability.

Passwords are stored only as adaptive password hashes. Session persistence stores only a one-way hash of the opaque session identifier. Raw session identifiers remain in the server-side cookie/application boundary.

Authentication state must never depend on client-controlled customer IDs. Future customer-owned resources must authorize against the authenticated server-side customer context.

Authentication UI is intentionally outside this foundation phase.
