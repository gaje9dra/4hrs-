"use client";

import { useReportWebVitals } from "next/web-vitals";

const ALLOWED = new Set(["LCP", "INP", "CLS", "FCP", "TTFB"]);

export function WebVitalsTelemetry() {
  useReportWebVitals((metric) => {
    if (!ALLOWED.has(metric.name) || !Number.isFinite(metric.value)) return;
    const body = JSON.stringify({ name: metric.name, value: metric.value });
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon("/api/telemetry/vitals", new Blob([body], { type: "application/json" }));
      } else {
        void fetch("/api/telemetry/vitals", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body,
          keepalive: true,
        }).catch(() => undefined);
      }
    } catch {}
  });
  return null;
}
