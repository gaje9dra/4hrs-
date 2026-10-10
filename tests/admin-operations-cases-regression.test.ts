import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("operations dashboard exposes only permission-gated, reasoned operator actions", () => {
  const page = readFileSync("app/admin/operations/page.tsx", "utf8");
  const actions = readFileSync("components/admin/operations-actions.tsx", "utf8");
  const route = readFileSync("app/api/admin/operations/route.ts", "utf8");
  assert.match(page, /canManage=\{canManage\}/);
  assert.match(page, /context\.permissions\.has\("synthetic\.execute"\)/);
  assert.match(actions, /REFRESH_HEALTH/);
  assert.match(actions, /RUN_RECONCILIATION/);
  assert.match(actions, /TRIGGER_SYNTHETIC/);
  assert.match(actions, /reason\.trim\(\)\.length < 3/);
  assert.match(actions, /window\.confirm/);
  assert.match(route, /requireAdmin\(request,"operations\.manage"\)/);
  assert.match(route, /requireAdmin\(request,"synthetic\.execute"\)/);
});

test("case pages preserve authorization and surface unexpected service errors", () => {
  const list = readFileSync("app/admin/cases/page.tsx", "utf8");
  const detail = readFileSync("app/admin/cases/[caseReference]/page.tsx", "utf8");
  const actions = readFileSync("components/admin/case-detail-actions.tsx", "utf8");
  assert.match(list, /requireAdmin\(undefined, "case\.read"\)/);
  assert.doesNotMatch(list, /catch\s*\{/);
  assert.match(detail, /error instanceof CaseDomainError && error\.code === "CASE_NOT_FOUND"/);
  assert.match(detail, /throw error/);
  assert.doesNotMatch(detail, /catch\(\(\)\s*=>\s*null\)/);
  assert.match(actions, /status === "OPEN" \? "TRIAGED" : "IN_PROGRESS"/);
  assert.match(actions, /canResolveInCurrentState = \["IN_PROGRESS", "WAITING", "RESOLVED"\]/);
});

test("fulfillment pagination retains active filters and date controls retain selected values", () => {
  const page = readFileSync("app/admin/fulfillments/page.tsx", "utf8");
  assert.match(page, /new URLSearchParams\(url\.searchParams\)/);
  assert.match(page, /params\.set\("page", String\(page\)\)/);
  assert.match(page, /name="from" defaultValue=\{query\.from\?\.toISOString\(\)\.slice\(0,10\)\|\|""\}/);
  assert.match(page, /name="to" defaultValue=\{query\.to\?\.toISOString\(\)\.slice\(0,10\)\|\|""\}/);
});

test("orders list and API stay behind the centralized orders permission", () => {
  const page = readFileSync("app/admin/orders/page.tsx", "utf8");
  const route = readFileSync("app/api/admin/orders/route.ts", "utf8");
  assert.match(page, /requireAdmin\(undefined, "orders\.read"\)/);
  assert.match(route, /requireAdmin\(request,"orders\.read"\)/);
  assert.match(page, /data\.pagination\.hasNextPage/);
  assert.match(page, /No orders matched the current filters/);
});
