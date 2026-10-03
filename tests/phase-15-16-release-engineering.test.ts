import test from "node:test";
import assert from "node:assert/strict";
import { publicReleaseIdentity, readServerEnvironment, validateServerEnvironment } from "@/lib/config/env";

const original = { ...process.env };\n\nfunction setNodeEnv(value: string) {\n  Object.defineProperty(process.env, "NODE_ENV", { value, writable: true, configurable: true, enumerable: true });\n}

function restoreEnvironment() {
  for (const key of Object.keys(process.env)) {
    if (!(key in original)) delete process.env[key];
  }
  for (const [key, value] of Object.entries(original)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

test.afterEach(restoreEnvironment);

test("runtime environment accepts CI-safe PostgreSQL configuration", () => {
  setNodeEnv("test");
  process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/fourhrs_test?schema=public";
  process.env.NEXT_PUBLIC_SITE_URL = "https://example.test";
  process.env.APP_VERSION = "15.16-test";
  process.env.COMMIT_SHA = "abc123";

  const env = validateServerEnvironment();
  assert.equal(env.nodeEnv, "test");
  assert.equal(env.databaseUrl.startsWith("postgresql://"), true);
  assert.deepEqual(publicReleaseIdentity(env), { version: "15.16-test", environment: "test" });
});

test("production requires an HTTPS public site origin", () => {
  setNodeEnv("production");
  process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/fourhrs";
  delete process.env.NEXT_PUBLIC_SITE_URL;
  assert.throws(() => readServerEnvironment(), /NEXT_PUBLIC_SITE_URL is required/);

  process.env.NEXT_PUBLIC_SITE_URL = "http://example.test";
  assert.throws(() => readServerEnvironment(), /must use HTTPS/);
});

test("live fulfillment requires its referenced secret", () => {
  setNodeEnv("test");
  process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/fourhrs";
  process.env.FULFILLMENT_PROVIDER_ENABLED = "true";
  process.env.FULFILLMENT_PROVIDER_MODE = "live";
  process.env.FULFILLMENT_PROVIDER_SECRET_REFERENCE = "QIKINK_CLIENT_SECRET";
  delete process.env.QIKINK_CLIENT_SECRET;
  assert.throws(() => validateServerEnvironment(), /QIKINK_CLIENT_SECRET is required/);
});

test("private release identity does not expose commit or deployment identifiers", () => {
  setNodeEnv("test");
  process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/fourhrs";
  process.env.APP_VERSION = "15.16-test";
  process.env.COMMIT_SHA = "secret-internal-sha";
  process.env.DEPLOY_ID = "secret-deploy-id";

  const release = publicReleaseIdentity(readServerEnvironment());
  assert.deepEqual(release, { version: "15.16-test", environment: "test" });
  assert.equal("commitSha" in release, false);
  assert.equal("deployId" in release, false);
});
