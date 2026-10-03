"use client";
import { useEffect, type ReactNode } from "react";
import { trackAnalyticsEvent } from "@/lib/analytics/client";

export function EditorialAnalytics({ contentId, contentType, locale, children }: { contentId: string; contentType: string; locale: string; children: ReactNode }) {
  useEffect(() => {
    void trackAnalyticsEvent({ eventName: "CONTENT_VIEWED", eventVersion: 1, properties: { contentId, contentType, locale } });
    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const cta = target.closest<HTMLElement>("[data-content-cta-block]");
      if (!cta) return;
      void trackAnalyticsEvent({ eventName: "CONTENT_CTA_CLICKED", eventVersion: 1, properties: { contentId, contentType, blockType: cta.dataset.contentCtaBlock ?? "unknown" } });
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [contentId, contentType, locale]);
  return <>{children}</>;
}
