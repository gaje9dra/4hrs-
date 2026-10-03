import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Container } from "@/components/layout/container";
import { CustomerProfileForm } from "@/components/storefront/customer-profile-form";
import { CustomerPrivacyControls } from "@/components/storefront/customer-privacy-controls";
import { requireCurrentCustomer } from "@/lib/auth/context";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Profile | 4HRS",
  description: "Manage your 4HRS customer profile.",
  robots: { index: false, follow: false, noarchive: true },
};

export default async function AccountProfilePage() {
  let current;
  try {
    current = await requireCurrentCustomer();
  } catch {
    redirect("/login?next=%2Faccount%2Fprofile");
  }

  return (
    <Container width="narrow" className="py-10 sm:py-14 lg:py-20">
      <header className="mb-8">
        <p className="text-xs font-900 uppercase tracking-[0.25em] text-primary-red">Customer / Profile</p>
        <h1 className="mt-3 uppercase">Profile</h1>
        <p className="mt-4 text-base leading-7">Update the editable profile information on your customer account.</p>
      </header>
      <CustomerProfileForm initialCustomer={current.customer} />
      <CustomerPrivacyControls />
    </Container>
  );
}
