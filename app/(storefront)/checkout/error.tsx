"use client";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Container } from "@/components/layout/container";
export default function CheckoutError({ reset }: { reset: () => void }) {
  useEffect(() => { console.error("[checkout-ui] route rendering failed"); }, []);
  return <Container className="py-10 sm:py-14 lg:py-16"><section className="max-w-3xl" aria-labelledby="checkout-error"><p className="text-xs font-900 uppercase tracking-[.25em] text-primary-red">Checkout</p><h1 id="checkout-error" className="mt-3">Checkout unavailable</h1><Alert variant="error" title="Something went wrong" className="mt-6">Checkout could not be loaded. Your Cart and account are unchanged.</Alert><div className="mt-6 flex flex-wrap gap-3"><Button onClick={reset}>Try again</Button><Button href="/cart" variant="yellow">Return to Cart</Button></div></section></Container>;
}
