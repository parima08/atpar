'use client';

import { createContext, useContext, useState, useEffect, ReactNode, Suspense } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import useSWR from 'swr';
import { AuthModal } from './auth-modal';
import { User } from '@/lib/db/schema';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface AuthContextValue {
  user: User | null | undefined;
  isLoading: boolean;
  openSignIn: () => void;
  openSignUp: () => void;
  openFromUrl: (tab: 'signin' | 'signup', error?: string) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Reads auth query params and opens modal; must be in Suspense because it uses useSearchParams()
function AuthUrlSync() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { openFromUrl } = useAuth();

  useEffect(() => {
    const authParam = searchParams.get('auth');
    const errorParam = searchParams.get('error');
    const messageParam = searchParams.get('message');

    if (authParam === 'signin' || authParam === 'signup') {
      const error = errorParam ? getErrorMessage(errorParam, messageParam) : undefined;
      openFromUrl(authParam, error);
      // Clean up URL (remove query params) after opening modal
      const url = new URL(window.location.href);
      url.searchParams.delete('auth');
      url.searchParams.delete('error');
      url.searchParams.delete('message');
      router.replace(url.pathname + url.search, { scroll: false });
    }
  }, [searchParams, router, pathname, openFromUrl]);

  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [defaultTab, setDefaultTab] = useState<'signin' | 'signup'>('signup');
  const [authError, setAuthError] = useState<string | null>(null);

  // Fetch user data - will be null if not logged in
  const { data: user, isLoading } = useSWR<User | null>('/api/user', fetcher);

  const openSignIn = () => {
    setAuthError(null);
    setDefaultTab('signin');
    setOpen(true);
  };

  const openSignUp = () => {
    setAuthError(null);
    setDefaultTab('signup');
    setOpen(true);
  };

  const openFromUrl = (tab: 'signin' | 'signup', error?: string) => {
    setDefaultTab(tab);
    setAuthError(error ?? null);
    setOpen(true);
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      setAuthError(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, openSignIn, openSignUp, openFromUrl }}>
      {children}
      <Suspense fallback={null}>
        <AuthUrlSync />
      </Suspense>
      <AuthModal 
        open={open} 
        onOpenChange={handleOpenChange}
        defaultTab={defaultTab}
        error={authError}
      />
    </AuthContext.Provider>
  );
}

// Map error codes to user-friendly messages
function getErrorMessage(errorCode: string, message?: string | null): string {
  const errorMessages: Record<string, string> = {
    oauth_not_configured: 'OAuth login is not configured. Please use email sign-in or try another provider.',
    oauth_failed: 'Failed to start login. Please try again.',
    missing_code: 'Authentication was cancelled. Please try again.',
    invalid_state: 'Security check failed. Please try again.',
    token_exchange_failed: 'Failed to complete authentication. Please try again.',
    user_info_failed: 'Could not retrieve your profile. Please try again.',
    no_email: 'No email address associated with your account.',
    callback_failed: 'Something went wrong. Please try again.',
    access_denied: 'Access was denied. You may need admin approval for this app.',
    consent_required: 'Admin approval is required for this app.',
  };
  
  // Use custom message if provided (from OAuth error_description)
  if (message) {
    return message;
  }
  
  return errorMessages[errorCode] || 'An error occurred. Please try again.';
}
