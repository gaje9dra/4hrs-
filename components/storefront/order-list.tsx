import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { OrderStatusBadge } from "@/components/storefront/order-status-badge";
import type { PublicOrderListDto } from "@/lib/orders/contracts";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
  }).format(new Date(value));
}

function money(value: string, currency: string) {
  return `${value} ${currency}`;
}

export function OrderList({ data }: { data: PublicOrderListDto }) {
  if (data.orders.length === 0) {
    return (
      <Card>
        <p className="text-xs font-900 uppercase tracking-[0.2em] text-primary-blue">Order history</p>
        <h2 className="mt-3 text-3xl uppercase">No orders yet</h2>
        <p className="mt-3 max-w-xl text-sm leading-6">
          Orders you complete will appear here. Your order history is kept separate from the current storefront catalog.
        </p>
        <div className="mt-6">
          <Button href="/shop" variant="yellow">Continue Shopping</Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="grid gap-4" aria-label="Order history">
      {data.orders.map((order) => (
        <Card key={order.id} className="p-4 sm:p-5 lg:p-6">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="break-all text-xl font-900 uppercase">
                  <Link
                    href={`/account/orders/${encodeURIComponent(order.orderNumber)}`}
                    className="underline decoration-2 underline-offset-4 hover:bg-primary-yellow focus:outline-none focus:ring-2 focus:ring-primary-blue focus:ring-offset-2"
                  >
                    {order.orderNumber}
                  </Link>
                </h2>
                <OrderStatusBadge status={order.status} />
              </div>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-xs font-900 uppercase tracking-[0.12em] text-muted-foreground">Date</dt>
                  <dd className="mt-1 font-700">{formatDate(order.createdAt)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-900 uppercase tracking-[0.12em] text-muted-foreground">Items</dt>
                  <dd className="mt-1 font-700">{order.items.reduce((count, item) => count + item.quantity, 0)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-900 uppercase tracking-[0.12em] text-muted-foreground">Total</dt>
                  <dd className="mt-1 font-900">{money(order.total, order.currency)}</dd>
                </div>
              </dl>
            </div>
            <Button href={`/account/orders/${encodeURIComponent(order.orderNumber)}`} variant="outline" className="w-full lg:w-auto">
              View order
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}
