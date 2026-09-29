import test from "node:test";
import assert from "node:assert/strict";
import {
  changedFields,
  recordCatalogAudit,
  type CatalogAuditClient,
} from "../lib/catalog/audit.ts";

test("audit records are bounded and redact sensitive metadata", async () => {
  let captured: any;
  const client = {
    catalogAuditEvent: {
      create: async ({ data }: any) => {
        captured = data;
        return data;
      },
    },
  } as unknown as CatalogAuditClient;

  await recordCatalogAudit({
    entityType: "PRODUCT",
    entityId: "00000000-0000-0000-0000-000000000001",
    operation: "UPDATE",
    beforeState: { title: "Old", password: "secret" },
    afterState: { title: "New", apiKey: "secret-key" },
    metadata: { requestId: "req-1", authorization: "Bearer secret" },
  }, client);

  assert.deepEqual(captured.changedFields, []);
  assert.equal(captured.beforeState.password, undefined);
  assert.equal(captured.afterState.apiKey, undefined);
  assert.equal(captured.metadata.authorization, undefined);
  assert.equal(captured.metadata.requestId, "req-1");
});

test("changedFields returns deterministic field names", () => {
  assert.deepEqual(
    changedFields(
      { title: "Old", price: "100", seoTitle: "A" },
      { title: "New", price: "100", seoTitle: "B", currency: "INR" },
    ),
    ["currency", "seoTitle", "title"],
  );
});

test("audit source and correlation context are persisted", async () => {
  let captured: any;
  const client = {
    catalogAuditEvent: {
      create: async ({ data }: any) => {
        captured = data;
        return data;
      },
    },
  } as unknown as CatalogAuditClient;

  await recordCatalogAudit({
    entityType: "PRODUCT",
    entityId: "00000000-0000-0000-0000-000000000002",
    operation: "UPDATE",
    source: "IMPORT",
    actorType: "IMPORT",
    correlationId: "import:test",
    metadata: { namespace: "test" },
  }, client);

  assert.equal(captured.source, "IMPORT");
  assert.equal(captured.actorType, "IMPORT");
  assert.equal(captured.correlationId, "import:test");
});
