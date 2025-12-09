import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = {
    title: "Privacy Policy - skoowl ai",
    description: "Learn how skoowl ai collects, uses, and protects your personal information.",
};

export default function PrivacyPolicyPage() {
    return (
        <div className="min-h-screen bg-gradient-to-b from-[#020024] via-[#090979] to-[#020024]">
            {/* Header */}
            <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-black/30 border-b border-white/10">
                <div className="max-w-4xl mx-auto px-6 py-4">
                    <Link
                        href="/"
                        className="inline-flex items-center gap-2 text-slate-300 hover:text-white transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        <span className="text-sm font-medium">Back to Home</span>
                    </Link>
                </div>
            </nav>

            {/* Content */}
            <main className="pt-24 pb-16">
                <div className="max-w-4xl mx-auto px-6">
                    <article className="prose prose-invert prose-slate max-w-none">
                        {/* Title */}
                        <div className="mb-12">
                            <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
                                Privacy Policy
                            </h1>
                            <p className="text-slate-400">
                                <strong>Effective Date:</strong> 5th December 2025
                            </p>
                        </div>

                        {/* Section 1 */}
                        <section className="mb-10">
                            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-3">
                                <span className="w-8 h-8 rounded-lg bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-sm text-purple-400 font-bold">1</span>
                                Introduction
                            </h2>
                            <p className="text-slate-300 leading-relaxed">
                                Welcome to skoowl ai (&ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;us&rdquo;). We respect your privacy and are committed to protecting the personal information you share with us. This Privacy Policy explains how we collect, use, and safeguard your data when you use our website and AI study tools.
                            </p>
                        </section>

                        {/* Section 2 */}
                        <section className="mb-10">
                            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-3">
                                <span className="w-8 h-8 rounded-lg bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-sm text-purple-400 font-bold">2</span>
                                Information We Collect
                            </h2>
                            <p className="text-slate-300 leading-relaxed mb-4">
                                We collect the following types of information:
                            </p>
                            <ul className="space-y-3 text-slate-300">
                                <li className="flex items-start gap-3">
                                    <span className="text-purple-400 mt-1">•</span>
                                    <span><strong className="text-white">Account Information:</strong> When you sign up via Google or Email (powered by Clerk), we collect your name, email address, and profile picture.</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <span className="text-purple-400 mt-1">•</span>
                                    <span><strong className="text-white">User Content:</strong> This includes the documents (PDFs, DOCX, TXT), audio recordings, and YouTube links you upload for processing.</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <span className="text-purple-400 mt-1">•</span>
                                    <span><strong className="text-white">Usage Data:</strong> We collect anonymous data on how you interact with the app (e.g., which features you use most) to improve performance.</span>
                                </li>
                            </ul>
                            <div className="mt-6 p-4 rounded-xl bg-slate-800/50 border border-white/10">
                                <p className="text-slate-300">
                                    <strong className="text-white">Cookies:</strong> We use cookies for authentication (keeping you logged in) and essential site functionality.
                                </p>
                            </div>
                        </section>

                        {/* Section 3 */}
                        <section className="mb-10">
                            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-3">
                                <span className="w-8 h-8 rounded-lg bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-sm text-purple-400 font-bold">3</span>
                                How We Use Your Data
                            </h2>
                            <p className="text-slate-300 leading-relaxed mb-4">
                                We use your information to:
                            </p>
                            <ul className="space-y-3 text-slate-300">
                                <li className="flex items-start gap-3">
                                    <span className="text-purple-400 mt-1">•</span>
                                    <span>Provide and maintain the skoowl ai service.</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <span className="text-purple-400 mt-1">•</span>
                                    <span><strong className="text-white">AI Processing:</strong> Your uploaded content (notes, audio, videos) is sent to third-party AI providers (e.g., Gemini, OpenAI, Anthropic) strictly for the purpose of generating study materials (notes, flashcards, quizzes, mind maps). <em>We do not sell your data to third parties.</em></span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <span className="text-purple-400 mt-1">•</span>
                                    <span>Improve and debug our services.</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <span className="text-purple-400 mt-1">•</span>
                                    <span>Communicate with you regarding updates or support.</span>
                                </li>
                            </ul>
                        </section>

                        {/* Section 4 */}
                        <section className="mb-10">
                            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-3">
                                <span className="w-8 h-8 rounded-lg bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-sm text-purple-400 font-bold">4</span>
                                Data Sharing and Third Parties
                            </h2>
                            <p className="text-slate-300 leading-relaxed mb-4">
                                We rely on trusted third-party services to run skoowl ai:
                            </p>
                            <div className="grid gap-3 mb-4">
                                <div className="p-4 rounded-xl bg-slate-800/50 border border-white/10 flex items-center gap-4">
                                    <span className="text-2xl">🔐</span>
                                    <div>
                                        <p className="text-white font-medium">Authentication</p>
                                        <p className="text-slate-400 text-sm">Clerk (for secure login)</p>
                                    </div>
                                </div>
                                <div className="p-4 rounded-xl bg-slate-800/50 border border-white/10 flex items-center gap-4">
                                    <span className="text-2xl">🤖</span>
                                    <div>
                                        <p className="text-white font-medium">AI Models</p>
                                        <p className="text-slate-400 text-sm">Gemini (for content generation)</p>
                                    </div>
                                </div>
                                <div className="p-4 rounded-xl bg-slate-800/50 border border-white/10 flex items-center gap-4">
                                    <span className="text-2xl">🗄️</span>
                                    <div>
                                        <p className="text-white font-medium">Database</p>
                                        <p className="text-slate-400 text-sm">Neon (for storing your saved notes)</p>
                                    </div>
                                </div>
                                <div className="p-4 rounded-xl bg-slate-800/50 border border-white/10 flex items-center gap-4">
                                    <span className="text-2xl">☁️</span>
                                    <div>
                                        <p className="text-white font-medium">Hosting</p>
                                        <p className="text-slate-400 text-sm">Vercel</p>
                                    </div>
                                </div>
                            </div>
                            <p className="text-slate-300 leading-relaxed">
                                These providers have limited access to your data solely to perform these tasks on our behalf and are obligated not to disclose or use it for other purposes.
                            </p>
                        </section>

                        {/* Section 5 */}
                        <section className="mb-10">
                            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-3">
                                <span className="w-8 h-8 rounded-lg bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-sm text-purple-400 font-bold">5</span>
                                Data Retention
                            </h2>
                            <p className="text-slate-300 leading-relaxed">
                                We retain your personal data and generated content for as long as your account is active. You may delete your account or specific documents at any time via the Dashboard, which will remove this data from our active servers.
                            </p>
                        </section>

                        {/* Section 6 */}
                        <section className="mb-10">
                            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-3">
                                <span className="w-8 h-8 rounded-lg bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-sm text-purple-400 font-bold">6</span>
                                Your Rights
                            </h2>
                            <p className="text-slate-300 leading-relaxed mb-4">
                                Depending on your location, you may have the right to:
                            </p>
                            <ul className="space-y-3 text-slate-300">
                                <li className="flex items-start gap-3">
                                    <span className="text-purple-400 mt-1">•</span>
                                    <span>Access the personal data we hold about you.</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <span className="text-purple-400 mt-1">•</span>
                                    <span>Request correction or deletion of your data.</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <span className="text-purple-400 mt-1">•</span>
                                    <span>Withdraw consent for data processing.</span>
                                </li>
                            </ul>
                        </section>

                        {/* Section 7 */}
                        <section className="mb-10">
                            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-3">
                                <span className="w-8 h-8 rounded-lg bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-sm text-purple-400 font-bold">7</span>
                                Contact Us
                            </h2>
                            <p className="text-slate-300 leading-relaxed mb-4">
                                If you have any questions about this Privacy Policy, please contact us at:
                            </p>
                            <div className="p-4 rounded-xl bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20">
                                <p className="text-white font-medium">
                                    Email:{" "}
                                    <a
                                        href="mailto:yourskoowlai@gmail.com"
                                        className="text-purple-400 hover:text-purple-300 transition-colors"
                                    >
                                        yourskoowlai@gmail.com
                                    </a>
                                </p>
                            </div>
                        </section>
                    </article>
                </div>
            </main>

            {/* Footer */}
            <footer className="border-t border-white/10 bg-black/20">
                <div className="max-w-4xl mx-auto px-6 py-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 text-center md:text-left">
                        <p className="text-slate-500 text-sm order-2 md:order-1">
                            © {new Date().getFullYear()} skoowl ai. All rights reserved.
                        </p>
                        <p className="text-slate-500 text-sm order-1 md:order-2">
                            Built with <span className="text-purple-400">💜</span> by Fais Wibowo
                        </p>
                    </div>
                </div>
            </footer>
        </div>
    );
}
