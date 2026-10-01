import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";

export default function AccountOrderNotFound() {
  return (
    <Container width="standard" className="py-10 sm:py-14 lg:py-20">
      <section aria-labelledby="order-not-found-heading" className="border-4 border-border bg-white p-6 shadow-hard-md">
        <p className="text-xs font-900 uppercase tracking-[0.25em] text-primary-red">Account / Orders</p>
        <h1 id="order-not-found-heading" className="mt-3 uppercase">Order not found</h1>
        <p className="mt-4 max-w-xl text-sm leading-6">That Order is unavailable. It may not belong to this account or the requested identifier may be invalid.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button href="/account/orders" variant="yellow">Back to Orders</Button>
          <Button href="/account" variant="outline">Account</Button>
        </div>
      </section>
    </Container>
  );
}
