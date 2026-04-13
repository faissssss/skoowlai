"use client";

import { useState, useEffect, Fragment, useRef } from "react";
import Image from "next/image";
import { Dialog, Transition } from "@headlessui/react";
import { Bug, X, Loader2, AlertTriangle, Info, AlertCircle, Upload, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useUser } from "@clerk/nextjs";

interface BugReportModalProps {
    isOpen: boolean;
    onClose: () => void;
}

type Severity = "low" | "medium" | "critical";

const severityConfig = {
    low: {
        label: "Low",
        icon: Info,
        color: "text-(--brand-accent)",
        bg: "bg-(--brand-accent)/15",
        border: "border-(--brand-accent)/25",
        activeBg: "bg-(--brand-accent)",
    },
    medium: {
        label: "Medium",
        icon: AlertTriangle,
        color: "text-yellow-500",
        bg: "bg-yellow-500/20",
        border: "border-yellow-500/30",
        activeBg: "bg-yellow-500",
    },
    critical: {
        label: "Critical",
        icon: AlertCircle,
        color: "text-destructive",
        bg: "bg-destructive/20",
        border: "border-destructive/30",
        activeBg: "bg-destructive",
    },
};

export default function BugReportModal({ isOpen, onClose }: BugReportModalProps) {
    const { user } = useUser();
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [severity, setSeverity] = useState<Severity>("medium");
    const [screenshot, setScreenshot] = useState<File | null>(null);
    const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState("");
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Auto-captured data
    const [pageUrl, setPageUrl] = useState("");
    const [userAgent, setUserAgent] = useState("");

    useEffect(() => {
        if (isOpen) {
            setPageUrl(window.location.href);
            setUserAgent(navigator.userAgent);
        }
    }, [isOpen]);

    const resetForm = () => {
        setTitle("");
        setDescription("");
        setSeverity("medium");
        setScreenshot(null);
        setScreenshotPreview(null);
        setError("");
    };

    const handleClose = () => {
        resetForm();
        onClose();
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (!title.trim() || !description.trim()) {
            setError("Please fill in all required fields.");
            return;
        }

        setIsSubmitting(true);

        try {
            // Convert screenshot to base64 if present
            let screenshotBase64: string | null = null;
            if (screenshot) {
                screenshotBase64 = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result as string);
                    reader.readAsDataURL(screenshot);
                });
            }

            const response = await fetch("/api/bug-report", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: title.trim(),
                    description: description.trim(),
                    severity,
                    screenshot: screenshotBase64,
                    pageUrl,
                    userAgent,
                    user: user ? {
                        name: user.fullName || user.firstName || "Unknown",
                        email: user.primaryEmailAddress?.emailAddress || "No email",
                    } : null,
                }),
            });

            if (!response.ok) {
                throw new Error("Failed to submit bug report");
            }

            toast.success("Thanks! We're on it. 🐛", {
                description: "Your bug report has been submitted successfully.",
            });
            handleClose();
        } catch {
            setError("Failed to submit bug report. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Transition appear show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-50" onClose={handleClose}>
                {/* Backdrop */}
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
                </Transition.Child>

                {/* Modal */}
                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4">
                        <Transition.Child
                            as={Fragment}
                            enter="ease-out duration-300"
                            enterFrom="opacity-0 scale-95"
                            enterTo="opacity-100 scale-100"
                            leave="ease-in duration-200"
                            leaveFrom="opacity-100 scale-100"
                            leaveTo="opacity-0 scale-95"
                        >
                            <Dialog.Panel className="w-full max-w-xl transform overflow-hidden rounded-2xl bg-card border border-primary/30 shadow-2xl shadow-black/20 transition-all flex flex-col">
                                {/* Header */}
                                <div className="flex items-center justify-between px-6 py-4 border-b border-border/40 shrink-0">
                                    <Dialog.Title className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center">
                                            <Bug className="w-5 h-5 text-primary" />
                                        </div>
                                        <div>
                                            <h2 className="text-lg font-semibold text-foreground font-heading">Report a Bug</h2>
                                            <p className="text-sm text-muted-foreground">Help us improve Skoowl AI</p>
                                        </div>
                                    </Dialog.Title>
                                    <button
                                        onClick={handleClose}
                                        className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>

                                {/* Form */}
                                <div className="p-6">
                                    <form onSubmit={handleSubmit} className="space-y-5">
                                        {/* Error Message */}
                                        {error && (
                                            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm">
                                                {error}
                                            </div>
                                        )}

                                        {/* Title */}
                                        <div>
                                            <label htmlFor="bug-title" className="block text-sm font-medium text-foreground/80 mb-2">
                                                Title <span className="text-destructive">*</span>
                                            </label>
                                            <input
                                                id="bug-title"
                                                type="text"
                                                value={title}
                                                onChange={(e) => setTitle(e.target.value)}
                                                placeholder="Short summary of the issue"
                                                className="w-full px-4 py-2.5 rounded-xl bg-background/30 border border-border/40 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-colors"
                                            />
                                        </div>

                                        {/* Description */}
                                        <div>
                                            <label htmlFor="bug-description" className="block text-sm font-medium text-foreground/80 mb-2">
                                                Description <span className="text-destructive">*</span>
                                            </label>
                                            <textarea
                                                id="bug-description"
                                                value={description}
                                                onChange={(e) => setDescription(e.target.value)}
                                                placeholder="What happened? Steps to reproduce..."
                                                rows={3}
                                                className="w-full px-4 py-2.5 rounded-xl bg-background/30 border border-border/40 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-colors resize-none"
                                            />
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            {/* Severity */}
                                            <div>
                                                <label className="block text-sm font-medium text-foreground/80 mb-2">
                                                    Severity
                                                </label>
                                                <div className="flex gap-2">
                                                    {(Object.keys(severityConfig) as Severity[]).map((level) => {
                                                        const config = severityConfig[level];
                                                        const Icon = config.icon;
                                                        const isActive = severity === level;
                                                        return (
                                                            <button
                                                                key={level}
                                                                type="button"
                                                                onClick={() => setSeverity(level)}
                                                                className={`flex-1 flex items-center justify-center gap-2 px-2 py-2.5 rounded-xl border transition-all ${isActive
                                                                    ? `${config.bg} ${config.border} ${config.color}`
                                                                    : "bg-background/30 border-border/40 text-muted-foreground hover:border-border/60"
                                                                    }`}
                                                            >
                                                                <Icon className="w-4 h-4" />
                                                                <span className="text-xs font-medium">{config.label}</span>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            {/* Screenshot Upload */}
                                            <div>
                                                <label className="block text-sm font-medium text-foreground/80 mb-2">
                                                    Screenshot <span className="text-muted-foreground">(Optional)</span>
                                                </label>

                                                {!screenshotPreview ? (
                                                    <div
                                                        onDragOver={(e) => {
                                                            e.preventDefault();
                                                            setIsDragging(true);
                                                        }}
                                                        onDragLeave={() => setIsDragging(false)}
                                                        onDrop={(e) => {
                                                            e.preventDefault();
                                                            setIsDragging(false);
                                                            const file = e.dataTransfer.files[0];
                                                            if (file && file.type.startsWith("image/")) {
                                                                setScreenshot(file);
                                                                setScreenshotPreview(URL.createObjectURL(file));
                                                            }
                                                        }}
                                                        onClick={() => fileInputRef.current?.click()}
                                                        className={`w-full p-2.5 rounded-xl border-2 border-dashed cursor-pointer transition-all ${isDragging
                                                            ? "border-primary bg-primary/10"
                                                            : "border-border/40 hover:border-border/60 bg-background/20"
                                                            }`}
                                                    >
                                                        <div className="flex items-center justify-center gap-2">
                                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDragging ? "bg-primary/20" : "bg-secondary/50"
                                                                }`}>
                                                                <Upload className={`w-4 h-4 ${isDragging ? "text-primary" : "text-muted-foreground"}`} />
                                                            </div>
                                                            <span className="text-xs text-muted-foreground font-medium">Upload</span>
                                                        </div>
                                                        <input
                                                            ref={fileInputRef}
                                                            type="file"
                                                            accept="image/*"
                                                            className="hidden"
                                                            onChange={(e) => {
                                                                const file = e.target.files?.[0];
                                                                if (file) {
                                                                    setScreenshot(file);
                                                                    setScreenshotPreview(URL.createObjectURL(file));
                                                                }
                                                            }}
                                                        />
                                                    </div>
                                                ) : (
                                                    <div className="relative rounded-xl overflow-hidden border border-border/40 bg-background/20 h-[54px]">
                                                        <Image
                                                            src={screenshotPreview}
                                                            alt="Screenshot preview"
                                                            fill
                                                            unoptimized
                                                            className="object-cover"
                                                        />
                                                        <div className="absolute inset-0 bg-linear-to-t from-black/60 to-transparent" />
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setScreenshot(null);
                                                                setScreenshotPreview(null);
                                                            }}
                                                            className="absolute top-1.5 right-1.5 p-1 rounded-md bg-destructive/80 hover:bg-destructive text-white transition-colors"
                                                        >
                                                            <Trash2 className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Submit Button */}
                                        <button
                                            type="submit"
                                            disabled={isSubmitting}
                                            className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-linear-to-r from-(--brand-primary) to-(--brand-secondary) hover:from-(--brand-primary-dark) hover:to-(--brand-primary) text-white font-semibold shadow-lg shadow-black/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                        >
                                            {isSubmitting ? (
                                                <>
                                                    <Loader2 className="w-5 h-5 animate-spin" />
                                                    Submitting...
                                                </>
                                            ) : (
                                                <>
                                                    <Bug className="w-5 h-5" />
                                                    Submit Bug Report
                                                </>
                                            )}
                                        </button>
                                    </form>
                                </div>
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition>
    );
}
