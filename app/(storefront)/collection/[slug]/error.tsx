"use client";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-[50vh] w-full max-w-3xl items-center px-4 py-16 sm:px-6 lg:px-8">
      <section className="w-full border-4 border-border bg-primary-yellow p-8 shadow-hard-md sm:p-10" aria-labelledby="collection-error-title">
        <p className="text-xs font-900 uppercase tracking-[.25em] text-primary-red">Catalog / Error</p>
        <h1 id="collection-error-title" className="mt-3 uppercase">Collection unavailable</h1>
        <p className="mt-4 max-w-2xl leading-7">We could not load this collection right now. Please try again.</p>
        <button type="button" onClick={reset} className="mt-7 min-h-12 border-2 border-border bg-primary-blue px-5 py-3 text-sm font-900 uppercase text-white shadow-hard-sm focus:outline-none focus:ring-2 focus:ring-primary-blue focus:ring-offset-2">Try again</button>
      </section>
    </main>
  );
}
