import { SignUp } from "@clerk/nextjs";
import { Metadata } from "next";

export const metadata: Metadata = {
    title: "Sign Up",
    description: "Create your free Skoowl AI account today and start transforming your study materials into interactive notes and quizzes.",
};

export default function SignUpPage() {
    return (
        <div
            className="min-h-screen flex items-center justify-center"
            style={{
                background: 'radial-gradient(ellipse at center, #0f0c29 0%, #020024 70%, #000000 100%)',
            }}
        >
            {/* Ambient glow effects */}
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-indigo-600/15 rounded-full blur-[100px] pointer-events-none" />

            <SignUp
                appearance={{
                    elements: {
                        rootBox: "mx-auto",
                        card: "bg-slate-900/80 backdrop-blur-xl border border-white/10 shadow-2xl shadow-purple-500/10",
                    },
                }}
            />
        </div>
    );
}
