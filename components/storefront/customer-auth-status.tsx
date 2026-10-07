"use client";

import Link from "next/link";
import { ShoppingCart, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import type { CustomerDto } from "@/lib/customer/contracts";

type SessionResponse =
  | { authenticated: true; customer: CustomerDto }
  | { authenticated: false; customer: null };

type Status = "loading" | "anonymous" | "authenticated" | "unavailable";

const iconBaseClassName =
  "motion-icon inline-flex h-11 w-11 shrink-0 items-center justify-center border-2 border-border no-underline shadow-hard-sm transition-transform duration-150 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-primary-blue focus:ring-offset-2";

export function CustomerAuthStatus() {
  const pathname = usePathname();
  const [customer, setCustomer] = useState<CustomerDto | null>(null);
  const [status, setStatus] = useState<Status>("loading");

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
        if (response.ok && body?.authenticated) {
          setCustomer(body.customer);
          setStatus("authenticated");
        } else if (response.ok && body?.authenticated === false) {
          setCustomer(null);
          setStatus("anonymous");
        } else {
          setCustomer(null);
          setStatus("unavailable");
        }
      })
      .catch(() => {
        if (active) {
          setCustomer(null);
          setStatus("unavailable");
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const accountHref = status === "authenticated" && customer ? "/account" : "/login";
  const accountActive = pathname === "/account";
  const cartActive = pathname === "/cart";

  if (status === "loading") {
    return (
      <div className="flex shrink-0 items-center gap-1.5" aria-label="Account and cart">
        <span
          className={`${iconBaseClassName} rounded-full bg-primary-red animate-pulse`}
          aria-hidden="true"
        >
          <UserRound size={20} strokeWidth={2.5} className="text-white" />
        </span>
        <span
          className={`${iconBaseClassName} rotate-45 bg-primary-blue animate-pulse`}
          aria-hidden="true"
        >
          <ShoppingCart size={20} strokeWidth={2.5} className="-rotate-45 text-white" />
        </span>
      </div>
    );
  }

  return (
    <nav className="flex shrink-0 items-center gap-1.5" aria-label="Account and cart">
      <Link
        href={accountHref}
        aria-label={status === "authenticated" ? "Open account" : "Sign in"}
        title={status === "authenticated" ? "Account" : "Sign in"}
        aria-current={accountActive ? "page" : undefined}
        className={[
          iconBaseClassName,
          "rounded-full bg-primary-red",
          accountActive ? "ring-2 ring-primary-yellow ring-offset-2" : "",
        ].filter(Boolean).join(" ")}
      >
        <UserRound size={20} strokeWidth={2.5} className="text-white" aria-hidden="true" />
      </Link>
      <Link
        href="/cart"
        aria-label="Open cart"
        title="Cart"
        aria-current={cartActive ? "page" : undefined}
        className={[
          iconBaseClassName,
          "rotate-45 bg-primary-blue",
          cartActive ? "ring-2 ring-primary-yellow ring-offset-2" : "",
        ].filter(Boolean).join(" ")}
      >
        <ShoppingCart size={20} strokeWidth={2.5} className="-rotate-45 text-white" aria-hidden="true" />
      </Link>
    </nav>
  );
}
