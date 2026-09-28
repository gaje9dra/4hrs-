# Phase 2.3 — Inventory & Stock Data Foundation

## 1. Ownership

Inventory is store-owned and belongs to a canonical `ProductVariant`. A variant may exist without an Inventory row.

No provider identity, provider stock field, provider API, or synchronization behavior exists in this phase.

## 2. Models

- `Inventory`: one canonical inventory record per ProductVariant.
- `InventoryTransaction`: immutable audit history for on-hand adjustments.
- `InventoryAdjustmentReason`: constrained adjustment reasons.

Inventory is intentionally one-per-variant for the current single-location architecture.

## 3. Quantity semantics

- **onHand**: physical/controlled stock currently held by the store.
- **reserved**: quantity committed for a future fulfillment operation. Reservation workflows are deferred.
- **available**: derived as `onHand - reserved`; it is not persisted.
- All quantities are PostgreSQL integers.

Database constraints enforce:

- `onHand >= 0`
- `reserved >= 0`
- `reserved <= onHand`
- `lowStockThreshold >= 0`

## 4. Availability and status

No redundant inventory-status column is stored.

`getInventoryAvailability()` derives:

- `UNTRACKED` when tracking is disabled.
- `OUT_OF_STOCK` when available is 0.
- `LOW_STOCK` when available is greater than 0 and less than or equal to the per-variant threshold.
- `IN_STOCK` otherwise.

This keeps quantities as the single source of truth.

## 5. Tracking strategy

`trackingEnabled` distinguishes stock-tracked variants from made-to-order/untracked variants.

A ProductVariant does not require an Inventory row. An untracked variant therefore does not need fake stock quantities.

## 6. Low-stock threshold

`lowStockThreshold` is stored per Inventory record and is evaluated against derived available quantity.

Notifications and replenishment automation are intentionally deferred.

## 7. Adjustments and audit history

`adjustInventory()` changes only on-hand stock. Every successful non-zero adjustment creates an immutable `InventoryTransaction` containing:

- inventory ID
- quantity delta
- previous on-hand quantity
- resulting on-hand quantity
- constrained reason
- optional actor/source/note/reference
- creation timestamp

Supported reasons are:

- INITIAL_STOCK
- MANUAL_ADJUSTMENT
- STOCK_RECEIPT
- DAMAGED
- LOST
- RETURNED
- CORRECTION

Provider synchronization is not implemented. A future provider sync can use a later reason/model without coupling the canonical inventory record to a provider.

## 8. Atomicity and concurrency

Inventory mutations that also write history run inside a Prisma interactive transaction.

The adjustment path uses an atomic conditional `updateMany` for decreases, so an adjustment cannot decrement below zero. PostgreSQL constraints also prevent an on-hand result below the reserved quantity.

The transaction uses Prisma's PostgreSQL `Serializable` isolation level so concurrent inventory mutations are treated as serial operations. A future high-volume order/reservation layer should add bounded retry handling for serialization/write-conflict failures.

No distributed locking system is introduced.

## 9. Data-access boundary

The minimum inventory boundary is:

`lib/inventory/repository.ts`

It exposes:

- `getInventoryByVariant()`
- `createInventory()`
- `adjustInventory()`
- `getInventoryHistory()`
- `calculateAvailableQuantity()`
- `getInventoryAvailability()`

Checkout, reservation, release, fulfillment, provider synchronization, and UI logic remain outside this boundary.

## 10. Location decision

A separate `InventoryLocation` model is intentionally deferred.

The current application has no established warehouse/location requirement. The canonical Inventory row is therefore single-location today.

Future multi-location support can introduce an InventoryLocation entity and change inventory uniqueness to a variant/location combination without adding provider fields to ProductVariant.

## 11. Deletion and archive behavior

Inventory is audit-sensitive.

- ProductVariant → Inventory is RESTRICT.
- Inventory → InventoryTransaction is RESTRICT.
- InventoryTransaction is never cascade-deleted by inventory deletion.
- Product/ProductVariant archival remains the preferred catalog lifecycle mechanism.
- A variant with inventory history cannot be casually deleted because the restrictive foreign keys preserve audit history.

This is intentionally stricter than the Phase 2.2 catalog-only cascade behavior once inventory exists.

## 12. Indexes

Minimum indexes:

- unique Inventory.variantId
- Inventory.trackingEnabled
- InventoryTransaction.inventoryId + createdAt
- InventoryTransaction.reason + createdAt

The variant unique key also supports direct inventory lookup by SKU through the ProductVariant relation without adding speculative provider/search indexes.

## 13. Migration

Created:

`prisma/migrations/20260928130000_inventory_foundation/migration.sql`

The migration adds only inventory enums/tables/indexes/constraints and does not reset or wipe existing catalog data.

During Phase 2.3 review, the malformed Phase 2.2 migration artifact on `main` was also repaired in place so the migration chain is syntactically coherent. Its catalog model contract was not changed.

## 14. Seed data

No seed data was added. The repository has no existing deterministic seed/test-data system, so fake inventory was intentionally not introduced.

## 15. Provider compatibility

The same canonical Inventory model supports:

Manual stock:
`ProductVariant → Inventory → Manual adjustment`

Future provider stock:
`ProductVariant → future Provider Mapping → provider → future synchronization into Inventory`

Made-to-order:
`ProductVariant → trackingEnabled=false`

No Qikink, Printrove, Printful, Printify, or other provider API behavior is implemented.

## 16. Future order/checkout integration

Later order/checkout code should:

1. Open a short database transaction.
2. Lock or conditionally update the relevant Inventory row.
3. Maintain the invariant `reserved <= onHand`.
4. Record the corresponding history where the business operation changes on-hand stock.
5. Derive available quantity rather than persisting a duplicate value.
6. Retry serialization/write-conflict failures where appropriate.

Reservation/release semantics are intentionally not implemented here.

## 17. Testing and validation

The repository does not currently define a test runner or `npm test` script, so no new test framework or dependency was introduced solely for this phase.

The expected local validation sequence is:

```bash
npx prisma generate
npx prisma validate
npm run lint
npm run typecheck
npm test
npm run build
```

Only commands actually executed in the developer checkout should be reported as passing.

## 18. Deferred functionality

- Qikink/Printrove/Printful/Printify inventory synchronization
- Provider APIs and credentials
- Provider mapping
- Orders
- Cart reservation workflow
- Checkout
- Payments
- Fulfillment
- Shipping
- Admin inventory UI
- Customer inventory UI
- Warehouse management
- Purchase orders
- Supplier management
- Automated replenishment
- Forecasting
- Inventory notifications
- Multi-location inventory
- Reservation/release workflow

## Architecture diagram

```text
Product
  |
ProductVariant
  |
  +---- Inventory --------------------+
  |       |                           |
  |       +-- onHand                  |
  |       +-- reserved                |
  |       +-- lowStockThreshold       |
  |       +-- trackingEnabled         |
  |                                   |
  |       InventoryTransaction[] <----+
  |
  +---- future Provider Mapping (deferred)
```

**STOP — Phase 2.3 implementation scope only.**
