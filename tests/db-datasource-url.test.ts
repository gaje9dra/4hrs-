import assert from "node:assert/strict";
import test from "node:test";
import { getRuntimeDatasourceUrl } from "../lib/db/datasource-url";

const poolerUrl = "postgresql://app:secret@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?sslmode=require";

test("missing database URL remains unset", () => {
  assert.equal(getRuntimeDatasourceUrl(undefined), undefined);
});

test("direct database URLs are not rewritten", () => {
  const directUrl = "postgresql://app:secret@db.example.com:5432/postgres?sslmode=require&connection_limit=1";
  assert.equal(getRuntimeDatasourceUrl(directUrl), directUrl);
});

test("Supabase pooler URLs enable pgbouncer and default to a small concurrent pool", () => {
  const result = getRuntimeDatasourceUrl(poolerUrl);
  assert.ok(result);
  const url = new URL(result);
  assert.equal(url.searchParams.get("pgbouncer"), "true");
  assert.equal(url.searchParams.get("connection_limit"), "3");
  assert.equal(url.searchParams.get("sslmode"), "require");
});

test("runtime default corrects a stale one-connection URL setting", () => {
  const result = getRuntimeDatasourceUrl(poolerUrl + "&connection_limit=1");
  assert.ok(result);
  const url = new URL(result);
  assert.equal(url.searchParams.get("connection_limit"), "3");
  assert.equal(url.searchParams.get("pgbouncer"), "true");
});

test("a valid environment override takes precedence over the URL and default", () => {
  const result = getRuntimeDatasourceUrl(poolerUrl + "&connection_limit=1", "5");
  assert.ok(result);
  const url = new URL(result);
  assert.equal(url.searchParams.get("connection_limit"), "5");
  assert.equal(url.searchParams.get("pgbouncer"), "true");
});

test("invalid overrides fall back to the conservative default", () => {
  for (const value of ["", "0", "-1", "1.5", "not-a-number", "21"]) {
    const result = getRuntimeDatasourceUrl(poolerUrl, value);
    assert.ok(result);
    assert.equal(new URL(result).searchParams.get("connection_limit"), "3");
  }
});

test("malformed database URLs are returned for Prisma to diagnose", () => {
  const malformed = "not a valid URL";
  assert.equal(getRuntimeDatasourceUrl(malformed), malformed);
});
