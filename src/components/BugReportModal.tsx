"use client";

import { useState, useEffect, Fragment, useRef } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { Bug, X, Loader2, AlertTriangle, Info, AlertCircle, Upload, ImageIcon, Trash2 } from "lucide-react";
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
        color: "text-blue-400",
        bg: "bg-blue-500/20",
        border: "border-blue-500/30",
        activeBg: "bg-blue-500",
    },
    medium: {
        label: "Medium",
        icon: AlertTriangle,
        color: "text-yellow-400",
        bg: "bg-yellow-500/20",
        border: "border-yellow-500/30",
        activeBg: "bg-yellow-500",
    },
    critical: {
        label: "Critical",
        icon: AlertCircle,
        color: "text-red-400",
        bg: "bg-red-500/20",
        border: "border-red-500/30",
        activeBg: "bg-red-500",
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
                            <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-2xl bg-slate-900 border border-violet-500/30 shadow-2xl shadow-violet-500/10 transition-all">
                                {/* Header */}
                                <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
                                    <Dialog.Title className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center">
                                            <Bug className="w-5 h-5 text-violet-400" />
                                        </div>
                                        <div>
                                            <h2 className="text-lg font-semibold text-white">Report a Bug</h2>
                                            <p className="text-sm text-slate-400">Help us improve skoowl ai</p>
                                        </div>
                                    </Dialog.Title>
                                    <button
                                        onClick={handleClose}
                                        className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>

                                {/* Form */}
                                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                                    {/* Error Message */}
                                    {error && (
                                        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                                            {error}
                                        </div>
                                    )}

                                    {/* Title */}
                                    <div>
                                        <label htmlFor="bug-title" className="block text-sm font-medium text-slate-300 mb-2">
                                            Title <span className="text-red-400">*</span>
                                        </label>
                                        <input
                                            id="bug-title"
                                            type="text"
                                            value={title}
                                            onChange={(e) => setTitle(e.target.value)}
                                            placeholder="Short summary of the issue"
                                            className="w-full px-4 py-3 rounded-xl bg-slate-800/50 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/50 transition-colors"
                                        />
                                    </div>

                                    {/* Description */}
                                    <div>
                                        <label htmlFor="bug-description" className="block text-sm font-medium text-slate-300 mb-2">
                                            Description <span className="text-red-400">*</span>
                                        </label>
                                        <textarea
                                            id="bug-description"
                                            value={description}
                                            onChange={(e) => setDescription(e.target.value)}
                                            placeholder="What happened? Steps to reproduce..."
                                            rows={4}
                                            className="w-full px-4 py-3 rounded-xl bg-slate-800/50 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/50 transition-colors resize-none"
                                        />
                                    </div>

                                    {/* Severity */}
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-2">
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
                                                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border transition-all ${isActive
                                                            ? `${config.bg} ${config.border} ${config.color}`
                                                            : "bg-slate-800/50 border-white/10 text-slate-400 hover:border-white/20"
                                                            }`}
                                                    >
                                                        <Icon className="w-4 h-4" />
                                                        <span className="text-sm font-medium">{config.label}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Screenshot Upload */}
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-2">
                                            Screenshot <span className="text-slate-500">(Optional)</span>
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
                                                className={`w-full p-6 rounded-xl border-2 border-dashed cursor-pointer transition-all ${isDragging
                                                        ? "border-violet-500 bg-violet-500/10"
                                                        : "border-white/10 hover:border-white/20 bg-slate-800/30"
                                                    }`}
                                            >
                                                <div className="flex flex-col items-center gap-2 text-center">
                                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDragging ? "bg-violet-500/20" : "bg-slate-700/50"
                                                        }`}>
                                                        <Upload className={`w-5 h-5 ${isDragging ? "text-violet-400" : "text-slate-400"}`} />
                                                    </div>
                                                    <p className="text-sm text-slate-400">
                                                        <span className="text-violet-400 font-medium">Click to upload</span> or drag and drop
                                                    </p>
                                                    <p className="text-xs text-slate-500">PNG, JPG, GIF up to 5MB</p>
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
                                            <div className="relative rounded-xl overflow-hidden border border-white/10 bg-slate-800/30">
                                                <img
                                                    src={screenshotPreview}
                                                    alt="Screenshot preview"
                                                    className="w-full h-32 object-cover"
                                                />
                                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                                                <div className="absolute bottom-3 left-3 flex items-center gap-2">
                                                    <ImageIcon className="w-4 h-4 text-white/80" />
                                                    <span className="text-sm text-white/80 truncate max-w-[200px]">
                                                        {screenshot?.name}
                                                    </span>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setScreenshot(null);
                                                        setScreenshotPreview(null);
                                                    }}
                                                    className="absolute top-2 right-2 p-1.5 rounded-lg bg-red-500/80 hover:bg-red-500 text-white transition-colors"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {/* Submit Button */}
                                    <button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-semibold shadow-lg shadow-violet-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
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
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition>
    );
}
