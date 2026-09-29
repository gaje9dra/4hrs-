import type { ReactNode } from 'react'

export type GeometricLayerName = 'back' | 'base' | 'front'
const layers: Record<GeometricLayerName, string> = { back: 'z-0', base: 'z-10', front: 'z-20' }

export function GeometricComposition({
  children, className = '', label, overflow = 'hidden',
}: { children: ReactNode; className?: string; label?: string; overflow?: 'hidden' | 'visible' }) {
  return (
    <div
      className={['relative isolate', overflow === 'hidden' ? 'overflow-hidden' : 'overflow-visible', className].join(' ')}
      aria-hidden={label ? undefined : true}
      role={label ? 'img' : undefined}
      aria-label={label}
    >
      {children}
    </div>
  )
}

export function GeometricLayer({
  children, className = '', layer = 'base',
}: { children?: ReactNode; className?: string; layer?: GeometricLayerName }) {
  return <div className={['absolute pointer-events-none', layers[layer], className].join(' ')} aria-hidden="true">{children}</div>
}
