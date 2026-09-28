import Link from 'next/link'
import { Facebook, Instagram, Youtube } from 'lucide-react'
import type { ReactNode } from 'react'
import type { SocialLink } from '@/types/footer'

type FooterIcon = (props: { size?: number; strokeWidth?: number }) => ReactNode

const XIcon: FooterIcon = ({ size = 20 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" fill="currentColor">
    <path d="M18.244 2H21.5l-7.11 8.13L22.75 22h-6.57l-5.14-6.72L5.16 22H1.9l7.6-8.69L1.25 2h6.74l4.65 6.14L18.244 2Zm-1.15 17.83h1.82L7 4.05H5.05l12.044 15.78Z" />
  </svg>
)

const icons: Record<SocialLink['icon'], FooterIcon> = {
  instagram: Instagram,
  facebook: Facebook,
  x: XIcon,
  youtube: Youtube,
}

type FooterSocialProps = {
  links: SocialLink[]
}

export function FooterSocial({ links }: FooterSocialProps) {
  if (links.length === 0) return null

  return (
    <nav aria-label="Social media">
      <h2 className="mb-4 text-xs font-900 uppercase tracking-[0.2em] text-primary-yellow">Social</h2>
      <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
        {links.map((link) => {
          const Icon = icons[link.icon]

          return (
            <li key={link.href}>
              <Link
                href={link.href}
                target={link.external ? '_blank' : undefined}
                rel={link.external ? 'noopener noreferrer' : undefined}
                aria-label={link.label}
                className="motion-icon inline-flex min-h-11 min-w-11 items-center justify-center border-2 border-white text-white no-underline hover:border-primary-yellow hover:bg-primary-yellow hover:text-foreground"
              >
                <span aria-hidden="true"><Icon size={20} strokeWidth={2.5} /></span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
