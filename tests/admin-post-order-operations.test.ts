import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import {parsePostOrderQuery} from "@/lib/admin/post-order";

test("post-order admin queries are bounded, deterministic and validate date/sort input",()=>{
 const q=parsePostOrderQuery(new URL("https://admin.local/admin/returns?page=2&pageSize=50&sort=updatedAt_desc&from=2026-10-01&to=2026-10-02"));
 assert.equal(q.page,2);assert.equal(q.pageSize,50);assert.equal(q.sort,"updatedAt_desc");assert.ok(q.from);assert.ok(q.to);
 assert.throws(()=>parsePostOrderQuery(new URL("https://admin.local/admin/returns?pageSize=51")));
 assert.throws(()=>parsePostOrderQuery(new URL("https://admin.local/admin/returns?sort=customer")));
 assert.throws(()=>parsePostOrderQuery(new URL("https://admin.local/admin/returns?from=2026-10-03&to=2026-10-02")));
});

test("admin post-order APIs never directly mutate canonical rows",()=>{
 for(const file of ["app/api/admin/cancellations/[reference]/route.ts","app/api/admin/returns/[reference]/route.ts","lib/admin/post-order.ts"]){
  const source=readFileSync(file,"utf8");
  assert.doesNotMatch(source,/db\.(cancellationRequest|returnRequest|returnItem|returnShipment|returnInspection|returnResolution)\.(create|update|updateMany|delete|deleteMany)/);
 }
});

test("post-order mutations invoke canonical Returns application services",()=>{
 const source=readFileSync("lib/admin/post-order.ts","utf8");
 assert.match(source,/createReturnsApplication/);
 assert.match(source,/reviewCancellation/);
 assert.match(source,/reviewReturn/);
 assert.match(source,/inspectReturn/);
 assert.match(source,/resolveReturn/);
 assert.match(source,/idempotencyKey/);
});

test("granular post-order permissions are defined",()=>{
 const source=readFileSync("lib/admin/permissions.ts","utf8");
 for(const permission of ["cancellation.read","cancellation.approve","return.read","return.approve","return.reject","return.inspect","return.resolve","case.read","case.create","case.update","case.assign","case.resolve","case.audit.read"]){
  assert.match(source,new RegExp(permission.replace(".","\\.")));
 }
});

test("refund and unsupported return resolution remain behind explicit canonical boundaries",()=>{
 const source=readFileSync("lib/admin/post-order.ts","utf8");
 assert.match(source,/return\.resolve/);
 assert.match(source,/not supported by the current Payment\/Return architecture/);
 assert.doesNotMatch(source,/createPaymentRefund/);
});

test("internal case notes are not part of customer DTOs",()=>{
 const source=readFileSync("lib/cases/application.ts","utf8");
 assert.match(source,/function customerDto/);
 const customerDto=source.slice(source.indexOf("function customerDto"),source.indexOf("function internalDto"));
 assert.doesNotMatch(customerDto,/notes/);
});

test("case admin mutations carry replay keys and use canonical case application",()=>{
 const source=readFileSync("components/admin/case-detail-actions.tsx","utf8");
 assert.match(source,/Idempotency-Key/);
 for(const file of ["app/api/admin/cases/[caseReference]/assign/route.ts","app/api/admin/cases/[caseReference]/notes/route.ts","app/api/admin/cases/[caseReference]/resolve/route.ts"]){
  assert.match(readFileSync(file,"utf8"),/createCaseApplication/);
  assert.match(readFileSync(file,"utf8"),/idempotencyKey/);
 }
});
