# Phase 15.22 — Production Data Integrity, Reconciliation & Cross-Domain Consistency

## Architecture
Reconciliation is an operational safety layer, never a second source of truth. Each rule identifies an authoritative domain and stores a sanitized evidence record.

### Authorities
Catalog, Payment, Order, Fulfillment, Shipping, Customer, Content and Feature Flags remain authoritative in their existing domains. Search, Analytics and Notifications remain projections. Governance remains the operational control layer. Qikink remains fulfillment/provider infrastructure only.

### Detection
The initial integrity engine checks orphan and invalid-reference relationships across Order/OrderItem, Payment/Order, Order/Customer, Fulfillment/Order, FulfillmentItem/OrderItem, Shipment/Fulfillment, Shipment/Order, TrackingEvent/Shipment, provider mapping/variant, AnalyticsEvent/Customer and NotificationDelivery/Event/Customer.

### Discrepancies
Cases use explicit discrepancy types: MISSING_DEPENDENCY, ORPHAN_RECORD, STATE_MISMATCH, DUPLICATE_RECORD, INVALID_REFERENCE, STALE_PROJECTION, DUPLICATE_EVENT, MISSING_EVENT, INVALID_TRANSITION, FINANCIAL_MISMATCH, OWNERSHIP_MISMATCH, PROVIDER_MISMATCH, TIMING_MISMATCH and UNKNOWN.

### Repair boundary
Automatic repair is eligible only for deterministic projection-safe classes. Payment amounts, refunds, order totals/status, customer ownership, provider shipment identity and irreversible state are never automatically mutated.

### Manual controls
High-risk resolution requires existing admin RBAC plus SUPER_ADMIN authorization. Every resolution uses an expected version, reason, before/after state, actor and audit event. The database action has a unique idempotency key.

### Concurrency and workload
Cases use version checks. Scans are bounded to 500 cases, each rule samples at most 100 records, and there is no recursive retry loop.

### Incident and governance
Critical unresolved cases are emitted through the existing reliability incident service. Admin mutations use the existing admin audit mechanism; no parallel incident or governance system is introduced.

### Privacy/security
Evidence is depth/size bounded and strips credentials, tokens, authorization headers, API keys and direct customer contact/address fields.

### Known limitations
Provider-side state cannot be reconciled where no machine-verifiable provider contract exists. Projection rebuild capabilities differ by subsystem, so the safe-repair control is intentionally bounded. Production-scale load evidence and external Phase 15.19 evidence remain external verification gates.

### Runbook
Detect → classify → inspect authority/evidence → review → bounded action → verify. Never delete or overwrite orphaned/financial/customer records automatically.

### CI
The phase adds model/security tests and a reconciliation architecture audit alongside the existing lint, typecheck, test, build, Prisma and migration gates.