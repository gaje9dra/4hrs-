# Notification Boundary

Notification orchestration belongs here.

## Phase 15.7

The boundary now contains:

- durable provider-neutral NotificationEvent and NotificationDelivery persistence;
- source-controlled transactional templates;
- server-only provider adapter contracts;
- bounded retry/backoff and idempotency;
- scheduled delivery processing;
- normalized delivery status/failure classification;
- bounded observability;
- granular admin read/resend controls.

Current channel: EMAIL.

A real production email provider is intentionally not bundled. The development/test adapter is never selected in production. Configure and implement a verified provider adapter before enabling production delivery.

Provider implementations must remain replaceable and server-side. Browser code must never call notification providers directly.
