import Link from "next/link";

export default function CategoryNotFound() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6 lg:px-8">
      <p className="text-xs font-900 uppercase tracking-[.25em] text-primary-red">Catalog / Category</p>
      <h1 className="mt-4 uppercase">Category not found</h1>
      <p className="mx-auto mt-5 max-w-xl">That category is unavailable or no longer published.</p>
      <Link href="/shop" className="motion-press mt-8 inline-flex min-h-12 items-center border-2 border-border bg-primary-yellow px-5 py-3 text-sm font-900 uppercase no-underline shadow-hard-sm focus:outline-none focus:ring-2 focus:ring-primary-blue focus:ring-offset-2">Return to shop</Link>
    </main>
  );
}
