'use client'

import type { InputHTMLAttributes } from 'react'
import { useFormField } from '@/components/ui/form-field'

export function Radio({ className = '', 'aria-invalid': ariaInvalid, 'aria-describedby': ariaDescribedBy, 'aria-required': ariaRequired, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  const field = useFormField()
  const invalid = ariaInvalid ?? (field?.invalid || undefined)

  return (
    <input
      {...props}
      type="radio"
      aria-invalid={invalid}
      aria-describedby={ariaDescribedBy ?? field?.describedBy}
      aria-required={ariaRequired ?? (field?.required || undefined)}
      className={`min-h-11 min-w-11 appearance-none rounded-full border-2 border-border bg-white align-middle transition-[background-color,border-color,box-shadow] duration-(--motion-fast) ease-(--motion-ease) checked:border-[6px] checked:border-primary-blue hover:border-primary-blue disabled:cursor-not-allowed disabled:bg-muted ${invalid ? 'border-primary-red' : ''} ${className}`}
    />
  )
}
