import { PolicyPage, policyMetadata } from "@/components/storefront/policy-page";
import type { Metadata } from "next";

export const metadata: Metadata = policyMetadata("shipping");

export default function Page() {
  return <PolicyPage slug="shipping" />;
}
