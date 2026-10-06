import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[50vh] w-full max-w-3xl items-center px-4 py-16 sm:px-6 lg:px-8">
      <section className="w-full border-4 border-border bg-primary-yellow p-8 shadow-hard-md sm:p-10" aria-labelledby="collection-not-found-title">
        <p className="text-xs font-900 uppercase tracking-[.25em] text-primary-red">Catalog / Collection</p>
        <h1 id="collection-not-found-title" className="mt-3 uppercase">Collection not found</h1>
        <p className="mt-4 max-w-2xl leading-7">This collection is not available.</p>
        <Link href="/shop" className="mt-7 inline-flex min-h-12 items-center border-2 border-border bg-white px-5 py-3 text-sm font-900 uppercase no-underline shadow-hard-sm focus:outline-none focus:ring-2 focus:ring-primary-blue focus:ring-offset-2">Shop all</Link>
      </section>
    </div>
  );
}
