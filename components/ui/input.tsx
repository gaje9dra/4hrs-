'use client'

import type { InputHTMLAttributes } from 'react'
import { useFormField } from '@/components/ui/form-field'

export function Input({ className = '', 'aria-invalid': ariaInvalid, 'aria-describedby': ariaDescribedBy, 'aria-required': ariaRequired, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  const field = useFormField()
  const invalid = ariaInvalid ?? (field?.invalid || undefined)

  return (
    <input
      {...props}
      aria-invalid={invalid}
      aria-describedby={ariaDescribedBy ?? field?.describedBy}
      aria-required={ariaRequired ?? (field?.required || undefined)}
      required={props.required ?? (field?.required || undefined)}
      className={`min-h-12 w-full border-2 border-border bg-white px-4 py-3 text-base font-500 transition-[border-color,background-color] duration-(--motion-fast) ease-(--motion-ease) hover:border-primary-blue focus:border-primary-blue disabled:cursor-not-allowed disabled:bg-muted ${invalid ? 'border-primary-red' : ''} ${className}`}
    />
  )
}
