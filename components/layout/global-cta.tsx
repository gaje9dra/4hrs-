import type { ReactNode } from 'react'
import { Container } from '@/components/layout/container'
import { Button } from '@/components/ui/button'
import { GeometricDecoration } from '@/components/bauhaus/geometric-decoration'

type GlobalCTAProps = {
  heading: string
  description?: string
  primaryAction: { label: string; href: string }
  secondaryAction?: { label: string; href: string }
  decoration?: ReactNode
  className?: string
}

export function GlobalCTA({
  heading,
  description,
  primaryAction,
  secondaryAction,
  decoration,
  className = '',
}: GlobalCTAProps) {
  return (
    <section className={['relative w-full overflow-hidden border-y-2 border-border bg-primary-yellow py-12 sm:py-16 lg:border-y-4 lg:py-20', className].filter(Boolean).join(' ')}>
      {decoration ?? (
        <>
          <GeometricDecoration shape="square" color="red" size="lg" className="pointer-events-none absolute -right-6 top-6 rotate-45 opacity-90" />
          <GeometricDecoration shape="circle" color="blue" size="md" className="pointer-events-none absolute -bottom-8 left-6 opacity-90" />
        </>
      )}
      <Container className="relative z-10">
        <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <h2 className="max-w-4xl text-4xl font-900 uppercase leading-[0.9] sm:text-5xl lg:text-6xl">{heading}</h2>
            {description ? <p className="mt-4 max-w-2xl text-base sm:text-lg">{description}</p> : null}
          </div>
          <div className="flex flex-wrap gap-3">
            <Button href={primaryAction.href} variant="primary">{primaryAction.label}</Button>
            {secondaryAction ? <Button href={secondaryAction.href} variant="outline">{secondaryAction.label}</Button> : null}
          </div>
        </div>
      </Container>
    </section>
  )
}
