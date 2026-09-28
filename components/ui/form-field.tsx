'use client'

import { createContext, useContext, type HTMLAttributes, type ReactNode } from 'react'

type FormFieldContextValue = {
  describedBy?: string
  invalid: boolean
  required: boolean
}

const FormFieldContext = createContext<FormFieldContextValue | null>(null)

export function useFormField() {
  return useContext(FormFieldContext)
}

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
  const messageId = htmlFor && description && !error ? `${htmlFor}-message` : undefined
  const errorId = htmlFor && error ? `${htmlFor}-error` : undefined
  const describedBy = [messageId, errorId].filter(Boolean).join(' ') || undefined

  return (
    <FormFieldContext.Provider value={{ describedBy, invalid: Boolean(error), required }}>
      <div className={`space-y-2 ${className}`} {...props}>
        {label ? (
          <label htmlFor={htmlFor} className="form-label">
            {label}
            {required ? <span className="ml-1"> (required)</span> : null}
          </label>
        ) : null}
        {children}
        {description && !error ? <p id={messageId} className="form-help">{description}</p> : null}
        {error ? <p id={errorId} className="form-error" role="alert">{error}</p> : null}
      </div>
    </FormFieldContext.Provider>
  )
}
