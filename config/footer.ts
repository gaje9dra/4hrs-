import type { FooterNavGroup, SocialLink } from '@/types/footer'

export const footerNavigationGroups: FooterNavGroup[] = [
  {
    label: 'Explore',
    items: [{ label: 'Home', href: '/' }],
  },
]

export const footerLegalLinks: FooterNavGroup = {
  label: 'Policies & Help',
  items: [
    { label: 'Refund & Replacement', href: '/refund-replacement' },
    { label: 'Shipping & Delivery', href: '/shipping' },
    { label: 'Terms & Conditions', href: '/terms' },
    { label: 'Privacy Policy', href: '/privacy' },
    { label: 'Cancellation Policy', href: '/cancellation' },
    { label: 'Contact Support', href: '/contact' },
    { label: 'FAQ', href: '/faq' },
  ],
}

export const footerSocialLinks: SocialLink[] = []
