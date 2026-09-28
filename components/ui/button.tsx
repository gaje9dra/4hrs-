import type { ButtonHTMLAttributes } from 'react'

const variants = {
  primary: 'bg-primary-red text-white',
  secondary: 'bg-primary-blue text-white',
  yellow: 'bg-primary-yellow text-foreground',
  outline: 'bg-white text-foreground',
  ghost: 'border-0 bg-transparent text-foreground shadow-none',
}

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof variants }) {
  return (
    <button
      className={`inline-flex min-h-12 items-center justify-center rounded-square border-2 border-border px-5 py-3 text-sm font-700 uppercase tracking-widest shadow-hard-sm transition-transform duration-200 ease-out active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:cursor-not-allowed disabled:bg-muted disabled:text-foreground disabled:shadow-none ${variants[variant]} ${className}`}
      {...props}
    />
  )
}
