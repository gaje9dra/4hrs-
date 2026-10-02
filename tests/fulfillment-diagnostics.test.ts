import assert from "node:assert/strict";
import test from "node:test";
import { getFulfillmentOperationalDiagnostics } from "@/lib/fulfillment/diagnostics";

test("operational diagnostics return null for an unknown fulfillment", async () => {
  const result = await getFulfillmentOperationalDiagnostics("00000000-0000-0000-0000-000000000000");
  assert.equal(result, null);
});
