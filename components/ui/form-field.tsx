import type { HTMLAttributes, ReactNode } from 'react'

type FormFieldProps = HTMLAttributes<HTMLDivElement> & {
  label?: string
  htmlFor?: string
  description?: string
  error?: string
  required?: boolean
  children: ReactNode
}

export function FormField({
  label,
  htmlFor,
  description,
  error,
  required = false,
  children,
  className = '',
  ...props
}: FormFieldProps) {
  const messageId = htmlFor ? `${htmlFor}-message` : undefined
  const errorId = htmlFor ? `${htmlFor}-error` : undefined

  return (
    <div className={`space-y-2 ${className}`} {...props}>
      {label ? (
        <label htmlFor={htmlFor} className="form-label">
          {label}{required ? <span aria-hidden="true"> *</span> : null}
        </label>
      ) : null}
      {children}
      {description && !error ? <p id={messageId} className="form-help">{description}</p> : null}
      {error ? <p id={errorId} className="form-error" role="alert">{error}</p> : null}
    </div>
  )
}
