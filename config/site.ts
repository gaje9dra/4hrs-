export const siteConfig = {
  name: '4HRS',
  description: 'Modern fashion, geometric by design.',
} as const

function readSiteOrigin(): URL | null {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (!raw) return null
  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    if (url.username || url.password || url.search || url.hash) return null
    url.pathname = url.pathname.replace(/\/+$/, '')
    return url
  } catch {
    return null
  }
}

export function getSiteOrigin(): URL {
  const url = readSiteOrigin()
  if (!url) throw new Error('NEXT_PUBLIC_SITE_URL must be a valid absolute HTTP(S) origin without credentials, query parameters, or fragments.')
  return url
}

export function getProductionSiteOrigin(): URL {
  const url = getSiteOrigin()
  if (url.protocol !== 'https:') throw new Error('NEXT_PUBLIC_SITE_URL must use HTTPS for production SEO surfaces.')
  return url
}

export function absoluteSiteUrl(pathname = '/'): string {
  const url = new URL(pathname, getSiteOrigin())
  url.search = ''
  url.hash = ''
  return url.toString()
}
