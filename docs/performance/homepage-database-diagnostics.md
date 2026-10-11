# Homepage database and TTFB diagnostics

## Changes in this branch

- Prisma slow-query warnings include a SHA-256 fingerprint of normalized SQL, never SQL text or bound parameters.
- Prisma error events classify `P2024` as `db.pool.wait_timeout` and request aggregate Prisma pool/wait metrics when available.
- Homepage cache-fill logs separate catalog, editorial content, promotional banners, and presentation work. Catalog logs further split hero products, category taxonomy, populated collections, and featured-collection products.
- The homepage product slice uses a dedicated bounded query and skips the separate catalog `COUNT(*)` query. The storefront listing APIs retain their normal pagination counts.
- No new catalog index is proposed: the live plan for the basic homepage product predicate scanned only two rows and completed in about 0.15 ms; `Product(status, createdAt)` already exists. Indexes should be added only when the full slow-query fingerprint/plan proves one is missing.

## Interpreting the production signals

- `db.query.slow`: Prisma query-event duration and opaque `queryFingerprint`; this is not, by itself, a pool-wait measurement.
- `db.pool.metrics_snapshot`: aggregate Prisma metrics filtered to pool, connection, and query-wait metrics. Inspect the wait histogram buckets and open/busy/idle connection gauges where available.
- `db.pool.wait_timeout`: explicit Prisma `P2024` timeout signal.
- `storefront.homepage.cache_fill.operation.slow`: a particular data load during a cache fill/revalidation.
- `storefront.homepage.cache_fill.slow`: overall cache-fill duration plus presentation timing.
- `storefront.homepage.operation.slow`: catalog-level phase timings. A cache hit skips the cache-fill callback, so correlate these logs with Netlify's function duration and request logs; absence of a fill event alone is not proof of a cache hit.

Do not increase `PRISMA_CONNECTION_LIMIT` blindly. The runtime defaults to 3 connections per function instance for Supabase pooler URLs; aggregate connection fan-out scales with concurrent serverless instances. Use the wait metrics and Supavisor pool utilization to decide whether the limit, query fan-out, or connection setup needs adjustment.

## After deploying

From a machine with Node.js 24+ and network access, run:

```sh
SITE_URL="https://YOUR_PRODUCTION_HOST/" HOMEPAGE_TTFB_SAMPLES=8 node scripts/homepage-ttfb-check.mjs
```

The script sends eight sequential anonymous GETs with 250 ms between requests and reports per-request status, time-to-response-headers (TTFB approximation), total response time, any exposed cache header, and p50/p95 summaries. It does not purge or bypass the server's Next.js data cache. Run it after deployment and correlate the timestamps with Netlify function logs and the new structured events. Compare before/after samples under similar conditions; do not treat a single request as a benchmark.

## Index review evidence

The current live database has `Product_status_createdAt_idx`, `ProductImage_productId_primary_sort_idx`, `ProductImage_productId_sortOrder_idx`, `ProductCollection_collectionId_isFeatured_priority_position_idx`, and `ProductCategory_categoryId_isFeatured_priority_position_idx`. A simple `EXPLAIN (ANALYZE, BUFFERS)` for the basic published newest-products predicate returned two rows with approximately 0.15 ms execution time. Live `pg_stat_statements` observations showed the simple Product select averaging under 1 ms (maximum under 9 ms), the corresponding count averaging under 1 ms (maximum under 5 ms), and a ProductImage select averaging about 8 ms (maximum about 85 ms). Those observations do not support adding a speculative index to explain ~1.2-second Prisma event durations. A separate live `pg_stat_activity` sample showed 20 sessions against `max_connections = 60`, one active session, and no idle-in-transaction sessions; this does not rule out transient Supavisor client-pool pressure at other times.

Supavisor logs around the reported slow-query timestamps show repeated transaction-pool client authentications from several peer IPs, while the pgbouncer log also contains short-lived internal local connections. This suggests connection setup/churn is worth measuring, but the logs do not by themselves prove pool saturation or tie a specific client to a specific slow query.
