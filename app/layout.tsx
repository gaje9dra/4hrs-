import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { Outfit } from 'next/font/google'
import './globals.css'
import { Header } from '@/components/layout/header'
import { SkipLink } from '@/components/layout/skip-link'
import { Footer } from '@/components/layout/footer'
import { WebVitalsTelemetry } from '@/components/observability/web-vitals'
import { ClientErrorTelemetry } from '@/components/observability/client-errors'
import { getStorefrontNavigation, storefrontNavigationToFooterGroups } from '@/lib/storefront/navigation'
import { getSiteOrigin, siteConfig } from '@/config/site'
import { organizationJsonLd, websiteJsonLd, serializeJsonLd } from '@/lib/seo/structured-data'
import { resolveRequestLocale } from '@/lib/i18n/resolution'
import type { NavigationItem } from '@/types/navigation'

const outfit = Outfit({ subsets: ['latin'], weight: ['400'], variable: '--font-outfit', display: 'swap' })

const FALLBACK_NAVIGATION: NavigationItem[] = [
  { label: 'Home', href: '/', match: 'exact' },
  { label: 'Shop', href: '/shop', match: 'section', activePrefixes: ['/shop', '/categories/', '/collections/', '/products/'] },
  { label: 'Search', href: '/search', match: 'section' },
  { label: 'Cart', href: '/cart', match: 'exact' },
]

export async function generateMetadata(): Promise<Metadata> {
  const locale = await resolveRequestLocale()
  return {
    metadataBase: process.env.NEXT_PUBLIC_SITE_URL ? getSiteOrigin() : undefined,
    title: { default: '4HRS — Modern Fashion, Geometric by Design', template: '%s | 4HRS' },
    description: siteConfig.description,
    alternates: { canonical: '/' },
    robots: { index: true, follow: true },
    openGraph: { title: '4HRS — Modern Fashion, Geometric by Design', description: siteConfig.description, url: '/', siteName: siteConfig.name, type: 'website', locale },
    twitter: { card: 'summary_large_image', title: siteConfig.name, description: siteConfig.description },
  }
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const requestHeaders = await headers()
  const locale = await resolveRequestLocale()
  const nonce = requestHeaders.get('x-nonce')

  let navigation = FALLBACK_NAVIGATION
  try {
    navigation = await getStorefrontNavigation()
  } catch {
    // Keep public/authentication pages renderable when catalog navigation is unavailable.
  }

  const footerGroups = storefrontNavigationToFooterGroups(navigation)
  const identityJsonLd = process.env.NEXT_PUBLIC_SITE_URL ? [organizationJsonLd(), websiteJsonLd()] : []

  return (
    <html lang={locale} dir="ltr"><body className={`${outfit.variable} antialiased`}>
      <SkipLink /><Header items={navigation} /><main id="main-content" tabIndex={-1}>{children}</main><Footer navigationGroups={footerGroups} />
      <WebVitalsTelemetry /><ClientErrorTelemetry />
      {identityJsonLd.map((value) => <script key={value['@type'] as string} nonce={nonce ?? undefined} type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(value) }} />)}
    </body></html>
  )
}
