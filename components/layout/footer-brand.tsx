import { GeometricMark } from '@/components/geometry/geometric-mark'

export function FooterBrand() {
  return (
    <div className="max-w-md">
      <GeometricMark className="mb-6" />
      <h2 className="text-4xl font-900 uppercase leading-[0.9] tracking-[-0.04em] text-white sm:text-5xl">4HRS</h2>
      <p className="mt-4 max-w-sm text-sm leading-6 text-white/75">
        A geometric fashion system built around bold pieces and clear choices.
      </p>
    </div>
  )
}
