export default function Loading() {
  return <section className="space-y-6" aria-busy="true" aria-live="polite">
    <div className="h-36 animate-pulse border-4 border-black bg-white" />
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{Array.from({length:8},(_,i)=><div key={i} className="h-28 animate-pulse border-4 border-black bg-white" />)}</div>
  </section>;
}