import { AlertCircle, CheckCircle2, Info, TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'

type AlertVariant = 'information' | 'success' | 'warning' | 'error'

const config: Record<AlertVariant, { icon: typeof Info; classes: string; title: string }> = {
  information: { icon: Info, classes: 'bg-primary-blue text-white', title: 'Information' },
  success: { icon: CheckCircle2, classes: 'bg-primary-yellow text-foreground', title: 'Success' },
  warning: { icon: TriangleAlert, classes: 'bg-primary-yellow text-foreground', title: 'Warning' },
  error: { icon: AlertCircle, classes: 'bg-primary-red text-white', title: 'Error' },
}

export function Alert({ variant = 'information', title, children, className = '' }: { variant?: AlertVariant; title?: string; children: ReactNode; className?: string }) {
  const { icon: Icon, classes, title: defaultTitle } = config[variant]
  return (
    <div role="alert" className={`flex gap-4 border-2 border-border p-4 shadow-hard-sm lg:border-4 ${classes} ${className}`}>
      <Icon className="mt-0.5 shrink-0" size={24} strokeWidth={3} aria-hidden="true" />
      <div>
        <p className="font-900 uppercase">{title ?? defaultTitle}</p>
        <div className="mt-1 text-sm leading-6">{children}</div>
      </div>
    </div>
  )
}

export const Status = Alert
