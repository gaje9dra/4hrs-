import type { HTMLAttributes, ReactNode } from 'react'
const gaps = { none: 'gap-0', xs: 'gap-2', sm: 'gap-4', md: 'gap-6', lg: 'gap-8', xl: 'gap-12' } as const
export function Stack({ children, gap = 'md', className = '', as: Component = 'div', ...props }: HTMLAttributes<HTMLElement> & { children: ReactNode; gap?: keyof typeof gaps; as?: 'div' | 'section' | 'ul' | 'ol' }) {
  return <Component className={['flex flex-col', gaps[gap], className].join(' ')} {...props}>{children}</Component>
}
