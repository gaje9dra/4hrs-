# Database Boundary

Database clients and data-access infrastructure belong here.

Dependency direction:

UI -> Feature Service -> Repository/Data Access -> Database

Phase 2.2 introduces the Prisma client boundary at lib/db/client.ts.

The catalog schema remains provider-neutral. Provider integrations must not bypass this boundary or add provider-specific fields to canonical catalog models.
