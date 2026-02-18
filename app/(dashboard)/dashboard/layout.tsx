'use client';

import { use } from 'react';

export default function DashboardLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params?: Promise<Record<string, string | string[]>>;
}) {
  if (params) use(params);
  return (
    <div className="min-h-screen">
      {/* Content */}
      <div className="max-w-5xl mx-auto">
        {children}
      </div>
    </div>
  );
}
