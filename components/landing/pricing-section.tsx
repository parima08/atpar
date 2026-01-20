'use client';

import { Button } from '@/components/ui/button';
import { Check } from 'lucide-react';
import { useAuth } from '@/components/auth/auth-provider';

const features = [
  'Unlimited users',
  'Unlimited Azure DevOps projects',
  'Unlimited sync volume',
  'Cancel anytime',
];

export function PricingSection() {
  const { openSignUp } = useAuth();

  return (
    <section id="pricing" className="py-24 px-4 md:px-8 text-center scroll-mt-20 bg-gradient-to-b from-[#F7FBFA] via-white to-[#FFF7E6]">
      <div className="max-w-[1100px] mx-auto">
        <span className="text-xs font-semibold uppercase tracking-widest text-[#0D7377] mb-4 inline-flex items-center gap-2 bg-[#E6F4F4] px-3 py-1 rounded-full border border-[#0D7377]/15">
          Pricing
        </span>
        <h2 className="font-display text-3xl md:text-4xl font-semibold leading-tight tracking-tight mb-12">
          Simple pricing. No surprises.
        </h2>
        
        <div className="max-w-[480px] mx-auto p-8 md:p-10 bg-white/90 backdrop-blur rounded-2xl border border-[#E7E5E4] shadow-xl shadow-[#0D7377]/10 relative overflow-hidden">
          {/* Top accent bar */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#0D7377] to-[#F59E0B]" />
          
          <div className="font-display text-5xl md:text-6xl font-bold tracking-tight text-[#0D7377] mb-1">
            $50
          </div>
          <p className="text-[#57534E] mb-6">
            per team / month
          </p>
          <p className="text-base text-[#1C1917] mb-8 pb-8 border-b border-[#F5F5F0]">
            Covers most teams—10 synced databases, unlimited everything else.
          </p>
          
          <ul className="text-left space-y-3 mb-8">
            {features.map((feature, index) => (
              <li key={index} className="flex items-center gap-3 text-[#57534E]">
                <Check className="w-5 h-5 text-[#059669] flex-shrink-0" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
          
          <Button 
            onClick={openSignUp}
            className="w-full bg-[#F59E0B] text-[#1C1917] font-semibold hover:bg-[#D97706] hover:-translate-y-0.5 hover:shadow-lg hover:shadow-amber-500/30 transition-all rounded-lg py-4 h-auto text-base"
          >
            Start 14-day free trial
          </Button>
          
          <p className="mt-4 text-sm text-[#78716C]">
            No credit card required
          </p>
        </div>
        
        <p className="mt-8 text-sm text-[#78716C] max-w-md mx-auto">
          A synced database is a Notion database actively syncing with ADO.<br />
          You can connect and disconnect anytime.
        </p>
      </div>
    </section>
  );
}
