import { Container } from '@/components/layout/container'
import { FooterBrand } from '@/components/layout/footer-brand'
import { FooterCopyright } from '@/components/layout/footer-copyright'
import { FooterNav } from '@/components/layout/footer-nav'
import { FooterSocial } from '@/components/layout/footer-social'
import type { FooterNavGroup } from '@/types/footer'
import { footerLegalLinks, footerSocialLinks } from '@/config/footer'

type FooterProps = {
  navigationGroups: FooterNavGroup[]
}

export function Footer({ navigationGroups }: FooterProps) {
  const hasSocialLinks = footerSocialLinks.length > 0
  const footerGroups = [...navigationGroups, footerLegalLinks]

  return (
    <footer className="border-t-4 border-primary-yellow bg-foreground text-white">
      <Container className="py-8 sm:py-12 lg:py-16">
        <div className="grid gap-8 border-b border-white/20 pb-8 sm:gap-12 sm:pb-10 lg:grid-cols-[minmax(260px,0.85fr)_minmax(0,2.15fr)] lg:gap-12 lg:pb-14">
          <FooterBrand />

          <div className={hasSocialLinks ? 'grid min-w-0 gap-8 md:grid-cols-[minmax(0,1fr)_auto]' : 'min-w-0'}>
            <FooterNav groups={footerGroups} />
            {hasSocialLinks ? <FooterSocial links={footerSocialLinks} /> : null}
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-2 pt-5 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:pt-6">
          <FooterCopyright />
          <p className="text-[10px] font-700 uppercase tracking-[0.12em] text-white/50 sm:text-xs sm:tracking-[0.14em]">
            Bold by design.
          </p>
        </div>
      </Container>
    </footer>
  )
}
