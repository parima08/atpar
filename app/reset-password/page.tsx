'use client';

import { useState, useSearchParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { Loader2, Eye, EyeOff, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { resetPassword } from '@/lib/auth/password-reset';
import { Suspense } from 'react';

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: '',
  });
  const [status, setStatus] = useState<{
    type: 'success' | 'error' | null;
    message: string;
  }>({
    type: null,
    message: '',
  });

  if (!token) {
    return (
      <div className="min-h-screen bg-[#FAFAF7] flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-2xl p-8 border border-[#E7E5E4] shadow-sm">
          <div className="text-center">
            <h1 className="text-2xl font-semibold text-[#1C1917] mb-2">Invalid Link</h1>
            <p className="text-[#78716C] mb-6">
              This password reset link is invalid or has expired.
            </p>
            <Button
              onClick={() => router.push('/sign-in')}
              className="w-full h-11 bg-[#F59E0B] text-[#1C1917] font-semibold hover:bg-[#D97706] rounded-xl"
            >
              Back to Sign In
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setStatus({ type: null, message: '' });

    const result = await resetPassword({
      token,
      password: formData.password,
      confirmPassword: formData.confirmPassword,
    });

    setIsLoading(false);

    if (result.success) {
      setStatus({
        type: 'success',
        message: result.message || 'Password reset successful!',
      });
      setTimeout(() => {
        router.push('/sign-in');
      }, 2000);
    } else {
      setStatus({
        type: 'error',
        message: result.error || 'Failed to reset password',
      });
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAF7] flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-2xl p-8 border border-[#E7E5E4] shadow-sm">
        {status.type === 'success' ? (
          <div className="text-center py-4">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
            </div>
            <h1 className="text-2xl font-semibold text-[#1C1917] mb-2">Success!</h1>
            <p className="text-[#78716C]">{status.message}</p>
            <p className="text-xs text-[#999] mt-4">Redirecting to sign in...</p>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <h1 className="text-2xl font-semibold text-[#1C1917] mb-2">
                Create new password
              </h1>
              <p className="text-[#78716C] text-sm">
                Enter your new password below
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password" className="text-[#3D3835] font-medium">
                  New Password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Create a password (min 8 characters)"
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
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
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-[#3D3835] font-medium">
                  Confirm Password
                </Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="Confirm your password"
                    value={formData.confirmPassword}
                    onChange={(e) =>
                      setFormData({ ...formData, confirmPassword: e.target.value })
                    }
                    required
                    minLength={8}
                    maxLength={100}
                    className="h-11 rounded-xl border-[#E7E5E4] focus:border-[#0D7377] focus:ring-[#0D7377]/20 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#78716C] hover:text-[#1C1917] transition-colors"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {status.type === 'error' && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-red-600 text-sm">
                  {status.message}
                </div>
              )}

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-11 bg-[#F59E0B] text-[#1C1917] font-semibold hover:bg-[#D97706] rounded-xl transition-all"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Resetting...
                  </>
                ) : (
                  'Reset password'
                )}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#FAFAF7]" />}>
      <ResetPasswordContent />
    </Suspense>
  );
}
