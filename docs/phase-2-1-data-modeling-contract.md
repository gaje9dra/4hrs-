# Phase 2.1 — Data Modeling Contract

## Purpose

This document is the contract for all subsequent Phase 2 database work.

The central rule is:

> The store database owns canonical commerce entities. External providers are integrations around those entities, not the source of truth for the customer-facing store.

Phase 2.1 defines modeling rules only. It does not implement the complete commerce schema.

## 1. Database ownership

The application owns canonical store entities and their customer-facing meaning.

For future catalog data, the store owns:

- Product identity
- Store title and description
- Store images
- Category relationships
- Tags
- Selling price
- Compare-at price
- Status
- SEO information
- Store-facing metadata

For future variants, the store owns:

- Variant identity
- Product relationship
- Size
- Color
- SKU
- Selling price
- Inventory state
- Store-facing availability

External providers own provider-specific facts such as:

- Provider identity
- External product ID
- External variant ID
- Provider SKU
- Provider-specific metadata
- Synchronization information

Provider records must never replace canonical store identity.

## 2. Provider-neutral architecture

Provider-specific models must not become the core representation of commerce entities.

Conceptually:

```text
Store Product
    |
    +-- Provider Mapping
            |
            +-- Qikink
            +-- Printrove
            +-- Printful
            +-- Printify
            +-- Manual
            +-- Future Provider
```

The same provider-neutral principle applies to:

- Fulfillment
- Payments
- Shipping

A future provider adapter may translate between the canonical domain and an external API, but the customer-facing store remains based on canonical store entities.

## 3. Canonical identifiers

Every canonical entity must have a stable internal identifier.

The following must **not** become primary identity:

- Provider product ID
- Provider variant ID
- Provider SKU
- Payment provider transaction ID
- Shipping provider tracking number

External identifiers are integration references and must be stored separately.

### Identifier rules

1. Preserve an established project identifier convention when one is introduced.
2. Use one consistent primary-key strategy across canonical entities.
3. Foreign keys must reference canonical internal IDs.
4. External provider IDs must remain provider-scoped.
5. Public identifiers/slugs are separate from internal primary identity when the domain requires them.

## 4. External-ID uniqueness

External IDs must never be assumed globally unique across providers.

A future provider mapping should support provider-scoped uniqueness conceptually equivalent to:

```text
(providerId, externalProductId)
(providerId, externalVariantId)
```

This permits the same external ID value to exist under different providers without collision.

## 5. Timestamp conventions

Future persistent entities should use consistent created/updated timestamps where meaningful:

- `createdAt`
- `updatedAt`

Lifecycle timestamps are added only when they represent an actual business event, for example:

- published
- archived
- synced
- processed
- completed

Do not add every possible timestamp to every model.

### Timezone/storage rule

Database timestamps should represent absolute instants using the selected database/ORM's timezone-safe timestamp representation. Application display may convert those instants to a user's or operational timezone.

## 6. Soft-delete policy

Soft deletion is **not global**.

Do not automatically add `deletedAt` to every model.

Historical commerce records must be preserved where deletion would destroy accounting, customer-service, operational, or audit history. This is particularly relevant to:

- Orders
- Payments
- Refunds
- Fulfillment records
- Shipping events
- Provider synchronization history
- Audit/event records

Reference/catalog entities may use hard deletion only where the domain explicitly permits it and no required historical record depends on the row.

A future model must choose its deletion policy intentionally.

## 7. Lifecycle/status modeling

Use explicit status fields or enums when lifecycle state has business meaning.

Examples for later models:

### Product

- Draft
- Active
- Archived

### Order

- Pending
- Confirmed
- Processing
- Fulfilled
- Cancelled
- Returned

### Payment

- Pending
- Authorized
- Paid
- Failed
- Refunded

### Fulfillment

- Pending
- Submitted
- Processing
- Shipped
- Failed
- Cancelled

These are modeling examples, not Phase 2.1 implementation requirements.

Lifecycle state must remain provider-neutral. External provider states should be translated at the integration boundary rather than leaked into the canonical domain.

## 8. Money model

Financial values must never use floating-point storage.

The project should use one consistent representation for all monetary values once commerce models are introduced.

The selected representation must be appropriate for the database/ORM and should use either:

- Decimal/numeric values with explicit precision/scale, or
- Integer minor units

The project must not mix strategies casually.

Future monetary fields include, as applicable:

- Product price
- Compare-at price
- Discount
- Tax
- Shipping charge
- Payment amount
- Refund amount
- Order total
- Provider cost

### Currency

A monetary value must have an unambiguous currency context.

The initial store may operate with one primary currency, but future schema design must not make multi-currency impossible.

Do not build a multi-currency subsystem in Phase 2.1.

### Rounding

Rounding rules must be deterministic and documented with the later pricing implementation. Financial calculations must not depend on binary floating-point behavior.

## 9. Enum strategy

The future enum strategy must follow the selected database/ORM conventions.

Use enums/database enums or application-level constrained values when:

- the value set is stable;
- the value has explicit business semantics;
- referential integrity benefits from constrained values.

Do not use database enums for highly dynamic values that are expected to change frequently or be administered as data.

Avoid introducing multiple competing enum patterns without a concrete domain reason.

## 10. Relationship conventions

Future relationships must be explicit and consistent.

Supported patterns include:

- One-to-one
- One-to-many
- Many-to-many

Foreign keys must point to canonical internal identifiers.

### Referential actions

Cascade, restrict, and null-on-delete behavior must be chosen according to business semantics, not convenience.

Historical commerce records should generally resist cascading deletion from parent records when that could erase financial or operational history.

Do not use broad cascade deletion as a default for the commerce domain.

## 11. Nullability rules

A field must be required, optional, nullable, or defaulted according to domain meaning.

Do not use nullability to hide unclear modeling.

Distinguish:

- Missing — the value was not supplied.
- Unknown — the value is expected but currently unavailable.
- Not applicable — the concept does not apply.
- Empty — the concept applies and has an intentionally empty value.

Provider metadata is a key case where these distinctions matter.

## 12. Uniqueness rules

Uniqueness must follow business scope.

Examples:

- Internal IDs: unique according to the chosen primary-key strategy.
- SKU: store-defined uniqueness according to business rules.
- External provider ID: unique within provider scope.
- Provider variant ID: unique within provider scope.
- Slug: unique within the relevant resource scope.

Do not create global uniqueness assumptions for identifiers supplied by third-party providers.

## 13. Indexing strategy

Indexes must support actual query patterns.

Likely future query patterns include:

- Product lookup
- SKU lookup
- Slug lookup
- Category filtering
- Product status filtering
- Provider mapping lookup
- Order lookup
- Customer lookup
- Payment lookup
- Shipment lookup

Do not create every future index during foundation work.

Each index should have a concrete read/query or constraint rationale.

Composite indexes should reflect the order of fields in real query predicates and sorting requirements.

## 14. Provider registry

The future architecture may represent providers through a provider-neutral registry:

```text
Provider
- internal ID
- provider type
- name
- status
- configuration reference
```

Potential provider types:

- Fulfillment
- Payment
- Shipping

Provider credentials and secrets must not be stored directly in ordinary business records.

Configuration references may point to secure environment/deployment secret storage or another approved secret-management mechanism.

No provider credentials or integrations are implemented in Phase 2.1.

## 15. Provider mappings

Canonical entities may later be mapped to external entities:

```text
Canonical Product
    |
    +-- Provider Product Mapping
            |
            +-- Provider
            +-- External Product ID
            +-- External Metadata
            +-- Synchronization State
```

The same boundary can later support:

- Product mappings
- Variant mappings
- Fulfillment mappings
- Payment references
- Shipping references

External IDs remain isolated from canonical IDs.

## 16. Product ownership contract

A canonical product must be editable independently of its provider.

Conceptually:

```text
Store Product
├── Store title
├── Store description
├── Store images
├── Store pricing
├── Store SEO
├── Store categories
├── Store tags
└── Store status

Provider Mapping
├── Provider
├── External product ID
├── External metadata
└── Synchronization state
```

An imported product can therefore become a normal store product whose customer-facing content is controlled by the store.

## 17. Manual products

A product does not have to originate from an external provider.

The following must remain a valid future state:

```text
Product
  |
  +-- No provider mapping
```

This is required for own-inventory and manual-fulfillment products.

## 18. Multiple providers

A single canonical product must be able to have multiple provider mappings without duplicating the customer-facing product.

Conceptually:

```text
Product A
├── Qikink mapping
└── Printrove mapping
```

Provider-specific schemas must remain behind integration boundaries. Customer-facing code must not need to understand vendor-specific persistence formats.

No synchronization logic is implemented in Phase 2.1.

## 19. Auditability

Commerce systems require historical traceability.

Future models must preserve meaningful history for:

- Orders
- Payments
- Refunds
- Fulfillment events
- Shipping events
- Provider synchronization

A complete generic audit-log subsystem is not required in Phase 2.1 unless one already exists.

Later models must not introduce destructive designs that make important historical events impossible to reconstruct.

## 20. Data-access boundary

Database access must remain behind the established application architecture.

The intended future direction is:

```text
UI / Route
    ↓
Feature / Domain Service
    ↓
Repository / Data Access
    ↓
Database
```

Do not scatter raw database queries through UI components.

Do not introduce a repository abstraction merely for ceremony if the selected ORM/query layer already provides an appropriate, well-defined data-access boundary.

## 21. Migration safety

Every future migration must be:

- Deterministic
- Reviewable
- Reproducible
- Data-preserving by default
- Compatible with development and production deployment
- Explicit about destructive operations

Destructive operations require explicit justification and must not be performed merely to simplify a migration.

Phase 2.1 creates no destructive migration.

## 22. Seed policy

Development/test seeds may eventually provide:

- Development categories
- Development products
- Test users
- Test provider records

Seeds must never contain:

- Real credentials
- Real payment credentials
- Real provider secrets
- Real customer information

Fake production-like data should not be added unless it is required for development/testing.

## 23. Environment safety

Development, test, and production database targets must remain distinct.

Future database commands must require explicit configuration and must not silently target production.

Database credentials belong outside source control.

Documentation may describe required environment variable names and setup requirements, but must never contain secret values.

## 24. Schema naming conventions

Follow the selected ORM/database's established naming conventions consistently.

At each abstraction layer, do not arbitrarily mix:

- camelCase
- snake_case
- PascalCase

Future documentation must clearly distinguish model/entity names, table names, field names, relation names, enum names, index names, constraint names, and provider mapping names where the technology requires it.

## 25. Future core domain map

Phase 2.1 establishes the following conceptual map only:

```text
Catalog
├── Product
├── Product Variant
├── Product Image
├── Category
├── Collection
└── Tag

Customer
├── Customer
├── Address
├── Wishlist
└── Cart

Commerce
├── Order
├── Order Item
├── Discount
└── Tax

Payment
├── Payment
├── Payment Transaction
└── Refund

Fulfillment
├── Fulfillment
├── Fulfillment Item
└── Provider Mapping

Shipping
├── Shipment
├── Tracking Event
└── Shipping Provider Mapping

Integration
├── Provider
├── Provider Product Mapping
└── Provider Variant Mapping

Administration
├── Admin
└── Audit/Event records where required
```

This is an architectural map, not permission to implement these models during Phase 2.1.

## 26. Explicit Phase 2.1 non-goals

Do not implement:

- Complete Product model
- ProductVariant
- Category
- Collection
- Tags
- Customer
- Address
- Cart
- Wishlist
- Orders
- Payments
- Refunds
- Fulfillment
- Shipping
- Inventory
- Checkout
- Authentication
- Admin product management
- Provider APIs
- Qikink
- Printrove
- Printful
- Printify
- Product import
- Synchronization workflows

## Contract status

Phase 2.1 establishes the database/data-modeling contract for later Phase 2 work.

The repository currently has no database foundation to modify, so no schema migration or database infrastructure is required by this phase.

**STOP after Phase 2.1.**
