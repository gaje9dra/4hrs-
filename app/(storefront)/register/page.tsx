import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Container } from "@/components/layout/container";
import { CustomerAuthForm } from "@/components/storefront/customer-auth-form";
import { resolveCurrentCustomer } from "@/lib/auth/context";
import { getSafeAuthRedirect } from "@/lib/auth/redirect";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Create account | 4HRS",
  description: "Create a 4HRS customer account.",
  robots: { index: false, follow: false, noarchive: true },
};

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const params = await searchParams;
  const next = getSafeAuthRedirect(params.next);

  let current = null;
  try {
    current = await resolveCurrentCustomer();
  } catch {
    // Authentication service availability is handled by the form/API boundary.
  }

  if (current) redirect(next);

  return (
    <Container width="narrow" className="py-10 sm:py-14 lg:py-20">
      <header className="mb-8 max-w-2xl">
        <p className="text-xs font-900 uppercase tracking-[0.25em] text-primary-blue">Customer authentication</p>
        <h1 className="mt-3 uppercase">Create your 4HRS account</h1>
        <p className="mt-5 text-base leading-7">Create a customer account with only the credentials required by the current authentication service.</p>
      </header>
      <CustomerAuthForm mode="register" redirectTo={next} />
    </Container>
  );
}
