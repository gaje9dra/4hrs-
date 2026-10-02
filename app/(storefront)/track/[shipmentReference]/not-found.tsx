import Link from "next/link";
import { Container } from "@/components/layout/container";

export default function ShipmentTrackingNotFound() {
  return (
    <Container width="standard" className="py-10 sm:py-14 lg:py-20">
      <section className="border-4 border-border p-6 shadow-[8px_8px_0_0_var(--color-border)]">
        <p className="text-xs font-900 uppercase tracking-[0.25em] text-primary-blue">4HRS / Tracking</p>
        <h1 className="mt-3 uppercase">Tracking information not found</h1>
        <p className="mt-4 max-w-2xl text-sm leading-6">
          The shipment could not be found for the signed-in customer. Check the shipment reference and try again.
        </p>
        <Link
          href="/account/orders"
          className="mt-6 inline-block border-2 border-border px-4 py-2 font-900 uppercase shadow-[4px_4px_0_0_var(--color-border)]"
        >
          View orders
        </Link>
      </section>
    </Container>
  );
}
