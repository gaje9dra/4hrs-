import type { Metadata } from "next";
import { CartPage } from "@/components/storefront/cart-page";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Cart — 4HRS",
  description: "Your private 4HRS Cart.",
  robots: { index: false, follow: false, noarchive: true },
};

export default function CartRoute() {
  return <CartPage />;
}
