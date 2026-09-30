# Authentication Boundary

Customer identity and session persistence now lives behind the provider-neutral customer boundary under `lib/customer/`.

- `lib/customer/repository.ts` owns Prisma persistence only.
- `lib/customer/service.ts` owns persistence-facing identity/session orchestration without implementing login or registration flows.
- `lib/customer/contracts.ts` owns explicit customer-safe DTO mapping.
- Password credentials store only an already-generated password hash. Hash generation and verification must use a dedicated adaptive password-hashing boundary when authentication flows are implemented.
- Sessions store only a one-way hash of the opaque session identifier; the raw identifier must remain outside persistence.
- Customer and administrator identities remain separate authorization domains.

Authentication/session infrastructure must remain outside individual pages and presentational components. Phase 9.2 intentionally does not implement login, registration, password reset, email verification, OAuth/social login, or account UI.
