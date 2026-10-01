import { Container } from "@/components/layout/container";
export default function CheckoutLoading() {
  return <Container className="py-10 sm:py-14 lg:py-16" aria-busy="true"><div className="border-4 border-border bg-white p-6 shadow-hard-md"><p className="text-xs font-900 uppercase tracking-[.25em] text-primary-blue">Checkout</p><h1 className="mt-3">Loading Checkout</h1><div className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]"><div className="h-64 animate-pulse bg-muted" /><div className="h-64 animate-pulse bg-muted" /></div></div></Container>;
}
