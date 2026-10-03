const baseUrl = (process.env.RELEASE_BASE_URL ?? "").trim().replace(/\/$/, "");

if (!baseUrl) {
  console.error("RELEASE_BASE_URL is required for deployment verification.");
  process.exit(1);
}

async function check(path: string) {
  const response = await fetch(`${baseUrl}${path}`, { headers: { accept: "application/json" }, cache: "no-store" });
  const body = await response.text();
  let parsed: unknown = null;
  try { parsed = JSON.parse(body); } catch {}
  return { path, status: response.status, ok: response.ok, body: parsed };
}

async function main() {
  const [health, readiness] = await Promise.all([check("/api/health"), check("/api/readiness")]);
  if (!health.ok || !readiness.ok) {
    console.error(JSON.stringify({ status: "failed", health, readiness }));
    process.exit(1);
  }
  if (!health.body || typeof health.body !== "object" || !("status" in health.body) || health.body.status !== "ok") {
    throw new Error("Health endpoint returned an unexpected contract.");
  }
  if (!readiness.body || typeof readiness.body !== "object" || !("status" in readiness.body) || readiness.body.status !== "ready") {
    throw new Error("Readiness endpoint returned an unexpected contract.");
  }
  console.log(JSON.stringify({
    status: "ok",
    release: "verified",
    health: health.status,
    readiness: readiness.status,
  }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Deployment verification failed.");
  process.exit(1);
});
