import test from "node:test";
import assert from "node:assert/strict";
import { createAuthenticatedCartOwnershipBoundary } from "../lib/cart/auth-ownership.ts";
import { CartServiceError } from "../lib/cart/errors.ts";
import type { CartRepository } from "../lib/cart/repository.ts";

test("authenticated Cart ownership rejects cross-customer access", async () => {
  const repository: Pick<CartRepository, "findCartById"> = {
    async findCartById() {
      return { id: "cart-1", customerId: "customer-a", createdAt: new Date(), updatedAt: new Date(), items: [] };
    },
  };
  const boundary = createAuthenticatedCartOwnershipBoundary(repository);
  await assert.rejects(
    boundary.authorizeCartAccess("cart-1", { customerId: "customer-b" }),
    (error: unknown) => error instanceof CartServiceError && error.code === "CART_UNAUTHORIZED",
  );
});

test("authenticated Cart ownership accepts the authenticated customer", async () => {
  const repository: Pick<CartRepository, "findCartById"> = {
    async findCartById() {
      return { id: "cart-1", customerId: "customer-a", createdAt: new Date(), updatedAt: new Date(), items: [] };
    },
  };
  const boundary = createAuthenticatedCartOwnershipBoundary(repository);
  await boundary.authorizeCartAccess("cart-1", { customerId: "customer-a" });
});

test("authorization primitives reject anonymous customer-owned resource access", async () => {
  const { requireCustomerIdentity, assertCustomerOwnsResource } = await import("../lib/auth/authorization.ts");
  assert.throws(() => requireCustomerIdentity(null), /Authentication is required/);
  assert.throws(() => assertCustomerOwnsResource("a", "b"), /not available/);
});
