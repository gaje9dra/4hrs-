import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const databaseConfigured = Boolean(process.env.DATABASE_URL);

test(
  "Payment persistence enforces ownership, Checkout association, precise money, attempts, events, and durable idempotency",
  { skip: !databaseConfigured },
  async () => {
    const { db } = await import("../lib/db/client.ts");
    const { createPaymentRepository } = await import("../lib/payments/repository.ts");
    const { Prisma } = await import("@prisma/client");

    const repository = createPaymentRepository(db);
    const suffix = randomUUID();
    const customer = await db.customer.create({
      data: { email: `payment-${suffix}@example.com` },
    });
    const otherCustomer = await db.customer.create({
      data: { email: `payment-other-${suffix}@example.com` },
    });
    const checkoutReference = `checkout-${suffix}`;
    const internalReference = `pay-${suffix}`;

    try {
      const payment = await repository.createPayment({
        customerId: customer.id,
        checkoutReference,
        internalReference,
        amount: "1499.50",
        currency: "INR",
      });

      assert.equal(payment.customerId, customer.id);
      assert.equal(payment.checkoutReference, checkoutReference);
      assert.equal(payment.amount.toFixed(2), "1499.50");
      assert.equal(payment.currency, "INR");
      assert.equal(payment.status, "CREATED");

      assert.equal((await repository.getPaymentById(payment.id, customer.id))?.id, payment.id);
      assert.equal(await repository.getPaymentById(payment.id, otherCustomer.id), null);
      assert.equal((await repository.getPaymentByCheckout(customer.id, checkoutReference))?.id, payment.id);
      assert.equal(await repository.getPaymentByCheckout(otherCustomer.id, checkoutReference), null);

      const attempt1 = await repository.createPaymentAttempt({
        paymentId: payment.id,
        attemptNumber: 1,
        amount: "1499.50",
        currency: "INR",
      });
      const attempt2 = await repository.createPaymentAttempt({
        paymentId: payment.id,
        attemptNumber: 2,
        amount: "1499.50",
        currency: "INR",
        failureCategory: "PROVIDER_UNAVAILABLE",
      });

      assert.equal((await repository.getPaymentAttempts(payment.id)).length, 2);
      assert.equal(attempt1.attemptNumber, 1);
      assert.equal(attempt2.attemptNumber, 2);
      await assert.rejects(
        repository.createPaymentAttempt({
          paymentId: payment.id,
          attemptNumber: 2,
          amount: "1499.50",
          currency: "INR",
        }),
      );

      const event = await repository.recordPaymentEvent({
        providerId: "future-provider",
        providerEventId: `event-${suffix}`,
        eventType: "payment.updated",
        normalizedEventType: "PROCESSING",
        paymentId: payment.id,
      });
      const duplicateEvent = await repository.recordPaymentEvent({
        providerId: "future-provider",
        providerEventId: `event-${suffix}`,
        eventType: "payment.updated",
        normalizedEventType: "PROCESSING",
        paymentId: payment.id,
      });
      assert.equal(event.created, true);
      assert.equal(duplicateEvent.created, false);
      assert.equal(duplicateEvent.record.id, event.record.id);

      await repository.markPaymentEventProcessed(event.record.id);
      assert.equal(
        (await repository.findPaymentEventByProviderEventId("future-provider", `event-${suffix}`))?.processingStatus,
        "PROCESSED",
      );

      const idempotency = await repository.createPaymentIdempotency({
        customerId: customer.id,
        checkoutReference,
        operation: "create-intent",
        key: `idem-${suffix}`,
        requestFingerprint: "fingerprint-a",
        paymentId: payment.id,
        response: { status: "CREATED" },
      });
      assert.equal(
        (await repository.lookupByIdempotencyKey(customer.id, "create-intent", `idem-${suffix}`))?.id,
        idempotency.id,
      );
      await assert.rejects(
        repository.createPaymentIdempotency({
          customerId: customer.id,
          checkoutReference,
          operation: "create-intent",
          key: `idem-${suffix}`,
          requestFingerprint: "fingerprint-b",
          paymentId: payment.id,
        }),
      );

      const updated = await repository.updatePaymentStatus(
        payment.id,
        "CREATED",
        "PROCESSING",
      );
      assert.equal(updated.status, "PROCESSING");
      await assert.rejects(
        repository.updatePaymentStatus(payment.id, "CREATED", "SUCCEEDED"),
      );

      await assert.rejects(
        db.payment.create({
          data: {
            customerId: randomUUID(),
            checkoutReference: `invalid-${suffix}`,
            internalReference: `invalid-${suffix}`,
            amount: new Prisma.Decimal("1.00"),
            currency: "INR",
          },
        }),
      );

      await assert.rejects(
        db.payment.create({
          data: {
            customerId: customer.id,
            checkoutReference: `checkout-duplicate-${suffix}`,
            internalReference,
            amount: new Prisma.Decimal("1.00"),
            currency: "INR",
          },
        }),
      );
    } finally {
      await db.paymentIdempotency.deleteMany({ where: { customerId: customer.id } });
      await db.paymentEvent.deleteMany({ where: { paymentId: { in: await db.payment.findMany({ where: { customerId: customer.id }, select: { id: true } }).then((rows) => rows.map((row) => row.id)) } } });
      await db.paymentAttempt.deleteMany({ where: { payment: { customerId: customer.id } } });
      await db.payment.deleteMany({ where: { customerId: customer.id } });
      await db.customer.delete({ where: { id: otherCustomer.id } });
      await db.customer.delete({ where: { id: customer.id } });
    }
  },
);

test("Payment migration is provider-neutral and protects financial history", async () => {
  const { readFile } = await import("node:fs/promises");
  const migration = await readFile(
    new URL("../prisma/migrations/20261001040000_payment_persistence_foundation/migration.sql", import.meta.url),
    "utf8",
  );

  assert.match(migration, /CREATE TYPE "PaymentStatus"/);
  assert.match(migration, /CREATE TABLE "Payment"/);
  assert.match(migration, /CREATE TABLE "PaymentAttempt"/);
  assert.match(migration, /CREATE TABLE "PaymentEvent"/);
  assert.match(migration, /CREATE TABLE "PaymentIdempotency"/);
  assert.match(migration, /"amount" DECIMAL\(12,2\) NOT NULL/);
  assert.match(migration, /"currency" VARCHAR\(3\) NOT NULL/);
  assert.match(migration, /Payment_customerId_checkoutReference_key/);
  assert.match(migration, /PaymentEvent_providerId_providerEventId_key/);
  assert.match(migration, /PaymentIdempotency_customerId_operation_key_key/);
  assert.match(migration, /ON DELETE RESTRICT/);
  assert.doesNotMatch(migration, /razorpay|payu|stripe/i);
});

test("Payment core model remains provider-neutral and contains no credential fields", async () => {
  const { readFile } = await import("node:fs/promises");
  const schema = await readFile(new URL("../prisma/schema.prisma", import.meta.url), "utf8");
  const paymentBlock = schema.match(/model Payment \{[\s\S]*?\n\}/)?.[0] ?? "";
  assert.match(paymentBlock, /providerId/);
  assert.match(paymentBlock, /providerReference/);
  assert.match(paymentBlock, /checkoutReference/);
  assert.doesNotMatch(paymentBlock, /razorpay|payu|stripe/i);
  assert.doesNotMatch(paymentBlock, /cardNumber|cvv|cvc|pin|bankPassword|upi/i);
});
