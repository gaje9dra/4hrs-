import type { HTMLAttributes } from 'react'

export function Card({ className = '', children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <article
      className={`relative border-2 border-border lg:border-4 bg-white p-6 shadow-hard-lg transition-transform duration-200 ease-out hover:-translate-y-1 ${className}`}
      {...props}
    >
      {children}
    </article>
  )
}
