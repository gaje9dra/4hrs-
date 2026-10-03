import { db } from "@/lib/db/client";

const DEFAULT_TIMEOUT_MS = 1500;

export async function checkDatabaseHealth(timeoutMs = DEFAULT_TIMEOUT_MS): Promise<{ ok: boolean; latencyMs: number }> {
  const started = performance.now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      db.$queryRaw`SELECT 1`,
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("DATABASE_TIMEOUT")), timeoutMs); }),
    ]);
    return { ok: true, latencyMs: Math.round(performance.now() - started) };
  } catch {
    return { ok: false, latencyMs: Math.round(performance.now() - started) };
  } finally {
    if (timer) clearTimeout(timer);
  }
}
