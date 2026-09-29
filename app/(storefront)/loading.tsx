import { Container } from "@/components/layout/container";

function SkeletonCard() {
  return (
    <div aria-hidden="true" className="border-4 border-border bg-white shadow-hard-md">
      <div className="aspect-[4/5] border-b-4 border-border bg-primary-yellow" />
      <div className="space-y-4 p-5">
        <div className="h-6 w-3/4 bg-muted" />
        <div className="h-5 w-1/3 bg-muted" />
      </div>
    </div>
  );
}

export default function StorefrontLoading() {
  return (
    <Container className="py-10 sm:py-14 lg:py-20" aria-busy="true" aria-live="polite">
      <div className="mb-8 border-4 border-border bg-white p-6 shadow-hard-md">
        <p className="text-sm font-900 uppercase">Loading catalog…</p>
      </div>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, index) => <SkeletonCard key={index} />)}
      </div>
    </Container>
  );
}
