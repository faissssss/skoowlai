'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { LayoutDashboard, Settings, Menu, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { cn } from '@/lib/utils';
import { useState, useEffect, useSyncExternalStore, type ComponentType } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import PricingModal from '@/components/PricingModal';
import { IS_PRE_LAUNCH } from '@/lib/config';
import WelcomeModal from '@/components/PreLaunchWelcomeModal';
import { AnimatedThemeToggler } from '@/components/ui/animated-theme-toggler';
import { AnimatedDockButton } from '@/components/ui/animated-dock-button';
import SiteBanner from '@/components/SiteBanner';
type NavItem = { href: string; label: string; icon: ComponentType<{ className?: string }> };

interface SidebarContentProps {
  mobile?: boolean;
  onItemClick?: () => void;
  isCollapsed: boolean;
  setIsCollapsed: (v: boolean) => void;
  pathname: string;
  navItems: NavItem[];
  setIsPricingOpen: (open: boolean) => void;
  IS_PRE_LAUNCH: boolean;
}

function SidebarContent({
  mobile = false,
  onItemClick,
  isCollapsed,
  setIsCollapsed,
  pathname,
  navItems,
  setIsPricingOpen,
  IS_PRE_LAUNCH,
}: SidebarContentProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Sidebar Header with Toggle */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-start">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={cn(!mobile && "flex")}
        >
          <Menu className="w-5 h-5" />
        </Button>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 p-4 space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link key={item.href} href={item.href} onClick={onItemClick}>
              <AnimatedDockButton className="w-full">
                <Button
                  variant={isActive ? "secondary" : "ghost"}
                  className={cn(
                    "w-full gap-3 transition-all duration-300 justify-start",
                    isActive && "bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400"
                  )}
                  title={isCollapsed && !mobile ? item.label : undefined}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  <AnimatePresence mode="wait">
                    {(!isCollapsed || mobile) && (
                      <motion.span
                        initial={{ opacity: 0, width: 0 }}
                        animate={{ opacity: 1, width: "auto" }}
                        exit={{ opacity: 0, width: 0 }}
                        transition={{ duration: 0.2 }}
                        className="whitespace-nowrap overflow-hidden"
                      >
                        {item.label}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </Button>
              </AnimatedDockButton>
            </Link>
          );
        })}
      </nav>

      {/* Upgrade Plan Button - Hidden during pre-launch */}
      {!IS_PRE_LAUNCH && (
        <div className={cn("p-4 border-t border-slate-200 dark:border-slate-800")}>
          <AnimatedDockButton className="w-full">
            <Button
              onClick={() => {
                setIsPricingOpen(true);
                if (mobile && onItemClick) onItemClick();
              }}
              className={cn(
                "w-full gap-2 bg-linear-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white shadow-lg shadow-purple-500/25 justify-center"
              )}
              title={isCollapsed && !mobile ? "Upgrade to Pro" : undefined}
            >
              <Crown className="w-4 h-4 shrink-0" />
              <AnimatePresence mode="wait">
                {(!isCollapsed || mobile) && (
                  <motion.span
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: "auto" }}
                    exit={{ opacity: 0, width: 0 }}
                    transition={{ duration: 0.2 }}
                    className="whitespace-nowrap overflow-hidden"
                  >
                    Upgrade to Pro
                  </motion.span>
                )}
              </AnimatePresence>
            </Button>
          </AnimatedDockButton>
        </div>
      )}
    </div>
  );
}

export default function DashboardLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isPricingOpen, setIsPricingOpen] = useState(false);
  const mounted = useSyncExternalStore(
    () => () => { },
    () => true,
    () => false
  );

  const navItems = [
    { href: '/dashboard', label: 'Home', icon: LayoutDashboard },
    { href: '/dashboard/settings', label: 'Settings', icon: Settings },
  ];

  /* removed inline SidebarContent to satisfy react-hooks/static-components */

  // When routed with ?billing=1, we:
  // 1) Set the pricing modal open state.
  // 2) Clean the URL so the modal doesn't auto-reopen on future renders.
  useEffect(() => {
    if (!searchParams) return;
    if (searchParams.get('billing') === '1') {
      // Open the pricing modal first
      setIsPricingOpen(true);
      // Then remove the billing param from the URL to avoid reopening on navigation
      const params = new URLSearchParams(searchParams.toString());
      params.delete('billing');
      const qs = params.toString();
      const nextUrl = qs ? `${pathname}?${qs}` : pathname;
      router.replace(nextUrl);
    }
  }, [searchParams, pathname, router]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex">
      <SiteBanner />
      {/* Desktop Sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: isCollapsed ? 80 : 256 }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className="hidden md:block bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 fixed inset-y-0 z-30"
        style={{ top: 'var(--banner-h, 0px)' }}
      >
        <SidebarContent
          isCollapsed={isCollapsed}
          setIsCollapsed={setIsCollapsed}
          pathname={pathname}
          navItems={navItems}
          setIsPricingOpen={setIsPricingOpen}
          IS_PRE_LAUNCH={IS_PRE_LAUNCH}
        />
      </motion.aside>

      {/* Mobile Sidebar */}
      <div
        className="md:hidden fixed left-4 z-40"
        style={{ top: 'calc(var(--banner-h, 0px) + 1rem)' }}
      >
        <Sheet open={mounted && isMobileOpen} onOpenChange={setIsMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon">
              <Menu className="w-5 h-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-64">
            <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
            <SidebarContent
              mobile
              onItemClick={() => setIsMobileOpen(false)}
              isCollapsed={isCollapsed}
              setIsCollapsed={setIsCollapsed}
              pathname={pathname}
              navItems={navItems}
              setIsPricingOpen={setIsPricingOpen}
              IS_PRE_LAUNCH={IS_PRE_LAUNCH}
            />
          </SheetContent>
        </Sheet>
      </div>

      {/* Main Content */}
      <motion.main
        initial={false}
        animate={{ marginLeft: isCollapsed ? 80 : 256 }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className="flex-1 min-h-screen hidden md:block relative"
      >
        {/* Top Right Theme Toggle */}
        <div className="absolute right-8 z-10" style={{ top: '1rem' }}>
          <AnimatedThemeToggler className="inline-flex items-center justify-center size-9 rounded-md text-slate-500 dark:text-slate-400 hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50 transition-all" />
        </div>
        {children}
      </motion.main>

      <main className="flex-1 min-h-screen md:hidden relative">
        {/* Top Right Theme Toggle for Mobile */}
        <div className="absolute right-4 z-10" style={{ top: '1rem' }}>
          <AnimatedThemeToggler className="inline-flex items-center justify-center size-9 rounded-md text-slate-500 dark:text-slate-400 hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50 transition-all" />
        </div>
        {children}
      </main>

      {/* Pricing Modal */}
      <PricingModal
        isOpen={isPricingOpen}
        onClose={() => setIsPricingOpen(false)}
      />

      {/* Welcome Modal - shows once for new and existing users */}
      <WelcomeModal />
    </div>
  );
}
