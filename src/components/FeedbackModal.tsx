"use client";

import { useState, Fragment } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { X, Loader2, Lightbulb, Heart, MessageCircle, Send } from "lucide-react";
import { toast } from "sonner";
import { useUser } from "@clerk/nextjs";
import confetti from "canvas-confetti";

interface FeedbackModalProps {
    isOpen: boolean;
    onClose: () => void;
}

type FeedbackType = "feature" | "improvement" | "general";

const feedbackTypes = {
    feature: {
        label: "New Feature Idea",
        icon: Lightbulb,
        emoji: "💡",
        color: "text-yellow-400",
        bg: "bg-yellow-500/20",
        border: "border-yellow-500/30",
    },
    improvement: {
        label: "Improvement",
        icon: Heart,
        emoji: "❤️",
        color: "text-pink-400",
        bg: "bg-pink-500/20",
        border: "border-pink-500/30",
    },
    general: {
        label: "General Feedback",
        icon: MessageCircle,
        emoji: "💬",
        color: "text-blue-400",
        bg: "bg-blue-500/20",
        border: "border-blue-500/30",
    },
};

const categoryOptions = [
    { value: "general", label: "General" },
    { value: "upload", label: "Upload" },
    { value: "notes", label: "Notes" },
    { value: "flashcards", label: "Flashcards" },
    { value: "mindmaps", label: "Mind Maps" },
    { value: "quiz", label: "Quiz" },
];

export default function FeedbackModal({ isOpen, onClose }: FeedbackModalProps) {
    const { user } = useUser();
    const [type, setType] = useState<FeedbackType>("feature");
    const [category, setCategory] = useState("general");
    const [summary, setSummary] = useState("");
    const [details, setDetails] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState("");

    const resetForm = () => {
        setType("feature");
        setCategory("general");
        setSummary("");
        setDetails("");
        setError("");
    };

    const handleClose = () => {
        resetForm();
        onClose();
    };

    const triggerConfetti = () => {
        const count = 200;
        const defaults = {
            origin: { y: 0.7 },
            zIndex: 9999,
        };

        function fire(particleRatio: number, opts: confetti.Options) {
            confetti({
                ...defaults,
                ...opts,
                particleCount: Math.floor(count * particleRatio),
            });
        }

        fire(0.25, { spread: 26, startVelocity: 55 });
        fire(0.2, { spread: 60 });
        fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
        fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
        fire(0.1, { spread: 120, startVelocity: 45 });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (!summary.trim()) {
            setError("Please provide a summary of your feedback.");
            return;
        }

        setIsSubmitting(true);

        try {
            const response = await fetch("/api/feedback", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    type,
                    category,
                    summary: summary.trim(),
                    details: details.trim(),
                    user: user ? {
                        name: user.fullName || user.firstName || "Unknown",
                        email: user.primaryEmailAddress?.emailAddress || "No email",
                    } : null,
                }),
            });

            if (!response.ok) {
                throw new Error("Failed to submit feedback");
            }

            // Trigger confetti for feature ideas
            if (type === "feature") {
                triggerConfetti();
            }

            toast.success("Thanks! Your idea has been sent! 🚀", {
                description: "Your feedback has been sent directly to our roadmap board.",
            });
            handleClose();
        } catch {
            setError("Failed to submit feedback. Please try again.");
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
                            <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-2xl bg-slate-900 border border-emerald-500/30 shadow-2xl shadow-emerald-500/10 transition-all">
                                {/* Header */}
                                <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
                                    <Dialog.Title className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                                            <Lightbulb className="w-5 h-5 text-emerald-400" />
                                        </div>
                                        <div>
                                            <h2 className="text-lg font-semibold text-white">Share Your Ideas</h2>
                                            <p className="text-sm text-slate-400">Help us build skoowl ai</p>
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

                                    {/* Feedback Type */}
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-2">
                                            What kind of feedback?
                                        </label>
                                        <div className="flex gap-2">
                                            {(Object.keys(feedbackTypes) as FeedbackType[]).map((feedbackType) => {
                                                const config = feedbackTypes[feedbackType];
                                                const Icon = config.icon;
                                                const isActive = type === feedbackType;
                                                return (
                                                    <button
                                                        key={feedbackType}
                                                        type="button"
                                                        onClick={() => setType(feedbackType)}
                                                        className={`flex-1 flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl border transition-all ${isActive
                                                                ? `${config.bg} ${config.border} ${config.color}`
                                                                : "bg-slate-800/50 border-white/10 text-slate-400 hover:border-white/20"
                                                            }`}
                                                    >
                                                        <Icon className="w-5 h-5" />
                                                        <span className="text-xs font-medium">{config.label}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Category */}
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-2">
                                            Related to
                                        </label>
                                        <div className="flex flex-wrap gap-2">
                                            {categoryOptions.map((option) => (
                                                <button
                                                    key={option.value}
                                                    type="button"
                                                    onClick={() => setCategory(option.value)}
                                                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${category === option.value
                                                            ? "bg-emerald-500/20 border border-emerald-500/30 text-emerald-400"
                                                            : "bg-slate-800/50 border border-white/10 text-slate-400 hover:border-white/20"
                                                        }`}
                                                >
                                                    {option.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Summary */}
                                    <div>
                                        <label htmlFor="feedback-summary" className="block text-sm font-medium text-slate-300 mb-2">
                                            Summary <span className="text-red-400">*</span>
                                        </label>
                                        <input
                                            id="feedback-summary"
                                            type="text"
                                            value={summary}
                                            onChange={(e) => setSummary(e.target.value)}
                                            placeholder="e.g., Add Dark Mode support for PDFs"
                                            className="w-full px-4 py-3 rounded-xl bg-slate-800/50 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-colors"
                                        />
                                    </div>

                                    {/* Details */}
                                    <div>
                                        <label htmlFor="feedback-details" className="block text-sm font-medium text-slate-300 mb-2">
                                            Details <span className="text-slate-500">(Optional)</span>
                                        </label>
                                        <textarea
                                            id="feedback-details"
                                            value={details}
                                            onChange={(e) => setDetails(e.target.value)}
                                            placeholder="Tell us more about how this would help you..."
                                            rows={3}
                                            className="w-full px-4 py-3 rounded-xl bg-slate-800/50 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-colors resize-none"
                                        />
                                    </div>

                                    {/* Submit Button */}
                                    <button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold shadow-lg shadow-emerald-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                    >
                                        {isSubmitting ? (
                                            <>
                                                <Loader2 className="w-5 h-5 animate-spin" />
                                                Sending...
                                            </>
                                        ) : (
                                            <>
                                                <Send className="w-5 h-5" />
                                                Send Feedback
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
