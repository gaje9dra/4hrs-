import { Container } from "@/components/layout/container";

export default function AccountOrdersLoading() {
  return (
    <Container width="standard" className="py-10 sm:py-14 lg:py-20" aria-busy="true" aria-live="polite">
      <div className="border-b-4 border-border pb-6">
        <div className="h-3 w-36 bg-muted" />
        <div className="mt-4 h-12 w-56 bg-muted" />
      </div>
      <div className="mt-8 grid gap-4">
        {[0, 1, 2].map((item) => <div key={item} className="min-h-36 border-4 border-border bg-white p-6 shadow-hard-md"><div className="h-6 w-52 bg-muted" /><div className="mt-6 h-4 w-72 max-w-full bg-muted" /></div>)}
      </div>
    </Container>
  );
}
