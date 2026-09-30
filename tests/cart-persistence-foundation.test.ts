import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const databaseConfigured = Boolean(process.env.DATABASE_URL);

test(
  "Cart persistence creates a cart and CartItem with canonical catalog relations",
  { skip: !databaseConfigured },
  async () => {
    const { db } = await import("../lib/db/client.ts");
    const { createCartRepository } = await import("../lib/cart/repository.ts");

    const repository = createCartRepository(db);
    const suffix = randomUUID();

    const product = await db.product.create({
      data: {
        title: `Cart persistence test ${suffix}`,
        slug: `cart-persistence-${suffix}`,
        price: "499.00",
      },
    });

    const variant = await db.productVariant.create({
      data: {
        productId: product.id,
        sku: `CART-${suffix}`,
        price: "499.00",
      },
    });

    try {
      const cart = await repository.createCart();
      const item = await repository.createCartItem({
        cartId: cart.id,
        productId: product.id,
        variantId: variant.id,
        quantity: 2,
      });

      assert.equal(item.cartId, cart.id);
      assert.equal(item.productId, product.id);
      assert.equal(item.variantId, variant.id);
      assert.equal(item.quantity, 2);

      const loaded = await repository.findCartById(cart.id);
      assert.equal(loaded?.items.length, 1);
      assert.equal(loaded?.items[0]?.id, item.id);

      await assert.rejects(
        repository.createCartItem({
          cartId: cart.id,
          productId: product.id,
          variantId: variant.id,
          quantity: 1,
        }),
      );

      assert.throws(
        () =>
          repository.createCartItem({
            cartId: cart.id,
            productId: product.id,
            variantId: null,
            quantity: 0,
          }),
        /Cart item quantity must be a positive integer/,
      );

      await repository.clearCartItems(cart.id);
      assert.equal((await repository.findCartById(cart.id))?.items.length, 0);

      await db.cart.delete({ where: { id: cart.id } });
      assert.equal(await db.cartItem.count({ where: { cartId: cart.id } }), 0);
    } finally {
      await db.product.delete({ where: { id: product.id } }).catch(() => undefined);
    }
  },
);

test("Cart migration preserves the required product-only and variant-specific duplicate constraints", async () => {
  const { readFile } = await import("node:fs/promises");
  const migration = await readFile(
    new URL("../prisma/migrations/20260930180000_cart_persistence_foundation/migration.sql", import.meta.url),
    "utf8",
  );

  assert.match(migration, /CartItem_product_only_unique/);
  assert.match(migration, /CartItem_variant_unique/);
  assert.match(migration, /CartItem_quantity_positive_check/);
  assert.match(migration, /ON DELETE CASCADE/);
  assert.match(migration, /ON DELETE RESTRICT/);
});
