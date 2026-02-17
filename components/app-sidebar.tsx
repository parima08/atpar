'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import { RefreshCcw, Settings, LogOut, ChevronRight, Play, Wrench, ArrowLeftRight, History, Users, Shield, Activity, Settings2 } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import useSWR, { mutate } from 'swr';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarSeparator,
} from '@/components/ui/sidebar';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { User } from '@/lib/db/schema';
import { signOut } from '@/app/(login)/actions';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface SyncSubItem {
  title: string;
  id: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface DashboardSubItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  subItems: (SyncSubItem | DashboardSubItem)[];
}

const navItems: NavItem[] = [
  {
    title: 'Sync Dashboard',
    href: '/sync',
    icon: RefreshCcw,
    subItems: [
      { title: 'Run Sync', id: 'run', icon: Play },
      { title: 'Configuration', id: 'config', icon: Wrench },
      { title: 'Mappings', id: 'mappings', icon: ArrowLeftRight },
      { title: 'History', id: 'history', icon: History },
    ] as SyncSubItem[],
  },
  {
    title: 'Account Settings',
    href: '/dashboard',
    icon: Settings,
    subItems: [
      { title: 'Team', href: '/dashboard', icon: Users },
      { title: 'General', href: '/dashboard/general', icon: Settings2 },
      { title: 'Activity', href: '/dashboard/activity', icon: Activity },
      { title: 'Security', href: '/dashboard/security', icon: Shield },
    ] as DashboardSubItem[],
  },
];

function isSyncSubItem(item: SyncSubItem | DashboardSubItem): item is SyncSubItem {
  return 'id' in item;
}

function AppSidebarInner() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: user } = useSWR<User>('/api/user', fetcher);
  
  // Initialize open state for collapsibles based on current path
  const [openItems, setOpenItems] = React.useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    navItems.forEach((item) => {
      const isActive = pathname === item.href || 
        (item.href !== '/' && pathname.startsWith(item.href));
      initial[item.href] = isActive;
    });
    return initial;
  });

  // Update open items when pathname changes
  React.useEffect(() => {
    const newOpenItems: Record<string, boolean> = {};
    navItems.forEach((item) => {
      const isActive = pathname === item.href || 
        (item.href !== '/' && pathname.startsWith(item.href));
      newOpenItems[item.href] = isActive;
    });
    setOpenItems(newOpenItems);
  }, [pathname]);

  async function handleSignOut() {
    await signOut();
    mutate('/api/user');
    router.push('/');
  }

  const scrollToSection = (id: string) => {
    // Navigate to /sync first if not already there
    if (!pathname.startsWith('/sync')) {
      router.push(`/sync#${id}`);
      return;
    }
    const element = document.getElementById(id);
    if (element) {
      const headerOffset = 20;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.scrollY - headerOffset;
      window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
    }
  };

  return (
    <Sidebar className="border-r border-sidebar-border">
      <SidebarHeader className="px-4 py-5">
        <Link href="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
          <Image 
            src="/img/at-par-logo.png" 
            alt="atpar" 
            width={32} 
            height={32}
            className="w-8 h-8"
          />
          <span className="font-display text-xl font-semibold text-[#0D7377] tracking-tight">
            atpar
          </span>
        </Link>
      </SidebarHeader>

      <SidebarSeparator />
      
      <SidebarContent className="px-2 py-4">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive = pathname === item.href || 
                  (item.href !== '/' && pathname.startsWith(item.href));
                const isOpen = openItems[item.href] ?? false;
                
                return (
                  <Collapsible
                    key={item.href}
                    open={isOpen}
                    onOpenChange={(open) => setOpenItems(prev => ({ ...prev, [item.href]: open }))}
                    className="group/collapsible"
                  >
                    <SidebarMenuItem>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton
                          isActive={isActive}
                          size="lg"
                          tooltip={item.title}
                          className="h-11 px-3"
                        >
                          <item.icon className="h-5 w-5" />
                          <span className="font-medium flex-1">{item.title}</span>
                          <ChevronRight className="h-4 w-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          {item.subItems?.map((subItem) => {
                            // For sync page, use scroll-to-section
                            if (isSyncSubItem(subItem)) {
                              return (
                                <SidebarMenuSubItem key={subItem.id}>
                                  <SidebarMenuSubButton
                                    onClick={() => scrollToSection(subItem.id)}
                                    className="cursor-pointer"
                                  >
                                    <subItem.icon className="h-4 w-4" />
                                    <span>{subItem.title}</span>
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              );
                            }
                            // For dashboard, use links
                            const isSubActive = pathname === subItem.href;
                            return (
                              <SidebarMenuSubItem key={subItem.href}>
                                <SidebarMenuSubButton
                                  asChild
                                  isActive={isSubActive}
                                >
                                  <Link href={subItem.href}>
                                    <subItem.icon className="h-4 w-4" />
                                    <span>{subItem.title}</span>
                                  </Link>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            );
                          })}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </SidebarMenuItem>
                  </Collapsible>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3 mt-auto">
        <SidebarSeparator className="mb-3" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-3 w-full p-2 rounded-lg hover:bg-sidebar-accent transition-colors text-left">
              <Avatar className="h-9 w-9">
                <AvatarImage alt={user?.name || ''} />
                <AvatarFallback className="bg-[#E6F4F4] text-[#0D7377] text-sm font-medium">
                  {user?.email
                    ?.split(' ')
                    .map((n) => n[0])
                    .join('')
                    .toUpperCase() || '?'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                <p className="text-sm font-medium text-sidebar-foreground truncate">
                  {user?.name || 'Account'}
                </p>
                <p className="text-xs text-sidebar-foreground/60 truncate">
                  {user?.email || ''}
                </p>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top" className="w-56">
            <DropdownMenuItem asChild className="cursor-pointer">
              <Link href="/dashboard" className="flex items-center">
                <Settings className="mr-2 h-4 w-4" />
                <span>Account Settings</span>
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
      </SidebarFooter>
    </Sidebar>
  );
}

// Skeleton component for loading state
function AppSidebarSkeleton() {
  return (
    <div className="flex h-full w-64 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="px-4 py-5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded bg-gray-200 animate-pulse" />
          <div className="w-16 h-6 rounded bg-gray-200 animate-pulse" />
        </div>
      </div>
      <div className="mx-2 h-px bg-sidebar-border" />
      <div className="flex-1 px-2 py-4 space-y-2">
        <div className="h-11 rounded-md bg-gray-100 animate-pulse" />
        <div className="h-11 rounded-md bg-gray-100 animate-pulse" />
      </div>
      <div className="p-3 mt-auto">
        <div className="h-px bg-sidebar-border mb-3" />
        <div className="flex items-center gap-3 p-2">
          <div className="w-9 h-9 rounded-full bg-gray-200 animate-pulse" />
          <div className="flex-1 space-y-1">
            <div className="h-4 w-20 rounded bg-gray-200 animate-pulse" />
            <div className="h-3 w-32 rounded bg-gray-200 animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}

// Export a dynamically imported version that skips SSR to avoid hydration mismatches
// caused by Radix UI's useId generating different IDs on server vs client
export const AppSidebar = dynamic(
  () => Promise.resolve(AppSidebarInner),
  { 
    ssr: false,
    loading: () => <AppSidebarSkeleton />
  }
);
