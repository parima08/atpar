'use client';

import { useState } from 'react';
import { Loader2, ChevronLeft, Mail } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { requestPasswordReset } from '@/lib/auth/password-reset';

interface ForgotPasswordModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBackClick: () => void;
}

export function ForgotPasswordModal({
  open,
  onOpenChange,
  onBackClick,
}: ForgotPasswordModalProps) {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const result = await requestPasswordReset({ email });

    setIsLoading(false);

    if (result.success) {
      setSubmitted(true);
      // Auto close after 5 seconds
      setTimeout(() => {
        setEmail('');
        setSubmitted(false);
        onOpenChange(false);
      }, 5000);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <button
              onClick={onBackClick}
              className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Back"
            >
              <ChevronLeft className="w-5 h-5 text-[#1C1917]" />
            </button>
            <div className="flex-1">
              <DialogTitle className="text-left">Reset your password</DialogTitle>
            </div>
          </div>
          <DialogDescription className="text-left">
            Enter your email and we&apos;ll send you a link to reset your password
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          {submitted ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-full bg-[#E6F4F4] flex items-center justify-center mx-auto mb-4">
                <Mail className="w-8 h-8 text-[#0D7377]" />
              </div>
              <h3 className="font-semibold text-[#1C1917] mb-2">Check your email</h3>
              <p className="text-sm text-[#78716C]">
                We&apos;ve sent a password reset link to {email}
              </p>
              <p className="text-xs text-[#78716C] mt-3">
                The link will expire in 1 hour.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reset-email" className="text-[#3D3835] font-medium">
                  Email address
                </Label>
                <Input
                  id="reset-email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  maxLength={50}
                  className="h-11 rounded-xl border-[#E7E5E4] focus:border-[#0D7377] focus:ring-[#0D7377]/20"
                />
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-11 bg-[#F59E0B] text-[#1C1917] font-semibold hover:bg-[#D97706] rounded-xl transition-all"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  'Send reset link'
                )}
              </Button>
            </form>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
