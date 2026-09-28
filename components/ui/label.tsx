import type { LabelHTMLAttributes } from 'react'

export function Label({ className = '', children, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={`form-label ${className}`} {...props}>{children}</label>
}
