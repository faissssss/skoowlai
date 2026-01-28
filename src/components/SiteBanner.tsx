'use client';

import { useState, useEffect, useRef, useSyncExternalStore } from 'react';
import dynamic from 'next/dynamic';
import { useUser } from '@clerk/nextjs';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

// Helper to safely check if we're on the client
const useIsMounted = () => useSyncExternalStore(
  () => () => { },
  () => true,
  () => false
);

// Inner component keyed by storageKey so it re-initializes on auth changes (login/sign-up)
function BannerInner({ storageKey }: { storageKey: string }) {
  const isMounted = useIsMounted();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Start with null to indicate "not yet determined" - prevents flash
  const [show, setShow] = useState<boolean | null>(null);
  
  // Track initial render for animation
  const [isInitialRender, setIsInitialRender] = useState(true);

  // Read from localStorage only after mount to avoid hydration issues
  useEffect(() => {
    try {
      const dismissed = localStorage.getItem(storageKey) === '1';
      setShow(!dismissed);
    } catch {
      setShow(true);
    }
    
    // After first mount, mark as not initial render for future navigations
    const timer = setTimeout(() => setIsInitialRender(false), 600);
    return () => clearTimeout(timer);
  }, [storageKey]);

  // Expose the current banner height via CSS variable so fixed elements can offset
  const bannerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const setVar = (h: number) => {
      try {
        document.documentElement.style.setProperty('--banner-h', `${h}px`);
      } catch {
        /* no-op */
      }
    };

    if (!show) {
      setVar(0);
      return;
    }

    const update = () => {
      const h = bannerRef.current?.offsetHeight ?? 0;
      setVar(h);
    };

    update();
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('resize', update);
      setVar(0);
    };
  }, [show]);

  const onClose = () => {
    try {
      localStorage.setItem(storageKey, '1');
    } catch {
      // ignore storage errors
    }
    setShow(false);
  };

  // Don't render anything until we've determined the show state
  if (!isMounted || show === null) return null;

  // Determine if we're already on the billing page
  const isOnBilling = pathname === '/dashboard' && searchParams?.get('billing') === '1';

  return (
    <AnimatePresence mode="wait">
      {show && (
        <motion.div
          ref={bannerRef}
          // Smooth slide-down animation only on initial render
          initial={isInitialRender ? { y: -60, opacity: 0 } : false}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -60, opacity: 0 }}
          transition={{
            type: 'spring',
            stiffness: 260,
            damping: 25,
            mass: 0.8,
          }}
          className="fixed top-0 inset-x-0 z-60"
        >
          <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 text-white">
            <div className="container mx-auto px-4">
              <div className="py-2.5 flex items-center justify-between gap-4">
                {/* Left: Text Content */}
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-lg">🎉</span>
                  <div className="min-w-0">
                    <span className="font-medium text-sm sm:text-base">Start your 14‑day free trial!</span>
                    <span className="hidden sm:inline text-white/80 text-sm ml-2">
                      Get 14 days of full access to all premium features
                    </span>
                  </div>
                </div>

                {/* Right: Button + Close */}
                <div className="flex items-center gap-2 shrink-0">
                  <Link
                    href="/dashboard?billing=1"
                    className={`inline-flex items-center justify-center rounded-full bg-white text-indigo-600 px-4 py-1.5 text-sm font-semibold shadow-sm transition-all duration-200 min-w-[120px] ${
                      isOnBilling 
                        ? 'opacity-70 cursor-default' 
                        : 'hover:bg-white/90 hover:scale-105 active:scale-95'
                    }`}
                    onClick={(e) => {
                      // If already on billing, prevent navigation and just scroll/focus
                      if (isOnBilling) {
                        e.preventDefault();
                      }
                    }}
                  >
                    Start Free Trial
                  </Link>
                  <button
                    aria-label="Close banner"
                    onClick={onClose}
                    className="p-1.5 rounded-full hover:bg-white/20 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Client-only banner component with persistent dismissal
function SiteBannerClient() {
  const { user, isLoaded } = useUser();

  // Wait for Clerk to load before determining the storage key
  // This prevents the key from changing from 'guest' to the user ID
  if (!isLoaded) return null;

  const uid = user?.id ?? 'guest';
  const storageKey = `site-banner:trial-14d:${uid}:dismissed`;
  return <BannerInner key={storageKey} storageKey={storageKey} />;
}

// Export as a client-only dynamic component to disable SSR
const SiteBanner = dynamic(() => Promise.resolve(SiteBannerClient), { ssr: false });
export default SiteBanner;
