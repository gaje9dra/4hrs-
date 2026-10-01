import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { Container } from "@/components/layout/container";
import { OrderList } from "@/components/storefront/order-list";
import { OrderPagination } from "@/components/storefront/order-pagination";
import { createOrderApplication } from "@/lib/orders/application";
import { OrderDomainError } from "@/lib/orders/errors";
import { requireCurrentCustomer } from "@/lib/auth/context";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Orders | 4HRS",
  description: "View your 4HRS order history.",
  robots: { index: false, follow: false, noarchive: true },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function positiveInteger(value: string | string[] | undefined, fallback: number) {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === undefined) return fallback;
  if (!/^\d+$/.test(raw)) return null;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed >= 1 ? parsed : null;
}

export default async function AccountOrdersPage({ searchParams }: { searchParams: SearchParams }) {
  try {
    await requireCurrentCustomer();
  } catch {
    redirect("/login?next=%2Faccount%2Forders");
  }

  const params = await searchParams;
  const page = positiveInteger(params.page, 1);
  const pageSize = positiveInteger(params.pageSize, 20);
  if (page === null || pageSize === null || pageSize > 50) notFound();

  const data = await createOrderApplication().listCustomerOrders({ page, pageSize });

  return (
    <Container width="standard" className="py-10 sm:py-14 lg:py-20">
      <header className="mb-8 border-b-4 border-border pb-6">
        <p className="text-xs font-900 uppercase tracking-[0.25em] text-primary-blue">Customer / Account</p>
        <h1 className="mt-3 uppercase">Orders</h1>
        <p className="mt-4 max-w-2xl text-sm leading-6">
          Your completed Order history, using the historical commercial information recorded at purchase time.
        </p>
      </header>
      <OrderList data={data} />
      <div className="mt-6">
        <OrderPagination
          page={data.pagination.page}
          pageSize={data.pagination.pageSize}
          totalPages={data.pagination.totalPages}
          hasNextPage={data.pagination.hasNextPage}
        />
      </div>
    </Container>
  );
}
