import { CornerDecoration } from './corner-decoration'
import { GeometricCircle, GeometricSquare, GeometricTriangle } from './geometric-shape'

export function CornerAccent({ placement = 'top-right' }: { placement?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' }) {
  return <CornerDecoration placement={placement} />
}

export function HeroComposition() {
  return (
    <div className="relative h-64 w-full sm:h-80 lg:h-[28rem]" aria-hidden="true">
      <GeometricCircle size="xl" color="red" className="absolute right-4 top-2 sm:right-10" />
      <GeometricSquare size="xl" color="blue" className="absolute bottom-8 left-2 sm:left-12" />
      <GeometricTriangle size="lg" color="yellow" rotation={45} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" />
    </div>
  )
}

export function EditorialComposition() {
  return (
    <div className="relative h-48 w-full" aria-hidden="true">
      <GeometricCircle size="lg" color="red" className="absolute left-4 top-2" />
      <GeometricSquare size="lg" color="blue" rotation={45} className="absolute right-12 top-10" />
      <GeometricTriangle size="md" color="yellow" rotation={-45} className="absolute bottom-2 left-1/2" />
    </div>
  )
}

export function SectionAccent() {
  return (
    <div className="flex items-center gap-3" aria-hidden="true">
      <GeometricSquare size="sm" color="red" />
      <GeometricTriangle size="sm" color="blue" rotation={45} />
      <GeometricCircle size="sm" color="yellow" />
    </div>
  )
}
