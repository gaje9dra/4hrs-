import type { ElementType, ReactNode } from 'react'
import { Container, type ContainerWidth } from '@/components/layout/container'

type SectionProps = {
  children: ReactNode
  as?: ElementType
  className?: string
  contentClassName?: string
  width?: 'content' | 'wide' | 'full'
  containerWidth?: ContainerWidth
  fullWidth?: boolean
  background?: string
  divider?: boolean
  decoration?: ReactNode
}

const contentWidths = { content: 'narrow', wide: 'standard', full: 'full' } as const

export function Section({
  children,
  as: Component = 'section',
  className = '',
  contentClassName = '',
  width = 'wide',
  containerWidth,
  fullWidth = false,
  background,
  divider = false,
  decoration,
}: SectionProps) {
  const resolvedWidth = containerWidth ?? contentWidths[width]

  return (
    <Component
      className={[
        'relative w-full py-12 sm:py-16 lg:py-24',
        divider ? 'border-b-2 border-border lg:border-b-4' : '',
        background ?? '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {decoration}
      <Container width={fullWidth ? 'full' : resolvedWidth} className={contentClassName}>
        {children}
      </Container>
    </Component>
  )
}
