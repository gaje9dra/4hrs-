"use client";

const MAX_MESSAGE = 500;

export function sendClientError(kind: "runtime" | "unhandledrejection", message: string): void {
  const body = JSON.stringify({ kind, message: message.slice(0, MAX_MESSAGE) });
  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/telemetry/client", new Blob([body], { type: "application/json" }));
    } else {
      void fetch("/api/telemetry/client", { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true }).catch(() => undefined);
    }
  } catch {}
}
