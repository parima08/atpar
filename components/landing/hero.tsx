'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/components/auth/auth-provider';

// Notion icon
function NotionIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ overflow: 'visible' }}>
      <path d="M6.017 4.313l55.333-4.087c6.797-.583 8.543-.19 12.817 2.917l17.663 12.443c2.913 2.14 3.883 2.723 3.883 5.053v68.243c0 4.277-1.553 6.807-6.99 7.193L24.467 99.967c-4.08.193-6.023-.39-8.16-3.113L3.3 79.94c-2.333-3.113-3.3-5.443-3.3-8.167V11.113c0-3.497 1.553-6.413 6.017-6.8z" fill="#fff"/>
      <path fillRule="evenodd" clipRule="evenodd" d="M61.35.227l-55.333 4.087C1.553 4.7 0 7.617 0 11.113v60.66c0 2.723.967 5.053 3.3 8.167l13.007 16.913c2.137 2.723 4.08 3.307 8.16 3.113l64.257-3.89c5.437-.387 6.99-2.917 6.99-7.193V20.64c0-2.21-.873-2.847-3.443-4.733L74.167 3.143C69.893.033 68.147-.357 61.35.227zM25.505 28.79c-5.33.277-6.547.34-9.593-2.14L8.73 20.83c-.787-.78-.393-1.753 1.36-1.943l53.193-3.887c4.467-.387 6.793.973 8.537 2.333l8.54 6.207c.393.193.973 1.167.193 1.167l-55.043 3.307-.007.777zm-6.597 66.093V39.39c0-2.53.777-3.697 3.103-3.893L86 32.19c2.14-.193 3.107 1.167 3.107 3.693v55.107c0 2.527-.39 4.667-3.883 4.863l-60.377 3.5c-3.493.193-5.163-.967-5.163-4.083l.223-.387zm59.597-54.33c.387 1.75 0 3.5-1.75 3.7l-2.917.553v41.043c-2.53 1.363-4.857 2.14-6.797 2.14-3.107 0-3.883-.973-6.21-3.887l-19.03-29.94v28.967l6.02 1.363s0 3.5-4.857 3.5l-13.39.777c-.39-.78 0-2.723 1.357-3.11l3.497-.97v-38.3L30.48 46.09c-.39-1.75.583-4.277 3.3-4.473l14.357-.97 19.807 30.33V43.563l-5.053-.583c-.39-2.143 1.163-3.7 3.103-3.89l13.907-.557z" fill="#000"/>
    </svg>
  );
}

// Azure DevOps icon
function AzureDevOpsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ overflow: 'visible' }}>
      <path d="M0 11.865v8.604l5.469 4.078 15.312-4.896v5.313l6.875-5.313-22.396-3.943V6l-5.26 5.865z" fill="#0078D7"/>
      <path d="M9.479 7.109l11.042-4.37v4.161L31 10.255v11.979l-4.219 3.349V10.839L9.479 7.109z" fill="#0078D7"/>
    </svg>
  );
}

export function Hero() {
  const { openSignUp } = useAuth();

  return (
    <section className="pt-40 pb-16 px-4 md:px-8 text-center">
      <div className="max-w-[1100px] mx-auto">
        {/* Badge with icons */}
        <div className="inline-flex items-center gap-3 px-5 py-2.5 bg-[#E6F4F4] border border-[#0D7377]/20 rounded-full text-sm text-[#0D7377] font-medium mb-6 animate-fadeInUp">
          <div className="flex items-center gap-2">
            <AzureDevOpsIcon className="w-5 h-5 flex-shrink-0" />
            <span>Azure DevOps</span>
          </div>
          <span className="text-[#0D7377]/60">↔</span>
          <div className="flex items-center gap-2">
            <NotionIcon className="w-5 h-5 flex-shrink-0" />
            <span>Notion</span>
          </div>
        </div>
        
        {/* Headline */}
        <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-semibold leading-[1.1] tracking-tight mb-6 animate-fadeInUp-delay-1">
          Stop being your team&apos;s<br />sync bot
        </h1>
        
        {/* Subheadline */}
        <p className="text-lg md:text-xl text-[#57534E] max-w-[600px] mx-auto mb-10 animate-fadeInUp-delay-2">
          Atpar keeps tasks and status in sync between Azure DevOps and Notion—so your team can work where they want, without copying things between tools.
        </p>
        
        {/* CTAs */}
        <div className="flex flex-wrap gap-4 justify-center mb-4 animate-fadeInUp-delay-3">
          <Button 
            onClick={openSignUp}
            className="bg-[#F59E0B] text-[#1C1917] font-semibold hover:bg-[#D97706] hover:-translate-y-0.5 hover:shadow-lg hover:shadow-amber-500/30 transition-all rounded-lg px-6 py-3 h-auto text-base"
          >
            Get started with AtPar Pro
          </Button>
          <Button 
            asChild
            variant="outline"
            className="bg-white text-[#1C1917] font-semibold border-[#E7E5E4] hover:border-[#0D7377] hover:text-[#0D7377] transition-all rounded-lg px-6 py-3 h-auto text-base"
          >
            <Link href="#how-it-works">See how it works</Link>
          </Button>
        </div>
        
        {/* Note */}
        <p className="text-sm text-[#78716C] animate-fadeInUp-delay-4">
          Cancel anytime
        </p>
        
        {/* Product Preview */}
        <div className="mt-16 animate-fadeInUp-delay-5">
          <div className="bg-white border border-[#E7E5E4] rounded-2xl p-6 md:p-8 shadow-sm shadow-[#0D7377]/5">
            <video
              className="rounded-xl w-full h-auto"
              controls
              autoPlay
              muted
              loop
              playsInline
            >
              <source src="/img/atpar-demo.mp4" type="video/mp4" />
              Your browser does not support the video tag.
            </video>
          </div>
        </div>
      </div>
    </section>
  );
}
