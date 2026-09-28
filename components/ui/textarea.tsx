'use client'

import type { TextareaHTMLAttributes } from 'react'
import { useFormField } from '@/components/ui/form-field'

export function Textarea({ className = '', 'aria-invalid': ariaInvalid, 'aria-describedby': ariaDescribedBy, 'aria-required': ariaRequired, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const field = useFormField()
  const invalid = ariaInvalid ?? (field?.invalid || undefined)

  return (
    <textarea
      {...props}
      aria-invalid={invalid}
      aria-describedby={ariaDescribedBy ?? field?.describedBy}
      aria-required={ariaRequired ?? (field?.required || undefined)}
      required={props.required ?? (field?.required || undefined)}
      className={`min-h-32 w-full resize-y border-2 border-border bg-white px-4 py-3 text-base font-500 transition-[border-color,background-color] duration-(--motion-fast) ease-(--motion-ease) hover:border-primary-blue focus:border-primary-blue disabled:cursor-not-allowed disabled:bg-muted ${invalid ? 'border-primary-red' : ''} ${className}`}
    />
  )
}
