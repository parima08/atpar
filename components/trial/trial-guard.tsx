'use client';

import { usePathname } from 'next/navigation';
import useSWR from 'swr';
import { TrialBanner } from './trial-banner';
import { TrialExpiredModal } from './trial-expired-modal';
import { TeamAccessStatus } from '@/lib/db/trial';
import { fetcher } from '@/lib/fetcher';

// Routes that don't require subscription (pricing, settings, etc.)
const EXEMPT_ROUTES = ['/pricing', '/dashboard/general', '/dashboard/security', '/sign-in', '/sign-up'];

export function TrialGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: accessStatus, isLoading } = useSWR<TeamAccessStatus>(
    '/api/team/access',
    fetcher,
    { revalidateOnFocus: true }
  );

  // Don't block exempt routes
  const isExemptRoute = EXEMPT_ROUTES.some(route => pathname?.startsWith(route));

  // Show loading state or just render children while loading
  if (isLoading || !accessStatus) {
    return <>{children}</>;
  }

  // Determine if we should show the expired modal
  const showExpiredModal = 
    !isExemptRoute && 
    accessStatus.status === 'trial_expired';

  return (
    <>
      {/* Trial banner at the top */}
      <TrialBanner accessStatus={accessStatus} />
      
      {/* Trial expired modal - blocks access to protected routes */}
      <TrialExpiredModal 
        isOpen={showExpiredModal} 
        expiredAt={accessStatus.status === 'trial_expired' ? accessStatus.expiredAt : undefined}
      />
      
      {children}
    </>
  );
}
