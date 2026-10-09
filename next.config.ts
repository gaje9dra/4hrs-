import type { NextConfig } from 'next'

const privateNoIndexRoutes = [
  '/admin/:path*', '/account/:path*', '/login', '/register', '/forgot-password', '/reset-password',
  '/cart', '/wishlist', '/checkout/:path*', '/payment/:path*', '/orders/:path*', '/track/:path*',
  '/api/:path*', '/dev/:path*', '/preview/:path*', '/debug/:path*',
]

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
  { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
  ...(process.env.NODE_ENV === 'production'
    ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' }]
    : []),
]

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    // Restrict optimized local images to public image assets while allowing both
    // plain paths (such as the hero banner) and versioned cache-busting URLs.
    localPatterns: [
      {
        pathname: '/images/**',
      },
    ],
  },
  async headers() {
    const privateHeaders = privateNoIndexRoutes.map((source) => ({
      source,
      headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive, nosnippet' }],
    }))

    return [
      ...privateHeaders,
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ]
  },
}

export default nextConfig
