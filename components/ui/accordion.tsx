'use client'

import { ChevronDown } from 'lucide-react'
import { useId, useState, type ReactNode } from 'react'

type AccordionItemProps = {
  title: ReactNode
  children: ReactNode
  defaultOpen?: boolean
  disabled?: boolean
}

export function AccordionItem({ title, children, defaultOpen = false, disabled = false }: AccordionItemProps) {
  const [open, setOpen] = useState(defaultOpen)
  const id = useId()
  const panelId = `accordion-panel-${id}`
  const buttonId = `accordion-button-${id}`

  return (
    <div className="border-2 border-border bg-white lg:border-4">
      <h3>
        <button
          id={buttonId}
          type="button"
          disabled={disabled}
          aria-expanded={open}
          aria-controls={panelId}
          className="motion-link flex min-h-14 w-full items-center justify-between gap-4 px-4 py-4 text-left text-base font-900 uppercase no-underline focus-visible:outline-none disabled:cursor-not-allowed disabled:bg-muted"
          onClick={() => setOpen((value) => !value)}
        >
          <span>{title}</span>
          <ChevronDown className={`shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} size={22} strokeWidth={3} aria-hidden="true" />
        </button>
      </h3>
      <div id={panelId} role="region" aria-labelledby={buttonId} hidden={!open} className="border-t-2 border-border px-4 py-4">
        {children}
      </div>
    </div>
  )
}

export function Accordion({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`space-y-3 ${className}`}>{children}</div>
}
