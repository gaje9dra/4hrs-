import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const databaseConfigured = Boolean(process.env.DATABASE_URL);

test(
  "customer persistence creates normalized identity, isolated credential, session, and Cart ownership",
  { skip: !databaseConfigured },
  async () => {
    const { db } = await import("../lib/db/client.ts");
    const { createCustomerRepository } = await import("../lib/customer/repository.ts");
    const repository = createCustomerRepository(db);
    const suffix = randomUUID();
    const email = `Customer+${suffix}@Example.COM`;

    const customer = await repository.createCustomer({ email: email.trim().toLowerCase() });
    const passwordHash = "$argon2id$v=19$m=65536,t=3,p=4$test$fixture";
    const sessionHash = randomUUID().replaceAll("-", "") + randomUUID().replaceAll("-", "");

    try {
      const credential = await repository.createCredential({
        customerId: customer.id,
        passwordHash,
      });
      const session = await repository.createSession({
        customerId: customer.id,
        sessionTokenHash: sessionHash,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      });
      const cart = await db.cart.create({ data: { customerId: customer.id } });

      assert.equal((await repository.findCustomerByNormalizedEmail(email.trim().toLowerCase()))?.id, customer.id);
      assert.equal((await repository.findCredentialByCustomerId(customer.id))?.passwordHash, passwordHash);
      assert.equal((await repository.findSessionByTokenHash(sessionHash))?.customer.id, customer.id);
      assert.equal((await repository.findCustomerCart(customer.id))?.id, cart.id);

      await repository.revokeSession(session.id);
      assert.ok((await repository.findSessionByTokenHash(sessionHash))?.revokedAt);

      await assert.rejects(
        db.customer.create({ data: { email: email.trim().toLowerCase() } }),
      );

      await db.cart.delete({ where: { id: cart.id } });
      await db.customer.delete({ where: { id: customer.id } });
      assert.equal(await db.customerCredential.findUnique({ where: { id: credential.id } }), null);
      assert.equal(await db.customerSession.findUnique({ where: { id: session.id } }), null);
    } catch (error) {
      await db.cart.deleteMany({ where: { customerId: customer.id } }).catch(() => undefined);
      await db.customer.delete({ where: { id: customer.id } }).catch(() => undefined);
      throw error;
    }
  },
);
