'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, Check, ArrowRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { VisuallyHidden } from 'radix-ui';

interface TrialExpiredModalProps {
  isOpen: boolean;
  expiredAt?: Date;
}

export function TrialExpiredModal({ isOpen, expiredAt }: TrialExpiredModalProps) {
  const router = useRouter();
  const [dismissed, setDismissed] = useState(false);

  // Reset dismissed state when isOpen changes to true
  useEffect(() => {
    if (isOpen) {
      setDismissed(false);
    }
  }, [isOpen]);

  const handleClose = () => {
    setDismissed(true);
  };

  const showModal = isOpen && !dismissed;

  const benefits = [
    'Unlimited syncs between Notion & ADO',
    'Bi-directional real-time updates',
    'Priority email support',
    'Team collaboration features',
  ];

  return (
    <Dialog open={showModal} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent 
        className="sm:max-w-lg p-0 overflow-hidden bg-white border border-[#E7E5E4] shadow-2xl"
      >
        <VisuallyHidden.Root>
          <DialogTitle>Your free trial has ended</DialogTitle>
        </VisuallyHidden.Root>
        
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
          aria-label="Close"
        >
          <X className="w-4 h-4 text-white" />
        </button>

        {/* Header with gradient */}
        <div className="relative bg-gradient-to-br from-[#0D7377] to-[#0A5C5F] px-8 pt-10 pb-12 text-center">
          {/* Decorative circles */}
          <div className="absolute top-0 left-0 w-32 h-32 bg-white/5 rounded-full -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 right-0 w-24 h-24 bg-white/5 rounded-full translate-x-1/3 translate-y-1/3" />
          
          <div className="relative">
            <div className="mx-auto mb-4 w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center ring-1 ring-white/20">
              <Sparkles className="w-7 h-7 text-white" />
            </div>
            <h2 className="text-2xl font-semibold text-white mb-2">
              Your free trial has ended
            </h2>
            <p className="text-white/80 text-sm max-w-xs mx-auto">
              Upgrade to keep your Notion and Azure DevOps in perfect sync
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="px-8 py-6">
          {/* Benefits list */}
          <div className="space-y-3 mb-6">
            {benefits.map((benefit, index) => (
              <div key={index} className="flex items-center gap-3">
                <div className="flex-shrink-0 w-5 h-5 rounded-full bg-[#E6F4F4] flex items-center justify-center">
                  <Check className="w-3 h-3 text-[#0D7377]" strokeWidth={3} />
                </div>
                <span className="text-[#1C1917] text-sm">{benefit}</span>
              </div>
            ))}
          </div>

          {/* CTA Button */}
          <Button
            onClick={() => router.push('/pricing')}
            className="w-full h-12 bg-[#0D7377] hover:bg-[#0A5C5F] text-white font-medium rounded-xl transition-all duration-200 shadow-lg shadow-[#0D7377]/20 hover:shadow-xl hover:shadow-[#0D7377]/30 group"
          >
            <span>Upgrade now</span>
            <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-0.5 transition-transform" />
          </Button>

          {/* Footer text */}
          <p className="text-center text-xs text-[#78716C] mt-4">
            Questions? Reach out at{' '}
            <a 
              href="mailto:support@atpar.io" 
              className="text-[#0D7377] hover:underline font-medium"
            >
              support@atpar.io
            </a>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
