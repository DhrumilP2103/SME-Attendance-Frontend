import type { NextConfig } from 'next';
const config: NextConfig = {
  poweredByHeader: false,
  turbopack: { root: process.cwd() },
  async rewrites() {
    return [{ source: '/api/v1/:path*', destination: `${process.env.BACKEND_INTERNAL_URL || 'http://127.0.0.1:4000'}/api/v1/:path*` }];
  },
  async headers() {
    return [{ source: '/:path*', headers: [{ key: 'Referrer-Policy', value: 'same-origin' }, { key: 'X-Content-Type-Options', value: 'nosniff' }, { key: 'X-Frame-Options', value: 'DENY' }] }];
  },
};
export default config;
