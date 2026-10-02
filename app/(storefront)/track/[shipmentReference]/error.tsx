"use client";

import { useEffect } from "react";
import { Container } from "@/components/layout/container";

export default function ShipmentTrackingError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[customer-tracking] page error", { digest: error.digest });
  }, [error.digest]);

  return (
    <Container width="standard" className="py-10 sm:py-14 lg:py-20">
      <section className="border-4 border-border p-6 shadow-[8px_8px_0_0_var(--color-border)]" role="alert">
        <p className="text-xs font-900 uppercase tracking-[0.25em] text-primary-blue">4HRS / Tracking</p>
        <h1 className="mt-3 uppercase">Tracking temporarily unavailable</h1>
        <p className="mt-4 max-w-2xl text-sm leading-6">
          We could not load the latest saved tracking information. Please try again.
        </p>
        <button
          type="button"
          onClick={() => reset()}
          className="mt-6 border-2 border-border px-4 py-2 font-900 uppercase shadow-[4px_4px_0_0_var(--color-border)]"
        >
          Try again
        </button>
      </section>
    </Container>
  );
}
