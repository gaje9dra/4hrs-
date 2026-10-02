import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import { clearQikinkAccessTokenCache, getQikinkAccessToken } from "@/lib/fulfillment/providers/qikink-auth";

const original = {
  clientId: process.env.QIKINK_CLIENT_ID,
  clientSecret: process.env.QIKINK_CLIENT_SECRET,
  sandboxSecret: process.env.QIKINK_SANDBOX_SECRET,
  mode: process.env.FULFILLMENT_PROVIDER_MODE,
  baseUrl: process.env.QIKINK_API_BASE_URL,
};

function restoreEnv() {
  for (const [key, value] of Object.entries({
    QIKINK_CLIENT_ID: original.clientId,
    QIKINK_CLIENT_SECRET: original.clientSecret,
    QIKINK_SANDBOX_SECRET: original.sandboxSecret,
    FULFILLMENT_PROVIDER_MODE: original.mode,
    QIKINK_API_BASE_URL: original.baseUrl,
  })) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  clearQikinkAccessTokenCache();
}

afterEach(restoreEnv);

test("Qikink Open API exchanges sandbox Client ID and Client Secret for an access token", async () => {
  process.env.QIKINK_CLIENT_ID = "sandbox-client";
  process.env.QIKINK_SANDBOX_SECRET = "sandbox-secret";
  process.env.QIKINK_CLIENT_SECRET = "";
  process.env.FULFILLMENT_PROVIDER_MODE = "test";

  let captured!: { url: string; init: RequestInit };
  const token = await getQikinkAccessToken({
    fetchImpl: async (url, init) => {
      captured = { url: String(url), init: init ?? {} };
      return new Response(JSON.stringify({ Accesstoken: "sandbox-token", expires_in: 3600 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });

  assert.equal(token, "sandbox-token");
  assert.equal(captured.url, "https://sandbox.qikink.com/api/token");
  assert.equal(captured.init.method, "POST");
  assert.equal(captured.init.headers instanceof Headers
    ? captured.init.headers.get("Content-Type")
    : (captured.init.headers as Record<string, string>)["Content-Type"], "application/x-www-form-urlencoded");

  const body = String(captured.init.body);
  assert.match(body, /ClientId=sandbox-client/);
  assert.match(body, /client_secret=sandbox-secret/);
});

test("Qikink access token is cached until expiry", async () => {
  process.env.QIKINK_CLIENT_ID = "sandbox-client";
  process.env.QIKINK_SANDBOX_SECRET = "sandbox-secret";
  process.env.FULFILLMENT_PROVIDER_MODE = "test";

  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return new Response(JSON.stringify({ Accesstoken: "cached-token", expires_in: 3600 }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  assert.equal(await getQikinkAccessToken({ fetchImpl }), "cached-token");
  assert.equal(await getQikinkAccessToken({ fetchImpl }), "cached-token");
  assert.equal(calls, 1);
});

test("Qikink authentication rejects a response without a token", async () => {
  process.env.QIKINK_CLIENT_ID = "sandbox-client";
  process.env.QIKINK_SANDBOX_SECRET = "sandbox-secret";
  process.env.FULFILLMENT_PROVIDER_MODE = "test";

  await assert.rejects(
    () => getQikinkAccessToken({
      fetchImpl: async () => new Response(JSON.stringify({ status: "ok" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    }),
    /did not contain an access token/,
  );
});
