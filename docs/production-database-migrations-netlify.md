# Production database migrations on Netlify

Netlify builds should compile the application without requiring a live production database connection. The build command runs `npm run build`; Prisma Client generation is handled by the package build script.

## Required release order

1. Review the pending Prisma migrations in the pull request.
2. Before deploying application code that depends on a schema change, run `npx prisma migrate deploy` from a trusted release environment with the production `DIRECT_URL` configured to the Supabase **session pooler** endpoint (port 5432), or use the Supabase direct database endpoint only when the runner's network supports it.
3. Verify the migration command exits successfully.
4. Deploy the application build.
5. Check homepage, product/category pages, admin catalog, and checkout; inspect Netlify function logs.

## Connection variables

- `DATABASE_URL`: Supabase transaction pooler for serverless runtime queries (normally port 6543).
- `DIRECT_URL`: Supabase session pooler for Prisma migrations (normally port 5432). Confirm the hostname is the `*.pooler.supabase.com` hostname provided by Supabase, not an unreachable direct database hostname.

Do not put credentials in repository files or logs. Do not run `prisma migrate reset` against production. If a migration fails, diagnose the specific migration error before retrying.
