import { Container } from "@/components/layout/container";

export default function AccountOrderDetailLoading() {
  return (
    <Container width="standard" className="py-10 sm:py-14 lg:py-20" aria-busy="true" aria-live="polite">
      <div className="border-b-4 border-border pb-6">
        <div className="h-3 w-36 bg-muted" />
        <div className="mt-4 h-12 w-72 max-w-full bg-muted" />
      </div>
      <div className="mt-8 grid gap-6">
        <div className="min-h-40 border-4 border-border bg-white p-6 shadow-hard-md" />
        <div className="min-h-32 border-4 border-border bg-white p-6 shadow-hard-md" />
      </div>
    </Container>
  );
}
