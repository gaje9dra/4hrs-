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
      className={`motion-icon inline-flex h-11 w-11 items-center justify-center rounded-square border-2 border-border bg-white disabled:cursor-not-allowed disabled:bg-muted ${className}`}
    >
      {children}
    </button>
  )
}
