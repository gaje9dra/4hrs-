import { Prisma } from "@prisma/client";
import { db } from "@/lib/db/client";

export type IntegritySeverity = "confirmed_violation" | "suspicious_condition" | "expected_historical_condition";
export type IntegrityFinding = Readonly<{ code: string; severity: IntegritySeverity; resourceType: string; resourceId?: string; message: string }>;

function finding(code: string, severity: IntegritySeverity, resourceType: string, message: string, resourceId?: string): IntegrityFinding {
  return { code, severity, resourceType, resourceId, message };
}

export async function runIntegrityAudit(): Promise<IntegrityFinding[]> {
  const findings: IntegrityFinding[] = [];

  const orders = await db.order.findMany({
    select: {
      id: true, customerId: true, paymentId: true, subtotal: true, total: true,
      items: { select: { id: true, quantity: true, unitPrice: true, lineTotal: true } },
      payment: { select: { id: true, amount: true, status: true } },
      fulfillment: { select: { id: true, items: { select: { id: true, orderItemId: true, quantity: true } } } },
      returnRequests: { select: { id: true, items: { select: { id: true, orderItemId: true, quantity: true } } } },
    },
    orderBy: { createdAt: "asc" },
    take: 10000,
  });

  for (const order of orders) {
    if (order.items.length === 0) {
      findings.push(finding("ORDER_WITHOUT_ITEMS", "confirmed_violation", "Order", "Order has no order items.", order.id));
    }

    const itemTotal = order.items.reduce((sum, item) => sum.plus(item.lineTotal), new Prisma.Decimal(0));
    if (!itemTotal.equals(order.subtotal) || !order.total.equals(order.subtotal)) {
      findings.push(finding("ORDER_TOTAL_MISMATCH", "confirmed_violation", "Order", "Order subtotal/total does not equal the persisted order-item total.", order.id));
    }

    for (const item of order.items) {
      if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
        findings.push(finding("INVALID_ORDER_ITEM_QUANTITY", "confirmed_violation", "OrderItem", "Order item quantity must be a positive integer.", item.id));
      }
      const expectedLine = item.unitPrice.mul(item.quantity);
      if (!expectedLine.equals(item.lineTotal)) {
        findings.push(finding("ORDER_ITEM_LINE_TOTAL_MISMATCH", "confirmed_violation", "OrderItem", "Order item line total does not equal unit price multiplied by quantity.", item.id));
      }
    }

    if (order.payment.id !== order.paymentId) {
      findings.push(finding("ORDER_PAYMENT_DISCONNECTED", "confirmed_violation", "Order", "Order payment relation does not match the persisted payment identifier.", order.id));
    }
    if (!order.payment.amount.equals(order.total)) {
      findings.push(finding("PAYMENT_AMOUNT_MISMATCH", "suspicious_condition", "Payment", "Payment amount differs from the order total and requires reconciliation review.", order.payment.id));
    }

    if (order.fulfillment) {
      const quantities = new Map(order.items.map((item) => [item.id, item.quantity]));
      for (const item of order.fulfillment.items) {
        const ordered = quantities.get(item.orderItemId);
        if (ordered === undefined || item.quantity <= 0 || item.quantity > ordered) {
          findings.push(finding("FULFILLMENT_QUANTITY_INVALID", "confirmed_violation", "FulfillmentItem", "Fulfillment quantity is not bounded by its order item.", order.fulfillment.id));
        }
      }
    }

    const orderQuantities = new Map(order.items.map((item) => [item.id, item.quantity]));
    for (const request of order.returnRequests) {
      for (const item of request.items) {
        const ordered = orderQuantities.get(item.orderItemId);
        if (ordered === undefined || item.quantity <= 0 || item.quantity > ordered) {
          findings.push(finding("RETURN_QUANTITY_INVALID", "confirmed_violation", "ReturnItem", "Return quantity is not bounded by its order item.", item.id));
        }
      }
    }
  }

  const refundRows = await db.$queryRaw<Array<{ payment_id: string; refund_total: Prisma.Decimal }>>(Prisma.sql`
    SELECT "paymentId" AS payment_id, COALESCE(SUM("amount"), 0) AS refund_total
    FROM "PaymentRefund"
    WHERE "status" IN ('PENDING','SUCCEEDED','AMBIGUOUS')
    GROUP BY "paymentId"
  `);
  const payments = await db.payment.findMany({ select: { id: true, amount: true }, take: 10000 });
  const paymentMap = new Map(payments.map((payment) => [payment.id, payment.amount]));
  for (const row of refundRows) {
    const amount = paymentMap.get(row.payment_id);
    if (amount && row.refund_total.greaterThan(amount)) {
      findings.push(finding("REFUND_TOTAL_EXCEEDS_PAYMENT", "confirmed_violation", "PaymentRefund", "Refund amounts exceed the payment amount.", row.payment_id));
    }
  }

  const orphanCounts = await db.$queryRaw<Array<{ table_name: string; orphan_count: bigint }>>(Prisma.sql`
    SELECT 'PaymentIdempotency' AS table_name, COUNT(*) FILTER (WHERE c.id IS NULL) AS orphan_count
    FROM "PaymentIdempotency" p LEFT JOIN "Customer" c ON c.id = p."customerId"
    UNION ALL
    SELECT 'PaymentEvent', COUNT(*) FILTER (WHERE p.id IS NULL)
    FROM "PaymentEvent" e LEFT JOIN "Payment" p ON p.id = e."paymentId" WHERE e."paymentId" IS NOT NULL
    UNION ALL
    SELECT 'TrackingEvent', COUNT(*) FILTER (WHERE s.id IS NULL)
    FROM "TrackingEvent" t LEFT JOIN "Shipment" s ON s.id = t."shipmentId"
  `);
  for (const row of orphanCounts) {
    if (Number(row.orphan_count) > 0) findings.push(finding("ORPHAN_RECORDS", "confirmed_violation", row.table_name, `${row.orphan_count.toString()} orphan relationship(s) detected.`));
  }

  const duplicateBusinessKeys = await db.$queryRaw<Array<{ key_name: string; duplicate_count: bigint }>>(Prisma.sql`
    SELECT 'Payment.providerReference' AS key_name, COUNT(*) FROM (
      SELECT "providerReference" FROM "Payment" WHERE "providerReference" IS NOT NULL GROUP BY "providerReference" HAVING COUNT(*) > 1
    ) x
    UNION ALL
    SELECT 'Fulfillment.providerFulfillmentReference', COUNT(*) FROM (
      SELECT "providerFulfillmentReference" FROM "Fulfillment" WHERE "providerFulfillmentReference" IS NOT NULL GROUP BY "providerFulfillmentReference" HAVING COUNT(*) > 1
    ) x
    UNION ALL
    SELECT 'Shipment.providerReference', COUNT(*) FROM (
      SELECT "providerReference" FROM "Shipment" WHERE "providerReference" IS NOT NULL GROUP BY "providerReference" HAVING COUNT(*) > 1
    ) x
  `);
  for (const row of duplicateBusinessKeys) {
    if (Number(row.duplicate_count) > 0) findings.push(finding("DUPLICATE_BUSINESS_IDENTIFIER", "confirmed_violation", "database", `${row.duplicate_count.toString()} duplicate group(s) detected for ${row.key_name}.`));
  }

  return findings;
}
