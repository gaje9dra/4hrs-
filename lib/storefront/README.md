# Storefront data boundary

lib/storefront/catalog.ts is the customer-facing data/query boundary for Phase 3.1.

Storefront routes consume this module rather than Prisma or catalog repositories directly. It maps canonical catalog query/search results into public view models and preserves Phase 2 visibility, pagination, merchandising, pricing, media, SEO, and availability semantics.

No checkout, cart, account, payment, order, shipping, fulfillment, or provider API logic belongs here.
