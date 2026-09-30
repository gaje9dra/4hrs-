import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Container } from "@/components/layout/container";
import { CustomerAuthForm } from "@/components/storefront/customer-auth-form";
import { resolveCurrentCustomer } from "@/lib/auth/context";
import { getSafeAuthRedirect } from "@/lib/auth/redirect";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Sign in | 4HRS",
  description: "Sign in to your 4HRS customer account.",
  robots: { index: false, follow: false, noarchive: true },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const params = await searchParams;
  const next = getSafeAuthRedirect(params.next);

  try {
    const current = await resolveCurrentCustomer();
    if (current) redirect(next);
  } catch {
    // Authentication service availability is handled by the form/API boundary.
  }

  return (
    <Container width="narrow" className="py-10 sm:py-14 lg:py-20">
      <header className="mb-8 max-w-2xl">
        <p className="text-xs font-900 uppercase tracking-[0.25em] text-primary-red">Customer authentication</p>
        <h1 className="mt-3 uppercase">Sign in to 4HRS</h1>
        <p className="mt-5 text-base leading-7">Use your customer credentials to continue. Your session is managed securely on the server.</p>
      </header>
      <CustomerAuthForm mode="login" redirectTo={next} />
    </Container>
  );
}
