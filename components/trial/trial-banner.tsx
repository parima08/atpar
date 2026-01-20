'use client';

import Link from 'next/link';
import { AlertTriangle, Clock, Sparkles } from 'lucide-react';
import { TeamAccessStatus } from '@/lib/db/trial';

interface TrialBannerProps {
  accessStatus: TeamAccessStatus;
}

export function TrialBanner({ accessStatus }: TrialBannerProps) {
  if (accessStatus.status === 'active_subscription') {
    return null;
  }

  if (accessStatus.status === 'trial_active') {
    const { daysRemaining } = accessStatus;
    const isUrgent = daysRemaining <= 3;

    return (
      <div
        className={`w-full px-4 py-2.5 flex items-center justify-center gap-2 text-sm font-medium ${
          isUrgent
            ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white'
            : 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white'
        }`}
      >
        <Clock className="w-4 h-4" />
        <span>
          {daysRemaining === 1
            ? 'Your trial ends tomorrow!'
            : daysRemaining === 0
            ? 'Your trial ends today!'
            : `${daysRemaining} days left in your free trial`}
        </span>
        <Link
          href="/pricing"
          className={`ml-2 px-3 py-1 rounded-full text-xs font-semibold transition-all ${
            isUrgent
              ? 'bg-white text-amber-600 hover:bg-amber-50'
              : 'bg-white/20 hover:bg-white/30 text-white'
          }`}
        >
          Upgrade now
        </Link>
      </div>
    );
  }

  if (accessStatus.status === 'trial_expired') {
    return (
      <div className="w-full px-4 py-3 bg-gradient-to-r from-red-500 to-rose-500 text-white flex items-center justify-center gap-2 text-sm font-medium">
        <AlertTriangle className="w-4 h-4" />
        <span>Your trial has expired. Subscribe to continue using the app.</span>
        <Link
          href="/pricing"
          className="ml-2 px-4 py-1.5 bg-white text-red-600 rounded-full text-xs font-semibold hover:bg-red-50 transition-all"
        >
          View plans
        </Link>
      </div>
    );
  }

  return null;
}
