import type { CSSProperties, HTMLAttributes, ReactNode } from 'react'

type VisuallyHiddenProps = HTMLAttributes<HTMLSpanElement> & {
  children: ReactNode
}

const visuallyHiddenStyle: CSSProperties = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: 0,
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0,
}

export function VisuallyHidden({ children, className = '', style, ...props }: VisuallyHiddenProps) {
  return (
    <span className={className} style={{ ...visuallyHiddenStyle, ...style }} {...props}>
      {children}
    </span>
  )
}
