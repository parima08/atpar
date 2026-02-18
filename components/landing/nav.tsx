'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { mutate } from 'swr';
import { Settings, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/components/auth/auth-provider';
import { signOut } from '@/app/(login)/actions';

export function Nav() {
  const { user, isLoading, openSignUp } = useAuth();
  const router = useRouter();

  async function handleSignOut() {
    await signOut();
    mutate('/api/user');
    router.push('/');
  }

  const getInitials = (email: string | null | undefined) => {
    if (!email) return '?';
    return email.charAt(0).toUpperCase();
  };

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
          
          {isLoading ? (
            <div className="w-9 h-9 rounded-full bg-[#E6F4F4] animate-pulse" />
          ) : user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 hover:opacity-80 transition-opacity focus:outline-none">
                  <Avatar className="h-9 w-9 cursor-pointer">
                    <AvatarImage alt={user.name || ''} />
                    <AvatarFallback className="bg-[#E6F4F4] text-[#0D7377] text-sm font-medium">
                      {user.name 
                        ? user.name.split(' ').map((n) => n[0]).join('').toUpperCase()
                        : getInitials(user.email)}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-2 py-1.5 text-sm">
                  <p className="font-medium text-[#3D3835]">{user.name || 'Account'}</p>
                  <p className="text-xs text-[#3D3835]/60 truncate">{user.email}</p>
                </div>
                <DropdownMenuItem asChild className="cursor-pointer">
                  <Link href="/sync" className="flex items-center">
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Dashboard</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={handleSignOut}
                  className="cursor-pointer text-red-600 focus:text-red-600"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button 
              onClick={openSignUp}
              className="bg-[#F59E0B] text-[#1C1917] font-semibold hover:bg-[#D97706] hover:-translate-y-0.5 hover:shadow-lg hover:shadow-amber-500/30 transition-all rounded-lg px-5 py-2"
            >
              Get started
            </Button>
          )}
        </div>
      </div>
    </nav>
  );
}
