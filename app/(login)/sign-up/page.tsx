'use client';

import { useRouter } from 'next/navigation';
import { AuthModal } from '@/components/auth/auth-modal';
import { Suspense } from 'react';

function SignUpContent() {
  const router = useRouter();

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      // Redirect to home when modal is closed
      router.push('/');
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAF7]">
      <AuthModal 
        open={true} 
        onOpenChange={handleOpenChange}
        defaultTab="signup"
      />
    </div>
  );
}

export default function SignUpPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#FAFAF7]" />}>
      <SignUpContent />
    </Suspense>
  );
}
