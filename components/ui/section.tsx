import type { HTMLAttributes, ReactNode } from 'react'

type SectionProps = HTMLAttributes<HTMLElement> & {
  children: ReactNode
  width?: 'content' | 'wide' | 'full'
}

const widths = {
  content: 'max-w-5xl',
  wide: 'max-w-7xl',
  full: 'max-w-none',
}

export function Section({ children, width = 'wide', className = '', ...props }: SectionProps) {
  return (
    <section className={`mx-auto w-full px-4 py-12 sm:py-16 lg:px-8 lg:py-24 ${widths[width]} ${className}`} {...props}>
      {children}
    </section>
  )
}
