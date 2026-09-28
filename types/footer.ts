export type FooterNavItem = {
  label: string
  href: string
  external?: boolean
}

export type FooterNavGroup = {
  label: string
  items: FooterNavItem[]
}

export type SocialLink = {
  label: string
  href: string
  external?: boolean
  icon: 'instagram' | 'facebook' | 'x' | 'youtube'
}
