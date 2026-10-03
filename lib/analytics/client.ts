"use client";

import type { AnalyticsEventName } from "./events";

type AnalyticsEventInput = {
  eventName: AnalyticsEventName;
  eventVersion: number;
  properties?: Record<string, unknown>;
};

let consentCache: "OPTED_IN" | "OPTED_OUT" | null = null;
let anonymousId: string | null = null;
let sessionId: string | null = null;

function browserIdentifier(storage: Storage, key: string): string {
  const existing = storage.getItem(key);
  if (existing && /^[A-Za-z0-9_-]{1,64}$/.test(existing)) return existing;
  const generated = globalThis.crypto?.randomUUID?.().replace(/-/g, "") ?? Math.random().toString(36).slice(2) + Date.now().toString(36);
  const bounded = generated.slice(0, 64);
  storage.setItem(key, bounded);
  return bounded;
}

async function getConsent(): Promise<"OPTED_IN" | "OPTED_OUT"> {
  if (consentCache) return consentCache;
  try {
    const response = await fetch("/api/analytics/events", { method: "GET", credentials: "same-origin", cache: "no-store" });
    const body = (await response.json()) as { state?: "OPTED_IN" | "OPTED_OUT" };
    consentCache = body.state === "OPTED_IN" ? "OPTED_IN" : "OPTED_OUT";
  } catch {
    consentCache = "OPTED_OUT";
  }
  return consentCache;
}

export async function setAnalyticsConsentClient(state: "OPTED_IN" | "OPTED_OUT"): Promise<void> {
  try {
    const response = await fetch("/api/analytics/events", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ state }),
    });
    if (!response.ok) return;
    consentCache = state;
  } catch {
    // Analytics preference changes must never break the storefront.
  }
}

export async function trackAnalyticsEvent(input: AnalyticsEventInput): Promise<void> {
  if (typeof window === "undefined") return;
  if (await getConsent() !== "OPTED_IN") return;
  try {
    anonymousId ??= browserIdentifier(sessionStorage, "4hrs_analytics_session");
    sessionId ??= browserIdentifier(sessionStorage, "4hrs_analytics_id");
    await fetch("/api/analytics/events", {
      method: "PUT",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        eventId: globalThis.crypto?.randomUUID?.().replace(/-/g, ""),
        eventName: input.eventName,
        eventVersion: input.eventVersion,
        occurredAt: new Date().toISOString(),
        properties: input.properties ?? {},
        anonymousId,
        sessionId,
        locale: document.documentElement.lang || undefined,
      }),
    });
  } catch {
    // Analytics is best-effort and must never affect navigation or commerce.
  }
}
