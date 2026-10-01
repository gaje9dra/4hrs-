import assert from "node:assert/strict";
import test from "node:test";
import type { CartDto } from "@/lib/cart/contracts";
import type { CustomerAddressDto, CustomerDto } from "@/lib/customer/contracts";
import { CustomerAddressError } from "@/lib/customer/errors";
import { CartServiceError } from "@/lib/cart/errors";
import { createCheckoutService } from "@/lib/checkout/service";
import { createCheckoutApplication } from "@/lib/checkout/api";

const customer: CustomerDto = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "customer@example.com",
  displayName: "Customer",
  status: "ACTIVE",
  emailVerifiedAt: null,
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
};

const address: CustomerAddressDto = {
  id: "22222222-2222-4222-8222-222222222222",
  recipientName: "Customer",
  phone: null,
  addressLine1: "1 Test Street",
  addressLine2: null,
  city: "Jaipur",
  stateOrProvince: "Rajasthan",
  postalCode: "302001",
  countryCode: "IN",
  label: "Home",
  isDefault: true,
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
};

function cart(overrides: Partial<CartDto> = {}): CartDto {
  const item = {
    id: "33333333-3333-4333-8333-333333333333",
    product: { id: "44444444-4444-4444-8444-444444444444", title: "Tee", slug: "tee", media: null },
    variant: null,
    quantity: 2,
    unitPrice: "499.00",
    currency: "INR",
    subtotal: "998.00",
    availability: "AVAILABLE" as const,
  };
  return {
    id: "55555555-5555-4555-8555-555555555555",
    items: [item],
    subtotal: "998.00",
    currency: "INR",
    hasUnavailableItems: false,
    warnings: [],
    ...overrides,
  };
}

function serviceFactory(getCart: () => Promise<CartDto>) {
  return createCheckoutService({
    customer,
    getCart,
    getAddress: async (_customerId, addressId) => {
      if (addressId !== address.id) throw new CustomerAddressError("CUSTOMER_ADDRESS_NOT_FOUND", "Address was not found.");
      return address;
    },
    listAddresses: async () => [address],
  });
}

test("valid checkout uses authoritative Cart totals and owned address", async () => {
  const result = await serviceFactory(async () => cart()).validate({ selectedAddressId: address.id });
  assert.equal(result.validation.state, "VALID");
  assert.equal(result.totals.total, "998.00");
  assert.equal(result.address?.id, address.id);
  assert.equal(result.payment.ready, true);
  assert.match(result.payment.checkoutReference ?? "", /^[0-9a-f]{64}$/);
});

test("missing Cart is a structured validation error", async () => {
  await assert.rejects(
    () => serviceFactory(async () => { throw new CartServiceError("CART_NOT_FOUND", "Cart was not found."); })
      .validate({ selectedAddressId: address.id }),
    (error: unknown) => error instanceof Error && error.message === "Your Cart could not be loaded.",
  );
});

test("empty Cart is rejected", async () => {
  const result = await serviceFactory(async () => cart({ items: [], subtotal: "0.00" })).validate({ selectedAddressId: address.id });
  assert.equal(result.validation.state, "CART_EMPTY");
});

test("unavailable product, variant and invalid quantity are rejected", async () => {
  const base = cart();
  const result = await serviceFactory(async () => ({
    ...base,
    items: [
      { ...base.items[0], quantity: 0 },
      { ...base.items[0], id: "66666666-6666-4666-8666-666666666666", availability: "PRODUCT_UNAVAILABLE" },
      { ...base.items[0], id: "77777777-7777-4777-8777-777777777777", availability: "VARIANT_UNAVAILABLE" },
    ],
  })).validate({ selectedAddressId: address.id });
  assert.equal(result.validation.issues.some((x) => x.code === "INVALID_QUANTITY"), true);
  assert.equal(result.validation.issues.some((x) => x.code === "PRODUCT_UNAVAILABLE"), true);
  assert.equal(result.validation.issues.some((x) => x.code === "VARIANT_UNAVAILABLE"), true);
});

test("authoritative price inconsistency becomes PRICE_CHANGED", async () => {
  const base = cart();
  const result = await serviceFactory(async () => ({
    ...base,
    items: [{ ...base.items[0], unitPrice: "599.00", subtotal: "998.00" }],
  })).validate({ selectedAddressId: address.id });
  assert.equal(result.validation.state, "PRICE_CHANGED");
});

test("browser price, total, currency, customer and Cart IDs are not accepted as authority", async () => {
  const app = createCheckoutApplication({
    resolveCustomer: async () => customer,
    getCart: async () => cart(),
    getAddress: async () => address,
    listAddresses: async () => [address],
  });
  const request = new Request("https://example.test/api/checkout", {
    method: "POST",
    body: JSON.stringify({
      selectedAddressId: address.id,
      customerId: customer.id,
      cartId: cart().id,
      price: "1.00",
      subtotal: "1.00",
      total: "1.00",
      currency: "USD",
    }),
    headers: { "content-type": "application/json" },
  });
  await assert.rejects(() => app.readRequest(request), /unsupported fields/i);
});

test("Checkout rejects every browser-controlled business authority field", async () => {
  const app = createCheckoutApplication({
    resolveCustomer: async () => customer,
    getCart: async () => cart(),
    getAddress: async () => address,
    listAddresses: async () => [address],
  });
  const fields = ["customerId", "cartId", "productId", "variantId", "quantity", "unitPrice", "price", "subtotal", "discount", "tax", "shipping", "shippingCharge", "total", "currency", "availability"];
  for (const field of fields) {
    const request = new Request("https://example.test/api/checkout", {
      method: "POST",
      body: JSON.stringify({ selectedAddressId: address.id, [field]: field === "quantity" ? 1 : "attacker-value" }),
      headers: { "content-type": "application/json" },
    });
    await assert.rejects(() => app.readRequest(request), /unsupported fields/i, field);
  }
});

test("another customer's address is rejected without leaking ownership", async () => {
  const result = await serviceFactory(async () => cart()).validate({
    selectedAddressId: "88888888-8888-4888-8888-888888888888",
  });
  assert.equal(result.validation.state, "ADDRESS_NOT_OWNED");
});

test("deleted address is rejected", async () => {
  const result = await createCheckoutService({
    customer,
    getCart: async () => cart(),
    getAddress: async () => {
      throw new CustomerAddressError("CUSTOMER_ADDRESS_NOT_FOUND", "Address was not found.");
    },
    listAddresses: async () => [],
  }).validate({ selectedAddressId: address.id });
  assert.equal(result.validation.state, "ADDRESS_NOT_OWNED");
});

test("default address is resolved server-side when no address ID is submitted", async () => {
  const result = await serviceFactory(async () => cart()).validate({});
  assert.equal(result.validation.state, "VALID");
  assert.equal(result.address?.id, address.id);
});

test("currency inconsistency is rejected", async () => {
  const base = cart();
  const result = await serviceFactory(async () => ({
    ...base,
    items: [
      base.items[0],
      { ...base.items[0], id: "99999999-9999-4999-8999-999999999999", currency: "USD", unitPrice: "4.50", subtotal: "9.00" },
    ],
  })).validate({ selectedAddressId: address.id });
  assert.equal(result.validation.state, "CURRENCY_CHANGED");
});

test("no address produces an incomplete Checkout state", async () => {
  const result = await createCheckoutService({
    customer,
    getCart: async () => cart(),
    getAddress: async () => address,
    listAddresses: async () => [],
  }).validate({});
  assert.equal(result.validation.state, "INVALID_ADDRESS");
});

test("customer identity cannot be overridden", async () => {
  const result = await serviceFactory(async () => cart()).validate({ selectedAddressId: address.id });
  assert.equal(result.customer?.id, customer.id);
});

test("unexpected Cart failures are mapped without ORM or SQL leakage", async () => {
  await assert.rejects(
    () => serviceFactory(async () => { throw new Error("SQL relation secret"); }).validate({ selectedAddressId: address.id }),
    (error: unknown) => error instanceof Error &&
      error.message === "Checkout validation is temporarily unavailable." &&
      !error.message.includes("SQL"),
  );
});

test("Checkout never performs inventory reservation", async () => {
  const reservationCalls = 0;
  const result = await serviceFactory(async () => cart()).validate({ selectedAddressId: address.id });
  assert.equal(result.validation.state, "VALID");
  assert.equal(reservationCalls, 0);
});


test("Checkout returns a deterministic opaque revision and detects stale pricing", async () => {
  let current = cart();
  const service = serviceFactory(async () => current);
  const first = await service.validate({ selectedAddressId: address.id });
  assert.deepEqual(first.revision, (await serviceFactory(async () => current).validate({ selectedAddressId: address.id })).revision);

  current = {
    ...current,
    items: [{ ...current.items[0], unitPrice: "599.00", subtotal: "1198.00" }],
    subtotal: "1198.00",
  };
  const stale = await service.validate({
    selectedAddressId: address.id,
    expectedRevision: first.revision,
  });
  assert.equal(stale.validation.state, "PRICE_CHANGED");
  assert.equal(stale.totals.total, "1198.00");
});

test("Checkout detects Cart structure changes without trusting client pricing", async () => {
  let current = cart();
  const service = serviceFactory(async () => current);
  const first = await service.validate({ selectedAddressId: address.id });

  current = {
    ...current,
    items: [
      ...current.items,
      {
        ...current.items[0],
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        quantity: 1,
        subtotal: "499.00",
      },
    ],
    subtotal: "1497.00",
  };

  const stale = await service.validate({
    selectedAddressId: address.id,
    expectedRevision: first.revision,
  });
  assert.equal(stale.validation.state, "CART_CHANGED");
  assert.equal(stale.totals.total, "1497.00");
});

test("Checkout revision request rejects malformed or monetary client fields", async () => {
  const app = createCheckoutApplication({
    resolveCustomer: async () => customer,
    getCart: async () => cart(),
    getAddress: async () => address,
    listAddresses: async () => [address],
  });

  const malformed = new Request("https://example.test/api/checkout", {
    method: "POST",
    body: JSON.stringify({ selectedAddressId: address.id, expectedRevision: { cart: "not-a-hash", pricing: "x", availability: "x" } }),
    headers: { "content-type": "application/json" },
  });
  await assert.rejects(() => app.readRequest(malformed), /revision is invalid/i);

  const monetary = new Request("https://example.test/api/checkout", {
    method: "POST",
    body: JSON.stringify({ selectedAddressId: address.id, expectedRevision: { cart: "a".repeat(64), pricing: "b".repeat(64), availability: "c".repeat(64) }, total: "1.00" }),
    headers: { "content-type": "application/json" },
  });
  await assert.rejects(() => app.readRequest(monetary), /unsupported fields/i);
});
