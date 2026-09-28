import { GeometricCircle, GeometricSquare, GeometricTriangle } from '@/components/bauhaus/geometric-shape'

export function GeometricMark({ className = '' }: { className?: string }) {
  return (
    <span className={`relative inline-block h-12 w-16 ${className}`} aria-hidden="true">
      <GeometricCircle size="sm" color="red" className="absolute left-0 top-0" />
      <GeometricSquare size="sm" color="blue" className="absolute right-0 top-1" />
      <GeometricTriangle size="sm" color="yellow" rotation={-45} className="absolute bottom-0 left-7" />
    </span>
  )
}

export function Shape({
  type, color, size = 'md', className = '',
}: {
  type: 'circle' | 'square' | 'triangle' | 'diamond' | 'line'
  color: 'red' | 'blue' | 'yellow'
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  if (type === 'diamond') return <GeometricSquare size={size} color={color} rotation={45} className={className} />
  if (type === 'line') {
    const colors = { red: 'bg-primary-red', blue: 'bg-primary-blue', yellow: 'bg-primary-yellow' }
    return <span aria-hidden="true" className={`pointer-events-none inline-block h-1 w-20 ${colors[color]} ${className}`} />
  }
  if (type === 'circle') return <GeometricCircle size={size} color={color} className={className} />
  if (type === 'triangle') return <GeometricTriangle size={size} color={color} className={className} />
  return <GeometricSquare size={size} color={color} className={className} />
}
