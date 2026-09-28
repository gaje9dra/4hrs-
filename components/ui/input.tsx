import type { InputHTMLAttributes } from 'react'

export function Input({ className = '', 'aria-invalid': ariaInvalid, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      aria-invalid={ariaInvalid}
      className={`min-h-12 w-full border-2 border-border bg-white px-4 py-3 text-base font-500 outline-none transition-colors duration-200 focus:border-primary-blue disabled:cursor-not-allowed disabled:bg-muted ${ariaInvalid ? 'border-primary-red' : ''} ${className}`}
    />
  )
}
