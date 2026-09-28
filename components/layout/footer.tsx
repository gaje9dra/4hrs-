import { Container } from '@/components/layout/container'
import { FooterBrand } from '@/components/layout/footer-brand'
import { FooterCopyright } from '@/components/layout/footer-copyright'
import { FooterLegal } from '@/components/layout/footer-legal'
import { FooterNav } from '@/components/layout/footer-nav'
import { FooterSocial } from '@/components/layout/footer-social'
import { footerLegalLinks, footerNavigationGroups, footerSocialLinks } from '@/config/footer'

export function Footer() {
  return (
    <footer className="border-t-2 border-border bg-foreground text-white lg:border-t-4">
      <Container className="py-12 sm:py-16 lg:py-20">
        <div className="grid gap-12 lg:grid-cols-[1.1fr_1.9fr] lg:gap-20">
          <FooterBrand />

          <div className="grid gap-10 sm:grid-cols-2">
            <FooterNav groups={footerNavigationGroups} />
            <FooterSocial links={footerSocialLinks} />
          </div>
        </div>

        <div className="mt-12 border-t-2 border-white/30 pt-5 lg:mt-16">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <FooterCopyright />
            <FooterLegal group={footerLegalLinks} />
          </div>
        </div>
      </Container>
    </footer>
  )
}
