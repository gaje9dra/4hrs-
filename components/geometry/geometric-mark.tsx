import type { HTMLAttributes } from 'react'

export function GeometricMark({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <span className={`relative inline-block h-12 w-16 ${className}`} aria-hidden="true" {...props}>
      <span className="absolute left-0 top-0 h-9 w-9 rounded-full bg-red" />
      <span className="absolute right-0 top-1 h-8 w-8 bg-blue" />
      <span className="absolute bottom-0 left-7 h-7 w-7 rotate-[-10deg] bg-yellow clip-triangle" />
    </span>
  )
}

export function Shape({ type, color, size = 'md', className = '' }: { type: 'circle' | 'square' | 'triangle' | 'diamond' | 'line'; color: 'red' | 'blue' | 'yellow'; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const sizes = { sm: 'h-5 w-5', md: 'h-8 w-8', lg: 'h-14 w-14' }
  const colors = { red: 'bg-red', blue: 'bg-blue', yellow: 'bg-yellow' }
  const shape = type === 'circle' ? 'rounded-full' : type === 'triangle' ? 'clip-triangle' : type === 'diamond' ? 'rotate-45' : ''
  const line = type === 'line' ? 'h-1 w-20' : sizes[size]
  return <span className={`inline-block ${line} ${colors[color]} ${shape} ${className}`} aria-hidden="true" />
}