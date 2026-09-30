import type { ReactNode } from 'react'

type SectionHeadingProps = {
  id?: string
  eyebrow?: ReactNode
  title: ReactNode
  description?: ReactNode
  align?: 'left' | 'center'
  className?: string
}

export function SectionHeading({ id, eyebrow, title, description, align = 'left', className = '' }: SectionHeadingProps) {
  return (
    <header className={`max-w-3xl ${align === 'center' ? 'mx-auto text-center' : ''} ${className}`}>
      {eyebrow ? <p className="mb-3 text-xs font-900 uppercase tracking-[0.25em] text-primary-blue">{eyebrow}</p> : null}
      <h2 id={id} className="text-4xl font-900 uppercase leading-none tracking-tight sm:text-5xl">{title}</h2>
      {description ? <p className="mt-4 text-base leading-7 lg:text-lg">{description}</p> : null}
    </header>
  )
}

export function Eyebrow({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <p className={`text-xs font-900 uppercase tracking-[0.25em] ${className}`}>{children}</p>
}
