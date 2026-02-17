'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { AuthModal } from '@/components/auth/auth-modal';
import { Suspense } from 'react';

function SignInContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const error = searchParams.get('error');

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      // Redirect to home when modal is closed
      router.push('/');
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAF7]">
      {/* Show error message if present */}
      {error && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">
          {error === 'oauth_not_configured' && 'Microsoft login is not configured.'}
          {error === 'oauth_failed' && 'Failed to initiate Microsoft login.'}
          {error === 'missing_code' && 'Authentication was cancelled.'}
          {error === 'invalid_state' && 'Security check failed. Please try again.'}
          {error === 'token_exchange_failed' && 'Failed to complete authentication.'}
          {error === 'user_info_failed' && 'Could not retrieve your profile.'}
          {error === 'no_email' && 'No email associated with your Microsoft account.'}
          {error === 'callback_failed' && 'Something went wrong. Please try again.'}
          {!['oauth_not_configured', 'oauth_failed', 'missing_code', 'invalid_state', 'token_exchange_failed', 'user_info_failed', 'no_email', 'callback_failed'].includes(error) && 'An error occurred. Please try again.'}
        </div>
      )}
      
      <AuthModal 
        open={true} 
        onOpenChange={handleOpenChange}
        defaultTab="signin"
      />
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#FAFAF7]" />}>
      <SignInContent />
    </Suspense>
  );
}
