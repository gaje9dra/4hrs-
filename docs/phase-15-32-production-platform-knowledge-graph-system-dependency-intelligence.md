# Phase 15.32 — Production Platform Knowledge Graph, System Dependency Intelligence & Architectural Truth

## Architecture
Phase 15.32 adds a provider-neutral architectural metadata layer to the existing PostgreSQL system. It deliberately does not introduce a graph database. The graph is informational and cannot mutate authoritative commerce state.

## Graph model
Nodes use a closed vocabulary for domains, services, modules, APIs/routes, databases/tables/columns, events/queues/jobs, caches/search indexes, providers/external systems, feature flags, workflows/customer journeys, incidents/SLOs/alerts, automation/remediation, resilience and digital-twin scenarios, governance/reconciliation, migrations/dependencies/deployments, owners/documents and ADRs.

Relationships use a closed vocabulary covering ownership, containment, dependencies, calls, data reads/writes, events, monitoring, controls, validation, reconciliation, migration, deployment, impact, governance, testing and recovery.

## Evidence, provenance and confidence
Every relationship records provenance, source identifier, confidence, discovery/verification/observation timestamps, freshness threshold, version and supporting evidence. UNKNOWN remains a first-class value. Inference is never promoted to authoritative architecture merely because it has high confidence.

## Source of truth
The graph references authoritative systems instead of replacing them. 4HRS+ remains authoritative for commerce data and Qikink remains behind the fulfillment adapter. No Qikink catalog ownership or browser-to-provider access is introduced.

## Dependency and impact intelligence
The service supports node lookup, upstream/downstream/bidirectional traversal and deterministic impact analysis. Traversal is bounded to five hops and 250 nodes; list pagination is bounded to 50 records.

## Reconciliation and drift
Graph reconciliation creates governed findings for orphan relationships and stale relationships. Drift is recorded, not automatically repaired, and graph cleanup never deletes authoritative business records.

## Synchronization and versioning
Node synchronization is idempotent. Relationship synchronization is keyed by stable ID and advances the relationship version on each synchronization. Evidence is appended for each synchronization. The graph does not directly execute payments, order mutations, provider mutations, destructive migrations, customer deletion or security-policy changes.

## APIs and admin explorer
The internal admin graph API is private and RBAC protected. It supports overview, health, node search, node detail, bounded traversal, impact analysis, synchronization, reconciliation, freshness refresh and governed drift recording. The admin explorer uses the existing Bauhaus visual language and exposes operational metadata only to authorized administrators.

## Security and privacy
Sensitive fields are redacted before graph metadata/evidence persistence. Passwords, secrets, tokens, authorization material, payment card data and unnecessary customer payloads are not copied into the graph. Public graph access is not exposed.

## Observability and performance
Health reports graph size, open findings and traversal bounds. Indexed node/edge lookups, bounded queries and pagination prevent unrestricted graph traversal from becoming a production bottleneck.

## Testing and CI
Phase-specific validation covers closed vocabularies, provenance, confidence, freshness and traversal/pagination bounds. Required repository gates are lint, typecheck, tests, build, Prisma validation, migration validation and existing repository safety checks.

## Rollback
The graph is additive. A reviewed deployment rollback can revert the Phase 15.32 migration and feature code. Existing commerce records are not modified by graph cleanup.

## Known limitations
Repository evidence cannot prove that every runtime dependency, provider call, SLO relationship, incident relationship or telemetry edge has been discovered. This phase therefore provides a governed control plane and deterministic intelligence primitives without fabricating live production architecture evidence.
