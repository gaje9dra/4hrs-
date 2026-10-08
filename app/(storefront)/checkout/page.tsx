import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Container } from "@/components/layout/container";
import { CheckoutPage } from "@/components/storefront/checkout-page";
import { resolveCurrentCustomer } from "@/lib/auth/context";
import { getSafeAuthRedirect } from "@/lib/auth/redirect";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Payment — 4HRS",
  description: "Secure 4HRS payment checkout powered by PayU.",
  robots: { index: false, follow: false, noarchive: true },
};

export default async function CheckoutRoute() {
  const current = await resolveCurrentCustomer();
  if (!current) redirect(`/login?next=${encodeURIComponent(getSafeAuthRedirect("/checkout"))}`);
  return <Container className="py-10 sm:py-14 lg:py-16"><CheckoutPage customer={current.customer} /></Container>;
}
