import { Container } from "@/components/layout/container";

export default function ShipmentTrackingLoading() {
  return (
    <Container width="standard" className="py-10 sm:py-14 lg:py-20" aria-busy="true">
      <div className="border-b-4 border-border pb-6">
        <div className="h-3 w-40 bg-border/20" />
        <div className="mt-4 h-12 w-3/4 max-w-xl bg-border/20" />
        <div className="mt-4 h-5 w-full max-w-2xl bg-border/20" />
      </div>
      <div className="mt-8 grid gap-5 lg:grid-cols-[1fr_2fr]">
        <div className="h-80 border-4 border-border bg-background p-5" />
        <div className="h-80 border-4 border-border bg-background p-5" />
      </div>
      <span className="sr-only">Loading shipment tracking information.</span>
    </Container>
  );
}
