'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/components/auth/auth-provider';

export function Nav() {
  const { openSignUp } = useAuth();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 px-4 md:px-8 py-4 bg-[#FAFAF7]/90 backdrop-blur-md border-b border-[#F5F5F0]">
      <div className="max-w-[1200px] mx-auto flex justify-between items-center">
        <Link 
          href="/" 
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
        >
          <Image 
            src="/img/at-par-logo.png" 
            alt="atpar" 
            width={36} 
            height={36}
            className="w-9 h-9"
          />
          <span className="font-display text-2xl font-semibold text-[#0D7377] tracking-tight">
            atpar
          </span>
        </Link>
        
        <div className="flex items-center gap-6 md:gap-10">
          <Link 
            href="#how-it-works" 
            className="hidden md:block text-[#3D3835] text-base font-medium hover:text-[#0D7377] transition-colors"
          >
            How it works
          </Link>
          <Link 
            href="#pricing" 
            className="hidden md:block text-[#3D3835] text-base font-medium hover:text-[#0D7377] transition-colors"
          >
            Pricing
          </Link>
          <Link 
            href="#faq" 
            className="hidden md:block text-[#3D3835] text-base font-medium hover:text-[#0D7377] transition-colors"
          >
            FAQ
          </Link>
          <Button 
            onClick={openSignUp}
            className="bg-[#F59E0B] text-[#1C1917] font-semibold hover:bg-[#D97706] hover:-translate-y-0.5 hover:shadow-lg hover:shadow-amber-500/30 transition-all rounded-lg px-5 py-2"
          >
            Start free trial
          </Button>
        </div>
      </div>
    </nav>
  );
}
