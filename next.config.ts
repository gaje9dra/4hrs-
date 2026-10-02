import type { NextConfig } from 'next'

const privateNoIndexRoutes = [
  '/admin/:path*', '/account/:path*', '/login', '/register', '/forgot-password', '/reset-password',
  '/cart', '/wishlist', '/checkout/:path*', '/payment/:path*', '/orders/:path*', '/track/:path*',
  '/api/:path*', '/dev/:path*', '/preview/:path*', '/debug/:path*',
]

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    const privateHeaders = privateNoIndexRoutes.map((source) => ({
      source,
      headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive, nosnippet' }],
    }))

    return [
      ...privateHeaders,
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Content-Security-Policy', value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'" },
        ],
      },
    ]
  },
}

export default nextConfig
