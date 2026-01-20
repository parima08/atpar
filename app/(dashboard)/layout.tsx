'use client';

import Link from 'next/link';
import { useState, Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { Home, LogOut, RefreshCcw } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { signOut } from '@/app/(login)/actions';
import { useRouter, usePathname } from 'next/navigation';
import { User } from '@/lib/db/schema';
import useSWR, { mutate } from 'swr';
import { TrialGuard } from '@/components/trial';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

function UserMenu() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { data: user } = useSWR<User>('/api/user', fetcher);
  const router = useRouter();

  async function handleSignOut() {
    await signOut();
    mutate('/api/user');
    router.push('/');
  }

  if (!user) {
    return (
      <>
        <Link
          href="/pricing"
          className="text-sm font-medium text-[#57534E] hover:text-[#0D7377]"
        >
          Pricing
        </Link>
        <Button asChild className="rounded-lg bg-[#F59E0B] text-[#1C1917] hover:bg-[#D97706]">
          <Link href="/sign-up">Sign Up</Link>
        </Button>
      </>
    );
  }

  return (
    <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
      <DropdownMenuTrigger>
        <Avatar className="cursor-pointer size-9">
          <AvatarImage alt={user.name || ''} />
          <AvatarFallback className="bg-[#E6F4F4] text-[#0D7377]">
            {user.email
              .split(' ')
              .map((n) => n[0])
              .join('')}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="flex flex-col gap-1">
        <DropdownMenuItem className="cursor-pointer">
          <Link href="/sync" className="flex w-full items-center">
            <RefreshCcw className="mr-2 h-4 w-4" />
            <span>Sync Dashboard</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem className="cursor-pointer">
          <Link href="/dashboard" className="flex w-full items-center">
            <Home className="mr-2 h-4 w-4" />
            <span>Settings</span>
          </Link>
        </DropdownMenuItem>
        <form action={handleSignOut} className="w-full">
          <button type="submit" className="flex w-full">
            <DropdownMenuItem className="w-full flex-1 cursor-pointer">
              <LogOut className="mr-2 h-4 w-4" />
              <span>Sign out</span>
            </DropdownMenuItem>
          </button>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Header() {
  return (
    <header className="border-b border-[#F5F5F0] bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
        <div className="flex items-center space-x-6">
          <Link href="/" className="flex items-center">
            <span className="font-display text-xl font-semibold text-[#0D7377]">atpar</span>
          </Link>
          <nav className="hidden md:flex items-center space-x-4">
            <Link
              href="/sync"
              className="text-sm font-medium text-[#57534E] hover:text-[#0D7377]"
            >
              Sync Dashboard
            </Link>
            <Link
              href="/sync/config"
              className="text-sm font-medium text-[#57534E] hover:text-[#0D7377]"
            >
              Configuration
            </Link>
            <Link
              href="/sync/mappings"
              className="text-sm font-medium text-[#57534E] hover:text-[#0D7377]"
            >
              Mappings
            </Link>
          </nav>
        </div>
        <div className="flex items-center space-x-4">
          <Suspense fallback={<div className="h-9" />}>
            <UserMenu />
          </Suspense>
        </div>
      </div>
    </header>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isHomepage = pathname === '/';

  // Homepage has its own Nav component, so don't show the Header
  if (isHomepage) {
    return <>{children}</>;
  }

  return (
    <section className="flex flex-col min-h-screen bg-[#FAFAF7]">
      <TrialGuard>
        <Header />
        {children}
      </TrialGuard>
    </section>
  );
}
