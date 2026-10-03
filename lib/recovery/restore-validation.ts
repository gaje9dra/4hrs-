import { Prisma } from "@prisma/client";
import { db } from "@/lib/db/client";

export type RecoveryCheck = Readonly<{ name: string; ok: boolean; detail: string }>;

const REQUIRED_TABLES = [
  "Customer","Order","OrderItem","Payment","PaymentEvent","PaymentIdempotency","PaymentRefund",
  "Fulfillment","FulfillmentItem","FulfillmentOperationIdempotency","Shipment","TrackingEvent",
  "ReturnRequest","ReturnItem","CancellationRequest","Case","AdminUser","AdminAuditLog",
];

const REQUIRED_INDEX_TABLES = ["Order","Payment","Fulfillment","Shipment","TrackingEvent","AdminAuditLog"];

export async function validateRestoredDatabase(): Promise<RecoveryCheck[]> {
  const checks: RecoveryCheck[] = [];
  await db.$queryRaw(Prisma.sql`SELECT 1`);
  checks.push({ name: "database-connectivity", ok: true, detail: "Database connection succeeded." });

  const tables = await db.$queryRaw<Array<{ table_name: string }>>(Prisma.sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  `);
  const tableSet = new Set(tables.map((row) => row.table_name));
  for (const table of REQUIRED_TABLES) checks.push({
    name: `table:${table}`, ok: tableSet.has(table), detail: tableSet.has(table) ? "Present." : "Required table is missing.",
  });

  const migrations = await db.$queryRaw<Array<{ migration_name: string; finished_at: Date | null; rolled_back_at: Date | null }>>(Prisma.sql`
    SELECT migration_name, finished_at, rolled_back_at
    FROM "_prisma_migrations"
    ORDER BY started_at DESC
    LIMIT 100
  `);
  checks.push({
    name: "migration-state",
    ok: migrations.length > 0 && migrations.every((m) => m.finished_at !== null && m.rolled_back_at === null),
    detail: migrations.length > 0 ? `Validated ${migrations.length} migration record(s).` : "No Prisma migration history was found.",
  });

  const indexes = await db.$queryRaw<Array<{ tablename: string; indexname: string }>>(Prisma.sql`
    SELECT tablename, indexname FROM pg_indexes WHERE schemaname = 'public'
  `);
  for (const table of REQUIRED_INDEX_TABLES) checks.push({
    name: `indexes:${table}`, ok: indexes.some((row) => row.tablename === table), detail: indexes.some((row) => row.tablename === table) ? "Indexes present." : "No indexes found for required table.",
  });

  const constraints = await db.$queryRaw<Array<{ constraint_name: string }>>(Prisma.sql`
    SELECT constraint_name FROM information_schema.table_constraints
    WHERE constraint_schema = 'public' AND constraint_type IN ('PRIMARY KEY','UNIQUE','FOREIGN KEY')
  `);
  checks.push({
    name: "critical-constraints",
    ok: constraints.length > 0,
    detail: `${constraints.length} primary/unique/foreign-key constraints discovered.`,
  });

  const invalid = await db.$queryRaw<Array<{ table_name: string; row_count: bigint }>>(Prisma.sql`
    SELECT 'Order' AS table_name, COUNT(*) AS row_count FROM "Order"
    WHERE "subtotal" < 0 OR "total" < 0
    UNION ALL
    SELECT 'OrderItem', COUNT(*) FROM "OrderItem" WHERE "quantity" <= 0 OR "unitPrice" < 0 OR "lineTotal" < 0
    UNION ALL
    SELECT 'Payment', COUNT(*) FROM "Payment" WHERE "amount" < 0
    UNION ALL
    SELECT 'ReturnItem', COUNT(*) FROM "ReturnItem" WHERE "quantity" <= 0
  `);
  for (const row of invalid) checks.push({
    name: `domain-values:${row.table_name}`, ok: Number(row.row_count) === 0, detail: Number(row.row_count) === 0 ? "No invalid values detected." : `${row.row_count.toString()} invalid row(s) detected.`,
  });

  return checks;
}

export function assertRecoveryChecks(checks: readonly RecoveryCheck[]): void {
  const failed = checks.filter((check) => !check.ok);
  if (failed.length > 0) throw new Error(`Recovery validation failed: ${failed.map((check) => check.name).join(", ")}`);
}
