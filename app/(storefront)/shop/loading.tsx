import { Container } from "@/components/layout/container";

export default function ShopLoading() {
  return (
    <Container className="py-10 sm:py-14 lg:py-20" aria-label="Loading shop catalog">
      <div className="animate-pulse" aria-hidden="true">
        <div className="h-4 w-32 bg-primary-red/30" />
        <div className="mt-4 h-12 w-48 bg-border/20" />
        <div className="mt-4 h-5 max-w-2xl bg-border/20" />
        <div className="mt-8 h-32 border-4 border-border bg-primary-yellow/50 shadow-hard-md" />
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, index) => (
            <div key={index} className="border-4 border-border bg-white shadow-hard-md">
              <div className="aspect-[4/5] bg-border/10" />
              <div className="space-y-3 p-5"><div className="h-6 bg-border/20" /><div className="h-5 w-2/3 bg-border/20" /></div>
            </div>
          ))}
        </div>
      </div>
      <p className="sr-only" role="status">Loading shop catalog.</p>
    </Container>
  );
}