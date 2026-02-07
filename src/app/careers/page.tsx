"use client";

import Link from "next/link";
import { ArrowLeft, Mail } from "lucide-react";

export default function CareersPage() {
    return (
        <div className="dark relative min-h-screen overflow-hidden bg-linear-to-b from-(--brand-dark) via-black to-(--brand-dark) text-foreground">
            <div className="relative flex min-h-screen flex-col items-center justify-center px-4 text-center">
                {/* Back Button */}
                <Link
                    href="/"
                    className="absolute left-6 top-6 flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back to Home
                </Link>

                {/* Content */}
                <div className="relative z-10 max-w-2xl px-6 py-12">
                    <h1 className="font-heading mb-4 text-4xl font-bold tracking-tight sm:text-6xl flex items-center justify-center gap-3">
                        <span className="bg-clip-text text-transparent bg-linear-to-b from-foreground to-muted-foreground pb-2">
                            Coming Soon
                        </span>
                        <span className="pb-2">🚀</span>
                    </h1>

                    <p className="mb-8 text-lg text-muted-foreground leading-relaxed max-w-lg mx-auto">
                        We&apos;re not actively hiring right now, but we&apos;re always looking for
                        talent to join our flock!
                    </p>

                    <a
                        href="mailto:yourskoowlai@gmail.com"
                        className="group relative inline-flex items-center gap-2 overflow-hidden rounded-full bg-card/60 px-8 py-3 text-sm font-semibold text-foreground transition-all hover:bg-card border border-border/60 hover:border-primary/50"
                    >
                        <Mail className="h-4 w-4 text-primary" />
                        <span className="bg-linear-to-r from-(--brand-primary) to-(--brand-accent) bg-clip-text text-transparent group-hover:text-foreground transition-colors">
                            yourskoowlai@gmail.com
                        </span>
                    </a>
                </div>
            </div>
        </div>
    );
}
