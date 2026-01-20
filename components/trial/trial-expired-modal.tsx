'use client';

import { useRouter } from 'next/navigation';
import { Clock, Zap, Shield, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface TrialExpiredModalProps {
  isOpen: boolean;
  expiredAt?: Date;
}

export function TrialExpiredModal({ isOpen, expiredAt }: TrialExpiredModalProps) {
  const router = useRouter();

  const features = [
    { icon: Zap, text: 'Unlimited syncs between Notion & ADO' },
    { icon: Shield, text: 'Priority support' },
    { icon: Users, text: 'Team collaboration' },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent 
        className="sm:max-w-md bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-slate-700 text-white"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-gradient-to-br from-orange-400 to-rose-500 flex items-center justify-center">
            <Clock className="w-8 h-8 text-white" />
          </div>
          <DialogTitle className="text-2xl font-bold text-white">
            Your Trial Has Ended
          </DialogTitle>
          <DialogDescription className="text-slate-300 mt-2">
            {expiredAt && (
              <span className="block text-sm text-slate-400 mb-2">
                Expired on {new Date(expiredAt).toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric'
                })}
              </span>
            )}
            Subscribe now to continue syncing your Notion and Azure DevOps workflows seamlessly.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-6 space-y-3">
          {features.map((feature, index) => (
            <div 
              key={index}
              className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/50 border border-slate-700"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400/20 to-rose-500/20 flex items-center justify-center">
                <feature.icon className="w-4 h-4 text-orange-400" />
              </div>
              <span className="text-sm text-slate-200">{feature.text}</span>
            </div>
          ))}
        </div>

        <div className="mt-6 space-y-3">
          <Button
            onClick={() => router.push('/pricing')}
            className="w-full bg-gradient-to-r from-orange-500 to-rose-500 hover:from-orange-600 hover:to-rose-600 text-white font-semibold py-3 rounded-lg transition-all duration-200 shadow-lg shadow-orange-500/25"
          >
            View Pricing Plans
          </Button>
          <p className="text-center text-xs text-slate-400">
            Questions? <a href="mailto:support@atpar.io" className="text-orange-400 hover:underline">Contact support</a>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
