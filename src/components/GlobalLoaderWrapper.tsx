'use client';

import { ReactNode, Suspense } from 'react';
import { LoaderProvider } from '@/contexts/LoaderContext';
import LoadingScreen from '@/components/LoadingScreen';
import RouteChangeLoader from '@/components/RouteChangeLoader';

interface GlobalLoaderWrapperProps {
    children: ReactNode;
}

export default function GlobalLoaderWrapper({ children }: GlobalLoaderWrapperProps) {
    return (
        <LoaderProvider>
            <LoadingScreen />
            <Suspense fallback={null}>
                <RouteChangeLoader />
            </Suspense>
            {children}
        </LoaderProvider>
    );
}
