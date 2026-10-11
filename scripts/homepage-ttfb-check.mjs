import { performance } from "node:perf_hooks";

const input = process.env.SITE_URL ?? process.argv[2];
if (!input) {
  console.error("Usage: SITE_URL=https://your-production-host node scripts/homepage-ttfb-check.mjs");
  process.exit(2);
}

let url;
try {
  url = new URL(input);
} catch {
  console.error("SITE_URL must be an absolute HTTP(S) URL.");
  process.exit(2);
}
if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
  console.error("SITE_URL must be an HTTP(S) URL without embedded credentials.");
  process.exit(2);
}

const requestedSamples = Number(process.env.HOMEPAGE_TTFB_SAMPLES ?? 8);
if (!Number.isInteger(requestedSamples) || requestedSamples < 1 || requestedSamples > 20) {
  console.error("HOMEPAGE_TTFB_SAMPLES must be an integer from 1 to 20.");
  process.exit(2);
}

const samples = [];
const round = (value) => Math.round(value * 10) / 10;
const percentile = (values, fraction) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)];
};

for (let index = 0; index < requestedSamples; index += 1) {
  const startedAt = performance.now();
  let response;
  try {
    response = await fetch(url, {
      redirect: "manual",
      headers: { "user-agent": "4hrs-homepage-ttfb-check/1.0" },
    });
    const headersAt = performance.now();
    await response.arrayBuffer();
    const completedAt = performance.now();
    const sample = {
      sample: index + 1,
      status: response.status,
      ttfbMs: round(headersAt - startedAt),
      totalMs: round(completedAt - startedAt),
      cacheHeader: response.headers.get("x-nf-cache")
        ?? response.headers.get("x-vercel-cache")
        ?? response.headers.get("x-cache")
        ?? "not-exposed",
    };
    samples.push(sample);
    console.log(JSON.stringify(sample));
  } catch (error) {
    console.error(JSON.stringify({
      sample: index + 1,
      error: error instanceof Error ? error.name : "FetchError",
    }));
    process.exitCode = 1;
  }

  if (index + 1 < requestedSamples) {
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

if (samples.length > 0) {
  const ttfb = samples.map((sample) => sample.ttfbMs);
  const total = samples.map((sample) => sample.totalMs);
  console.log(JSON.stringify({
    summary: {
      successfulSamples: samples.length,
      requestedSamples,
      ttfbP50Ms: percentile(ttfb, 0.5),
      ttfbP95Ms: percentile(ttfb, 0.95),
      totalP50Ms: percentile(total, 0.5),
      totalP95Ms: percentile(total, 0.95),
      non2xxResponses: samples.filter((sample) => sample.status < 200 || sample.status >= 300).length,
    },
  }, null, 2));
}
