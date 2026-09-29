import Link from "next/link";

export function StorefrontNotFound({ entity }: { entity: "product" | "category" | "collection" }) {
  const label = entity[0].toUpperCase() + entity.slice(1);
  return (
    <div className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6 lg:px-8">
      <p className="text-xs font-900 uppercase tracking-[.25em] text-primary-red">404 / {label}</p>
      <h1 className="mt-4 uppercase">Nothing here.</h1>
      <p className="mx-auto mt-5 max-w-xl">This {entity} is not available in the public catalog.</p>
      <Link href="/shop" className="motion-press mt-8 inline-flex min-h-12 items-center border-2 border-border bg-primary-yellow px-5 py-3 text-sm font-900 uppercase no-underline shadow-hard-sm lg:shadow-hard-md">
        Back to shop
      </Link>
    </div>
  );
}
