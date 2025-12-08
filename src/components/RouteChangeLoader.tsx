'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useGlobalLoader } from '@/contexts/LoaderContext';

export default function RouteChangeLoader() {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const { startLoading, stopLoading } = useGlobalLoader();
    const isInitialMount = useRef(true);

    useEffect(() => {
        // Skip the initial mount to avoid loading screen on first page load
        if (isInitialMount.current) {
            isInitialMount.current = false;
            return;
        }

        // Show loader when route changes
        startLoading();

        // Small delay to ensure the new page has time to start rendering
        const timer = setTimeout(() => {
            stopLoading();
        }, 500);

        return () => {
            clearTimeout(timer);
            stopLoading();
        };
    }, [pathname, searchParams, startLoading, stopLoading]);

    return null;
}
