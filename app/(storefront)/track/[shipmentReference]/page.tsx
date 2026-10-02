import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Container } from "@/components/layout/container";
import { requireCurrentCustomer } from "@/lib/auth/context";
import { createShippingApplication } from "@/lib/shipping/application";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Track Shipment | 4HRS",
  description: "View the current shipment status and tracking timeline for your 4HRS order.",
  robots: { index: false, follow: false, noarchive: true },
};

export default async function ShipmentTrackingPage({
  params,
}: {
  params: Promise<{ shipmentReference: string }>;
}) {
  let customer;
  try {
    customer = await requireCurrentCustomer();
  } catch {
    const { shipmentReference } = await params;
    redirect(`/login?next=${encodeURIComponent(`/track/${shipmentReference}`)}`);
  }

  const { shipmentReference } = await params;
  const shipment = await createShippingApplication().getCustomerShipmentByReference({
    shipmentReference,
    customerId: customer.customer.id,
  });

  if (!shipment) notFound();

  return (
    <Container width="standard" className="py-10 sm:py-14 lg:py-20">
      <header className="mb-8 border-b-4 border-border pb-6">
        <p className="text-xs font-900 uppercase tracking-[0.25em] text-primary-blue">4HRS / Shipment</p>
        <h1 className="mt-3 uppercase">Track your shipment</h1>
        <p className="mt-4 max-w-2xl text-sm leading-6">
          Canonical shipment updates recorded by 4HRS. Tracking information refreshes when new server-side shipping data is available.
        </p>
      </header>

      <section aria-labelledby="shipment-summary" className="grid gap-5 lg:grid-cols-[1fr_2fr]">
        <div className="border-4 border-border bg-background p-5 shadow-[8px_8px_0_0_var(--color-border)]">
          <h2 id="shipment-summary" className="text-sm font-900 uppercase tracking-[0.18em]">Shipment</h2>
          <dl className="mt-5 space-y-4 text-sm">
            <div>
              <dt className="font-800 uppercase tracking-wider">Shipment reference</dt>
              <dd className="mt-1 break-all">{shipment.shipmentReference}</dd>
            </div>
            <div>
              <dt className="font-800 uppercase tracking-wider">Order</dt>
              <dd className="mt-1">{shipment.orderReference}</dd>
            </div>
            <div>
              <dt className="font-800 uppercase tracking-wider">Status</dt>
              <dd className="mt-1 text-lg font-900 uppercase">{shipment.statusLabel}</dd>
            </div>
            {shipment.carrier ? (
              <div>
                <dt className="font-800 uppercase tracking-wider">Carrier</dt>
                <dd className="mt-1">{shipment.carrier}</dd>
              </div>
            ) : null}
            {shipment.trackingNumber ? (
              <div>
                <dt className="font-800 uppercase tracking-wider">Tracking number</dt>
                <dd className="mt-1 break-all">{shipment.trackingNumber}</dd>
              </div>
            ) : null}
            {shipment.trackingUrl ? (
              <div>
                <a
                  href={shipment.trackingUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-block border-2 border-border px-4 py-2 font-900 uppercase shadow-[4px_4px_0_0_var(--color-border)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_var(--color-border)] focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  Open tracking link
                </a>
              </div>
            ) : null}
          </dl>
        </div>

        <div className="border-4 border-border bg-background p-5 shadow-[8px_8px_0_0_var(--color-border)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-900 uppercase tracking-[0.18em]">Tracking timeline</h2>
              <p className="mt-2 text-sm leading-6">Events are shown in canonical chronological order.</p>
            </div>
            <span aria-label={`Current status: ${shipment.statusLabel}`} className="border-2 border-border px-3 py-1 text-xs font-900 uppercase">
              {shipment.statusLabel}
            </span>
          </div>

          {shipment.events.length === 0 ? (
            <div className="mt-6 border-2 border-border p-5" role="status">
              <h3 className="font-900 uppercase">Tracking not available yet</h3>
              <p className="mt-2 text-sm leading-6">
                Your shipment exists, but no customer-visible tracking events have been recorded yet.
              </p>
            </div>
          ) : (
            <ol className="mt-8 space-y-0" aria-label="Shipment tracking events">
              {shipment.events.map((event, index) => (
                <li key={`${event.occurredAt}-${event.status}-${index}`} className="relative border-l-4 border-border pb-7 pl-6 last:pb-0">
                  <span aria-hidden="true" className="absolute -left-[9px] top-0 h-3 w-3 border-2 border-border bg-background" />
                  <p className="text-xs font-900 uppercase tracking-[0.14em]">{event.statusLabel}</p>
                  <time dateTime={event.occurredAt} className="mt-1 block text-xs">
                    {new Date(event.occurredAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                  </time>
                  {event.location ? <p className="mt-2 text-sm font-800">{event.location}</p> : null}
                  <p className="mt-1 text-sm leading-6">{event.description}</p>
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>
    </Container>
  );
}
