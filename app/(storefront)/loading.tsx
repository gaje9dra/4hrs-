import { Container } from "@/components/layout/container";

export default function StorefrontLoading() {
  return (
    <Container className="py-16" aria-busy="true" aria-live="polite">
      <div className="border-2 border-border bg-white p-6 shadow-hard-md lg:border-4 lg:shadow-hard-lg">
        <p className="text-sm font-900 uppercase">Loading catalog…</p>
      </div>
    </Container>
  );
}
