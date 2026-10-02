# Admin Platform

Phase 14.1 establishes the protected administrative control plane under this route boundary.

The admin UI uses the existing customer authentication/session infrastructure plus an explicit AdminUser authority and centralized RBAC permission checks. Admin routes and APIs must never treat customer authentication alone as administrative authority.

Business-domain logic remains in canonical application/domain services. Future admin modules must reuse the Phase 14.1 authorization and audit foundation rather than creating independent session, RBAC or audit infrastructure.