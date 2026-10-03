# Phase 15.4 — Observability, Error Monitoring, Audit Telemetry & Operational Alerting

## 1. Observability architecture
Phase 15.4 adds observability around the existing 4HRS+ domains without changing domain ownership.

The model separates:
- structured application logs
- bounded operational metrics
- exception/error telemetry
- authoritative Admin audit events
- request correlation
- domain operation correlation
- provider-operation telemetry
- security events
- liveness/readiness signals

Telemetry is subordinate to business correctness. Telemetry failures are swallowed at the logger boundary and client telemetry is best-effort.

No external monitoring or alerting vendor is configured by this repository. The internal event/metric model is the integration boundary for Netlify/runtime logs and a future production monitoring backend.

## 2. Logging model
Server logs are JSON records with stable event names and bounded context: timestamp, severity, environment, service, requestId, correlationId, operationId, safe actor/resource context, provider, duration, outcome, and errorCode.
Important operational events use machine-readable names such as request.failed, db.query.failed, payment.create.succeeded, provider.request.failed, shipping.operation, and authorization.denied.
The logger never intentionally writes secrets, authentication headers, cookies, payment credentials, or unbounded user payloads.

## 3. Metrics model
Metrics are bounded process-local counters intended to remain cheap and provider-neutral. Current metric families include HTTP/payment/fulfillment/shipping/provider/security/database/frontend signals.
The implementation deliberately does not invent a remote metrics provider. A production metrics backend can consume structured runtime telemetry without changing the commerce domains.

## 4. Error reporting
lib/observability/errors.ts classifies failures into validation, authentication, authorization, not found, conflict/idempotency, business rule, dependency, provider, database, timeout, rate limit, webhook verification, and unexpected categories.
Unhandled request errors are captured through Next.js instrumentation.ts. Existing public API error boundaries continue to return safe public messages; internal diagnostics are emitted separately.

## 5. Request correlation
proxy.ts creates or validates a bounded x-request-id. Trusted inbound values must match a restricted machine-safe format and maximum length. Invalid or oversized values are replaced with a cryptographically generated UUID.
The ID is propagated into request headers and returned as a response header. This preserves request → application operation → database/provider correlation.

## 6. Domain correlation
Important operations use operation/correlation identifiers where the existing architecture already has a natural boundary. Payment API create/read operations use operation IDs; shipping operations already use correlation IDs; admin audit metadata can carry request IDs; provider telemetry identifies canonical fulfillment resources.
The implementation does not add arbitrary IDs to every function.

## 7. Provider telemetry
Provider telemetry is recorded at the provider-neutral boundary. Provider, operation, result, duration, and bounded error classification are recorded. Credentials, Authorization headers, provider payloads, and customer secrets are excluded.

## 8. Qikink telemetry
Qikink remains behind the existing Fulfillment adapter.
The Qikink adapter records request success/failure, timeout classification, provider error category, bounded provider/operation identity, duration, and canonical Fulfillment resource ID.
Qikink telemetry is operational evidence only. Canonical Fulfillment state remains authoritative. No Qikink catalog synchronization or undocumented provider capability was added.

## 9. Payment telemetry
Payment HTTP operations emit bounded operation/status signals and failures pass through the shared error-reporting boundary. Payment creation records a request/operation ID and explicit success/failure events.
Sensitive payment data is never included in telemetry.

## 10. Fulfillment telemetry
The existing Fulfillment observability boundary was retained and hardened to use the structured logger and bounded metrics. It records create, transition, provider-resolution, mapping, reconciliation and eligibility outcomes without treating logs as canonical state.

## 11. Shipping telemetry
The existing Shipping observation boundary was retained and hardened to use structured logging and bounded metrics.
It preserves Order → Fulfillment → Shipment → Tracking correlation and records reconciliation, tracking, handoff and shipment-operation outcomes.

## 12. Security telemetry
Security events are server-owned. Clients cannot choose event severity or event type.
Current security event examples include authorization.denied, authentication failures through the shared error boundary, CSRF rejection through the authentication boundary, provider authentication failures at provider boundaries, and rate-limit/webhook security events where the existing boundary emits them.
Admin authorization denials are also linked to authoritative Admin audit persistence.

## 13. Admin audit integration
AdminAuditLog remains the authoritative privileged-action record.
Phase 15.4 does not replace it with ordinary logs. Request IDs can be attached as sanitized metadata, while existing correlation IDs remain available. Sensitive values continue to be removed by the audit metadata sanitizer.

## 14. Health/readiness model
Two minimal public endpoints are provided:
- /api/health — liveness; confirms the application process is responding.
- /api/ready — readiness; performs a bounded SELECT 1 database connectivity check.
Readiness does not expose connection strings, database hosts, SQL, credentials, or stack traces.
Third-party provider failure does not automatically make the application dead when the storefront can otherwise operate.

## 15. Alert definitions
The repository documents alert-ready conditions but does not claim to deliver alerts without an external alerting system.
Recommended conditions include sustained elevated 5xx rate, critical API latency degradation, database connectivity failure, payment verification/webhook failure spikes, fulfillment provider failure spikes, shipping failure/reconciliation backlog, repeated privileged authentication failures, and critical background/reconciliation failures.
A production monitoring system should define the evaluation window, aggregation method, warning/critical threshold, and operator action for each condition.

## 16. Metric cardinality rules
Allowed dimensions are bounded to route, method, status class, error class, provider, operation, environment, and metric.
Never use customer ID, order ID, email, arbitrary URLs, query strings, search terms, request IDs, or provider request bodies as metric labels.

## 17. Privacy/redaction
Telemetry is treated as sensitive infrastructure. Redaction covers password, secret, token, authorization, cookie, credential, API/access/private key, CVV/card number, and session data keys.
Client telemetry intentionally excludes full URLs, query strings, authentication tokens, payment data, and private customer content.
Frontend Web Vitals are restricted to supported metric names and numeric values.

## 18. Retention assumptions
The repository does not own the final retention policy of Netlify/runtime logs or a future external telemetry backend.
Recommended separation: application logs for short-lived operational troubleshooting; metrics for longer aggregate trends; Admin audit logs under a separate privileged-action retention policy; security events retained as appropriate for incident investigation and applicable requirements.
No new long-term sensitive telemetry store was introduced.

## 19. Failure behavior
Observability must not become a dependency of commerce correctness. Structured logging catches telemetry serialization failures, client reporting is best-effort, telemetry endpoints fail safely, and database/provider operations do not depend on a remote monitoring provider.

## 20. Performance considerations
Database instrumentation records failures and slow queries rather than every successful production query. Slow-query logging currently uses a 500 ms heuristic; it is not presented as a universal performance threshold.
Client telemetry uses sendBeacon where available and does not block navigation.

## 21. Operator troubleshooting workflow
1. Identify the request or operation and obtain x-request-id.
2. Find the corresponding structured request/error event.
3. Identify the domain resource and operation/correlation ID.
4. Inspect database/provider failure classification and duration.
5. Check authoritative Admin/security audit events when privileged activity is involved.
6. Determine whether the business operation succeeded, failed, was retried, or requires reconciliation.
7. Verify canonical domain state before taking recovery action.
For provider ambiguity, treat provider telemetry as evidence rather than business truth and use the canonical Fulfillment/Shipping reconciliation boundary.

## 22. Verification commands
- npm install
- npx prisma validate
- npm audit --omit=dev --audit-level=high
- npm test
- npm run lint
- npm run typecheck
- npm run build
CI remains the final verification gate.

## 23. Known limitations / accepted boundaries
- Metrics are process-local because no external metrics backend is configured.
- No external alert delivery service is claimed or implemented.
- Client telemetry is intentionally minimal and best-effort.
- Existing domain-specific operations that already had observability retain their architecture; Phase 15.4 does not redesign every service merely to add a generic wrapper.
- No production benchmark numbers are invented.
- Distributed metric aggregation remains an infrastructure concern outside this phase.

## 24. Security and operational acceptance
Phase 15.4 preserves Phase 15.3 security controls, including strict CSP, request trust checks, provider credential isolation, safe public errors, and dependency audit coverage.
The regression suite verifies request correlation, redaction, metric cardinality, health secrecy, client privacy, database instrumentation, provider telemetry, admin/security integration, and telemetry non-fatal behavior.