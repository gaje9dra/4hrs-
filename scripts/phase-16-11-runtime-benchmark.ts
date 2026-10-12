import { randomUUID } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { db } from "@/lib/db/client";
import { createSessionToken, hashSessionToken } from "@/lib/auth/session";

type Sample = { endpoint: string; scenario: string; requests: number; concurrency: number; errors: number; errorRate: number; p50Ms: number | null; p95Ms: number | null; p99Ms: number | null; throughputRps: number; };
type SessionFixture = { customerId: string; cookie: string };

function percentile(values: number[], p: number) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return Number(sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)].toFixed(2));
}

function localBaseUrl(): URL {
  const raw = process.env.PERF_BASE_URL;
  if (!raw) throw new Error("PERF_BASE_URL is required");
  const url = new URL(raw);
  // This benchmark creates a disposable customer/session in the configured DB.
  // Never permit it to run against a deployed or non-local server.
  if (!["localhost", "127.0.0.1", "::1"].includes(url.hostname)) {
    throw new Error("Phase 16.11 authenticated benchmark is restricted to localhost/127.0.0.1; refusing remote fixture creation.");
  }
  return url;
}

async function createSessionFixture(): Promise<SessionFixture> {
  const email = `phase-16-11-perf-${randomUUID()}@example.test`;
  const token = createSessionToken();
  const customer = await db.customer.create({ data: { email, status: "ACTIVE" } });
  try {
    await db.customerSession.create({
      data: {
        customerId: customer.id,
        sessionTokenHash: hashSessionToken(token),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        lastUsedAt: new Date(),
      },
    });
    return { customerId: customer.id, cookie: `customer_session=${token}` };
  } catch (error) {
    await db.customer.delete({ where: { id: customer.id } }).catch(() => undefined);
    throw error;
  }
}

async function cleanupSessionFixture(fixture: SessionFixture) {
  // Cart customer relation is restrictive, so remove its cart before customer.
  await db.cart.deleteMany({ where: { customerId: fixture.customerId } });
  await db.customer.delete({ where: { id: fixture.customerId } });
}

async function run(baseUrl: URL, endpoint: string, requests: number, concurrency: number, cookie?: string): Promise<Omit<Sample, "endpoint" | "scenario">> {
  const durations: number[] = [];
  let errors = 0;
  let cursor = 0;

  async function worker() {
    while (true) {
      const index = cursor++;
      if (index >= requests) return;
      const started = performance.now();
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const controller = new AbortController();
        timer = setTimeout(() => controller.abort(), 5000);
        const response = await fetch(new URL(endpoint, baseUrl), {
          signal: controller.signal,
          cache: "no-store",
          headers: {
            "cache-control": "no-cache",
            ...(cookie ? { Cookie: cookie } : {}),
          },
        });
        if (!response.ok) errors++;
        await response.arrayBuffer();
      } catch {
        errors++;
      } finally {
        if (timer) clearTimeout(timer);
        durations.push(performance.now() - started);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, requests) }, () => worker()));
  const longestMs = Math.max(...durations, 1);
  return {
    requests,
    concurrency,
    errors,
    errorRate: Number((errors / Math.max(1, requests)).toFixed(4)),
    p50Ms: percentile(durations, 50),
    p95Ms: percentile(durations, 95),
    p99Ms: percentile(durations, 99),
    throughputRps: Number((requests / (longestMs / 1000)).toFixed(2)),
  };
}

async function main() {
  const baseUrl = localBaseUrl();
  const fixture = await createSessionFixture();
  const samples: Sample[] = [];
  let soakRequests = 0;
  let serverRssKb: number | null = null;

  try {
    // Warm up auth, cart creation, and checkout reads outside measured samples.
    for (const endpoint of ["/api/cart", "/api/checkout"]) {
      const response = await fetch(new URL(endpoint, baseUrl), {
        cache: "no-store",
        headers: { Cookie: fixture.cookie, "cache-control": "no-cache" },
      });
      await response.arrayBuffer();
      if (!response.ok) throw new Error(`Warm-up for ${endpoint} returned HTTP ${response.status}`);
    }

    const scenarios = [
      { name: "normal", requests: 20, concurrency: 2 },
      { name: "elevated", requests: 60, concurrency: 5 },
      { name: "spike", requests: 40, concurrency: 10 },
    ] as const;
    const endpoints = [
      { path: "/", auth: false },
      { path: "/cart", auth: true },
      { path: "/checkout", auth: true },
      { path: "/api/health", auth: false },
      { path: "/api/cart", auth: true },
      { path: "/api/checkout", auth: true },
    ];

    for (const endpoint of endpoints) {
      for (const scenario of scenarios) {
        const result = await run(baseUrl, endpoint.path, scenario.requests, scenario.concurrency, endpoint.auth ? fixture.cookie : undefined);
        samples.push({ endpoint: endpoint.path, scenario: scenario.name, ...result });
      }
    }

    const soakStarted = Date.now();
    while (Date.now() - soakStarted < 15000) {
      const result = await run(baseUrl, "/api/cart", 5, 1, fixture.cookie);
      soakRequests += result.requests;
      if (result.errors) samples.push({ endpoint: "/api/cart", scenario: "soak", ...result });
    }

    const serverPid = process.env.NEXT_SERVER_PID;
    if (serverPid) {
      try {
        const proc = await readFile("/proc/" + serverPid + "/status", "utf8");
        serverRssKb = Number(/VmRSS:\\s+(\\d+)/.exec(proc)?.[1] ?? "0") || null;
      } catch {}
    }
  } finally {
    await cleanupSessionFixture(fixture);
  }

  const critical = samples.filter((sample) => ["/api/cart", "/api/checkout", "/cart", "/checkout"].includes(sample.endpoint) && sample.scenario !== "soak");
  const failures = samples.filter((sample) => sample.errors > 0 || sample.errorRate > 0);
  const overFourSeconds = critical.filter((sample) => (sample.p95Ms ?? Infinity) > 4000);
  const overThreeSeconds = critical.filter((sample) => (sample.p95Ms ?? Infinity) > 3000);
  const report = {
    generatedAt: new Date().toISOString(),
    environment: "isolated CI PostgreSQL + local Next.js production server",
    productionTraffic: false,
    scenarios: samples,
    criticalPathAcceptance: {
      endpoints: ["/cart", "/checkout", "/api/cart", "/api/checkout"],
      samples: critical.length,
      scenariosOver3sP95: overThreeSeconds.map((x) => ({ endpoint: x.endpoint, scenario: x.scenario, p95Ms: x.p95Ms })),
      scenariosOver4sP95: overFourSeconds.map((x) => ({ endpoint: x.endpoint, scenario: x.scenario, p95Ms: x.p95Ms })),
      failedScenarios: critical.filter((x) => x.errors > 0).map((x) => ({ endpoint: x.endpoint, scenario: x.scenario, errors: x.errors })),
    },
    soak: { durationSeconds: 15, requests: soakRequests, endpoint: "/api/cart", authenticated: true },
    serverRssKb,
  };
  await mkdir("artifacts", { recursive: true });
  await writeFile("artifacts/phase-16-11-runtime-benchmark.json", JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({
    samples: samples.length,
    totalFailedSamples: failures.length,
    criticalPathSamples: critical.length,
    criticalOver3sP95: overThreeSeconds.length,
    criticalOver4sP95: overFourSeconds.length,
    soakRequests,
    serverRssKb,
  }));
  if (failures.length || overFourSeconds.length) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
