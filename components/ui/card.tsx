import type { HTMLAttributes, ReactNode } from 'react'

type CardProps = HTMLAttributes<HTMLElement> & {
  children: ReactNode
}

export function Card({ className = '', children, ...props }: CardProps) {
  return (
    <article
      className={`relative border-2 border-border bg-white p-6 shadow-hard-lg transition-transform duration-200 ease-out lg:border-4 hover:-translate-y-1 ${className}`}
      {...props}
    >
      {children}
    </article>
  )
}

export function CardHeader({ className = '', children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`mb-5 ${className}`} {...props}>{children}</div>
}

export function CardTitle({ className = '', children, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={`text-2xl font-900 uppercase leading-none ${className}`} {...props}>{children}</h3>
}

export function CardDescription({ className = '', children, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={`mt-2 text-sm leading-6 ${className}`} {...props}>{children}</p>
}

export function CardContent({ className = '', children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={` ${className}`} {...props}>{children}</div>
}

export function CardFooter({ className = '', children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`mt-6 flex flex-wrap items-center gap-3 border-t-2 border-border pt-5 ${className}`} {...props}>{children}</div>
}
