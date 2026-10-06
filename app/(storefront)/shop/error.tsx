"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function ShopError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6 lg:px-8">
      <p className="text-xs font-900 uppercase tracking-[.25em] text-primary-red">Catalog / Error</p>
      <h1 className="mt-4 uppercase">The shop could not be loaded.</h1>
      <p className="mx-auto mt-5 max-w-xl">The catalog request could not be completed. No internal error details are exposed here.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-4">
        <button type="button" onClick={reset} className="motion-press min-h-12 border-2 border-border bg-primary-blue px-5 py-3 text-sm font-900 uppercase text-white shadow-hard-sm focus:outline-none focus:ring-2 focus:ring-primary-blue focus:ring-offset-2">Try again</button>
        <Link href="/shop" className="motion-press inline-flex min-h-12 items-center border-2 border-border bg-primary-yellow px-5 py-3 text-sm font-900 uppercase no-underline shadow-hard-sm focus:outline-none focus:ring-2 focus:ring-primary-blue focus:ring-offset-2">Reset shop</Link>
      </div>
    </div>
  );
}