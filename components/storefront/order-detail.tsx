import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { OrderStatusBadge } from "@/components/storefront/order-status-badge";
import type { PublicOrderDto } from "@/lib/orders/contracts";
import type { ExceptionSummary } from "@/lib/returns/contracts";
import { OrderExceptionActions } from "@/components/storefront/order-exception-actions";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "long", timeStyle: "short" }).format(new Date(value));
}

function money(value: string, currency: string) {
  return `${value} ${currency}`;
}

export function OrderDetail({ order, exceptionSummary }: { order: PublicOrderDto; exceptionSummary: ExceptionSummary }) {
  return (
    <div className="grid gap-8">
      <header className="border-b-4 border-border pb-6">
        <p className="text-xs font-900 uppercase tracking-[0.25em] text-primary-blue">Account / Order</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="break-all uppercase">{order.orderNumber}</h1>
          <OrderStatusBadge status={order.status} />
        </div>
        <p className="mt-4 text-sm leading-6">Placed {formatDate(order.createdAt)}</p>
      </header>

      <section aria-labelledby="order-items-heading">
        <h2 id="order-items-heading" className="mb-4 text-2xl uppercase">Items</h2>
        <div className="grid gap-3">
          {order.items.map((item, index) => (
            <Card key={`${item.productId ?? "item"}-${item.variantId ?? "variant"}-${index}`} className="p-4 sm:p-5">
              <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                <div className="min-w-0">
                  <h3 className="break-words text-lg font-900 uppercase">{item.productTitle}</h3>
                  {item.variantTitle ? <p className="mt-1 text-sm font-700">{item.variantTitle}</p> : null}
                  {item.selectedOptions ? (
                    <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs">
                      {Object.entries(item.selectedOptions).map(([key, value]) => (
                        <div key={key}>
                          <dt className="inline font-900 uppercase">{key}: </dt>
                          <dd className="inline">{value}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : null}
                  {item.sku ? <p className="mt-3 text-xs font-700 uppercase tracking-[0.1em]">SKU {item.sku}</p> : null}
                </div>
                <dl className="grid gap-1 text-sm sm:min-w-36 sm:text-right">
                  <div><dt className="inline font-700">Qty </dt><dd className="inline font-900">{item.quantity}</dd></div>
                  <div><dt className="inline font-700">Unit </dt><dd className="inline font-900">{money(item.unitPrice, item.currency)}</dd></div>
                  <div className="border-t-2 border-border pt-1"><dt className="inline font-900 uppercase">Line total </dt><dd className="inline font-900">{money(item.lineTotal, item.currency)}</dd></div>
                </dl>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        {order.address ? (
          <Card>
            <p className="text-xs font-900 uppercase tracking-[0.2em] text-primary-blue">Address at purchase</p>
            <h2 className="mt-2 text-2xl uppercase">{order.address.label || "Delivery address"}</h2>
            <address className="mt-4 whitespace-normal break-words text-sm not-italic leading-7">
              <strong>{order.address.recipientName}</strong><br />
              {order.address.addressLine1}<br />
              {order.address.addressLine2 ? <>{order.address.addressLine2}<br /></> : null}
              {order.address.city}, {order.address.stateOrProvince} {order.address.postalCode}<br />
              {order.address.countryCode}
              {order.address.phone ? <><br />{order.address.phone}</> : null}
            </address>
          </Card>
        ) : null}

        <Card className="border-4 bg-primary-yellow">
          <p className="text-xs font-900 uppercase tracking-[0.2em]">Order total</p>
          <dl className="mt-5 grid gap-3 text-sm">
            <div className="flex justify-between gap-4"><dt className="font-900 uppercase">Subtotal</dt><dd>{money(order.subtotal, order.currency)}</dd></div>
            <div className="flex justify-between gap-4 border-t-4 border-border pt-4 text-xl font-900"><dt className="uppercase">Total</dt><dd>{money(order.total, order.currency)}</dd></div>
          </dl>
          <p className="mt-5 border-t-2 border-border pt-4 text-xs font-700 leading-5">
            This page shows the historical Order record. Shipping, tracking, returns, refunds, and cancellation are shown only when the server-authoritative exception policy permits them.
          </p>
        </Card>
      </div>

      <OrderExceptionActions order={order} summary={exceptionSummary} />\n\n      <div className="flex flex-wrap gap-3">
        <Button href="/account/orders" variant="outline">Back to Orders</Button>
        <Button href="/shop" variant="yellow">Continue Shopping</Button>
      </div>

      <p className="text-xs font-700 uppercase tracking-[0.12em] text-muted-foreground">
        Need another account action? <Link href="/account" className="underline underline-offset-4">Return to Account</Link>.
      </p>
    </div>
  );
}
