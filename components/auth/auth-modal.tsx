'use client';

import { useState, useCallback, useMemo, useActionState } from 'react';
import Image from 'next/image';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { signIn, signUp } from '@/app/(login)/actions';
import { ActionState } from '@/lib/auth/middleware';

// Microsoft logo SVG component
function MicrosoftLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="9" height="9" fill="#f25022"/>
      <rect x="11" y="1" width="9" height="9" fill="#7fba00"/>
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef"/>
      <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
    </svg>
  );
}

interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: 'signin' | 'signup';
  error?: string | null;
}

function MicrosoftSignInButton() {
  const [loading, setLoading] = useState(false);

  const handleClick = () => {
    setLoading(true);
    window.location.href = '/api/auth/microsoft';
  };

  return (
    <Button
      type="button"
      onClick={handleClick}
      disabled={loading}
      variant="outline"
      className="w-full h-11 rounded-xl border-[#E7E5E4] hover:bg-gray-50 font-medium"
    >
      {loading ? (
        <>
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          Connecting...
        </>
      ) : (
        <>
          <MicrosoftLogo className="w-5 h-5 mr-2" />
          Continue with Microsoft
        </>
      )}
    </Button>
  );
}

function Divider() {
  return (
    <div className="relative my-4">
      <div className="absolute inset-0 flex items-center">
        <div className="w-full border-t border-[#E7E5E4]" />
      </div>
      <div className="relative flex justify-center text-xs">
        <span className="px-3 bg-white text-[#78716C]">or continue with email</span>
      </div>
    </div>
  );
}

function SignInForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    signIn,
    { error: '' }
  );

  return (
    <div className="space-y-4">
      <MicrosoftSignInButton />
      
      <Divider />

      <form action={formAction} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="signin-email" className="text-[#3D3835] font-medium">
            Email
          </Label>
          <Input
            id="signin-email"
            name="email"
            type="email"
            placeholder="you@example.com"
            defaultValue={state.email}
            required
            maxLength={50}
            className="h-11 rounded-xl border-[#E7E5E4] focus:border-[#0D7377] focus:ring-[#0D7377]/20"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="signin-password" className="text-[#3D3835] font-medium">
            Password
          </Label>
          <div className="relative">
            <Input
              id="signin-password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter your password"
              defaultValue={state.password}
              required
              minLength={8}
              maxLength={100}
              className="h-11 rounded-xl border-[#E7E5E4] focus:border-[#0D7377] focus:ring-[#0D7377]/20 pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#78716C] hover:text-[#1C1917] transition-colors"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {state?.error && (
          <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
            {state.error}
          </p>
        )}

        <Button
          type="submit"
          disabled={pending}
          className="w-full h-11 bg-[#F59E0B] text-[#1C1917] font-semibold hover:bg-[#D97706] rounded-xl transition-all"
        >
          {pending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Signing in...
            </>
          ) : (
            'Sign in'
          )}
        </Button>
      </form>
    </div>
  );
}

function SignUpForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    signUp,
    { error: '' }
  );

  return (
    <div className="space-y-4">
      <MicrosoftSignInButton />
      
      <Divider />

      <form action={formAction} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="signup-email" className="text-[#3D3835] font-medium">
            Email
          </Label>
          <Input
            id="signup-email"
            name="email"
            type="email"
            placeholder="you@example.com"
            defaultValue={state.email}
            required
            maxLength={50}
            className="h-11 rounded-xl border-[#E7E5E4] focus:border-[#0D7377] focus:ring-[#0D7377]/20"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="signup-password" className="text-[#3D3835] font-medium">
            Password
          </Label>
          <div className="relative">
            <Input
              id="signup-password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Create a password (min 8 characters)"
              defaultValue={state.password}
              required
              minLength={8}
              maxLength={100}
              className="h-11 rounded-xl border-[#E7E5E4] focus:border-[#0D7377] focus:ring-[#0D7377]/20 pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#78716C] hover:text-[#1C1917] transition-colors"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {state?.error && (
          <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
            {state.error}
          </p>
        )}

        <Button
          type="submit"
          disabled={pending}
          className="w-full h-11 bg-[#F59E0B] text-[#1C1917] font-semibold hover:bg-[#D97706] rounded-xl transition-all"
        >
          {pending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Creating account...
            </>
          ) : (
            'Create account'
          )}
        </Button>

        <p className="text-xs text-center text-[#78716C]">
          By signing up, you agree to our{' '}
          <a href="/terms" className="text-[#0D7377] hover:underline">Terms</a>
          {' '}and{' '}
          <a href="/privacy" className="text-[#0D7377] hover:underline">Privacy Policy</a>
        </p>
      </form>
    </div>
  );
}

export function AuthModal({ open, onOpenChange, defaultTab = 'signin', error }: AuthModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader className="text-center">
          <div className="flex justify-center mb-3">
            <Image
              src="/img/at-par-logo.png"
              alt="atpar"
              width={48}
              height={48}
              className="w-12 h-12"
            />
          </div>
          <DialogTitle className="text-center">Welcome to atpar</DialogTitle>
          <DialogDescription className="text-center">
            Sign in to your account or create a new one
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          {/* OAuth Error Message */}
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-100 text-red-600 text-sm">
              {error}
            </div>
          )}
          
          <Tabs defaultValue={defaultTab}>
            <TabsList>
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Sign up</TabsTrigger>
            </TabsList>
            <TabsContent value="signin">
              <SignInForm />
            </TabsContent>
            <TabsContent value="signup">
              <SignUpForm />
            </TabsContent>
          </Tabs>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

// Hook to easily use the auth modal anywhere
export function useAuthModal(defaultTab?: 'signin' | 'signup') {
  const [open, setOpen] = useState(false);

  const AuthModalComponent = useCallback(() => {
    return (
      <AuthModal
        open={open}
        onOpenChange={setOpen}
        defaultTab={defaultTab}
      />
    );
  }, [open, defaultTab]);

  return useMemo(
    () => ({
      open,
      setOpen,
      AuthModal: AuthModalComponent,
    }),
    [open, AuthModalComponent]
  );
}
