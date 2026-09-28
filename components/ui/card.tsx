import type { HTMLAttributes } from 'react'

export function Card({ className = '', children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <article className={`relative border-4 border-border bg-white p-6 shadow-[8px_8px_0px_0px_#121212] transition-transform duration-200 ease-out hover:-translate-y-1 ${className}`} {...props}>
      {children}
    </article>
  )
}