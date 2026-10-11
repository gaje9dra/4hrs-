import type { Metadata } from "next";
import { Container } from "@/components/layout/container";
import { CheckoutPage } from "@/components/storefront/checkout-page";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Payment — 4HRS",
  description: "Secure 4HRS payment checkout powered by PayU.",
  robots: { index: false, follow: false, noarchive: true },
};

export default function CheckoutRoute() {
  // Render the checkout shell immediately. Authentication, cart ownership,
  // addresses, and payable totals remain enforced by the authenticated APIs.
  // Blocking this route on a server-side session lookup delayed first render
  // and then the client performed the same authentication lookup again.
  return <Container className="py-10 sm:py-14 lg:py-16"><CheckoutPage /></Container>;
}
