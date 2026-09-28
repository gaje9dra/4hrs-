import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'yellow' | 'outline' | 'ghost'

type CommonProps = {
  variant?: ButtonVariant
  loading?: boolean
  className?: string
  children?: ReactNode
  disabled?: boolean
}

type ButtonProps = CommonProps & ButtonHTMLAttributes<HTMLButtonElement> & {
  href?: undefined
}

type LinkButtonProps = CommonProps & AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string
}

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-primary-red text-white',
  secondary: 'bg-primary-blue text-white',
  yellow: 'bg-primary-yellow text-foreground',
  outline: 'bg-white text-foreground',
  ghost: 'border-0 bg-transparent text-foreground shadow-none',
}

const baseClass =
  'motion-press inline-flex min-h-12 items-center justify-center gap-2 rounded-square border-2 border-border px-5 py-3 text-sm font-700 uppercase tracking-widest no-underline hover:no-underline focus-visible:outline-none disabled:cursor-not-allowed disabled:bg-muted disabled:text-foreground disabled:shadow-none'

export function Button({ variant = 'primary', loading = false, className = '', children, disabled, ...props }: ButtonProps | LinkButtonProps) {
  const classes = `${baseClass} shadow-hard-sm lg:shadow-hard-md ${variants[variant]} ${className}`
  const content = loading ? 'Loading…' : children

  if ('href' in props && props.href) {
    const { href, onClick, ...linkProps } = props
    return (
      <a
        {...linkProps}
        href={href}
        className={classes}
        aria-disabled={loading || undefined}
        aria-busy={loading || undefined}
        tabIndex={loading ? -1 : undefined}
        onClick={(event) => {
          if (loading) {
            event.preventDefault()
            return
          }
          onClick?.(event)
        }}
      >
        {content}
      </a>
    )
  }

  return (
    <button
      type="button"
      {...props}
      disabled={disabled || loading}
      className={classes}
      aria-busy={loading || undefined}
    >
      {content}
    </button>
  )
}
