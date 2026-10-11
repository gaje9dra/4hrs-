import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

test("cart resolves unique product details in a bounded batch", () => {
  const service = read("lib/cart/service.ts");
  const catalogRepository = read("lib/catalog/repository.ts");
  const catalogQuery = read("lib/catalog/query.ts");
  const cartRepository = read("lib/cart/repository.ts");
  const cartOwnership = read("lib/cart/auth-ownership.ts");
  const cartApi = read("lib/cart/api.ts");

  assert.match(service, /new Set\(cart\.items\.map\(\(item\) => item\.productId\)\)/);
  assert.match(service, /getPublishedProductDetailsByIds/);
  assert.match(catalogRepository, /getPublishedProductDetailsByIds[\s\S]*?product\.findMany\([\s\S]*?id: \{ in: uniqueIds \}/);
  assert.match(catalogQuery, /async getPublishedProductDetailsByIds\(ids: string\[\]\)/);
  assert.doesNotMatch(service, /cart\.items\.map\(resolveLine\)/);
  assert.match(cartRepository, /findCartOwner\(cartId: string\)[\s\S]*?select: \{ customerId: true \}/);
  assert.match(cartOwnership, /repository\.findCartOwner[\s\S]*?await repository\.findCartById/);
  assert.match(cartOwnership, /verifiedCartId === cartId/);
  assert.match(cartApi, /owner: \{ customerId, verifiedCartId: cart\.id \}/);
});

test("checkout bootstrap returns saved addresses without a duplicate initial request", () => {
  const checkoutService = read("lib/checkout/service.ts");
  const checkoutContracts = read("lib/checkout/contracts.ts");
  const checkoutPage = read("components/storefront/checkout-page.tsx");
  const checkoutRoute = read("app/(storefront)/checkout/page.tsx");
  const checkoutApi = read("lib/checkout/api.ts");
  const cartApi = read("lib/cart/api.ts");

  // Checkout bootstrap must return addresses in its own response and avoid
  // a second client request. Cart and address reads should also overlap so
  // initial checkout latency is not the sum of both database paths.
  assert.match(checkoutService, /const cartPromise = dependencies\.getCart\(\)/);
  assert.match(checkoutService, /const addressPromise = \(addressId[\s\S]*?dependencies\.listAddresses\(dependencies\.customer\.id\)/);
  assert.match(checkoutService, /const addressResult = await addressPromise/);
  assert.match(checkoutService, /\.\.\.\(addresses \? \{ addresses \} : \{\}\)/);
  assert.match(checkoutContracts, /addresses\?: CustomerAddressDto\[\]/);
  assert.match(checkoutPage, /checkoutRequest\("GET"\)[\s\S]*?const nextAddresses = nextCheckout\.addresses \?\? \[\]/);
  assert.doesNotMatch(checkoutPage, /Promise\.all\(\[checkoutRequest\("GET"\), addressRequest\(\)\]\)/);
  assert.doesNotMatch(checkoutRoute, /await resolveCurrentCustomer/);
  assert.match(checkoutPage, /checkout\?\.customer\?\.email/);
  assert.match(cartApi, /getCurrentCartForCustomer\(customerId: string\)/);
  assert.match(checkoutApi, /cartApplication\.getCurrentCartForCustomer\(customer\.id\)/);
});
