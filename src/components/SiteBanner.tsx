'use client';

import { useState, useEffect, useRef, useSyncExternalStore } from 'react';
import dynamic from 'next/dynamic';
import { useUser } from '@clerk/nextjs';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

// Helper to safely check if we're on the client
const useIsMounted = () => useSyncExternalStore(
  () => () => { },
  () => true,
  () => false
);

// Track if animation has played this session to prevent re-animation on navigation
const animationPlayedKey = 'banner-animated-session';

// Inner component keyed by storageKey so it re-initializes on auth changes (login/sign-up)
function BannerInner({ storageKey }: { storageKey: string }) {
  const isMounted = useIsMounted();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  // Start with null to indicate "not yet determined" - prevents flash
  const [show, setShow] = useState<boolean | null>(null);
  
  // Check if animation already played this session
  const [hasAnimated, setHasAnimated] = useState(false);

  // Read from localStorage only after mount to avoid hydration issues
  useEffect(() => {
    try {
      const dismissed = localStorage.getItem(storageKey) === '1';
      const alreadyAnimated = sessionStorage.getItem(animationPlayedKey) === '1';
      setHasAnimated(alreadyAnimated);
      setShow(!dismissed);
      // Mark animation as played after first render
      if (!dismissed && !alreadyAnimated) {
        sessionStorage.setItem(animationPlayedKey, '1');
      }
    } catch {
      setShow(true);
    }
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

  const handleStartTrial = () => {
    setIsLoading(true);
    // Use router.push for smoother client-side navigation
    router.push('/dashboard?billing=1');
  };

  // Don't render anything until we've determined the show state
  if (!isMounted || show === null) return null;

  return (
    <AnimatePresence mode="wait">
      {show && (
        <motion.div
          ref={bannerRef}
          // Only animate on first appearance, not on subsequent navigations
          initial={hasAnimated ? false : { y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -50, opacity: 0 }}
          transition={{
            type: 'spring',
            stiffness: 300,
            damping: 30,
            mass: 1
          }}
          layout="position"
          className="fixed top-0 inset-x-0 z-60"
        >
          <div className="bg-linear-to-r from-indigo-600 via-purple-600 to-pink-500 text-white">
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
                  <button
                    onClick={handleStartTrial}
                    disabled={isLoading}
                    className="inline-flex items-center justify-center rounded-full bg-white text-indigo-600 px-4 py-1.5 text-sm font-semibold hover:bg-white/90 transition-colors shadow-sm disabled:opacity-70 min-w-[120px]"
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      'Start Free Trial'
                    )}
                  </button>
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