# Phase 13.2 — Shipping Data Model, Persistence & Tracking Foundation

## Scope
This phase implements the persistence foundation only. It does not implement customer tracking APIs/UI, a shipping dashboard, returns, exchanges, refunds, a second provider, or Phase 13.3.

Canonical flow: Order → Fulfillment → Shipment → TrackingEvent → Customer

Qikink remains a fulfillment/provider identifier. It is not the catalog source of truth.

## Shipment model
Shipment is a physical/logistical shipment associated with exactly one existing Fulfillment and one Order.

Persisted fields: internal UUID, immutable server-generated shipment reference, fulfillmentId, orderId, provider-neutral providerId, external providerReference, carrier, tracking number, verified tracking URL, service, normalized status, shipped/delivered timestamps, and created/updated timestamps.

The internal shipment ID/reference is independent of any Qikink ID.

## Fulfillment relationship
One Fulfillment can have multiple Shipments. A Shipment cannot exist without its Fulfillment.

Database foreign keys use ON DELETE RESTRICT so historical shipping records are not silently removed by upstream mutations.

## Shipment lifecycle
Normalized persisted statuses: CREATED, IN_TRANSIT, OUT_FOR_DELIVERY, DELIVERED, DELIVERY_FAILED, RETURNED.

The repository requires an expected current state and delegates transition validation to the shipping domain. Terminal DELIVERED and RETURNED states cannot move backwards.

A late event may be stored historically without automatically rewriting canonical shipment state; reconciliation remains a later domain concern.

## TrackingEvent model
TrackingEvent is immutable historical data associated with a Shipment.

It stores shipment ID, provider ID, optional provider event ID, deterministic deduplication key, provider status, normalized status, event timestamp, location, description, event source, received timestamp, and created timestamp.

Event occurrence time and database receipt time are intentionally separate.

## Event deduplication
When a provider event ID exists, the deduplication key is provider-event:<providerEventId>.

When a provider event ID is unavailable, the repository derives a SHA-256 fingerprint from provider, normalized status, event timestamp, location, and description.

The database enforces uniqueness on shipmentId + providerId + deduplicationKey. A concurrent duplicate that reaches the unique constraint is resolved by returning the existing event.

## Historical integrity
Shipment and TrackingEvent records do not reference mutable Product, ProductVariant, Store SKU, or provider mapping rows.

Therefore catalog deletion/unpublishing and later mapping changes do not rewrite or remove shipment history.

The historical Order address remains authoritative. This phase does not copy mutable CustomerAddress records into Shipment.

## Provider references
providerId and providerReference are separate from internal Shipment identity.

The canonical model does not treat Qikink as a carrier. Carrier is nullable because the fulfillment provider and actual carrier can be different.

No speculative provider payload or secret is persisted.

## Repository boundary
lib/shipping/repository.ts provides createShipment, getShipmentById, getShipmentByCustomer, getShipmentByFulfillment, listShipmentsByOrder, provider-reference lookup, tracking-number lookup, controlled status transition, tracking-event creation, paginated tracking-event retrieval, and provider-event lookup.

Repositories do not perform Qikink HTTP calls.

Customer-scoped lookup resolves ownership through the canonical Order relation, preparing the persistence layer for later authenticated customer APIs.

## Database constraints and indexes
The migration adds Shipment and TrackingEvent foreign keys, unique internal shipment reference, provider/event deduplication uniqueness, fulfillment/order/time indexes, provider reference indexes, tracking number index, shipment status index, and tracking event timestamp/status indexes.

Deletes are restrictive for Shipment/TrackingEvent history.

## Migration
Migration: 20261002190000_shipping_persistence_foundation.

It creates normalized status/source enums and Shipment/TrackingEvent tables without destructive data operations.

## Security
The persistence boundary does not expose a public Shipment lookup by identifier alone. Customer-scoped access is available through Order ownership.

Provider credentials, authorization headers, raw provider payloads, provider SKU mappings, and internal diagnostics are not fields in the canonical shipping models.

## Phase 13.3 prerequisites
Phase 13.3 still needs to build the application/API layer around this persistence foundation and must use verified provider capabilities rather than inventing Qikink tracking behavior.

Required next-phase concerns include authenticated customer Shipment APIs, DTO filtering, provider adapter/resolver integration, verified Qikink tracking/status/webhook contract, reconciliation and webhook processing, rate limiting, operational errors, and the customer tracking experience.

No customer tracking UI or complete Shipping API is included here.