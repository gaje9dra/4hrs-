export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8" aria-busy="true" aria-label="Loading collection">
      <div className="h-5 w-32 border-2 border-border bg-primary-yellow" />
      <div className="mt-5 h-14 w-2/3 border-4 border-border bg-white shadow-hard-sm" />
      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, index) => <div key={index} className="aspect-[4/5] border-4 border-border bg-white shadow-hard-sm" />)}
      </div>
    </main>
  );
}
