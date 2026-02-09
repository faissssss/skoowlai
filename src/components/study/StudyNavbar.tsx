import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Menu, X, Crown } from 'lucide-react';
import { AnimatedDockButton } from '@/components/ui/animated-dock-button';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { IS_PRE_LAUNCH } from '@/lib/config';

interface NavItem {
    href: string;
    label: string;
    icon: React.ElementType;
}

interface StudyNavbarProps {
    navItems: NavItem[];
    isSidebarCollapsed: boolean;
    toggleSidebar: () => void;
    isMobileSidebarOpen: boolean;
    setIsMobileSidebarOpen: (isOpen: boolean) => void;
    setIsPricingOpen: (isOpen: boolean) => void;
}

export function StudyNavbar({
    navItems,
    isSidebarCollapsed,
    toggleSidebar,
    isMobileSidebarOpen,
    setIsMobileSidebarOpen,
    setIsPricingOpen
}: StudyNavbarProps) {
    const pathname = usePathname();

    return (
        <>
            {/* Mobile Sidebar Overlay */}
            <AnimatePresence>
                {isMobileSidebarOpen && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/50 z-40 md:hidden"
                            onClick={() => setIsMobileSidebarOpen(false)}
                        />
                        {/* Mobile Drawer */}
                        <motion.aside
                            initial={{ x: -280 }}
                            animate={{ x: 0 }}
                            exit={{ x: -280 }}
                            transition={{ duration: 0.3, ease: "easeInOut" }}
                            className="fixed left-0 top-0 bottom-0 w-[280px] bg-card border-r border-border z-50 md:hidden flex flex-col"
                        >
                            {/* Mobile Drawer Header */}
                            <div className="p-4 border-b border-border flex items-center justify-between">
                                <Link href="/dashboard" className="flex items-center gap-2 text-muted-foreground">
                                    <ArrowLeft className="w-4 h-4" />
                                    <span className="text-sm font-medium">Back to Dashboard</span>
                                </Link>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setIsMobileSidebarOpen(false)}
                                >
                                    <X className="w-5 h-5" />
                                </Button>
                            </div>

                            {/* Mobile Navigation Items */}
                            <nav className="flex-1 p-4 space-y-2">
                                {navItems.map((item) => {
                                    const Icon = item.icon;
                                    const isActive = pathname === item.href;
                                    return (
                                        <Link key={item.href} href={item.href} onClick={() => setIsMobileSidebarOpen(false)}>
                                            <AnimatedDockButton className="relative w-full">
                                                {/* Sliding active indicator */}
                                                {isActive && (
                                                    <motion.div
                                                        layoutId="mobile-sidebar-active-indicator"
                                                        className="absolute inset-0 bg-primary/10 rounded-md"
                                                        transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                                                    />
                                                )}
                                                <Button
                                                    variant="ghost"
                                                    className={cn(
                                                        "w-full gap-3 justify-start relative z-10",
                                                        isActive && "text-primary"
                                                    )}
                                                >
                                                    <Icon className="w-5 h-5 shrink-0" strokeWidth={1.5} />
                                                    <span>{item.label}</span>
                                                </Button>
                                            </AnimatedDockButton>
                                        </Link>
                                    );
                                })}
                            </nav>

                            {/* Mobile Upgrade Button - Hidden during pre-launch */}
                            {!IS_PRE_LAUNCH && (
                                <div className="p-4 border-t border-border">
                                    <Button
                                        onClick={() => { setIsPricingOpen(true); setIsMobileSidebarOpen(false); }}
                                        className="w-full gap-2 bg-linear-to-r from-(--brand-primary) to-(--brand-secondary) hover:from-(--brand-primary-dark) hover:to-(--brand-primary) text-white shadow-lg shadow-black/20"
                                    >
                                        <Crown className="w-4 h-4 shrink-0" />
                                        <span>Upgrade to Pro</span>
                                    </Button>
                                </div>
                            )}
                        </motion.aside>
                    </>
                )}
            </AnimatePresence>

            {/* Desktop Left Sidebar - Floating card style */}
            <motion.aside
                initial={false}
                animate={{ width: isSidebarCollapsed ? 80 : 256 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="hidden md:flex bg-card/95 backdrop-blur-sm border-r border-y border-border/60 flex-col fixed left-0 top-1/2 -translate-y-1/2 h-[70vh] z-20 overflow-y-auto rounded-r-2xl shadow-xl shadow-black/20"
            >
                {/* Sidebar Header with Toggle */}
                <div className="p-4 border-b border-border/60 flex items-center justify-start">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={toggleSidebar}
                    >
                        <Menu className="w-5 h-5" />
                    </Button>
                </div>

                {/* Navigation Items with sliding indicator */}
                <nav className="flex-1 p-4 space-y-2">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = pathname === item.href;
                        return (
                            <Link key={item.href} href={item.href}>
                                <AnimatedDockButton className="relative w-full">
                                    {/* Sliding active indicator */}
                                    {isActive && (
                                        <motion.div
                                            layoutId="sidebar-active-indicator"
                                            className="absolute inset-0 bg-primary/10 rounded-md"
                                            transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                                        />
                                    )}
                                    <Button
                                        variant="ghost"
                                        className={cn(
                                            "w-full gap-3 transition-all duration-300 justify-start relative z-10",
                                            isActive && "text-primary"
                                        )}
                                        title={isSidebarCollapsed ? item.label : undefined}
                                    >
                                        <Icon className="w-5 h-5 shrink-0" strokeWidth={1.5} />
                                        <AnimatePresence mode="wait">
                                            {!isSidebarCollapsed && (
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
                    <div className="p-4 border-t border-border">
                        <AnimatedDockButton className="w-full">
                            <Button
                                onClick={() => setIsPricingOpen(true)}
                                className="w-full gap-2 bg-linear-to-r from-(--brand-primary) to-(--brand-secondary) hover:from-(--brand-primary-dark) hover:to-(--brand-primary) text-white shadow-lg shadow-black/20 justify-center"
                                title={isSidebarCollapsed ? "Upgrade to Pro" : undefined}
                            >
                                <Crown className="w-4 h-4 shrink-0" />
                                <AnimatePresence mode="wait">
                                    {!isSidebarCollapsed && (
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
            </motion.aside>
        </>
    );
}
