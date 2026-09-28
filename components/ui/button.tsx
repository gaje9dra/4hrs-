import type { ButtonHTMLAttributes } from 'react'

const variants = {
  primary: 'bg-red text-white',
  secondary: 'bg-blue text-white',
  yellow: 'bg-yellow text-foreground',
  outline: 'bg-white text-foreground',
  ghost: 'border-0 bg-transparent text-foreground shadow-none',
}

export function Button({ variant = 'primary', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof variants }) {
  return (
    <button
      className={`inline-flex min-h-12 items-center justify-center rounded-none border-2 border-border px-5 py-3 text-sm font-900 uppercase tracking-widest shadow-[3px_3px_0px_0px_#121212] transition-transform duration-200 ease-out active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}
      {...props}
    />
  )
}