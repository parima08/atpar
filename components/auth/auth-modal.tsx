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
import { ForgotPasswordModal } from './forgot-password-modal';

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

// Notion logo (compact)
function NotionLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6.017 4.313l55.333-4.087c6.797-.583 8.543-.19 12.817 2.917l17.663 12.443c2.913 2.14 3.883 2.723 3.883 5.053v68.243c0 4.277-1.553 6.807-6.99 7.193L24.467 99.967c-4.08.193-6.023-.39-8.16-3.113L3.3 79.94c-2.333-3.113-3.3-5.443-3.3-8.167V11.113c0-3.497 1.553-6.413 6.017-6.8z" fill="#fff"/>
      <path fillRule="evenodd" clipRule="evenodd" d="M61.35.227l-55.333 4.087C1.553 4.7 0 7.617 0 11.113v60.66c0 2.723.967 5.053 3.3 8.167l13.007 16.913c2.137 2.723 4.08 3.307 8.16 3.113l64.257-3.89c5.437-.387 6.99-2.917 6.99-7.193V20.64c0-2.21-.873-2.847-3.443-4.733L74.167 3.143C69.893.033 68.147-.357 61.35.227zM25.505 28.79c-5.33.277-6.547.34-9.593-2.14L8.73 20.83c-.787-.78-.393-1.753 1.36-1.943l53.193-3.887c4.467-.387 6.793.973 8.537 2.333l8.54 6.207c.393.193.973 1.167.193 1.167l-55.043 3.307-.007.777zm-6.597 66.093V39.39c0-2.53.777-3.697 3.103-3.893L86 32.19c2.14-.193 3.107 1.167 3.107 3.693v55.107c0 2.527-.39 4.667-3.883 4.863l-60.377 3.5c-3.493.193-5.163-.967-5.163-4.083l.223-.387zm59.597-54.33c.387 1.75 0 3.5-1.75 3.7l-2.917.553v41.043c-2.53 1.363-4.857 2.14-6.797 2.14-3.107 0-3.883-.973-6.21-3.887l-19.03-29.94v28.967l6.02 1.363s0 3.5-4.857 3.5l-13.39.777c-.39-.78 0-2.723 1.357-3.11l3.497-.97v-38.3L30.48 46.09c-.39-1.75.583-4.277 3.3-4.473l14.357-.97 19.807 30.33V43.563l-5.053-.583c-.39-2.143 1.163-3.7 3.103-3.89l13.907-.557z" fill="#000"/>
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

function NotionSignInButton() {
  const [loading, setLoading] = useState(false);

  const handleClick = () => {
    setLoading(true);
    window.location.href = '/api/auth/notion';
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
          <NotionLogo className="w-5 h-5 mr-2" />
          Continue with Notion
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
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    signIn,
    { error: '' }
  );

  return (
    <>
      <div className="space-y-4">
        <MicrosoftSignInButton />
        <NotionSignInButton />

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
            <div className="flex items-center justify-between">
              <Label htmlFor="signin-password" className="text-[#3D3835] font-medium">
                Password
              </Label>
              <button
                type="button"
                onClick={() => setShowForgotPassword(true)}
                className="text-xs text-[#0D7377] hover:underline font-medium"
              >
                Forgot?
              </button>
            </div>
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

      <ForgotPasswordModal
        open={showForgotPassword}
        onOpenChange={setShowForgotPassword}
        onBackClick={() => setShowForgotPassword(false)}
      />
    </>
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
      <NotionSignInButton />

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
