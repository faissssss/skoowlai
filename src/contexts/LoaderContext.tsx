'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface LoaderContextType {
    isLoading: boolean;
    message: string;
    startLoading: (message?: string) => void;
    stopLoading: () => void;
}

const LoaderContext = createContext<LoaderContextType | undefined>(undefined);

export function LoaderProvider({ children }: { children: ReactNode }) {
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState('Loading...');

    const startLoading = useCallback((msg?: string) => {
        setMessage(msg || 'Loading...');
        setIsLoading(true);
    }, []);

    const stopLoading = useCallback(() => {
        setIsLoading(false);
        setMessage('Loading...');
    }, []);

    return (
        <LoaderContext.Provider value={{ isLoading, message, startLoading, stopLoading }}>
            {children}
        </LoaderContext.Provider>
    );
}

export function useGlobalLoader() {
    const context = useContext(LoaderContext);
    if (context === undefined) {
        throw new Error('useGlobalLoader must be used within a LoaderProvider');
    }
    return context;
}

