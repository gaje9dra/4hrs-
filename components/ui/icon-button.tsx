import type { ButtonHTMLAttributes, ReactNode } from 'react'

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string
  children: ReactNode
}

export function IconButton({ label, children, className = '', ...props }: IconButtonProps) {
  return (
    <button
      {...props}
      type={props.type ?? 'button'}
      aria-label={label}
      className={`inline-flex h-11 w-11 items-center justify-center rounded-square border-2 border-border bg-white transition-transform duration-200 hover:-translate-x-px hover:-translate-y-px active:translate-x-[2px] active:translate-y-[2px] active:shadow-none focus-visible:outline-none disabled:cursor-not-allowed disabled:bg-muted ${className}`}
    >
      {children}
    </button>
  )
}
