'use client'

import { ChevronDown } from 'lucide-react'
import type { SelectHTMLAttributes } from 'react'
import { useFormField } from '@/components/ui/form-field'

export function Select({ className = '', 'aria-invalid': ariaInvalid, 'aria-describedby': ariaDescribedBy, 'aria-required': ariaRequired, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  const field = useFormField()
  const invalid = ariaInvalid ?? (field?.invalid || undefined)

  return (
    <span className="relative block">
      <select
        {...props}
        aria-invalid={invalid}
        aria-describedby={ariaDescribedBy ?? field?.describedBy}
        aria-required={ariaRequired ?? (field?.required || undefined)}
        className={`min-h-12 w-full appearance-none border-2 border-border bg-white px-4 py-3 pr-12 text-base font-500 transition-[border-color,background-color] duration-(--motion-fast) ease-(--motion-ease) hover:border-primary-blue focus:border-primary-blue disabled:cursor-not-allowed disabled:bg-muted ${invalid ? 'border-primary-red' : ''} ${className}`}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2" size={20} strokeWidth={3} aria-hidden="true" />
    </span>
  )
}
