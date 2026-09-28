import type { HTMLAttributes, ReactNode } from 'react'
const gaps = { none: 'gap-0', xs: 'gap-2', sm: 'gap-4', md: 'gap-6', lg: 'gap-8' } as const
const aligns = { start: 'items-start', center: 'items-center', end: 'items-end', stretch: 'items-stretch' } as const
const justifies = { start: 'justify-start', center: 'justify-center', end: 'justify-end', between: 'justify-between' } as const
export function Cluster({ children, gap = 'sm', className = '', align = 'center', justify = 'start', as: Component = 'div', ...props }: HTMLAttributes<HTMLElement> & { children: ReactNode; gap?: keyof typeof gaps; align?: keyof typeof aligns; justify?: keyof typeof justifies; as?: 'div' | 'nav' | 'ul' }) {
  return <Component className={['flex flex-wrap', gaps[gap], aligns[align], justifies[justify], className].join(' ')} {...props}>{children}</Component>
}
