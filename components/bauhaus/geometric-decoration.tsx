import type { HTMLAttributes } from 'react'

type GeometricDecorationProps = HTMLAttributes<HTMLSpanElement> & {
  shape: 'circle' | 'square' | 'triangle' | 'diamond' | 'line'
  color: 'red' | 'blue' | 'yellow'
  size?: 'sm' | 'md' | 'lg'
}

export function GeometricDecoration({ shape, color, size = 'md', className = '', ...props }: GeometricDecorationProps) {
  const sizes = { sm: 'h-5 w-5', md: 'h-8 w-8', lg: 'h-14 w-14' }
  const colors = { red: 'bg-primary-red', blue: 'bg-primary-blue', yellow: 'bg-primary-yellow' }
  const geometry = shape === 'circle' ? 'rounded-full' : shape === 'triangle' ? 'clip-triangle' : shape === 'diamond' ? 'rotate-45' : ''
  const dimensions = shape === 'line' ? 'h-1 w-20' : sizes[size]

  return <span aria-hidden="true" className={`pointer-events-none inline-block ${dimensions} ${colors[color]} ${geometry} ${className}`} {...props} />
}
