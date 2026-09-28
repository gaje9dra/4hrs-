import type { TextareaHTMLAttributes } from 'react'

export function Textarea({ className = '', 'aria-invalid': ariaInvalid, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      aria-invalid={ariaInvalid}
      className={`min-h-32 w-full resize-y border-2 border-border bg-white px-4 py-3 text-base font-500 outline-none transition-[border-color,background-color] duration-(--motion-fast) ease-(--motion-ease) hover:border-primary-blue focus:border-primary-blue disabled:cursor-not-allowed disabled:bg-muted ${ariaInvalid ? 'border-primary-red' : ''} ${className}`}
    />
  )
}
