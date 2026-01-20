'use client';

import { usePathname } from 'next/navigation';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app-sidebar';
import { TrialGuard } from '@/components/trial';

export default function Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isHomepage = pathname === '/';

  // Homepage has its own Nav component, so don't show the sidebar
  if (isHomepage) {
    return <>{children}</>;
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="bg-[#FAFAF7]">
        {/* Mobile header with sidebar trigger */}
        <header className="flex h-14 items-center gap-4 border-b border-[#F5F5F0] bg-white px-4 md:hidden">
          <SidebarTrigger className="-ml-1" />
          <span className="font-display text-lg font-semibold text-[#0D7377]">atpar</span>
        </header>
        
        <main className="flex-1 overflow-y-auto">
          <TrialGuard>
            {children}
          </TrialGuard>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
