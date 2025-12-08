import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = {
    title: "Terms of Service - skoowl ai",
    description: "Read the terms and conditions for using skoowl ai.",
};

export default function TermsOfServicePage() {
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
                                Terms of Service
                            </h1>
                            <p className="text-slate-400">
                                <strong>Last Updated:</strong> 5 December 2025
                            </p>
                        </div>

                        {/* Section 1 */}
                        <section className="mb-10">
                            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-3">
                                <span className="w-8 h-8 rounded-lg bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-sm text-purple-400 font-bold">1</span>
                                Acceptance of Terms
                            </h2>
                            <p className="text-slate-300 leading-relaxed">
                                By accessing or using skoowl ai, you agree to be bound by these Terms of Service. If you do not agree, you may not access the service.
                            </p>
                        </section>

                        {/* Section 2 */}
                        <section className="mb-10">
                            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-3">
                                <span className="w-8 h-8 rounded-lg bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-sm text-purple-400 font-bold">2</span>
                                Description of Service
                            </h2>
                            <p className="text-slate-300 leading-relaxed">
                                Skoowl ai is an AI-powered study assistant that generates notes, flashcards, quizzes, and mind maps from user-uploaded content.
                            </p>
                        </section>

                        {/* Section 3 - Important */}
                        <section className="mb-10">
                            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-3">
                                <span className="w-8 h-8 rounded-lg bg-yellow-500/20 border border-yellow-500/30 flex items-center justify-center text-sm text-yellow-400 font-bold">3</span>
                                AI Disclaimer
                                <span className="px-2 py-0.5 rounded-full bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 text-xs font-medium">Important</span>
                            </h2>
                            <div className="space-y-4">
                                <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
                                    <p className="text-slate-300 leading-relaxed">
                                        <strong className="text-yellow-400">Accuracy:</strong> skoowl ai uses artificial intelligence to generate content. AI can make mistakes, &ldquo;hallucinate,&rdquo; or omit information. You should strictly verify any generated notes or quiz answers against your original study materials.
                                    </p>
                                </div>
                                <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
                                    <p className="text-slate-300 leading-relaxed">
                                        <strong className="text-yellow-400">No Academic Guarantees:</strong> We are not responsible for any grades, exam results, or academic outcomes resulting from the use of our tools. Use this tool as a supplement to, not a replacement for, your own studying.
                                    </p>
                                </div>
                            </div>
                        </section>

                        {/* Section 4 */}
                        <section className="mb-10">
                            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-3">
                                <span className="w-8 h-8 rounded-lg bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-sm text-purple-400 font-bold">4</span>
                                User Accounts
                            </h2>
                            <ul className="space-y-3 text-slate-300">
                                <li className="flex items-start gap-3">
                                    <span className="text-purple-400 mt-1">•</span>
                                    <span>You are responsible for maintaining the security of your account credentials.</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <span className="text-purple-400 mt-1">•</span>
                                    <span>You must be at least 13 years old to use this service.</span>
                                </li>
                            </ul>
                        </section>

                        {/* Section 5 */}
                        <section className="mb-10">
                            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-3">
                                <span className="w-8 h-8 rounded-lg bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-sm text-purple-400 font-bold">5</span>
                                User Content & Ownership
                            </h2>
                            <div className="space-y-4">
                                <div className="p-4 rounded-xl bg-slate-800/50 border border-white/10">
                                    <p className="text-slate-300 leading-relaxed">
                                        <strong className="text-white">Your Rights:</strong> You retain full ownership of the documents and media you upload.
                                    </p>
                                </div>
                                <div className="p-4 rounded-xl bg-slate-800/50 border border-white/10">
                                    <p className="text-slate-300 leading-relaxed">
                                        <strong className="text-white">License to Us:</strong> By uploading content, you grant skoowl ai a temporary, worldwide license to process, host, and modify that content solely for the purpose of generating your study materials.
                                    </p>
                                </div>
                                <div className="p-4 rounded-xl bg-slate-800/50 border border-white/10">
                                    <p className="text-slate-300 leading-relaxed">
                                        <strong className="text-white">Copyright:</strong> You agree not to upload content that violates the copyright or intellectual property rights of others (e.g., pirated textbooks).
                                    </p>
                                </div>
                            </div>
                        </section>

                        {/* Section 6 */}
                        <section className="mb-10">
                            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-3">
                                <span className="w-8 h-8 rounded-lg bg-red-500/20 border border-red-500/30 flex items-center justify-center text-sm text-red-400 font-bold">6</span>
                                Prohibited Conduct
                            </h2>
                            <p className="text-slate-300 leading-relaxed mb-4">
                                You agree not to:
                            </p>
                            <ul className="space-y-3 text-slate-300">
                                <li className="flex items-start gap-3">
                                    <span className="text-red-400 mt-1">✕</span>
                                    <span>Use the service for any illegal purpose.</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <span className="text-red-400 mt-1">✕</span>
                                    <span>Attempt to reverse-engineer the AI or scrape data from the site.</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <span className="text-red-400 mt-1">✕</span>
                                    <span>Upload malicious code or viruses.</span>
                                </li>
                            </ul>
                        </section>

                        {/* Section 7 */}
                        <section className="mb-10">
                            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-3">
                                <span className="w-8 h-8 rounded-lg bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-sm text-purple-400 font-bold">7</span>
                                Termination
                            </h2>
                            <p className="text-slate-300 leading-relaxed">
                                We reserve the right to suspend or terminate your account at our discretion if you violate these Terms, specifically regarding prohibited content or abuse of the service.
                            </p>
                        </section>

                        {/* Section 8 */}
                        <section className="mb-10">
                            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-3">
                                <span className="w-8 h-8 rounded-lg bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-sm text-purple-400 font-bold">8</span>
                                Limitation of Liability
                            </h2>
                            <p className="text-slate-300 leading-relaxed">
                                To the fullest extent permitted by law, skoowl ai shall not be liable for any indirect, incidental, or consequential damages arising out of your use of the service, including data loss or service interruptions.
                            </p>
                        </section>

                        {/* Section 9 */}
                        <section className="mb-10">
                            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-3">
                                <span className="w-8 h-8 rounded-lg bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-sm text-purple-400 font-bold">9</span>
                                Changes to Terms
                            </h2>
                            <p className="text-slate-300 leading-relaxed">
                                We may modify these terms at any time. Continued use of the service signifies your acceptance of the updated terms.
                            </p>
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
