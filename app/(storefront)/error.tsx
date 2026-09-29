"use client";

import { CatalogErrorState } from "@/components/storefront/catalog-error";

export default function StorefrontError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div>
      <CatalogErrorState />
      <div className="mx-auto max-w-3xl px-4 pb-16 text-center sm:px-6 lg:px-8">
        <button type="button" onClick={reset} className="motion-press min-h-12 border-2 border-border bg-white px-5 py-3 text-sm font-900 uppercase shadow-hard-sm">
          Try again
        </button>
      </div>
    </div>
  );
}
