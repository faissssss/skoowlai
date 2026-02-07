'use client';

import { X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { UserProfile } from '@clerk/nextjs';

interface AccountModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function AccountModal({ isOpen, onClose }: AccountModalProps) {
    if (!isOpen) return null;

    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    const modalContent = (
        <div
            className="fixed inset-0 z-9999 overflow-y-auto"
            data-scroll-lock-scrollable
        >
            {/* Backdrop */}
            <div className="fixed inset-0 bg-black/70 backdrop-blur-md" aria-hidden="true" />

            {/* Container */}
            <div
                className="flex min-h-full items-center justify-center p-4"
                onClick={handleBackdropClick}
            >
                {/* Modal */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                    className="relative w-full max-w-[98vw] sm:max-w-5xl lg:max-w-6xl bg-card rounded-xl shadow-2xl border border-border overflow-hidden"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Close Button */}
                    <button
                        onClick={onClose}
                        className="absolute top-3 right-3 z-50 p-2 rounded-full bg-secondary/80 hover:bg-secondary transition-colors"
                    >
                        <X className="w-5 h-5 text-muted-foreground" />
                    </button>

                    {/* User Profile Content */}
                    <div className="p-4 md:p-6">
                        <UserProfile
                            routing="hash"
                            appearance={{
                                elements: {
                                    rootBox: "mx-auto w-full",
                                    card: "shadow-none bg-transparent",
                                    pageTitle: "text-white text-xl font-bold mb-2 hidden",
                                    pageSubtitle: "text-muted-foreground text-sm mb-4 hidden",
                                    navbar: "hidden",
                                    navbarMobileMenuButton: "hidden",
                                    formButton: "bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2",
                                    formFieldInput: "bg-secondary border-border text-white",
                                    formFieldLabel: "text-white",
                                    accordionTriggerButton: "text-white hover:bg-primary/10 py-3",
                                    accordionContent: "text-white",
                                    userPreviewTextContainer: "text-white",
                                    userPreviewSecondaryText: "text-muted-foreground",
                                    profileSection: "text-white",
                                    profileSectionTitle: "text-white font-semibold",
                                    profileSectionSubtitle: "text-muted-foreground",
                                    identityPreviewText: "text-white",
                                    identityPreviewEditButton: "text-primary hover:text-primary/80",
                                    formButtonReset: "text-muted-foreground hover:text-white",
                                    badge: "bg-primary text-primary-foreground",
                                    formButtonPrimary: "bg-primary text-primary-foreground hover:bg-primary/90",
                                    formButtonDanger: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
                                },
                            }}
                        />
                    </div>
                </motion.div>
            </div>
        </div>
    );

    if (typeof document === 'undefined') return null;
    return createPortal(modalContent, document.body);
}
