import test from "node:test";
import assert from "node:assert/strict";
import { CartServiceError } from "@/lib/cart/errors";
import {
  CART_API_MAX_BODY_BYTES,
  CART_API_MAX_QUANTITY,
  createCartApplication,
  parseAddCartItemInput,
  parseUpdateCartItemInput,
  toCartDto,
} from "@/lib/cart/api";

const uuid = "11111111-1111-4111-8111-111111111111";

function makeCartView() {
  return {
    id: uuid,
    items: [{
      id: "22222222-2222-4222-8222-222222222222",
      productId: uuid,
      variantId: null,
      quantity: 2,
      state: "AVAILABLE" as const,
      product: {
        id: uuid,
        title: "Test Tee",
        slug: "test-tee",
        media: { url: "/tee.jpg", altText: "Test Tee" },
      },
      variant: null,
      unitPrice: "499.00",
      currency: "INR",
      subtotal: "998.00",
      availableQuantity: 5,
    }],
    subtotal: "998.00",
    currency: "INR",
    hasUnavailableItems: false,
  };
}

test("Cart DTO is independent of persistence fields and exposes only storefront-safe data", () => {
  const dto = toCartDto(makeCartView());
  assert.deepEqual(dto, {
    id: uuid,
    items: [{
      id: "22222222-2222-4222-8222-222222222222",
      product: {
        id: uuid,
        title: "Test Tee",
        slug: "test-tee",
        media: { url: "/tee.jpg", altText: "Test Tee" },
      },
      variant: null,
      quantity: 2,
      unitPrice: "499.00",
      currency: "INR",
      subtotal: "998.00",
      availability: "AVAILABLE",
    }],
    subtotal: "998.00",
    currency: "INR",
    hasUnavailableItems: false,
    warnings: [],
  });
});

test("Cart DTO turns stale line state into deterministic warnings", () => {
  const dto = toCartDto({
    ...makeCartView(),
    hasUnavailableItems: true,
    items: [{
      ...makeCartView().items[0],
      state: "VARIANT_UNAVAILABLE",
      product: null,
      variant: null,
      unitPrice: null,
      currency: null,
      subtotal: null,
      availableQuantity: null,
    }],
  });
  assert.deepEqual(dto.warnings, [{
    code: "VARIANT_UNAVAILABLE",
    itemId: "22222222-2222-4222-8222-222222222222",
  }]);
});

test("strict add-item validation rejects prices, totals, provider fields and malformed identifiers", () => {
  assert.deepEqual(
    parseAddCartItemInput({ productId: uuid, variantId: uuid, quantity: 1 }),
    { productId: uuid, variantId: uuid, quantity: 1 },
  );

  for (const input of [
    { productId: uuid, variantId: uuid, quantity: 1, price: "1.00" },
    { productId: uuid, variantId: uuid, quantity: 1, total: "1.00" },
    { productId: uuid, variantId: uuid, quantity: 1, providerId: "provider-1" },
    { productId: "not-a-uuid", variantId: uuid, quantity: 1 },
  ]) {
    assert.throws(
      () => parseAddCartItemInput(input),
      (error: unknown) => error instanceof CartServiceError && error.code === "INVALID_CART_INPUT",
    );
  }
});

test("quantity validation enforces a bounded integer request contract", () => {
  assert.equal(CART_API_MAX_QUANTITY, 100);
  assert.deepEqual(parseUpdateCartItemInput({ quantity: 1 }), { quantity: 1 });

  for (const quantity of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 101]) {
    assert.throws(
      () => parseUpdateCartItemInput({ quantity }),
      (error: unknown) => error instanceof CartServiceError && error.code === "INVALID_QUANTITY",
    );
  }
});

test("strict request parsing rejects malformed JSON, empty bodies and oversized bodies", async () => {
  const valid = new Request("https://example.test/api/cart", {
    method: "POST",
    body: JSON.stringify({ productId: uuid, variantId: uuid, quantity: 1 }),
    headers: { "content-type": "application/json" },
  });
  assert.deepEqual(await (await import("@/lib/cart/api")).readJsonBody(valid), {
    productId: uuid,
    variantId: uuid,
    quantity: 1,
  });

  const empty = new Request("https://example.test/api/cart", { method: "POST", body: " " });
  await assert.rejects(
    (await import("@/lib/cart/api")).readJsonBody(empty),
    (error: unknown) => error instanceof CartServiceError && error.code === "INVALID_CART_INPUT",
  );

  const oversized = new Request("https://example.test/api/cart", {
    method: "POST",
    body: "x".repeat(CART_API_MAX_BODY_BYTES + 1),
  });
  await assert.rejects(
    (await import("@/lib/cart/api")).readJsonBody(oversized),
    (error: unknown) => error instanceof CartServiceError && error.code === "INVALID_CART_INPUT",
  );
});

test("default application fails closed without customer/session identity", async () => {
  const application = createCartApplication();
  await assert.rejects(
    application.getCurrentCart(new Request("https://example.test/api/cart")),
    (error: unknown) => error instanceof CartServiceError && error.code === "CART_OWNERSHIP_UNAVAILABLE",
  );
});

test("application mutations invoke the Cart service without accepting client pricing data", async () => {
  const calls: string[] = [];
  const service = {
    addItem: async (_cartId: string, input: { productId: string; variantId: string | null; quantity: number }) => {
      calls.push(`add:${input.productId}:${input.variantId}:${input.quantity}`);
      return { id: "item-1" };
    },
    getCart: async () => makeCartView(),
  } as never;

  const application = createCartApplication({
    service,
    resolveRequestContext: async () => ({ cartId: uuid, owner: "server-owner" }),
  });

  const request = new Request("https://example.test/api/cart", {
    method: "POST",
    body: JSON.stringify({ productId: uuid, variantId: uuid, quantity: 2 }),
    headers: { "content-type": "application/json" },
  });

  const result = await application.addItem(request);
  assert.equal(result.subtotal, "998.00");
  assert.deepEqual(calls, [`add:${uuid}:${uuid}:2`]);
});

test("API route handlers expose malformed requests safely and fail closed without identity", async () => {
  const route = await import("@/app/api/cart/route");

  const malformed = await route.POST(new Request("https://example.test/api/cart", {
    method: "POST",
    body: JSON.stringify({ productId: uuid, quantity: 1, price: "1.00" }),
    headers: { "content-type": "application/json" },
  }));
  assert.equal(malformed.status, 400);
  assert.deepEqual(await malformed.json(), {
    error: {
      code: "INVALID_CART_INPUT",
      message: "Request contains unsupported fields.",
    },
  });

  const read = await route.GET(new Request("https://example.test/api/cart"));
  assert.equal(read.status, 503);
  assert.deepEqual(await read.json(), {
    error: {
      code: "CART_OWNERSHIP_UNAVAILABLE",
      message: "Cart ownership cannot be resolved because customer/session identity is not implemented.",
    },
  });
  assert.equal(read.headers.get("cache-control"), "private, no-store, max-age=0");
});
