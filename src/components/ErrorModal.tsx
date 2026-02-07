'use client';

import { useState, createContext, useContext, ReactNode } from 'react';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle, Clock, Zap } from 'lucide-react';
import { IS_PRE_LAUNCH } from '@/lib/config';

interface ErrorModalContextType {
    showError: (title: string, message: string, type?: 'error' | 'limit') => void;
}

const ErrorModalContext = createContext<ErrorModalContextType | null>(null);

export function useErrorModal() {
    const context = useContext(ErrorModalContext);
    if (!context) {
        throw new Error('useErrorModal must be used within ErrorModalProvider');
    }
    return context;
}

export function ErrorModalProvider({ children }: { children: ReactNode }) {
    const [isOpen, setIsOpen] = useState(false);
    const [title, setTitle] = useState('');
    const [message, setMessage] = useState('');
    const [type, setType] = useState<'error' | 'limit'>('error');

    const showError = (newTitle: string, newMessage: string, newType: 'error' | 'limit' = 'error') => {
        setTitle(newTitle);
        setMessage(newMessage);
        setType(newType);
        setIsOpen(true);
    };

    return (
        <ErrorModalContext.Provider value={{ showError }}>
            {children}
            <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
                <AlertDialogContent className="sm:max-w-md">
                    <AlertDialogHeader>
                        <div className="flex items-center gap-3">
                            {type === 'limit' ? (
                                <div className="w-12 h-12 rounded-full bg-amber/20 flex items-center justify-center">
                                    <Clock className="w-6 h-6 text-amber" />
                                </div>
                            ) : (
                                <div className="w-12 h-12 rounded-full bg-destructive/20 flex items-center justify-center">
                                    <AlertTriangle className="w-6 h-6 text-destructive" />
                                </div>
                            )}
                            <AlertDialogTitle className="text-xl">
                                {title}
                            </AlertDialogTitle>
                        </div>
                    </AlertDialogHeader>
                    <AlertDialogDescription className="text-base text-muted-foreground mt-2">
                        {message}
                    </AlertDialogDescription>
                    {type === 'limit' && !IS_PRE_LAUNCH && (
                        <div className="mt-4 p-3 bg-linear-to-r from-primary/10 to-(--brand-secondary)/10 rounded-lg border border-primary/30">
                            <div className="flex items-center gap-2">
                                <Zap className="w-4 h-4 text-primary" />
                                <span className="text-sm font-medium text-primary">
                                    Want unlimited access?
                                </span>
                            </div>
                            <p className="text-xs text-primary/80 mt-1">
                                Upgrade to Student plan for unlimited study sets, longer videos, and more!
                            </p>
                        </div>
                    )}
                    <AlertDialogFooter className="mt-4">
                        <AlertDialogAction className="w-full bg-primary hover:bg-primary/90 text-white">
                            Got it
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </ErrorModalContext.Provider>
    );
}
