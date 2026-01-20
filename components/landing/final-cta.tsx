'use client';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/components/auth/auth-provider';

export function FinalCTA() {
  const { openSignUp } = useAuth();

  return (
    <section className="py-32 px-4 md:px-8 text-center bg-gradient-to-b from-[#E6F4F4] via-[#FDF7EA] to-white border-t border-[#F5F5F0]">
      <div className="max-w-[1100px] mx-auto">
        <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-semibold leading-tight tracking-tight mb-4">
          Keep your tools at parity
        </h2>
        <p className="text-lg md:text-xl text-[#57534E] mb-8">
          Spend less time managing systems. Spend more time building.
        </p>
        <Button 
          onClick={openSignUp}
          className="bg-[#F59E0B] text-[#1C1917] font-semibold hover:bg-[#D97706] hover:-translate-y-0.5 hover:shadow-lg hover:shadow-amber-500/30 transition-all rounded-lg px-8 py-4 h-auto text-lg"
        >
          Start your 14-day free trial
        </Button>
      </div>
    </section>
  );
}
