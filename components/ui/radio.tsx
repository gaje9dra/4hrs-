import type { InputHTMLAttributes } from 'react'

export function Radio({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      type="radio"
      className={`h-5 w-5 appearance-none rounded-full border-2 border-border bg-white align-middle checked:border-[6px] checked:border-primary-blue focus-visible:outline-none disabled:cursor-not-allowed disabled:bg-muted ${className}`}
    />
  )
}
