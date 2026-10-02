import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Container } from "@/components/layout/container";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { requireCurrentCustomer } from "@/lib/auth/context";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Account | 4HRS",
  description: "Manage your 4HRS customer account.",
  robots: { index: false, follow: false, noarchive: true },
};

export default async function AccountPage() {
  let current;
  try {
    current = await requireCurrentCustomer();
  } catch {
    redirect("/login?next=%2Faccount");
  }

  return (
    <Container width="standard" className="py-10 sm:py-14 lg:py-20">
      <header className="mb-8">
        <p className="text-xs font-900 uppercase tracking-[0.25em] text-primary-blue">Customer / Account</p>
        <h1 className="mt-3 uppercase">Your account</h1>
        <p className="mt-4 max-w-2xl text-base leading-7">Manage the customer information associated with your authenticated 4HRS session.</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)]">
        <Card>
          <CardHeader><CardTitle>Profile</CardTitle></CardHeader>
          <CardContent className="grid gap-5">
            <div>
              <p className="text-xs font-900 uppercase tracking-[0.12em] text-muted-foreground">Email</p>
              <p className="mt-2 break-all text-lg font-700">{current.customer.email}</p>
            </div>
            <div>
              <p className="text-xs font-900 uppercase tracking-[0.12em] text-muted-foreground">Display name</p>
              <p className="mt-2 text-lg font-700">{current.customer.displayName || "Not set"}</p>
            </div>
            <div>
              <p className="text-xs font-900 uppercase tracking-[0.12em] text-muted-foreground">Account status</p>
              <p className="mt-2 text-lg font-700">{current.customer.status}</p>
            </div>
            <div>
              <p className="text-xs font-900 uppercase tracking-[0.12em] text-muted-foreground">Email verification</p>
              <p className="mt-2 text-lg font-700">{current.customer.emailVerifiedAt ? "Verified" : "Not verified"}</p>
            </div>
            <Link href="/account/profile" className="inline-flex min-h-12 items-center border-2 border-border bg-primary-yellow px-4 py-3 text-sm font-900 uppercase no-underline shadow-hard-sm hover:bg-white focus:outline-none focus:ring-2 focus:ring-primary-blue focus:ring-offset-2">Edit profile</Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Account navigation</CardTitle></CardHeader>
          <CardContent className="grid gap-3">
            <Link href="/account" aria-current="page" className="border-2 border-border bg-white px-4 py-3 font-900 uppercase no-underline">Account</Link>
            <Link href="/account/profile" className="border-2 border-border bg-white px-4 py-3 font-900 uppercase no-underline hover:bg-primary-yellow">Profile</Link>
            <Link href="/account/orders" className="border-2 border-border bg-white px-4 py-3 font-900 uppercase no-underline hover:bg-primary-yellow">Orders</Link><Link href="/account/cases" className="border-2 border-border bg-white px-4 py-3 font-900 uppercase no-underline hover:bg-primary-yellow">Support cases</Link>
            <Button href="/cart" variant="outline">Cart</Button>
          </CardContent>
        </Card>
      </div>
    </Container>
  );
}
