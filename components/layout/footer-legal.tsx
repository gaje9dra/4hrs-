import Link from 'next/link'
import type { FooterNavGroup } from '@/types/footer'

type FooterLegalProps = {
  group: FooterNavGroup
}

export function FooterLegal({ group }: FooterLegalProps) {
  if (group.items.length === 0) return null

  return (
    <nav aria-labelledby="footer-legal-heading">
      <h2 id="footer-legal-heading" className="sr-only">{group.label}</h2>
      <ul className="m-0 flex list-none flex-wrap gap-x-6 gap-y-2 p-0">
        {group.items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              target={item.external ? '_blank' : undefined}
              rel={item.external ? 'noopener noreferrer' : undefined}
              className="text-xs font-700 uppercase text-white/80 no-underline hover:bg-primary-yellow hover:text-foreground"
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
