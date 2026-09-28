# API Route Boundary

Reserved for future server-side API route handlers.

API routes must delegate to feature/domain services and infrastructure boundaries. Do not put raw database queries, provider SDK calls or customer-facing UI logic in route handlers.
