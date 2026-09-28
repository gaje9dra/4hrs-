import { ChevronDown } from 'lucide-react'
import type { SelectHTMLAttributes } from 'react'

export function Select({ className = '', 'aria-invalid': ariaInvalid, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <span className="relative block">
      <select
        {...props}
        aria-invalid={ariaInvalid}
        className={`min-h-12 w-full appearance-none border-2 border-border bg-white px-4 py-3 pr-12 text-base font-500 outline-none transition-[border-color,background-color] duration-(--motion-fast) ease-(--motion-ease) hover:border-primary-blue focus:border-primary-blue disabled:cursor-not-allowed disabled:bg-muted ${ariaInvalid ? 'border-primary-red' : ''} ${className}`}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2" size={20} strokeWidth={3} aria-hidden="true" />
    </span>
  )
}
