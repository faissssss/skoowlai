'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Settings, Menu, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import PricingModal from '@/components/PricingModal';
import { IS_PRE_LAUNCH } from '@/lib/config';

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const [isMobileOpen, setIsMobileOpen] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [isPricingOpen, setIsPricingOpen] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const navItems = [
        { href: '/dashboard', label: 'Home', icon: LayoutDashboard },
        { href: '/dashboard/settings', label: 'Settings', icon: Settings },
    ];

    const SidebarContent = ({ mobile = false }: { mobile?: boolean }) => (
        <div className="flex flex-col h-full">
            {/* Sidebar Header with Toggle */}
            <div className={cn(
                "p-4 border-b border-slate-200 dark:border-slate-800 flex items-center",
                isCollapsed && !mobile ? "justify-center" : "justify-start"
            )}>
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
                        <Link key={item.href} href={item.href}>
                            <Button
                                variant={isActive ? "secondary" : "ghost"}
                                className={cn(
                                    "w-full gap-3 transition-all duration-300",
                                    isActive && "bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400",
                                    isCollapsed && !mobile ? "justify-center px-2" : "justify-start"
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
                        </Link>
                    );
                })}
            </nav>

            {/* Upgrade Plan Button - Hidden during pre-launch */}
            {!IS_PRE_LAUNCH && (
                <div className={cn(
                    "p-4 border-t border-slate-200 dark:border-slate-800",
                    isCollapsed && !mobile ? "flex justify-center" : ""
                )}>
                    <Button
                        onClick={() => setIsPricingOpen(true)}
                        className={cn(
                            "w-full gap-2 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white shadow-lg shadow-purple-500/25",
                            isCollapsed && !mobile ? "px-2" : ""
                        )}
                        title={isCollapsed && !mobile ? "Upgrade Plan" : undefined}
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
                                    Upgrade Plan
                                </motion.span>
                            )}
                        </AnimatePresence>
                    </Button>
                </div>
            )}
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex">
            {/* Desktop Sidebar */}
            <motion.aside
                initial={false}
                animate={{ width: isCollapsed ? 80 : 256 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="hidden md:block bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 fixed inset-y-0 z-30"
            >
                <SidebarContent />
            </motion.aside>

            {/* Mobile Sidebar */}
            <div className="md:hidden fixed top-4 left-4 z-40">
                {mounted && (
                    <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
                        <SheetTrigger asChild>
                            <Button variant="outline" size="icon">
                                <Menu className="w-5 h-5" />
                            </Button>
                        </SheetTrigger>
                        <SheetContent side="left" className="p-0 w-64">
                            <SidebarContent mobile />
                        </SheetContent>
                    </Sheet>
                )}
            </div>

            {/* Main Content */}
            <motion.main
                initial={false}
                animate={{ marginLeft: isCollapsed ? 80 : 256 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="flex-1 min-h-screen hidden md:block relative"
            >
                {/* Top Right Logo */}
                <div className="absolute top-4 right-8 z-10 flex items-center gap-2">
                    <img src="/skoowl-logo.png" alt="skoowl ai" className="w-8 h-8" />
                    <span className="font-bold text-xl text-slate-900 dark:text-white">skoowl ai</span>
                </div>
                {children}
            </motion.main>

            {/* Mobile Main Content */}
            <main className="flex-1 min-h-screen md:hidden relative">
                {/* Top Right Logo for Mobile */}
                <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
                    <img src="/skoowl-logo.png" alt="skoowl ai" className="w-8 h-8" />
                    <span className="font-bold text-xl text-slate-900 dark:text-white">skoowl ai</span>
                </div>
                {children}
            </main>

            {/* Pricing Modal */}
            <PricingModal isOpen={isPricingOpen} onClose={() => setIsPricingOpen(false)} />
        </div>
    );
}
