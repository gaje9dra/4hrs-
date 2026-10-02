import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Container } from "@/components/layout/container";
import { OrderDetail } from "@/components/storefront/order-detail";
import { createOrderApplication } from "@/lib/orders/application";
import { OrderDomainError } from "@/lib/orders/errors";
import { requireCurrentCustomer } from "@/lib/auth/context";
import { createReturnsApplication } from "@/lib/returns/application";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Order | 4HRS",
  description: "View a private 4HRS order.",
  robots: { index: false, follow: false, noarchive: true },
};

type Params = Promise<{ orderNumber: string }>;

export default async function AccountOrderDetailPage({ params }: { params: Params }) {
  try {
    await requireCurrentCustomer();
  } catch {
    redirect("/login?next=%2Faccount%2Forders");
  }

  const { orderNumber } = await params;
  if (!orderNumber || orderNumber.length > 128) notFound();

  let order;
  try {
    order = await createOrderApplication().getCustomerOrder({ identifier: orderNumber });
  } catch (error) {
    if (error instanceof OrderDomainError && (
      error.code === "ORDER_NOT_FOUND" ||
      error.code === "ORDER_INVALID_REQUEST"
    )) {
      notFound();
    }
    throw error;
  }

  return (
    <Container width="standard" className="py-10 sm:py-14 lg:py-20">
      <OrderDetail order={order} exceptionSummary={await createReturnsApplication().getCustomerExceptionSummary({ orderNumber })} />
    </Container>
  );
}
