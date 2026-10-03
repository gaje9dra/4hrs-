import { Prisma } from "@prisma/client";
import { db } from "@/lib/db/client";
import { AdminError } from "@/lib/admin/errors";

export const DEFAULT_ANALYTICS_TIMEZONE = "Asia/Kolkata";
const MAX_RANGE_DAYS = 366;
const MAX_TREND_BUCKETS = 366;

export type AnalyticsGrouping = "day" | "week" | "month";
export type AnalyticsQuery = {
  from: string;
  to: string;
  timezone: string;
  grouping: AnalyticsGrouping;
};

function dateOnly(value: string | null): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(value + "T00:00:00.000Z");
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value) return null;
  return value;
}

function localToday(timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function addDays(value: string, days: number): string {
  const d = new Date(value + "T00:00:00.000Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function dayDistance(from: string, to: string): number {
  return Math.round((Date.parse(to + "T00:00:00Z") - Date.parse(from + "T00:00:00Z")) / 86_400_000) + 1;
}

function validateTimezone(value: string): string {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return value;
  } catch {
    throw new AdminError("INVALID_REQUEST", "Unsupported reporting timezone.");
  }
}

export function parseAnalyticsQuery(url: URL): AnalyticsQuery {
  const timezone = validateTimezone(url.searchParams.get("timezone") ?? DEFAULT_ANALYTICS_TIMEZONE);
  const today = localToday(timezone);
  const from = dateOnly(url.searchParams.get("from")) ?? addDays(today, -29);
  const to = dateOnly(url.searchParams.get("to")) ?? today;
  if (from > to) throw new AdminError("INVALID_REQUEST", "The analytics date range is invalid.");
  if (dayDistance(from, to) > MAX_RANGE_DAYS) throw new AdminError("INVALID_REQUEST", "The analytics date range cannot exceed 366 days.");
  const grouping = url.searchParams.get("grouping") ?? (dayDistance(from, to) <= 62 ? "day" : "week");
  if (grouping !== "day" && grouping !== "week" && grouping !== "month") {
    throw new AdminError("INVALID_REQUEST", "Unsupported analytics grouping.");
  }
  return { from, to, timezone, grouping };
}

type SummaryRow = {
  orderCount: bigint | number;
  paidOrderCount: bigint | number;
  grossSales: Prisma.Decimal | string | number | null;
  refundAmount: Prisma.Decimal | string | number | null;
  netSales: Prisma.Decimal | string | number | null;
};

type PaymentRow = {
  successfulPayments: bigint | number;
  failedPayments: bigint | number;
  pendingPayments: bigint | number;
  successfulAttempts: bigint | number;
  failedAttempts: bigint | number;
};

type FulfillmentRow = {
  attempts: bigint | number;
  success: bigint | number;
  failure: bigint | number;
  pending: bigint | number;
  retries: bigint | number;
  reconciliations: bigint | number;
};

type ShippingRow = {
  shipmentCount: bigint | number;
  deliveryFailures: bigint | number;
  trackingAvailable: bigint | number;
  delivered: bigint | number;
  inTransit: bigint | number;
  pending: bigint | number;
};

type ReturnRow = {
  requests: bigint | number;
  approved: bigint | number;
  rejected: bigint | number;
  resolved: bigint | number;
  receivedItemQuantity: bigint | number;
  cancellations: bigint | number;
  completedCancellations: bigint | number;
};

type CaseRow = {
  openCases: bigint | number;
  newCases: bigint | number;
  resolvedCases: bigint | number;
};

type CustomerRow = {
  newCustomers: bigint | number;
  customersWithPaidOrders: bigint | number;
};

type TrendRow = {
  bucket: string;
  orderCount: bigint | number;
  paidOrderCount: bigint | number;
  grossSales: Prisma.Decimal | string | number | null;
  refundAmount: Prisma.Decimal | string | number | null;
  netSales: Prisma.Decimal | string | number | null;
};

export function calculateRate(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null;
  return Number(((numerator / denominator) * 100).toFixed(2));
}
export function calculateAov(grossSales: Prisma.Decimal | string | number, paidOrders: number): string | null {
  if (paidOrders === 0) return null;
  return new Prisma.Decimal(grossSales).div(paidOrders).toFixed(2);
}
export function calculateNetSales(grossSales: Prisma.Decimal.Value, refundAmount: Prisma.Decimal.Value): string {
  return new Prisma.Decimal(grossSales).minus(refundAmount).toFixed(2);
}

const int = (value: bigint | number): number => Number(value);
const money = (value: Prisma.Decimal | string | number | null): string => value === null ? "0.00" : new Prisma.Decimal(value).toFixed(2);

function rangeSql(query: AnalyticsQuery) {
  const end = addDays(query.to, 1);
  return Prisma.sql`"createdAt" >= (${query.from}::date::timestamp AT TIME ZONE ${query.timezone})
    AND "createdAt" < (${end}::date::timestamp AT TIME ZONE ${query.timezone})`;
}

function bucketSql(query: AnalyticsQuery) {
  const field = query.grouping;
  return Prisma.sql`date_trunc(${field}, "createdAt" AT TIME ZONE ${query.timezone})`;
}

function bucketLabelSql(query: AnalyticsQuery) {
  const format = query.grouping === "day" ? "YYYY-MM-DD" : query.grouping === "week" ? 'IYYY-"W"IW' : "YYYY-MM";
  return Prisma.sql`to_char(${bucketSql(query)}, ${format})`;
}

async function assertSingleCurrency(query: AnalyticsQuery): Promise<"INR"> {
  const range = rangeSql(query);
  const rows = await db.$queryRaw<Array<{ currency: string }>>(Prisma.sql`
    SELECT DISTINCT currency FROM (
      SELECT o.currency AS currency FROM "Order" o WHERE ${range}
      UNION
      SELECT p.currency AS currency FROM "Payment" p WHERE ${range}
      UNION
      SELECT pr.currency AS currency FROM "PaymentRefund" pr WHERE ${range}
    ) currencies
    WHERE currency IS NOT NULL
    LIMIT 3
  `);
  const currencies = rows.map((row) => row.currency);
  if (currencies.some((currency) => currency !== "INR") || currencies.length > 1) {
    throw new AdminError("INVALID_REQUEST", "Analytics currently supports one reporting currency: INR. Multi-currency aggregation is not enabled.");
  }
  return "INR";
}

export async function getAdminAnalytics(query: AnalyticsQuery, options: {
  financial: boolean;
  operations: boolean;
  customer: boolean;
}) {
  const reportingCurrency = await assertSingleCurrency(query);
  const range = rangeSql(query);
  const bucket = bucketSql(query);
  const bucketLabel = bucketLabelSql(query);

  const summaryPromise = db.$queryRaw<SummaryRow[]>(Prisma.sql`
    SELECT
      COUNT(o.id)::bigint AS "orderCount",
      COUNT(o.id) FILTER (WHERE p.status IN ('SUCCEEDED','REFUNDED','PARTIALLY_REFUNDED'))::bigint AS "paidOrderCount",
      COALESCE(SUM(o.total) FILTER (WHERE p.status IN ('SUCCEEDED','REFUNDED','PARTIALLY_REFUNDED')), 0)::numeric AS "grossSales",
      COALESCE(SUM(COALESCE(r.refund_amount, 0)) FILTER (WHERE p.status IN ('SUCCEEDED','REFUNDED','PARTIALLY_REFUNDED')), 0)::numeric AS "refundAmount",
      (COALESCE(SUM(o.total) FILTER (WHERE p.status IN ('SUCCEEDED','REFUNDED','PARTIALLY_REFUNDED')), 0)
       - COALESCE(SUM(COALESCE(r.refund_amount, 0)) FILTER (WHERE p.status IN ('SUCCEEDED','REFUNDED','PARTIALLY_REFUNDED')), 0))::numeric AS "netSales"
    FROM "Order" o
    JOIN "Payment" p ON p.id = o."paymentId"
    LEFT JOIN (
      SELECT "paymentId", SUM("amount") FILTER (WHERE "status" = 'SUCCEEDED') AS refund_amount
      FROM "PaymentRefund"
      GROUP BY "paymentId"
    ) r ON r."paymentId" = p.id
    WHERE ${range}
  `);

  const paymentPromise = db.$queryRaw<PaymentRow[]>(Prisma.sql`
    SELECT
      COUNT(*) FILTER (WHERE "status" IN ('SUCCEEDED','REFUNDED','PARTIALLY_REFUNDED'))::bigint AS "successfulPayments",
      COUNT(*) FILTER (WHERE "status" = 'FAILED')::bigint AS "failedPayments",
      COUNT(*) FILTER (WHERE "status" IN ('CREATED','REQUIRES_ACTION','PROCESSING'))::bigint AS "pendingPayments",
      COUNT(*) FILTER (WHERE "status" IN ('SUCCEEDED','REFUNDED','PARTIALLY_REFUNDED'))::bigint AS "successfulAttempts",
      COUNT(*) FILTER (WHERE "status" = 'FAILED')::bigint AS "failedAttempts"
    FROM "PaymentAttempt"
    WHERE ${range}
  `);

  const fulfillmentPromise = db.$queryRaw<FulfillmentRow[]>(Prisma.sql`
    SELECT
      COUNT(*) FILTER (WHERE "operation" = 'SUBMIT')::bigint AS "attempts",
      COUNT(*) FILTER (WHERE "operation" = 'SUBMIT' AND "status" = 'SUCCEEDED')::bigint AS "success",
      COUNT(*) FILTER (WHERE "operation" = 'SUBMIT' AND "status" = 'FAILED')::bigint AS "failure",
      COUNT(*) FILTER (WHERE "operation" = 'SUBMIT' AND "status" = 'PENDING')::bigint AS "pending",
      COUNT(*) FILTER (WHERE "operation" = 'RETRY')::bigint AS "retries",
      COUNT(*) FILTER (WHERE "operation" = 'RECONCILE')::bigint AS "reconciliations"
    FROM "FulfillmentOperationIdempotency"
    WHERE ${range}
  `);

  const shippingPromise = db.$queryRaw<ShippingRow[]>(Prisma.sql`
    SELECT
      COUNT(*)::bigint AS "shipmentCount",
      COUNT(*) FILTER (WHERE "status" = 'DELIVERY_FAILED')::bigint AS "deliveryFailures",
      COUNT(*) FILTER (WHERE "trackingNumber" IS NOT NULL)::bigint AS "trackingAvailable",
      COUNT(*) FILTER (WHERE "status" = 'DELIVERED')::bigint AS "delivered",
      COUNT(*) FILTER (WHERE "status" IN ('IN_TRANSIT','OUT_FOR_DELIVERY'))::bigint AS "inTransit",
      COUNT(*) FILTER (WHERE "status" = 'CREATED')::bigint AS "pending"
    FROM "Shipment"
    WHERE ${range}
  `);

  const returnsPromise = db.$queryRaw<ReturnRow[]>(Prisma.sql`
    SELECT
      COUNT(*)::bigint AS "requests",
      COUNT(*) FILTER (WHERE "status" = 'APPROVED')::bigint AS "approved",
      COUNT(*) FILTER (WHERE "status" = 'REJECTED')::bigint AS "rejected",
      COUNT(*) FILTER (WHERE "status" = 'RESOLVED')::bigint AS "resolved",
      COALESCE((
        SELECT SUM(ri."quantity") FROM "ReturnItem" ri
        JOIN "ReturnRequest" rr2 ON rr2.id = ri."returnRequestId"
        WHERE rr2."status" IN ('RETURN_RECEIVED','INSPECTION_PENDING','INSPECTED','RESOLUTION_PENDING','RESOLVED')
          AND rr2."createdAt" >= (${query.from}::date::timestamp AT TIME ZONE ${query.timezone})
          AND rr2."createdAt" < (${addDays(query.to, 1)}::date::timestamp AT TIME ZONE ${query.timezone})
      ), 0)::bigint AS "receivedItemQuantity",
      (SELECT COUNT(*) FROM "CancellationRequest" cr WHERE cr."createdAt" >= (${query.from}::date::timestamp AT TIME ZONE ${query.timezone}) AND cr."createdAt" < (${addDays(query.to, 1)}::date::timestamp AT TIME ZONE ${query.timezone}))::bigint AS "cancellations",
      (SELECT COUNT(*) FROM "CancellationRequest" cr WHERE cr."status" = 'COMPLETED' AND cr."createdAt" >= (${query.from}::date::timestamp AT TIME ZONE ${query.timezone}) AND cr."createdAt" < (${addDays(query.to, 1)}::date::timestamp AT TIME ZONE ${query.timezone}))::bigint AS "completedCancellations"
    FROM "ReturnRequest"
    WHERE ${range}
  `);

  const casesPromise = db.$queryRaw<CaseRow[]>(Prisma.sql`
    SELECT
      COUNT(*) FILTER (WHERE "status" IN ('OPEN','IN_PROGRESS','WAITING'))::bigint AS "openCases",
      COUNT(*)::bigint AS "newCases",
      COUNT(*) FILTER (WHERE "status" IN ('RESOLVED','CLOSED'))::bigint AS "resolvedCases"
    FROM "Case"
    WHERE ${range}
  `);

  const customerPromise = options.customer ? db.$queryRaw<CustomerRow[]>(Prisma.sql`
    SELECT
      (SELECT COUNT(*) FROM "Customer" c WHERE ${range})::bigint AS "newCustomers",
      (SELECT COUNT(DISTINCT o."customerId") FROM "Order" o JOIN "Payment" p ON p.id = o."paymentId" WHERE p.status IN ('SUCCEEDED','REFUNDED','PARTIALLY_REFUNDED') AND o."createdAt" >= (${query.from}::date::timestamp AT TIME ZONE ${query.timezone}) AND o."createdAt" < (${addDays(query.to, 1)}::date::timestamp AT TIME ZONE ${query.timezone}))::bigint AS "customersWithPaidOrders"
  `) : Promise.resolve([{newCustomers: 0, customersWithPaidOrders: 0}]);

  const engagementPromise = db.$queryRaw<Array<{ pageViews: bigint; productViews: bigint; searches: bigint; addToCart: bigint; checkoutStarts: bigint }>>(Prisma.sql`
    SELECT
      COUNT(*) FILTER (WHERE "eventName" = 'PAGE_VIEW')::bigint AS "pageViews",
      COUNT(*) FILTER (WHERE "eventName" = 'PRODUCT_VIEWED')::bigint AS "productViews",
      COUNT(*) FILTER (WHERE "eventName" = 'SEARCH_PERFORMED')::bigint AS "searches",
      COUNT(*) FILTER (WHERE "eventName" = 'ADD_TO_CART')::bigint AS "addToCart",
      COUNT(*) FILTER (WHERE "eventName" = 'CHECKOUT_STARTED')::bigint AS "checkoutStarts"
    FROM "AnalyticsEvent"
    WHERE ${range}
  `);

  const trendsPromise = db.$queryRaw<TrendRow[]>(Prisma.sql`
    SELECT
      ${bucketLabel} AS bucket,
      COUNT(o.id)::bigint AS "orderCount",
      COUNT(o.id) FILTER (WHERE p.status IN ('SUCCEEDED','REFUNDED','PARTIALLY_REFUNDED'))::bigint AS "paidOrderCount",
      COALESCE(SUM(o.total) FILTER (WHERE p.status IN ('SUCCEEDED','REFUNDED','PARTIALLY_REFUNDED')), 0)::numeric AS "grossSales",
      COALESCE(SUM(COALESCE(r.refund_amount, 0)) FILTER (WHERE p.status IN ('SUCCEEDED','REFUNDED','PARTIALLY_REFUNDED')), 0)::numeric AS "refundAmount",
      (COALESCE(SUM(o.total) FILTER (WHERE p.status IN ('SUCCEEDED','REFUNDED','PARTIALLY_REFUNDED')), 0)
       - COALESCE(SUM(COALESCE(r.refund_amount, 0)) FILTER (WHERE p.status IN ('SUCCEEDED','REFUNDED','PARTIALLY_REFUNDED')), 0))::numeric AS "netSales"
    FROM "Order" o
    JOIN "Payment" p ON p.id = o."paymentId"
    LEFT JOIN (
      SELECT "paymentId", SUM("amount") FILTER (WHERE "status" = 'SUCCEEDED') AS refund_amount
      FROM "PaymentRefund"
      GROUP BY "paymentId"
    ) r ON r."paymentId" = p.id
    WHERE ${range}
    GROUP BY ${bucket}, ${bucketLabel}
    ORDER BY ${bucket}
    LIMIT ${MAX_TREND_BUCKETS}
  `);

  const [[summary], [payment], [fulfillment], [shipping], [returns], [cases], [customer], [engagement], trends] = await Promise.all([
    summaryPromise, paymentPromise, fulfillmentPromise, shippingPromise, returnsPromise, casesPromise, customerPromise, engagementPromise, trendsPromise,
  ]);

  const paidOrders = int(summary?.paidOrderCount ?? 0);
  const successfulAttempts = int(payment?.successfulAttempts ?? 0);
  const failedAttempts = int(payment?.failedAttempts ?? 0);
  const attemptDenominator = successfulAttempts + failedAttempts;

  return {
    range: { ...query, endExclusive: addDays(query.to, 1) },
    freshness: { generatedAt: new Date().toISOString(), model: "live-canonical-aggregation", cacheTtlSeconds: 0 },
    currency: reportingCurrency,
    sales: options.financial ? {
      orderCount: int(summary?.orderCount ?? 0), paidOrderCount: paidOrders,
      grossSales: money(summary?.grossSales), refundAmount: money(summary?.refundAmount),
      netSales: money(summary?.netSales), averageOrderValue: calculateAov(summary?.grossSales ?? 0, paidOrders),
    } : { orderCount: int(summary?.orderCount ?? 0), paidOrderCount: null, grossSales: null, refundAmount: null, netSales: null, averageOrderValue: null },
    payments: options.financial ? {
      successfulPayments: int(payment?.successfulPayments ?? 0), failedPayments: int(payment?.failedPayments ?? 0), pendingPayments: int(payment?.pendingPayments ?? 0),
      paymentSuccessRate: calculateRate(successfulAttempts, attemptDenominator),
      refundCount: await countSuccessfulRefunds(query), refundAmount: money(summary?.refundAmount),
    } : null,
    fulfillment: options.operations ? {
      attempts: int(fulfillment?.attempts ?? 0),
      success: int(fulfillment?.success ?? 0),
      failure: int(fulfillment?.failure ?? 0),
      pending: int(fulfillment?.pending ?? 0),
      retries: int(fulfillment?.retries ?? 0),
      reconciliations: int(fulfillment?.reconciliations ?? 0),
    } : null,
    shipping: options.operations ? {
      shipmentCount: int(shipping?.shipmentCount ?? 0),
      deliveryFailures: int(shipping?.deliveryFailures ?? 0),
      trackingAvailable: int(shipping?.trackingAvailable ?? 0),
      delivered: int(shipping?.delivered ?? 0),
      inTransit: int(shipping?.inTransit ?? 0),
      pending: int(shipping?.pending ?? 0),
    } : null,
    returns: options.operations ? {
      requests: int(returns?.requests ?? 0),
      approved: int(returns?.approved ?? 0),
      rejected: int(returns?.rejected ?? 0),
      resolved: int(returns?.resolved ?? 0),
      receivedItemQuantity: int(returns?.receivedItemQuantity ?? 0),
      cancellations: int(returns?.cancellations ?? 0),
      completedCancellations: int(returns?.completedCancellations ?? 0),
      cancellationRate: calculateRate(int(returns?.completedCancellations ?? 0), paidOrders),
    } : null,
    cases: options.operations ? {
      openCases: int(cases?.openCases ?? 0),
      newCases: int(cases?.newCases ?? 0),
      resolvedCases: int(cases?.resolvedCases ?? 0),
    } : null,
    customers: options.customer ? {
      newCustomers: int(customer?.newCustomers ?? 0),
      customersWithPaidOrders: int(customer?.customersWithPaidOrders ?? 0),
    } : null,
    engagement: {
      sourceOfTruth: "AnalyticsEvent",
      supportingSignalOnly: true,
      pageViews: int(engagement?.pageViews ?? 0),
      productViews: int(engagement?.productViews ?? 0),
      searches: int(engagement?.searches ?? 0),
      addToCart: int(engagement?.addToCart ?? 0),
      checkoutStarts: int(engagement?.checkoutStarts ?? 0),
    },
    trends: trends.map((row) => ({
      bucket: row.bucket,
      orderCount: int(row.orderCount),
      paidOrderCount: int(row.paidOrderCount),
      grossSales: options.financial ? money(row.grossSales) : null,
      refundAmount: options.financial ? money(row.refundAmount) : null,
      netSales: options.financial ? money(row.netSales) : null,
    })),
  };
}

async function countSuccessfulRefunds(query: AnalyticsQuery): Promise<number> {
  const range = rangeSql(query);
  const rows = await db.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
    SELECT COUNT(*)::bigint AS count
    FROM "PaymentRefund"
    WHERE "status" = 'SUCCEEDED' AND ${range}
  `);
  return int(rows[0]?.count ?? 0);
}
