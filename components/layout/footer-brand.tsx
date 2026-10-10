import { GeometricMark } from '@/components/bauhaus/geometric-mark'

export function FooterBrand() {
  return (
    <div className="min-w-0 max-w-md">
      <GeometricMark className="mb-5" />
      <h2 className="text-4xl font-900 uppercase leading-[0.9] tracking-[-0.05em] text-white sm:text-5xl">4HRS</h2>
      <p className="mt-4 max-w-sm text-sm leading-6 text-white/70">
        Modern fashion built around bold pieces, clear choices, and geometric design.
      </p>
      <p className="mt-5 inline-flex border border-white/20 px-3 py-2 text-[10px] font-900 uppercase tracking-[0.2em] text-white/60">
        Bold by design
      </p>
    </div>
  )
}
