'use client';

import { createContext, useContext, useState, ReactNode } from 'react';
import { AuthModal } from './auth-modal';

interface AuthContextValue {
  openSignIn: () => void;
  openSignUp: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [defaultTab, setDefaultTab] = useState<'signin' | 'signup'>('signup');

  const openSignIn = () => {
    setDefaultTab('signin');
    setOpen(true);
  };

  const openSignUp = () => {
    setDefaultTab('signup');
    setOpen(true);
  };

  return (
    <AuthContext.Provider value={{ openSignIn, openSignUp }}>
      {children}
      <AuthModal 
        open={open} 
        onOpenChange={setOpen}
        defaultTab={defaultTab}
      />
    </AuthContext.Provider>
  );
}
