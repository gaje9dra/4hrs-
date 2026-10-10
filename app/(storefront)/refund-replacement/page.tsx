import { PolicyPage, policyMetadata } from "@/components/storefront/policy-page";
import type { Metadata } from "next";

export const metadata: Metadata = policyMetadata("refund-replacement");

export default function Page() {
  return <PolicyPage slug="refund-replacement" />;
}
