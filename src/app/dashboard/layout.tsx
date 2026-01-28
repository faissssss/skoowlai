import { Suspense } from 'react';
import DashboardLayoutClient from './DashboardLayoutClient';

// Force dynamic rendering for all dashboard routes - required because:
// 1. useSearchParams() needs runtime context (no search params at build time)
// 2. Dashboard pages require authentication (cookies/session)
// 3. Child pages access browser APIs like window.location
export const dynamic = "force-dynamic";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={null}>
      <DashboardLayoutClient>{children}</DashboardLayoutClient>
    </Suspense>
  );
}
