import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(path, "utf8");

test("customer Order routes are private, dynamic, and authenticated", () => {
  for (const route of [
    "app/(storefront)/account/orders/page.tsx",
    "app/(storefront)/account/orders/[orderNumber]/page.tsx",
  ]) {
    const source = read(route);
    assert.match(source, /dynamic = "force-dynamic"/);
    assert.match(source, /robots: { index: false, follow: false, noarchive: true }/);
    assert.match(source, /requireCurrentCustomer/);
  }
});

test("customer Order UI uses the application/DTO boundary and never Prisma", () => {
  const paths = [
    "app/(storefront)/account/orders/page.tsx",
    "app/(storefront)/account/orders/[orderNumber]/page.tsx",
    "components/storefront/order-list.tsx",
    "components/storefront/order-detail.tsx",
  ];
  for (const path of paths) {
    const source = read(path);
    assert.doesNotMatch(source, /from ["']@\/prisma|from ["']@\/lib\/db|PrismaClient|\.findMany\(|\.findUnique\(/);
  }
  assert.match(read("app/(storefront)/account/orders/page.tsx"), /createOrderApplication/);
  assert.match(read("app/(storefront)/account/orders/[orderNumber]/page.tsx"), /getCustomerOrder/);
});

test("Order detail uses public historical snapshots and does not substitute catalog data", () => {
  const source = read("components/storefront/order-detail.tsx");
  assert.match(source, /productTitle/);
  assert.match(source, /variantTitle/);
  assert.match(source, /selectedOptions/);
  assert.match(source, /unitPrice/);
  assert.match(source, /lineTotal/);
  assert.match(source, /order\.total/);
  assert.match(source, /order\.subtotal/);
  assert.doesNotMatch(source, /fetch\(|productService|catalog/i);
});

test("Order status presentation supports only real Phase 12 lifecycle states", () => {
  const source = read("components/storefront/order-status-badge.tsx");
  assert.match(source, /PENDING/);
  assert.match(source, /CONFIRMED/);
  assert.doesNotMatch(source, /SHIPPED|DELIVERED|RETURNED|REFUNDED|PACKED/);
});

test("Order URLs use public Order numbers rather than internal database IDs", () => {
  const source = read("components/storefront/order-list.tsx");
  assert.match(source, /order\.orderNumber/);
  assert.match(source, /\/account\/orders/);
  assert.doesNotMatch(source, /order\.id.*href|href=.*order\.id/);
});

test("Order history has a bounded canonical pagination integration", () => {
  assert.match(read("app/(storefront)/account/orders/page.tsx"), /pageSize > 50/);
  assert.match(read("components/storefront/order-pagination.tsx"), /hasNextPage/);
  assert.match(read("components/storefront/order-pagination.tsx"), /pageSize/);
});

test("Order account has loading, safe error, and not-found boundaries", () => {
  for (const path of [
    "app/(storefront)/account/orders/loading.tsx",
    "app/(storefront)/account/orders/error.tsx",
    "app/(storefront)/account/orders/[orderNumber]/loading.tsx",
    "app/(storefront)/account/orders/[orderNumber]/error.tsx",
    "app/(storefront)/account/orders/[orderNumber]/not-found.tsx",
  ]) {
    assert.equal(existsSync(path), true, path);
  }
  assert.doesNotMatch(read("app/(storefront)/account/orders/error.tsx"), /Prisma|SQL|stack|provider|database error/i);
  assert.doesNotMatch(read("app/(storefront)/account/orders/[orderNumber]/not-found.tsx"), /customerId|paymentId|checkoutReference|Prisma/i);
});

test("Account navigation exposes the implemented Orders destination", () => {
  const source = read("app/(storefront)/account/page.tsx");
  assert.match(source, /href="\/account\/orders"/);
  assert.match(source, /Orders/);
});
