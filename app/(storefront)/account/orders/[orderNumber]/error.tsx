"use client";

import { useEffect } from "react";
import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";

export default function AccountOrderError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("Account Order detail failed", error); }, [error]);

  return (
    <Container width="standard" className="py-10 sm:py-14 lg:py-20">
      <section aria-labelledby="order-error-heading" className="border-4 border-border bg-white p-6 shadow-hard-md">
        <p className="text-xs font-900 uppercase tracking-[0.25em] text-primary-red">Account / Order</p>
        <h1 id="order-error-heading" className="mt-3 uppercase">Order unavailable</h1>
        <p className="mt-4 max-w-xl text-sm leading-6">This Order could not be loaded right now. No internal application details are shown here.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button onClick={reset}>Try again</Button>
          <Button href="/account/orders" variant="outline">Back to Orders</Button>
        </div>
      </section>
    </Container>
  );
}
