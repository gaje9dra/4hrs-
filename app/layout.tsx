import type { Metadata } from 'next'
import { Outfit } from 'next/font/google'
import './globals.css'
import { Header } from '@/components/layout/header'
import { SkipLink } from '@/components/layout/skip-link'
import { Footer } from '@/components/layout/footer'
import { getStorefrontNavigation, storefrontNavigationToFooterGroups } from '@/lib/storefront/navigation'

const outfit = Outfit({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-outfit',
  display: 'swap',
})

export const metadata: Metadata = {
  title: '4HRS — Modern Fashion, Geometric by Design',
  description: 'A Bauhaus-inspired fashion storefront foundation for 4HRS.',
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const navigation = await getStorefrontNavigation()
  const footerGroups = storefrontNavigationToFooterGroups(navigation)

  return (
    <html lang="en">
      <body className={`${outfit.variable} antialiased`}>
        <SkipLink />
        <Header items={navigation} />
        <main id="main-content" tabIndex={-1}>
          {children}
        </main>
        <Footer navigationGroups={footerGroups} />
      </body>
    </html>
  )
}
