import Link from 'next/link'
import type { FooterNavGroup } from '@/types/footer'

type FooterNavProps = {
  groups: FooterNavGroup[]
}

const headingId = (label: string) => 'footer-nav-' + label.toLowerCase().replace(/[^a-z0-9]+/g, '-')

export function FooterNav({ groups }: FooterNavProps) {
  const visibleGroups = groups.filter((group) => group.items.length > 0)

  if (visibleGroups.length === 0) return null

  return (
    <div className="grid gap-8 sm:grid-cols-2">
      {visibleGroups.map((group) => {
        const id = headingId(group.label)

        return (
          <nav key={group.label} aria-labelledby={id}>
            <h2 id={id} className="mb-4 text-xs font-900 uppercase tracking-[0.2em] text-primary-yellow">{group.label}</h2>
            <ul className="m-0 list-none space-y-3 p-0">
              {group.items.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    target={item.external ? '_blank' : undefined}
                    rel={item.external ? 'noopener noreferrer' : undefined}
                    className="inline-flex min-h-11 items-center text-sm font-700 uppercase text-white no-underline transition-[color,background-color] duration-[120ms] hover:bg-primary-yellow hover:text-foreground focus-visible:text-foreground"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )
      })}
    </div>
  )
}
