'use client';

import { useEffect } from 'react';

/**
 * Filters out false-positive "params/searchParams is a Promise" console warnings
 * that Next.js 15 canary emits from its own internal devtools log-forwarding code
 * (layout-router.tsx → InnerScrollAndFocusHandler → JSON.stringify on route proxies).
 * These are not caused by app code and do not affect runtime behaviour.
 */
export function DevWarningFilter() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;

    const originalError = console.error;
    console.error = (...args: unknown[]) => {
      const msg = typeof args[0] === 'string' ? args[0] : '';
      if (
        msg.includes('params') && msg.includes('Promise') ||
        msg.includes('searchParams') && msg.includes('Promise')
      ) {
        return;
      }
      originalError.apply(console, args);
    };

    return () => {
      console.error = originalError;
    };
  }, []);

  return null;
}
