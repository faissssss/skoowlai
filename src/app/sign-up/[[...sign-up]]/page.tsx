"use client";

import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
    return (
        <div
            className="min-h-screen flex items-center justify-center"
            style={{
                background: 'radial-gradient(ellipse at center, #0f0c29 0%, #020024 70%, #000000 100%)',
            }}
        >
            {/* Ambient glow effects */}
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-(--brand-secondary)/20 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-primary/15 rounded-full blur-[100px] pointer-events-none" />

            <style jsx global>{`
                .cl-socialButtonsBlockButton {
                    color: white !important;
                }
                .cl-socialButtonsBlockButtonText {
                    color: white !important;
                }
                .cl-socialButtonsIconButton {
                    color: white !important;
                }
            `}</style>

            <SignUp
                appearance={{
                    elements: {
                        rootBox: "mx-auto",
                        card: "bg-card/80 backdrop-blur-xl border border-white/10 shadow-2xl shadow-(--brand-secondary)/10",
                        inputText: "text-white",
                        inputLabel: "text-white",
                        formButton: "text-white",
                        socialButtonsBlockButton: "text-white",
                        socialButtonsBlockButtonText: "text-white",
                        socialButtonsIconButton: "text-white",
                        dividerText: "text-white",
                        footerActionLink: "text-white",
                        footerText: "text-white",
                        headerTitle: "text-white",
                        headerSubtitle: "text-white",
                    },
                }}
            />
        </div>
    );
}
