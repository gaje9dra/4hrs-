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
  "group motion-icon inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md border-2 border-border bg-white no-underline shadow-[2px_2px_0_#121212] transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[3px_3px_0_#121212] focus:outline-none focus:ring-2 focus:ring-primary-blue focus:ring-offset-2";

const accountBadgeClassName =
  "flex size-7 items-center justify-center rounded-full bg-primary-yellow transition-transform duration-150 group-hover:scale-105";

const cartBadgeClassName =
  "flex size-7 rotate-45 items-center justify-center rounded-sm bg-primary-blue transition-transform duration-150 group-hover:scale-105";

const accountIconClassName = "text-foreground";
const cartIconClassName = "-rotate-45 text-white";

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
      <div className="flex shrink-0 items-center gap-2" aria-label="Account and cart">
        <span className={`${iconBaseClassName} animate-pulse`} aria-hidden="true">
          <span className={accountBadgeClassName}>
            <UserRound size={16} strokeWidth={2.5} className={accountIconClassName} />
          </span>
        </span>
        <span className={`${iconBaseClassName} animate-pulse`} aria-hidden="true">
          <span className={cartBadgeClassName}>
            <ShoppingCart size={16} strokeWidth={2.5} className={cartIconClassName} />
          </span>
        </span>
      </div>
    );
  }

  return (
    <nav className="flex shrink-0 items-center gap-2" aria-label="Account and cart">
      <Link
        href={accountHref}
        aria-label={status === "authenticated" ? "Open account" : "Sign in"}
        title={status === "authenticated" ? "Account" : "Sign in"}
        aria-current={accountActive ? "page" : undefined}
        className={[
          iconBaseClassName,
          accountActive ? "ring-2 ring-primary-yellow ring-offset-2" : "",
        ].filter(Boolean).join(" ")}
      >
        <span className={accountBadgeClassName}>
          <UserRound size={16} strokeWidth={2.5} className={accountIconClassName} aria-hidden="true" />
        </span>
      </Link>
      <Link
        href="/cart"
        aria-label="Open cart"
        title="Cart"
        aria-current={cartActive ? "page" : undefined}
        className={[
          iconBaseClassName,
          cartActive ? "ring-2 ring-primary-yellow ring-offset-2" : "",
        ].filter(Boolean).join(" ")}
      >
        <span className={cartBadgeClassName}>
          <ShoppingCart size={16} strokeWidth={2.5} className={cartIconClassName} aria-hidden="true" />
        </span>
      </Link>
    </nav>
  );
}
