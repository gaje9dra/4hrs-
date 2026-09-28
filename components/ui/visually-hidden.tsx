import type { HTMLAttributes, ReactNode } from 'react'

type VisuallyHiddenProps = HTMLAttributes<HTMLSpanElement> & {
  children: ReactNode
}

export function VisuallyHidden({ children, className = '', ...props }: VisuallyHiddenProps) {
  return (
    <span
      className={['absolute h-px w-px overflow-hidden whitespace-nowrap border-0 p-0', '[-clip:rect(0,0,0,0)]', className].filter(Boolean).join(' ')}
      {...props}
    >
      {children}
    </span>
  )
}
