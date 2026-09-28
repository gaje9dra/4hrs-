import type { HTMLAttributes, ReactNode } from 'react'
export function Split({ children, className = '', reverseOnDesktop = false, ...props }: HTMLAttributes<HTMLDivElement> & { children: ReactNode; reverseOnDesktop?: boolean }) {
  return <div className={['grid items-center gap-8 lg:grid-cols-2 lg:gap-12', reverseOnDesktop ? 'lg:[&>*:first-child]:order-2' : '', className].filter(Boolean).join(' ')} {...props}>{children}</div>
}
