import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import { parseAdminCustomerQuery } from "@/lib/admin/customer-query";
import { assertCustomerStatusTransition, normalizeCustomerDisplayName } from "@/lib/customer/domain";

test("customer query defaults and bounds are deterministic",()=>{
 const q=parseAdminCustomerQuery(new URL("https://admin.local/admin/customers"));
 assert.equal(q.page,1);assert.equal(q.pageSize,25);assert.equal(q.sort,"createdAt");assert.equal(q.direction,"desc");
 assert.throws(()=>parseAdminCustomerQuery(new URL("https://admin.local/admin/customers?pageSize=51")),/pagination/);
 assert.throws(()=>parseAdminCustomerQuery(new URL("https://admin.local/admin/customers?sort=credentials")),/sort/);
 assert.throws(()=>parseAdminCustomerQuery(new URL("https://admin.local/admin/customers?verified=yes")),/Verification/);
});

test("financial customer query requires financial permission",()=>{
 assert.throws(()=>parseAdminCustomerQuery(new URL("https://admin.local/admin/customers?sort=grossPurchaseValue"),new Set(["customers.read"])),/financial/);
 const q=parseAdminCustomerQuery(new URL("https://admin.local/admin/customers?sort=grossPurchaseValue&valueMin=10.50"),new Set(["customers.read","customers.financial.read"]));
 assert.equal(q.valueMin,"10.50");
});

test("customer status transitions only use supported lifecycle states",()=>{
 assert.doesNotThrow(()=>assertCustomerStatusTransition("ACTIVE","SUSPENDED"));
 assert.doesNotThrow(()=>assertCustomerStatusTransition("SUSPENDED","ACTIVE"));
 assert.throws(()=>assertCustomerStatusTransition("PENDING_VERIFICATION","ACTIVE"),/verification/);
 assert.throws(()=>assertCustomerStatusTransition("ACTIVE","PENDING_VERIFICATION"),/verification/);
});

test("display names are bounded and normalized",()=>{
 assert.equal(normalizeCustomerDisplayName("  Ada  "),"Ada");
 assert.equal(normalizeCustomerDisplayName(""),null);
 assert.throws(()=>normalizeCustomerDisplayName("x".repeat(121)),/too long/);
});

test("customer admin response code does not select credentials or sessions",()=>{

 const source=fs.readFileSync("lib/admin/customer-detail.ts","utf8");
 assert.doesNotMatch(source,/passwordHash|sessionTokenHash|resetToken|oauth/i);
});
