import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { Prisma } from "@prisma/client";
import { calculateAov, calculateNetSales, calculateRate, parseAnalyticsQuery } from "@/lib/admin/analytics";
import { ADMIN_PERMISSIONS } from "@/lib/admin/permissions";

test("analytics query validation is timezone-safe, bounded and whitelisted",()=>{
  const q=parseAnalyticsQuery(new URL("https://admin.local/admin/analytics?from=2026-10-01&to=2026-10-31&timezone=Asia/Kolkata&grouping=day"));
  assert.equal(q.from,"2026-10-01");assert.equal(q.to,"2026-10-31");assert.equal(q.timezone,"Asia/Kolkata");assert.equal(q.grouping,"day");
  assert.throws(()=>parseAnalyticsQuery(new URL("https://admin.local/admin/analytics?from=2026-11-01&to=2026-10-31")));
  assert.throws(()=>parseAnalyticsQuery(new URL("https://admin.local/admin/analytics?from=2025-01-01&to=2026-10-01")));
  assert.throws(()=>parseAnalyticsQuery(new URL("https://admin.local/admin/analytics?timezone=Not/A-Timezone")));
  assert.throws(()=>parseAnalyticsQuery(new URL("https://admin.local/admin/analytics?grouping=quarter")));
});

test("financial formulas use decimal arithmetic and define zero denominators",()=>{
  assert.equal(calculateAov(new Prisma.Decimal("100.00"),2),"50.00");
  assert.equal(calculateAov(new Prisma.Decimal("100.00"),0),null);
  assert.equal(calculateNetSales(new Prisma.Decimal("100.00"),new Prisma.Decimal("25.50")),"74.50");
  assert.equal(calculateNetSales(new Prisma.Decimal("10.00"),new Prisma.Decimal("15.00")),"-5.00");
  assert.equal(calculateRate(1,3),33.33);
  assert.equal(calculateRate(0,0),null);
});

test("analytics implementation is read-only",()=>{
  for(const file of ["app/api/admin/analytics/route.ts","lib/admin/analytics.ts"]){
    const source=readFileSync(file,"utf8");
    assert.doesNotMatch(source,/db\.[A-Za-z]+\.(create|createMany|update|updateMany|delete|deleteMany|upsert)\s*\(/);
    assert.doesNotMatch(source,/\$executeRaw/);
  }
});

test("analytics does not call fulfillment or shipping providers",()=>{
  const source=readFileSync("lib/admin/analytics.ts","utf8");
  assert.doesNotMatch(source,/qikink|providerResolver|fetch\(/i);
});

test("analytics uses database-side aggregation rather than loading domain rows",()=>{
  const source=readFileSync("lib/admin/analytics.ts","utf8");
  assert.match(source,/COUNT\(/);assert.match(source,/SUM\(/);assert.match(source,/GROUP BY/);
  assert.doesNotMatch(source,/findMany\(/);
});

test("financial refund aggregation counts only successful PaymentRefund records once",()=>{
  const source=readFileSync("lib/admin/analytics.ts","utf8");
  assert.match(source,/"PaymentRefund"/);
  assert.match(source,/"status" = 'SUCCEEDED'/);
  assert.match(source,/SUM\("amount"\)/);
  assert.match(source,/GROUP BY "paymentId"/);
});

test("analytics RBAC is centralized and granular",()=>{
  for(const permission of ["analytics.read","analytics.financial.read","analytics.operations.read","analytics.customer.read"]){
    assert.ok((ADMIN_PERMISSIONS as readonly string[]).includes(permission),permission);
  }
  const source=readFileSync("app/api/admin/analytics/route.ts","utf8");
  assert.match(source,/requireAdmin\(request, "analytics\.read"\)/);
  assert.match(source,/analytics\.financial\.read/);
  assert.match(source,/analytics\.customer\.read/);
});

test("no unrestricted analytics export endpoint was introduced",()=>{
  const source=readFileSync("app/api/admin/analytics/route.ts","utf8");
  assert.match(source,/Analytics is read-only/);
  assert.doesNotMatch(source,/csv|spreadsheet|export/i);
});

test("customer analytics is aggregated and contains no customer PII",()=>{
  const source=readFileSync("lib/admin/analytics.ts","utf8");
  assert.doesNotMatch(source,/"email"|"phone"|"addressLine1"|"displayName"/);
  assert.match(source,/COUNT\(DISTINCT o\."customerId"\)/);
});
