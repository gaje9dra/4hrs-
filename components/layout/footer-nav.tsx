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
    <div className="grid min-w-0 grid-cols-1 gap-x-8 gap-y-10 min-[420px]:grid-cols-2 xl:grid-cols-[minmax(120px,0.8fr)_minmax(150px,0.9fr)_minmax(230px,1.3fr)] xl:gap-x-8">
      {visibleGroups.map((group) => {
        const id = headingId(group.label)

        return (
          <nav key={group.label} aria-labelledby={id} className="min-w-0">
            <div
              id={id}
              role="heading"
              aria-level={2}
              className="mb-4 border-l-2 border-primary-yellow pl-3 text-lg font-900 uppercase leading-tight tracking-[-0.035em] text-white whitespace-nowrap sm:mb-5 sm:text-xl"
            >
              {group.label}
            </div>
            <ul className="m-0 list-none space-y-1 p-0">
              {group.items.map((item) => (
                <li key={item.href} className="min-w-0">
                  <Link
                    href={item.href}
                    target={item.external ? '_blank' : undefined}
                    rel={item.external ? 'noopener noreferrer' : undefined}
                    className="inline-flex min-h-10 max-w-full items-center break-words py-2 pr-1 text-sm font-500 leading-relaxed text-white/75 no-underline transition-colors hover:text-primary-yellow focus-visible:text-primary-yellow focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary-yellow"
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
