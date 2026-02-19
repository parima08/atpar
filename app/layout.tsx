import './globals.css';
import type { Metadata, Viewport } from 'next';
import { DM_Sans, Fraunces } from 'next/font/google';
import { getUser, getTeamForUser } from '@/lib/db/queries';
import { SWRConfig } from 'swr';
import { DevWarningFilter } from '@/components/dev-warning-filter';
import { SupportBadge } from '@/components/support/support-badge';

export const metadata: Metadata = {
  title: 'Atpar — Keep Azure DevOps and Notion at parity',
  description: 'Atpar keeps tasks and status in sync between Azure DevOps and Notion—so your team can work where they want, without copying things between tools.'
};

export const viewport: Viewport = {
  maximumScale: 1
};

const dmSans = DM_Sans({ 
  subsets: ['latin'],
  variable: '--font-dm-sans',
  display: 'swap',
});

const fraunces = Fraunces({ 
  subsets: ['latin'],
  variable: '--font-fraunces',
  display: 'swap',
});

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${dmSans.variable} ${fraunces.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-[100dvh] bg-[#FAFAF7] font-sans text-[#1C1917] antialiased" suppressHydrationWarning>
        <DevWarningFilter />
        <SWRConfig
          value={{
            fallback: {
              // We do NOT await here; components that read this data will suspend.
              // If DB is unreachable (e.g. POSTGRES_URL missing or fetch failed), resolve to null so the app still renders.
              '/api/user': getUser().catch(() => null),
              '/api/team': getTeamForUser().catch(() => null)
            }
          }}
        >
          {children}
          <SupportBadge />
        </SWRConfig>
      </body>
    </html>
  );
}
