import { GeometricCircle, GeometricSquare, GeometricTriangle } from './geometric-shape'

export type CornerPlacement = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
const placements: Record<CornerPlacement, string> = {
  'top-left': '-left-5 -top-5', 'top-right': '-right-5 -top-5',
  'bottom-left': '-bottom-5 -left-5', 'bottom-right': '-bottom-5 -right-5',
}

export function CornerDecoration({
  placement = 'top-right', className = '',
}: { placement?: CornerPlacement; className?: string }) {
  return (
    <div aria-hidden="true" className={['pointer-events-none absolute z-0 hidden sm:block', placements[placement], className].join(' ')}>
      <div className="relative h-24 w-24">
        <GeometricCircle size="lg" color="red" className="absolute left-0 top-0" />
        <GeometricSquare size="md" color="blue" rotation={45} className="absolute bottom-0 right-0" />
        <GeometricTriangle size="sm" color="yellow" rotation={-45} className="absolute bottom-2 left-8" />
      </div>
    </div>
  )
}
