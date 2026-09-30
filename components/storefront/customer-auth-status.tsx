"use client";

import Link from "next/link";
import { LogOut, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { CustomerDto } from "@/lib/customer/contracts";

type SessionResponse =
  | { authenticated: true; customer: CustomerDto }
  | { authenticated: false; customer: null };

export function CustomerAuthStatus() {
  const [customer, setCustomer] = useState<CustomerDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/auth/session", {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
      headers: { Accept: "application/json" },
    })
      .then(async (response) => {
        const body = await response.json().catch(() => null) as SessionResponse | null;
        if (!active) return;
        if (response.ok && body?.authenticated) setCustomer(body.customer);
        else setCustomer(null);
      })
      .catch(() => {
        if (active) setCustomer(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      if (response.ok) setCustomer(null);
    } finally {
      setLoggingOut(false);
    }
  }

  if (loading) {
    return (
      <span
        className="inline-flex min-h-11 items-center border-2 border-border bg-white px-3 text-xs font-900 uppercase tracking-[0.08em]"
        aria-live="polite"
        aria-label="Checking account status"
      >
        Checking…
      </span>
    );
  }

  if (!customer) {
    return (
      <div className="flex shrink-0 items-center gap-2">
        <Link
          href="/login"
          className="inline-flex min-h-11 items-center gap-2 border-2 border-border bg-primary-yellow px-3 py-2 text-xs font-900 uppercase tracking-[0.08em] no-underline shadow-hard-sm hover:bg-white focus:outline-none focus:ring-2 focus:ring-primary-blue focus:ring-offset-2"
        >
          <UserRound size={16} strokeWidth={3} aria-hidden="true" />
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 shrink-0 items-center gap-2">
      <span className="hidden max-w-40 truncate text-xs font-900 uppercase tracking-[0.06em] lg:block" title={customer.email}>
        {customer.email}
      </span>
      <Button
        variant="outline"
        loading={loggingOut}
        onClick={() => void handleLogout()}
        aria-label="Sign out"
        className="min-h-11 px-3 text-xs"
      >
        <LogOut size={16} strokeWidth={3} aria-hidden="true" />
        <span className="hidden sm:inline">Sign out</span>
      </Button>
    </div>
  );
}
