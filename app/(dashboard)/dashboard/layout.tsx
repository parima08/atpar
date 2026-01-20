'use client';

export default function DashboardLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      {/* Content */}
      <div className="max-w-5xl mx-auto">
        {children}
      </div>
    </div>
  );
}
