import type { Config } from "@netlify/functions";
import { processScheduledContent } from "../../lib/content/service";
import { logger } from "../../lib/observability/logger";

export default async function processContentSchedule(): Promise<Response> {
  const startedAt = Date.now();
  const results = await processScheduledContent(50);
  logger.info("content.scheduler_completed", {
    durationMs: Date.now() - startedAt,
    outcome: "success",
  }, {
    processed: results.length,
    published: results.filter((item) => item.action === "PUBLISHED").length,
    unpublished: results.filter((item) => item.action === "UNPUBLISHED").length,
    skipped: results.filter((item) => item.action === "SKIPPED").length,
  });
  return new Response(null, { status: 204 });
}

export const config: Config = {
  schedule: "*/5 * * * *",
};
