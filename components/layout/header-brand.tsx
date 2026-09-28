import Link from 'next/link'
import { GeometricMark } from '@/components/geometry/geometric-mark'

export function HeaderBrand({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Link
      href="/"
      onClick={onNavigate}
      className="group inline-flex min-w-0 items-center gap-2 no-underline"
      aria-label="4HRS home"
    >
      <GeometricMark className="h-10 w-14 shrink-0 scale-90" />
      <span className="truncate text-2xl font-900 uppercase tracking-[-0.05em]">4HRS</span>
    </Link>
  )
}
