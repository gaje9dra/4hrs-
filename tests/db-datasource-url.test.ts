import assert from "node:assert/strict";
import test from "node:test";
import { getRuntimeDatasourceUrl } from "../lib/db/datasource-url";

const poolerUrl = "postgresql://app:secret@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?sslmode=require";

test("missing database URL remains unset", () => {
  assert.equal(getRuntimeDatasourceUrl(undefined), undefined);
});

test("direct database URLs are not rewritten", () => {
  const directUrl = "postgresql://app:secret@db.example.com:5432/postgres?sslmode=require";
  assert.equal(getRuntimeDatasourceUrl(directUrl), directUrl);
});

test("Supabase pooler URLs enable pgbouncer and default to one connection", () => {
  const result = getRuntimeDatasourceUrl(poolerUrl);
  assert.ok(result);
  const url = new URL(result);
  assert.equal(url.searchParams.get("pgbouncer"), "true");
  assert.equal(url.searchParams.get("connection_limit"), "1");
  assert.equal(url.searchParams.get("sslmode"), "require");
});

test("an explicit URL connection limit takes precedence over the default", () => {
  const result = getRuntimeDatasourceUrl(poolerUrl + "&connection_limit=4", "2");
  assert.ok(result);
  const url = new URL(result);
  assert.equal(url.searchParams.get("connection_limit"), "4");
  assert.equal(url.searchParams.get("pgbouncer"), "true");
});

test("a valid environment override can tune the pooler connection limit", () => {
  const result = getRuntimeDatasourceUrl(poolerUrl, "3");
  assert.ok(result);
  assert.equal(new URL(result).searchParams.get("connection_limit"), "3");
});

test("invalid pooler connection limit overrides fall back safely to one", () => {
  for (const value of ["0", "-1", "1.5", "not-a-number", "101"]) {
    const result = getRuntimeDatasourceUrl(poolerUrl, value);
    assert.ok(result);
    assert.equal(new URL(result).searchParams.get("connection_limit"), "1");
  }
});

test("malformed database URLs are returned for Prisma to diagnose", () => {
  const malformed = "not a valid URL";
  assert.equal(getRuntimeDatasourceUrl(malformed), malformed);
});
