import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    ppr: true,
    clientSegmentCache: true
  },
  // Suppress false-positive "params/searchParams is a Promise" warnings emitted
  // by Next.js 15 canary's internal devtools log-forwarding code. These fire inside
  // Next.js's own layout-router.tsx (not in app code) when it tries to JSON.stringify
  // the route proxy objects during scroll/focus handling. They are dev-only noise and
  // do not affect production behaviour.
  logging: {
    fetches: {
      fullUrl: false
    }
  }
};

export default nextConfig;
