import assert from "node:assert/strict";
import test from "node:test";
import { getFulfillmentOperationalDiagnostics } from "@/lib/fulfillment/diagnostics";

test("operational diagnostics expose fulfillment identifiers and safe state only", async () => {
  const original = process.env.NODE_ENV;
  process.env.NODE_ENV = "test";
  const result = await getFulfillmentOperationalDiagnostics("00000000-0000-0000-0000-000000000000");
  assert.equal(result, null);
  process.env.NODE_ENV = original;
});
