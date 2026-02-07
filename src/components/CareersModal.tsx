"use client";

import { X, Briefcase, Mail, ArrowRight, Code, Paintbrush, Megaphone } from "lucide-react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";

interface CareersModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const openRoles = [
    {
        title: "Software Engineer",
        type: "Full-time",
        location: "Remote",
        icon: Code,
        color: "text-blue",
        bg: "bg-blue/10",
        border: "border-blue/20",
    },
    {
        title: "Product Designer",
        type: "Full-time",
        location: "Remote",
        icon: Paintbrush,
        color: "text-(--brand-secondary)",
        bg: "bg-(--brand-secondary)/10",
        border: "border-(--brand-secondary)/20",
    },
    {
        title: "Marketing Lead",
        type: "Full-time",
        location: "Remote",
        icon: Megaphone,
        color: "text-(--brand-accent)",
        bg: "bg-(--brand-accent)/10",
        border: "border-(--brand-accent)/20",
    },
];

export default function CareersModal({ isOpen, onClose }: CareersModalProps) {
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

            {/* Scrollable Container */}
            <div
                className="flex min-h-full items-center justify-center p-4 touch-pan-y pointer-events-auto"
                onClick={handleBackdropClick}
            >
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                    className="relative w-full max-w-lg bg-card rounded-xl shadow-2xl border border-border overflow-hidden"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Close Button */}
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 z-10 p-2 rounded-full bg-muted hover:bg-muted/80 transition-colors"
                    >
                        <X className="w-4 h-4 text-muted-foreground" />
                    </button>

                    {/* Header */}
                    <div className="p-6 pb-2 text-center">
                        <div className="mx-auto w-12 h-12 rounded-full bg-(--brand-secondary)/10 flex items-center justify-center mb-4 border border-(--brand-secondary)/20">
                            <Briefcase className="w-6 h-6 text-(--brand-secondary)" />
                        </div>
                        <h2 className="text-2xl font-bold text-foreground mb-2">
                            Join the Flock
                        </h2>
                        <p className="text-muted-foreground text-sm">
                            Help us build the future of AI-powered learning.
                        </p>
                    </div>

                    {/* Open Roles List */}
                    <div className="p-6 space-y-3">
                        {openRoles.map((role, index) => (
                            <div
                                key={index}
                                className="group p-4 rounded-xl bg-muted/50 hover:bg-muted border border-border hover:border-border/80 transition-all cursor-default"
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`p-2 rounded-lg ${role.bg} ${role.border} border`}>
                                        <role.icon className={`w-5 h-5 ${role.color}`} />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-foreground font-medium text-sm">{role.title}</h3>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-xs text-muted-foreground/60">{role.type}</span>
                                            <span className="w-1 h-1 rounded-full bg-muted-foreground/40" />
                                            <span className="text-xs text-muted-foreground/60">{role.location}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* CTA Footer */}
                    <div className="p-6 bg-muted/30 border-t border-border text-center">
                        <p className="text-muted-foreground text-sm mb-4">
                            Don&apos;t see your role? We&apos;re always looking for talent.
                        </p>
                        <a
                            href="mailto:careers@skoowlai.com?subject=Application for Skoowl AI"
                            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors text-sm"
                        >
                            <Mail className="w-4 h-4" />
                            Apply via Email
                            <ArrowRight className="w-4 h-4" />
                        </a>
                    </div>
                </motion.div>
            </div>
        </div>
    );

    if (typeof document === "undefined") return null;
    return createPortal(modalContent, document.body);
}
