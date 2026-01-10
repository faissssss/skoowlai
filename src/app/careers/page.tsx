"use client";

import Link from "next/link";
import { ArrowLeft, Mail, Sparkles } from "lucide-react";
import { ShaderGradientCanvas, ShaderGradient } from "@shadergradient/react";

export default function CareersPage() {
    return (
        <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-[#020024] via-[#090979] to-[#020024] text-white">
            <div className="relative flex min-h-screen flex-col items-center justify-center px-4 text-center">
                {/* Back Button */}
                <Link
                    href="/"
                    className="absolute left-6 top-6 flex items-center gap-2 text-sm text-slate-400 transition-colors hover:text-white"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back to Home
                </Link>

                {/* Content */}
                <div className="relative z-10 max-w-2xl px-6 py-12">
                    <h1 className="mb-4 text-4xl font-bold tracking-tight sm:text-6xl flex items-center justify-center gap-3">
                        <span className="bg-clip-text text-transparent bg-gradient-to-b from-white to-slate-400 pb-2">
                            Coming Soon
                        </span>
                        <span className="pb-2">🚀</span>
                    </h1>

                    <p className="mb-8 text-lg text-slate-400 leading-relaxed max-w-lg mx-auto">
                        We're not actively hiring right now, but we're always looking for
                        talent to join our flock!
                    </p>

                    <a
                        href="mailto:yourskoowlai@gmail.com"
                        className="group relative inline-flex items-center gap-2 overflow-hidden rounded-full bg-slate-900 px-8 py-3 text-sm font-semibold text-white transition-all hover:bg-slate-800 border border-slate-700 hover:border-purple-500/50"
                    >
                        <Mail className="h-4 w-4 text-purple-400" />
                        <span className="bg-gradient-to-r from-purple-200 to-indigo-200 bg-clip-text text-transparent group-hover:text-white transition-colors">
                            yourskoowlai@gmail.com
                        </span>
                    </a>
                </div>
            </div>
        </div>
    );
}
