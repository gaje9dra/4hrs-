import { Container } from '@/components/layout/container'
import { FooterBrand } from '@/components/layout/footer-brand'
import { FooterCopyright } from '@/components/layout/footer-copyright'
import { FooterLegal } from '@/components/layout/footer-legal'
import { FooterNav } from '@/components/layout/footer-nav'
import { FooterSocial } from '@/components/layout/footer-social'
import type { FooterNavGroup } from '@/types/footer'
import { footerLegalLinks, footerSocialLinks } from '@/config/footer'

type FooterProps = {
  navigationGroups: FooterNavGroup[]
}

export function Footer({ navigationGroups }: FooterProps) {
  const hasSocialLinks = footerSocialLinks.length > 0

  return (
    <footer className="border-t-2 border-border bg-foreground text-white lg:border-t-4">
      <Container className="py-10 sm:py-14 lg:py-16">
        <div className="grid gap-10 lg:grid-cols-[minmax(280px,1fr)_minmax(0,1.7fr)] lg:gap-16">
          <FooterBrand />

          <div className={hasSocialLinks ? 'grid min-w-0 gap-10 md:grid-cols-[minmax(0,1fr)_auto]' : 'min-w-0'}>
            <FooterNav groups={navigationGroups} />
            {hasSocialLinks ? <FooterSocial links={footerSocialLinks} /> : null}
          </div>
        </div>

        <div className="mt-10 border-t-2 border-white/30 pt-5 sm:mt-12">
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <FooterCopyright />
            <FooterLegal group={footerLegalLinks} />
          </div>
        </div>
      </Container>
    </footer>
  )
}
