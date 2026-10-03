import type { Config } from "@netlify/functions";
import { processNotificationBatch } from "../../lib/notifications/service";
import { logger } from "../../lib/observability/logger";
import { notificationProcessorScheduleEnabled } from "../../lib/notifications/config";

export default async function processNotifications(): Promise<Response> {
  if (!notificationProcessorScheduleEnabled()) {
    logger.info("notification.worker_skipped", { outcome: "rejected", errorCode: "NOTIFICATION_PROVIDER_NOT_CONFIGURED" });
    return new Response(null, { status: 204 });
  }

  const startedAt = Date.now();
  const results = await processNotificationBatch();
  logger.info("notification.worker_completed", { durationMs: Date.now() - startedAt, outcome: "success" }, {
    processed: results.length,
    statuses: results.reduce<Record<string, number>>((acc, result) => {
      acc[result.status] = (acc[result.status] ?? 0) + 1;
      return acc;
    }, {}),
  });
  return new Response(null, { status: 204 });
}

export const config: Config = {
  schedule: "*/5 * * * *",
};
