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
        color: "text-blue-400",
        bg: "bg-blue-500/10",
        border: "border-blue-500/20",
    },
    {
        title: "Product Designer",
        type: "Full-time",
        location: "Remote",
        icon: Paintbrush,
        color: "text-purple-400",
        bg: "bg-purple-500/10",
        border: "border-purple-500/20",
    },
    {
        title: "Marketing Lead",
        type: "Full-time",
        location: "Remote",
        icon: Megaphone,
        color: "text-pink-400",
        bg: "bg-pink-500/10",
        border: "border-pink-500/20",
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
            className="fixed inset-0 z-[9999] overflow-y-auto"
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
                    className="relative w-full max-w-lg bg-slate-900 rounded-xl shadow-2xl border border-slate-700/50 overflow-hidden"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Close Button */}
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 z-10 p-2 rounded-full bg-slate-800 hover:bg-slate-700 transition-colors"
                    >
                        <X className="w-4 h-4 text-slate-400" />
                    </button>

                    {/* Header */}
                    <div className="p-6 pb-2 text-center">
                        <div className="mx-auto w-12 h-12 rounded-full bg-purple-500/10 flex items-center justify-center mb-4 border border-purple-500/20">
                            <Briefcase className="w-6 h-6 text-purple-400" />
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-2">
                            Join the Flock
                        </h2>
                        <p className="text-slate-400 text-sm">
                            Help us build the future of AI-powered learning.
                        </p>
                    </div>

                    {/* Open Roles List */}
                    <div className="p-6 space-y-3">
                        {openRoles.map((role, index) => (
                            <div
                                key={index}
                                className="group p-4 rounded-xl bg-slate-800/50 hover:bg-slate-800 border border-slate-700 hover:border-slate-600 transition-all cursor-default"
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`p-2 rounded-lg ${role.bg} ${role.border} border`}>
                                        <role.icon className={`w-5 h-5 ${role.color}`} />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-white font-medium text-sm">{role.title}</h3>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-xs text-slate-500">{role.type}</span>
                                            <span className="w-1 h-1 rounded-full bg-slate-600" />
                                            <span className="text-xs text-slate-500">{role.location}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* CTA Footer */}
                    <div className="p-6 bg-slate-950/50 border-t border-slate-800 text-center">
                        <p className="text-slate-400 text-sm mb-4">
                            Don't see your role? We're always looking for talent.
                        </p>
                        <a
                            href="mailto:careers@skoowlai.com?subject=Application for Skoowl AI"
                            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-white text-slate-900 font-semibold hover:bg-slate-100 transition-colors text-sm"
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
