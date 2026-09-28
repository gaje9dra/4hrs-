import type { HTMLAttributes } from 'react'

type SectionDividerProps = HTMLAttributes<HTMLDivElement> & {
  accent?: 'black' | 'red' | 'blue' | 'yellow'
}

const accents = {
  black: 'bg-foreground',
  red: 'bg-primary-red',
  blue: 'bg-primary-blue',
  yellow: 'bg-primary-yellow',
} as const

export function SectionDivider({ accent = 'black', className = '', ...props }: SectionDividerProps) {
  return (
    <div
      role="separator"
      aria-hidden="true"
      className={['h-0.5 w-full sm:h-1', accents[accent], className].filter(Boolean).join(' ')}
      {...props}
    />
  )
}
