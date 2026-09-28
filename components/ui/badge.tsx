import type { HTMLAttributes } from 'react'

type BadgeVariant = 'neutral' | 'red' | 'blue' | 'yellow' | 'outline'

const variants: Record<BadgeVariant, string> = {
  neutral: 'bg-muted text-foreground',
  red: 'bg-primary-red text-white',
  blue: 'bg-primary-blue text-white',
  yellow: 'bg-primary-yellow text-foreground',
  outline: 'bg-white text-foreground',
}

export function Badge({ variant = 'neutral', className = '', children, ...props }: HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  return (
    <span
      className={`inline-flex items-center border-2 border-border px-2.5 py-1 text-xs font-700 uppercase tracking-widest ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </span>
  )
}
