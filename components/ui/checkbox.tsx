import type { InputHTMLAttributes } from 'react'

export function Checkbox({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      type="checkbox"
      className={`h-5 w-5 appearance-none border-2 border-border bg-white align-middle transition-[background-color,border-color,box-shadow] duration-(--motion-fast) ease-(--motion-ease) checked:bg-primary-blue hover:border-primary-blue focus-visible:outline-none disabled:cursor-not-allowed disabled:bg-muted ${className}`}
    />
  )
}
