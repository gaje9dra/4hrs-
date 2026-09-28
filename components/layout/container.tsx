import type { HTMLAttributes, ReactNode } from 'react'

export type ContainerWidth = 'standard' | 'wide' | 'narrow' | 'full'
const widths: Record<ContainerWidth, string> = {
  standard: 'max-w-7xl', wide: 'max-w-screen-2xl', narrow: 'max-w-3xl', full: 'max-w-none',
}
export type ContainerProps = HTMLAttributes<HTMLDivElement> & { children: ReactNode; width?: ContainerWidth }

export function Container({ children, width = 'standard', className = '', ...props }: ContainerProps) {
  return <div className={['mx-auto w-full px-4 sm:px-6 lg:px-8', widths[width], className].filter(Boolean).join(' ')} {...props}>{children}</div>
}
