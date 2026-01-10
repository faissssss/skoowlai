'use client';

import Link from 'next/link';
import { ShaderGradientCanvas, ShaderGradient } from '@shadergradient/react'
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Mic, Youtube, Brain, Layers, CheckCircle, Network, Sparkles, Menu, X, Upload, FileType, Headphones, Users, HelpCircle, Plus } from 'lucide-react';
import { useEffect, useState, useRef } from 'react';
import { SignedIn, SignedOut, UserButton } from '@clerk/nextjs';
import BugReportModal from '@/components/BugReportModal';
import FeedbackModal from '@/components/FeedbackModal';
import PricingModal from '@/components/PricingModal';
import Testimonials from '@/components/landing/Testimonials';

import { AnimatedGradientText } from '@/components/magicui/animated-gradient-text';
import { AvatarCircles } from '@/components/magicui/avatar-circles';
import { IS_PRE_LAUNCH } from '@/lib/config';

// Avatar data for social proof
const avatarUrls = [
  { imageUrl: "https://avatars.githubusercontent.com/u/16860528" },
  { imageUrl: "https://avatars.githubusercontent.com/u/20110627" },
  { imageUrl: "https://avatars.githubusercontent.com/u/106103625" },
  { imageUrl: "https://avatars.githubusercontent.com/u/59228569" },
  { imageUrl: "https://avatars.githubusercontent.com/u/59442788" },
];

// Count-up number component with scroll trigger
function CountUpNumber({ value, duration = 2.5, className }: { value: number; duration?: number; className?: string }) {
  const [count, setCount] = useState(0);
  const [hasAnimated, setHasAnimated] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated) {
          setHasAnimated(true);
          const startTime = performance.now();
          const animate = (currentTime: number) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / (duration * 1000), 1);
            // easeOut curve
            const easeOut = 1 - Math.pow(1 - progress, 3);
            setCount(Math.floor(easeOut * value));
            if (progress < 1) {
              requestAnimationFrame(animate);
            }
          };
          requestAnimationFrame(animate);
        }
      },
      { threshold: 0.3 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, [value, duration, hasAnimated]);

  return <span ref={ref} className={className}>{count}+</span>;
}

// Text loop effect component for dynamic text
const dynamicWords = ['Smart Notes', 'Quizzes', 'Flashcards', 'Mind Maps'];

function TextLoop() {
  const [currentWordIndex, setCurrentWordIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentWordIndex((prev) => (prev + 1) % dynamicWords.length);
    }, 2500);

    return () => clearInterval(interval);
  }, []);

  return (
    <motion.span
      key={currentWordIndex}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.5 }}
      className="inline-block"
    >
      <AnimatedGradientText
        colorFrom="#818cf8"
        colorTo="#e879f9"
      >
        {dynamicWords[currentWordIndex]}
      </AnimatedGradientText>
    </motion.span>
  );
}

// FAQ Accordion Component
const faqItems = [
  {
    question: "What file formats can I upload?",
    answer: "We support a wide range of inputs. You can upload documents (PDF, DOCX, PPT, TXT), record audio directly for lectures, or simply paste a YouTube video link to instantly generate study materials."
  },
  {
    question: "Can I edit the AI-generated content?",
    answer: "Absolutely. The AI gives you a head start, but you have full control. You can edit text in notes, modify flashcards, and adjust mind map nodes to ensure everything is perfect."
  },
  {
    question: "Can I customize the features?",
    answer: "Yes, you can set up your own configuration. Before generating, you can choose specific settings to match your style."
  },
  {
    question: "Is Skoowl AI free to use?",
    answer: "Yes! You can start studying for free with our basic plan, which gives you access to all core features."
  },
  {
    question: "Does it work on mobile devices?",
    answer: "Not yet. We are currently creating a high-performance desktop experience optimized for deep study sessions, but a mobile companion app is coming soon."
  }
];

function FAQAccordion() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="space-y-3">
      {faqItems.map((item, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: index * 0.1 }}
          viewport={{ once: true }}
        >
          <div
            className={`rounded-xl border transition-all duration-300 ${openIndex === index
              ? 'bg-white/5 border-violet-500/50 shadow-lg shadow-violet-500/10'
              : 'bg-white/5 border-white/10 hover:border-white/20'
              }`}
          >
            <button
              onClick={() => setOpenIndex(openIndex === index ? null : index)}
              className="w-full flex items-center justify-between p-5 text-left"
            >
              <span className={`font-medium transition-colors ${openIndex === index ? 'text-white' : 'text-slate-200'
                }`}>
                {item.question}
              </span>
              <motion.div
                animate={{ rotate: openIndex === index ? 45 : 0 }}
                transition={{ duration: 0.2 }}
                className={`flex-shrink-0 ml-4 ${openIndex === index ? 'text-violet-400' : 'text-slate-400'
                  }`}
              >
                <Plus className="w-5 h-5" />
              </motion.div>
            </button>

            <AnimatePresence>
              {openIndex === index && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: [0.04, 0.62, 0.23, 0.98] }}
                  className="overflow-hidden"
                >
                  <div className="px-5 pb-5 text-slate-400 leading-relaxed">
                    {item.answer}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      ))}
    </div>
  );
}


// Hero visual - empty placeholder
function HeroVisual() {
  return null;
}

export default function LandingPage() {
  const [isBugReportOpen, setIsBugReportOpen] = useState(false);

  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [isPricingOpen, setIsPricingOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="relative min-h-screen overflow-hidden bg-black">
      {/* ShaderGradient Background */}
      <div className="absolute inset-0 z-0 w-full h-full">
        <ShaderGradientCanvas
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
          }}
        >
          <ShaderGradient
            animate="on"
            brightness={0.5}
            cAzimuthAngle={180}
            cDistance={10}
            cPolarAngle={70}
            cameraZoom={1}
            color1="#020024"
            color2="#0f172a"
            color3="#8b5cf6"
            envPreset="city"
            grain="off"
            lightType="3d"
            positionX={0}
            positionY={-1}
            positionZ={0}
            reflection={0.1}
            rotationX={0}
            rotationY={0}
            rotationZ={0}
            type="waterPlane"
            uDensity={2}
            uFrequency={5}
            uSpeed={0.1}
            uStrength={3}
            uTime={0.2}
          />
        </ShaderGradientCanvas>
      </div>

      {/* Ambient glow effects */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-indigo-600/15 rounded-full blur-[100px] pointer-events-none" />

      {/* Glassmorphic Navigation */}
      <nav className="fixed top-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-7xl px-4 sm:px-6">
        <div className="w-full px-6 py-4 rounded-2xl bg-slate-900/40 backdrop-blur-xl border border-white/10 shadow-lg relative">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2">
              <img src="/skoowl-logo.png" alt="skoowl" className="w-9 h-9" />
              <span className="text-xl font-bold text-white">skoowl ai</span>
            </Link>

            {/* Desktop Navigation - Absolutely Centered */}
            <div className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 items-center gap-8">
              <a href="#features" className="text-slate-400 hover:text-white transition-colors text-sm font-medium">Features</a>
              <a href="#how-it-works" className="text-slate-400 hover:text-white transition-colors text-sm font-medium">How it Works</a>
              {!IS_PRE_LAUNCH && (
                <button onClick={() => setIsPricingOpen(true)} className="text-slate-400 hover:text-white transition-colors text-sm font-medium">Pricing</button>
              )}
              <a href="https://changelog.skoowlai.com" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-white transition-colors text-sm font-medium">Changelog</a>
              <Link href="/careers" className="text-slate-400 hover:text-white transition-colors text-sm font-medium">Careers</Link>
            </div>

            {/* Right Side Actions */}
            <div className="flex items-center gap-4">
              {/* Mobile Menu Button */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="md:hidden p-2 text-slate-400 hover:text-white transition-colors"
                aria-label="Toggle menu"
              >
                {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>

              {/* Auth Buttons */}
              <div className="hidden md:flex items-center gap-3" suppressHydrationWarning>
                <SignedOut>
                  <Link href="/sign-in" className="text-slate-300 hover:text-white transition-colors text-sm font-medium px-4 py-2">
                    Sign In
                  </Link>
                  <Link href="/sign-up">
                    <button className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-semibold hover:from-indigo-500 hover:to-purple-500 transition-all shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40">
                      Get Started
                    </button>
                  </Link>
                </SignedOut>
                <SignedIn>
                  <Link href="/dashboard" className="text-slate-300 hover:text-white transition-colors text-sm font-medium px-4 py-2">
                    Dashboard
                  </Link>
                  <UserButton
                    afterSignOutUrl="/"
                    appearance={{
                      elements: {
                        avatarBox: "w-9 h-9",
                      },
                    }}
                  />
                </SignedIn>
              </div>
            </div>
          </div>

          {/* Mobile Menu Dropdown */}
          <AnimatePresence>
            {isMobileMenuOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                className="md:hidden overflow-hidden"
              >
                <div className="pt-4 pb-2 space-y-3 border-t border-white/10 mt-4">
                  <a href="#features" onClick={() => setIsMobileMenuOpen(false)} className="block text-slate-400 hover:text-white transition-colors text-sm font-medium py-2">Features</a>
                  <a href="#how-it-works" onClick={() => setIsMobileMenuOpen(false)} className="block text-slate-400 hover:text-white transition-colors text-sm font-medium py-2">How it Works</a>
                  {!IS_PRE_LAUNCH && (
                    <button onClick={() => { setIsPricingOpen(true); setIsMobileMenuOpen(false); }} className="block w-full text-left text-slate-400 hover:text-white transition-colors text-sm font-medium py-2">Pricing</button>
                  )}
                  <a href="https://changelog.skoowlai.com" target="_blank" rel="noopener noreferrer" onClick={() => setIsMobileMenuOpen(false)} className="block text-slate-400 hover:text-white transition-colors text-sm font-medium py-2">Changelog</a>
                  <Link href="/careers" onClick={() => setIsMobileMenuOpen(false)} className="block text-slate-400 hover:text-white transition-colors text-sm font-medium py-2">Careers</Link>
                  <div className="pt-3 border-t border-white/10 space-y-2" suppressHydrationWarning>
                    <SignedOut>
                      <Link href="/sign-in" onClick={() => setIsMobileMenuOpen(false)} className="block text-slate-300 hover:text-white transition-colors text-sm font-medium py-2">
                        Sign In
                      </Link>
                      <Link href="/sign-up" onClick={() => setIsMobileMenuOpen(false)}>
                        <button className="w-full px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-semibold hover:from-indigo-500 hover:to-purple-500 transition-all shadow-lg shadow-purple-500/25">
                          Get Started
                        </button>
                      </Link>
                    </SignedOut>
                    <SignedIn>
                      <Link href="/dashboard" onClick={() => setIsMobileMenuOpen(false)} className="block text-slate-300 hover:text-white transition-colors text-sm font-medium py-2">
                        Dashboard
                      </Link>
                      <div className="flex items-center justify-between py-2">
                        <span className="text-slate-400 text-sm">Account</span>
                        <UserButton
                          afterSignOutUrl="/"
                          appearance={{
                            elements: {
                              avatarBox: "w-8 h-8",
                            },
                          }}
                        />
                      </div>
                    </SignedIn>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="relative pt-24 lg:pt-28 pb-12">
        <div className="max-w-4xl mx-auto px-6">
          {/* Centered Content */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center"
          >
            {/* Badge with Animated Gradient Border */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="inline-flex mb-5"
            >
              <div className="group relative mx-auto flex items-center justify-center rounded-full px-4 py-1.5 shadow-[inset_0_-8px_10px_#8fdfff1f] transition-shadow duration-500 ease-out hover:shadow-[inset_0_-5px_10px_#8fdfff3f] bg-slate-900/50 backdrop-blur-sm">
                <span
                  className="animate-gradient absolute inset-0 block h-full w-full rounded-[inherit] bg-gradient-to-r from-[#ffaa40]/50 via-[#9c40ff]/50 to-[#ffaa40]/50 bg-[length:300%_100%] p-[1px]"
                  style={{
                    WebkitMask:
                      "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                    WebkitMaskComposite: "destination-out",
                    mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                    maskComposite: "subtract",
                  }}
                />
                <Sparkles className="w-4 h-4 text-amber-400" />
                <hr className="mx-2 h-4 w-px shrink-0 bg-neutral-500" />
                <span className="text-neutral-200 text-sm font-medium">AI-Powered Study Assistant</span>
              </div>
            </motion.div>

            {/* Headline with Text Loop Effect */}
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight mb-5">
              Turn Your Materials into
              <br />
              <AnimatePresence mode="wait">
                <TextLoop />
              </AnimatePresence>
            </h1>

            {/* Subheadline */}
            <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-6">
              Upload your PDFs, PPTs, DOCXs, TXT, record lectures, or paste YouTube links — let AI do the rest.
            </p>

            {/* CTA Button */}
            <div className="flex flex-col items-center gap-4">
              <Link href="/dashboard">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="relative px-8 py-4 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 bg-[length:200%_100%] text-white font-semibold text-lg shadow-2xl shadow-purple-500/30 hover:shadow-purple-500/50 transition-all group overflow-hidden"
                >
                  <span className="relative z-10">Get Started for Free</span>
                  <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                </motion.button>
              </Link>

              {/* Avatar Circles - Social Proof */}
              <div className="flex items-center gap-3">
                <AvatarCircles avatarUrls={avatarUrls} />
                <span className="text-slate-400 text-sm">Join 100+ students</span>
              </div>
            </div>
          </motion.div>
        </div>
      </main>

      {/* Statistics Section */}
      <section className="relative py-16">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          variants={{
            hidden: { opacity: 0 },
            visible: {
              opacity: 1,
              transition: { staggerChildren: 0.1 }
            }
          }}
          className="max-w-4xl mx-auto px-6"
        >
          {/* Section Title */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            viewport={{ once: false }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4">
              Trusted by Students{' '}
              <AnimatedGradientText colorFrom="#c084fc" colorTo="#f472b6">
                Everywhere
              </AnimatedGradientText>
            </h2>
            <p className="text-lg text-slate-400 max-w-xl mx-auto">
              Numbers that speak for themselves
            </p>
          </motion.div>

          {/* Students - Main Stat (Bigger) */}
          <motion.div
            variants={{
              hidden: { opacity: 0, y: 20 },
              visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
            }}
            className="text-center mb-10"
          >
            <div className="flex items-center justify-center gap-3 mb-2">
              <div className="p-3 rounded-2xl bg-violet-500/20 border border-violet-500/30">
                <Users className="w-8 h-8 text-violet-400" />
              </div>
            </div>
            <CountUpNumber value={100} duration={2.5} className="text-6xl md:text-7xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-400" />
            <p className="text-slate-400 text-lg mt-2">Students Learning</p>
          </motion.div>

          {/* Other 4 Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
            <motion.div
              variants={{
                hidden: { opacity: 0, y: 20 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
              }}
              className="text-center"
            >
              <div className="flex justify-center mb-2">
                <div className="p-2 rounded-xl bg-blue-500/20 border border-blue-500/30">
                  <FileText className="w-5 h-5 text-blue-400" />
                </div>
              </div>
              <CountUpNumber value={300} duration={2.5} className="text-3xl md:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-400" />
              <p className="text-slate-400 text-sm mt-1">Notes Created</p>
            </motion.div>

            <motion.div
              variants={{
                hidden: { opacity: 0, y: 20 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
              }}
              className="text-center"
            >
              <div className="flex justify-center mb-2">
                <div className="p-2 rounded-xl bg-emerald-500/20 border border-emerald-500/30">
                  <Layers className="w-5 h-5 text-emerald-400" />
                </div>
              </div>
              <CountUpNumber value={200} duration={2.5} className="text-3xl md:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-400" />
              <p className="text-slate-400 text-sm mt-1">Flashcards Made</p>
            </motion.div>

            <motion.div
              variants={{
                hidden: { opacity: 0, y: 20 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
              }}
              className="text-center"
            >
              <div className="flex justify-center mb-2">
                <div className="p-2 rounded-xl bg-yellow-500/20 border border-yellow-500/30">
                  <HelpCircle className="w-5 h-5 text-yellow-400" />
                </div>
              </div>
              <CountUpNumber value={500} duration={2.5} className="text-3xl md:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-400" />
              <p className="text-slate-400 text-sm mt-1">Quizzes Created</p>
            </motion.div>

            <motion.div
              variants={{
                hidden: { opacity: 0, y: 20 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
              }}
              className="text-center"
            >
              <div className="flex justify-center mb-2">
                <div className="p-2 rounded-xl bg-pink-500/20 border border-pink-500/30">
                  <Network className="w-5 h-5 text-pink-400" />
                </div>
              </div>
              <CountUpNumber value={100} duration={2.5} className="text-3xl md:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-400" />
              <p className="text-slate-400 text-sm mt-1">Mind Maps</p>
            </motion.div>
          </div>
        </motion.div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="relative py-16 overflow-hidden">
        {/* Background glow effects */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-purple-600/10 rounded-full blur-[150px] pointer-events-none" />

        <div className="max-w-7xl mx-auto px-6">
          {/* Section Header */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            viewport={{ once: false }}
            className="text-center mb-20"
          >
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-6">
              From Chaos to{' '}
              <AnimatedGradientText colorFrom="#c084fc" colorTo="#f472b6">
                Clarity
              </AnimatedGradientText>
              {' '}in 3 Steps
            </h2>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto">
              Stop manually summarizing. Let AI transform your raw materials into interactive study tools instantly.
            </p>
          </motion.div>

          {/* 3-Step Process with Connectors */}
          <div className="relative">
            {/* Animated Energy Beam Connector */}
            <svg className="absolute top-1/2 left-0 w-full h-32 -translate-y-1/2 pointer-events-none hidden lg:block" viewBox="0 0 1200 100" fill="none">
              <defs>
                <linearGradient id="beamGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#818cf8" stopOpacity="0.3" />
                  <stop offset="50%" stopColor="#c084fc" stopOpacity="0.6" />
                  <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.3" />
                </linearGradient>
                <filter id="glow">
                  <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                  <feMerge>
                    <feMergeNode in="coloredBlur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              {/* Beam path from card 1 to card 2 */}
              <motion.path
                d="M200 50 C 300 50, 350 50, 400 50 C 450 50, 500 50, 600 50"
                stroke="url(#beamGradient)"
                strokeWidth="3"
                fill="none"
                filter="url(#glow)"
                initial={{ pathLength: 0, opacity: 0 }}
                whileInView={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 1.5, delay: 0.5 }}
                viewport={{ once: true }}
              />
              {/* Beam path from card 2 to card 3 */}
              <motion.path
                d="M600 50 C 700 50, 750 50, 800 50 C 850 50, 900 50, 1000 50"
                stroke="url(#beamGradient)"
                strokeWidth="3"
                fill="none"
                filter="url(#glow)"
                initial={{ pathLength: 0, opacity: 0 }}
                whileInView={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 1.5, delay: 1 }}
                viewport={{ once: true }}
              />
              {/* Animated pulse dots */}
            </svg>

            {/* Step Cards */}
            <div className="grid lg:grid-cols-3 gap-8 relative z-10">
              {/* Step 1: Upload & Capture */}
              <motion.div
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                viewport={{ once: true }}
                whileHover={{ y: -8, scale: 1.02 }}
                className="group relative"
              >
                <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-blue-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity blur-xl" />
                <div className="relative p-8 rounded-3xl bg-slate-900/60 backdrop-blur-xl border border-white/10 group-hover:border-blue-500/40 transition-all h-full">
                  {/* Step Number */}
                  <div className="absolute -top-4 -left-4 w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white font-bold shadow-lg shadow-blue-500/30">
                    1
                  </div>

                  {/* Icon Group */}
                  <div className="mb-6 flex items-center justify-center">
                    <div className="relative">
                      <div
                        className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-400/30 flex items-center justify-center shadow-[0_0_30px_rgba(59,130,246,0.4)]"
                      >
                        <div className="flex items-center gap-1">
                          <FileText className="w-6 h-6 text-blue-400" />
                          <Mic className="w-5 h-5 text-cyan-400" />
                          <Youtube className="w-5 h-5 text-red-400" />
                        </div>
                      </div>
                      <Upload className="absolute -bottom-2 -right-2 w-8 h-8 text-blue-400 bg-slate-900 rounded-lg p-1.5 border border-blue-400/30" />
                    </div>
                  </div>

                  <h3 className="text-xl font-bold text-white mb-3">Upload Anything</h3>
                  <p className="text-slate-400 leading-relaxed">
                    Drag & drop PDFs, documents, record lectures directly, or paste YouTube URLs.
                  </p>
                </div>
              </motion.div>

              {/* Step 2: AI Synthesis */}
              <motion.div
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.4 }}
                viewport={{ once: true }}
                whileHover={{ y: -8, scale: 1.02 }}
                className="group relative"
              >
                {/* Enhanced purple glow for the "magic" step */}
                <div
                  className="absolute inset-0 rounded-3xl bg-gradient-to-br from-purple-500/30 to-pink-500/20 blur-xl opacity-40"
                />
                <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-purple-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity blur-xl" />
                <div className="relative p-8 rounded-3xl bg-slate-900/70 backdrop-blur-xl border border-purple-500/30 group-hover:border-purple-400/60 transition-all h-full">
                  {/* Step Number */}
                  <div className="absolute -top-4 -left-4 w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold shadow-lg shadow-purple-500/30">
                    2
                  </div>

                  {/* AI Brain Icon */}
                  <div className="mb-6 flex items-center justify-center">
                    <div
                      className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500/30 to-pink-500/20 border border-purple-400/40 flex items-center justify-center shadow-[0_0_40px_rgba(168,85,247,0.5)]"
                    >
                      <Brain className="w-10 h-10 text-purple-400" />
                    </div>
                  </div>

                  <h3 className="text-xl font-bold text-white mb-3">Deep Processing</h3>
                  <p className="text-slate-400 leading-relaxed">
                    Our advanced AI analyzes concepts, structures hierarchies, and extracts key information instantly.
                  </p>
                </div>
              </motion.div>

              {/* Step 3: Master Your Topic */}
              <motion.div
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.6 }}
                viewport={{ once: true }}
                whileHover={{ y: -8, scale: 1.02 }}
                className="group relative"
              >
                <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-cyan-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity blur-xl" />
                <div className="relative p-8 rounded-3xl bg-slate-900/60 backdrop-blur-xl border border-white/10 group-hover:border-cyan-500/40 transition-all h-full">
                  {/* Step Number */}
                  <div className="absolute -top-4 -left-4 w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-indigo-500 flex items-center justify-center text-white font-bold shadow-lg shadow-cyan-500/30">
                    3
                  </div>

                  {/* Output Tools Icon */}
                  <div className="mb-6 flex items-center justify-center">
                    <div
                      className="w-24 h-24 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-indigo-500/20 border border-cyan-400/30 flex items-center justify-center shadow-[0_0_30px_rgba(34,211,238,0.4)]"
                    >
                      <div className="grid grid-cols-2 gap-2">
                        <FileText className="w-5 h-5 text-blue-400" />
                        <CheckCircle className="w-5 h-5 text-green-400" />
                        <Layers className="w-5 h-5 text-cyan-400" />
                        <Network className="w-5 h-5 text-pink-400" />
                      </div>
                    </div>
                  </div>

                  <h3 className="text-xl font-bold text-white mb-3">Start Studying</h3>
                  <p className="text-slate-400 leading-relaxed">
                    Dive into generated Notes, Quizzes, Flashcards, and Interactive Mind Maps designed for retention.
                  </p>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section - Zig-Zag Layout */}
      <section id="features" className="relative py-16 overflow-hidden">
        {/* Glowing Thread Connector - Simplified */}
        <div className="absolute left-1/2 top-0 bottom-0 w-px -translate-x-1/2 hidden lg:block">
          <div className="h-full w-full bg-gradient-to-b from-transparent via-purple-500/20 to-transparent" />
        </div>

        <div className="max-w-7xl mx-auto px-6">
          {/* Section Header */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            viewport={{ once: false }}
            className="text-center mb-24"
          >
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-6">
              Everything You Need to{' '}
              <AnimatedGradientText colorFrom="#c084fc" colorTo="#f472b6">
                Excel
              </AnimatedGradientText>
            </h2>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto">
              Transform how you study with AI-powered tools designed for maximum retention.
            </p>
          </motion.div>

          {/* Feature 1: AI Notes (Text Left | Visual Right) */}
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center mb-32">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7 }}
              viewport={{ once: true }}
              className="order-2 lg:order-1"
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 mb-4">
                <FileText className="w-4 h-4 text-blue-400" />
                <span className="text-blue-400 text-sm font-medium">Smart Notes</span>
              </div>
              <h3 className="text-2xl md:text-3xl font-bold text-white mb-4">
                Instant Smart Summaries.
              </h3>
              <p className="text-slate-400 text-lg leading-relaxed mb-6">
                Stop drowning in text. Upload PDFs or record lectures, and let AI extract key concepts, definitions, and action items in seconds.
              </p>
              <Link href="/dashboard" className="inline-flex items-center gap-2 text-purple-400 hover:text-purple-300 font-medium transition-colors">
                See an example →
              </Link>
            </motion.div>

            {/* Visual: Smart Notes Preview */}
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7 }}
              viewport={{ once: true }}
              className="order-1 lg:order-2"
            >
              <div className="relative">
                <div className="rounded-2xl overflow-hidden bg-slate-900 border border-blue-500/20 shadow-2xl shadow-blue-500/10 transform rotate-1 hover:rotate-0 transition-transform">
                  {/* Header */}
                  <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
                    <h4 className="text-white font-semibold">Study Notes</h4>
                    <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-sm border border-white/10">
                      <span>✏️</span> Edit Notes
                    </button>
                  </div>

                  {/* Content */}
                  <div className="p-6 space-y-5">
                    {/* Title */}
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                      <span>📚</span> Robotics Engineering: A High-Level Roadmap
                    </h3>

                    {/* Quote Block */}
                    <div className="border-l-4 border-purple-500 pl-4 py-2 bg-purple-500/5 rounded-r-lg">
                      <p className="text-slate-300 text-sm italic leading-relaxed">
                        "This roadmap provides a high-level overview of robotics engineering, breaking it down into four core pillars."
                      </p>
                    </div>

                    {/* Learning Objectives */}
                    <div className="space-y-3">
                      <h4 className="text-base font-semibold text-white flex items-center gap-2">
                        <span>🎯</span> Learning Objectives
                      </h4>
                      <p className="text-slate-400 text-sm">After studying these notes, you will be able to:</p>
                      <ul className="space-y-1.5 text-sm text-slate-300 pl-1">
                        <li>• Understand the major interconnected fields in robotics.</li>
                        <li>• Identify key concepts within Control, Software, and Math.</li>
                        <li>• Recognize algorithms used in robot development.</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Feature 2: Flashcards (Visual Left | Text Right) */}
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center mb-32">
            {/* Visual: Flashcard */}
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7 }}
              viewport={{ once: true }}
            >
              <div className="relative">
                <div className="relative p-8 rounded-2xl bg-slate-800 border border-green-500/20 transform -rotate-2 hover:rotate-0 transition-transform shadow-2xl">
                  {/* Card Label */}
                  <div className="flex items-center justify-between mb-6">
                    <span className="text-slate-500 text-sm">Biology - Photosynthesis</span>
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                      <span className="text-green-400 text-xs">Due today</span>
                    </div>
                  </div>
                  {/* Question */}
                  <div className="text-center py-8">
                    <p className="text-white text-lg font-medium leading-relaxed">
                      What is the process by which plants convert light energy into chemical energy?
                    </p>
                  </div>
                  {/* Controls */}
                  <div className="flex items-center justify-between pt-4 border-t border-white/10">
                    <button className="text-slate-400 hover:text-white transition-colors">←</button>
                    <div className="flex items-center gap-3">
                      <span className="text-slate-500 text-sm">1 / 5</span>
                      <button className="px-4 py-2 rounded-lg bg-purple-500/20 text-purple-400 text-sm font-medium hover:bg-purple-500/30 transition-colors">
                        Flip
                      </button>
                    </div>
                    <button className="text-slate-400 hover:text-white transition-colors">→</button>
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7 }}
              viewport={{ once: true }}
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 mb-4">
                <Layers className="w-4 h-4 text-purple-400" />
                <span className="text-purple-400 text-sm font-medium">Flashcards</span>
              </div>
              <h3 className="text-2xl md:text-3xl font-bold text-white mb-4">
                Retention Engineered.
              </h3>
              <p className="text-slate-400 text-lg leading-relaxed mb-6">
                Forget rote memorization. Our Spaced Repetition System (SRS) predicts exactly when you're about to forget a card and surfaces it.
              </p>
              <Link href="/dashboard" className="inline-flex items-center gap-2 text-purple-400 hover:text-purple-300 font-medium transition-colors">
                Try flashcards →
              </Link>
            </motion.div>
          </div>

          {/* Feature 3: Quizzes (Text Left | Visual Right) */}
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center mb-32">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7 }}
              viewport={{ once: true }}
              className="order-2 lg:order-1"
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/20 mb-4">
                <HelpCircle className="w-4 h-4 text-yellow-400" />
                <span className="text-yellow-400 text-sm font-medium">Quizzes</span>
              </div>
              <h3 className="text-2xl md:text-3xl font-bold text-white mb-4">
                Active Recall on Autopilot.
              </h3>
              <p className="text-slate-400 text-lg leading-relaxed mb-6">
                Turn passive reading into active testing. Generate multiple-choice and short-answer quizzes instantly from your class materials.
              </p>
              <Link href="/dashboard" className="inline-flex items-center gap-2 text-purple-400 hover:text-purple-300 font-medium transition-colors">
                Start a quiz →
              </Link>
            </motion.div>

            {/* Visual: Quiz Interface */}
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7 }}
              viewport={{ once: true }}
              className="order-1 lg:order-2"
            >
              <div className="relative">
                <div className="relative p-6 rounded-2xl bg-slate-900/80 border border-yellow-500/20 transform rotate-1 hover:rotate-0 transition-transform">
                  {/* Quiz Header */}
                  <div className="flex items-center justify-between mb-6">
                    <span className="text-white font-medium">Question 3 of 10</span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 rounded-full bg-slate-700">
                        <div className="w-8 h-full rounded-full bg-gradient-to-r from-yellow-500 to-green-500" />
                      </div>
                      <span className="text-slate-400 text-sm">30%</span>
                    </div>
                  </div>
                  {/* Question */}
                  <p className="text-white text-lg mb-6">
                    Which organelle is responsible for photosynthesis in plant cells?
                  </p>
                  {/* Options */}
                  <div className="space-y-3">
                    <div className="p-3 rounded-xl bg-slate-800/50 border border-white/10 text-slate-400">
                      A. Mitochondria
                    </div>
                    <div className="p-3 rounded-xl bg-green-500/20 border border-green-500/50 text-green-400 flex items-center justify-between">
                      <span>B. Chloroplast</span>
                      <div className="flex items-center gap-1">
                        <CheckCircle className="w-4 h-4" />
                        <span className="text-xs font-medium">Correct!</span>
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-800/50 border border-white/10 text-slate-400">
                      C. Nucleus
                    </div>
                    <div className="p-3 rounded-xl bg-slate-800/50 border border-white/10 text-slate-400">
                      D. Ribosome
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Feature 4: Mind Maps (Visual Left | Text Right) */}
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            {/* Visual: Mind Map */}
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7 }}
              viewport={{ once: true }}
            >
              <div className="relative">
                <div className="relative p-6 rounded-2xl bg-slate-900/80 border border-pink-500/20 transform -rotate-1 hover:rotate-0 transition-transform">
                  {/* Mind Map Visualization */}
                  <svg className="w-full h-48" viewBox="0 0 300 150" fill="none">
                    {/* Central Node */}
                    <motion.rect
                      x="110" y="55" width="80" height="40" rx="8"
                      fill="url(#nodeGradient)"
                      stroke="#a855f7"
                      strokeWidth="2"
                    />
                    <text x="150" y="80" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">Photosynthesis</text>

                    {/* Child Nodes */}
                    <motion.rect x="20" y="20" width="60" height="30" rx="6" fill="#1e293b" stroke="#38bdf8" strokeWidth="1.5" />
                    <text x="50" y="40" textAnchor="middle" fill="#38bdf8" fontSize="8">Light Reactions</text>

                    <motion.rect x="220" y="20" width="60" height="30" rx="6" fill="#1e293b" stroke="#38bdf8" strokeWidth="1.5" />
                    <text x="250" y="40" textAnchor="middle" fill="#38bdf8" fontSize="8">Calvin Cycle</text>

                    <motion.rect x="20" y="100" width="60" height="30" rx="6" fill="#1e293b" stroke="#38bdf8" strokeWidth="1.5" />
                    <text x="50" y="120" textAnchor="middle" fill="#38bdf8" fontSize="8">Chloroplast</text>

                    <motion.rect x="220" y="100" width="60" height="30" rx="6" fill="#1e293b" stroke="#38bdf8" strokeWidth="1.5" />
                    <text x="250" y="120" textAnchor="middle" fill="#38bdf8" fontSize="8">Glucose</text>

                    {/* Connecting Lines with Animation */}
                    <motion.path
                      d="M110 65 Q 80 45, 80 35"
                      stroke="#38bdf8"
                      strokeWidth="2"
                      fill="none"
                      initial={{ pathLength: 0 }}
                      whileInView={{ pathLength: 1 }}
                      transition={{ duration: 1 }}
                    />
                    <motion.path
                      d="M190 65 Q 220 45, 220 35"
                      stroke="#38bdf8"
                      strokeWidth="2"
                      fill="none"
                      initial={{ pathLength: 0 }}
                      whileInView={{ pathLength: 1 }}
                      transition={{ duration: 1, delay: 0.2 }}
                    />
                    <motion.path
                      d="M110 95 Q 80 110, 80 115"
                      stroke="#38bdf8"
                      strokeWidth="2"
                      fill="none"
                      initial={{ pathLength: 0 }}
                      whileInView={{ pathLength: 1 }}
                      transition={{ duration: 1, delay: 0.4 }}
                    />
                    <motion.path
                      d="M190 95 Q 220 110, 220 115"
                      stroke="#38bdf8"
                      strokeWidth="2"
                      fill="none"
                      initial={{ pathLength: 0 }}
                      whileInView={{ pathLength: 1 }}
                      transition={{ duration: 1, delay: 0.6 }}
                    />

                    <defs>
                      <linearGradient id="nodeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#6366f1" />
                        <stop offset="100%" stopColor="#a855f7" />
                      </linearGradient>
                    </defs>
                  </svg>

                  {/* Toolbar */}
                  <div className="flex items-center justify-center gap-2 mt-4">
                    <button className="px-3 py-1.5 rounded-lg bg-purple-500/20 text-purple-400 text-xs font-medium border border-purple-500/30">
                      Radial
                    </button>
                    <button className="px-3 py-1.5 rounded-lg bg-slate-800/50 text-slate-400 text-xs font-medium border border-white/10 hover:border-purple-500/30 transition-colors">
                      Tree
                    </button>
                    <button className="px-3 py-1.5 rounded-lg bg-slate-800/50 text-slate-400 text-xs font-medium border border-white/10 hover:border-purple-500/30 transition-colors">
                      Fishbone
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7 }}
              viewport={{ once: true }}
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-pink-500/10 border border-pink-500/20 mb-4">
                <Network className="w-4 h-4 text-pink-400" />
                <span className="text-pink-400 text-sm font-medium">Mind Maps</span>
              </div>
              <h3 className="text-2xl md:text-3xl font-bold text-white mb-4">
                Visualize the Complexity.
              </h3>
              <p className="text-slate-400 text-lg leading-relaxed mb-6">
                Don't just read linearly. See how concepts connect. Switch layouts from Radial to Tree to Fishbone instantly to fit your mental model.
              </p>
              <Link href="/dashboard" className="inline-flex items-center gap-2 text-purple-400 hover:text-purple-300 font-medium transition-colors">
                Explore mind maps →
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <Testimonials />

      {/* FAQ Section */}
      <section id="faq" className="relative py-16">
        <div className="max-w-2xl mx-auto px-6">
          {/* Section Header */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            viewport={{ once: false }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Common Questions.
            </h2>
            <p className="text-slate-400">
              Everything you need to know about us.
            </p>
          </motion.div>

          {/* Accordion */}
          <FAQAccordion />
        </div>
      </section>

      {/* Footer */}
      <footer className="relative">
        <div className="max-w-7xl mx-auto px-6 py-12">
          {/* Main Footer Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 lg:gap-8">

            {/* Column 1: Brand & Mission */}
            <div className="lg:col-span-2">
              <div className="flex items-center gap-3 mb-4">
                <img src="/skoowl-logo.png" alt="skoowl ai" className="w-10 h-10" />
                <span className="text-xl font-bold text-white">skoowl ai</span>
              </div>
              <p className="text-slate-400 max-w-sm">
                Your Personal AI Study Buddy. Built for students, by a student.
              </p>
            </div>

            {/* Column 2: Support & Legal */}
            <div>
              <h4 className="text-white font-semibold mb-4">Support & Legal</h4>
              <ul className="space-y-3">
                <li>
                  <Link href="/privacy" className="text-slate-400 hover:text-white transition-colors text-sm">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link href="/terms" className="text-slate-400 hover:text-white transition-colors text-sm">
                    Terms of Service
                  </Link>
                </li>
                <li>
                  <button
                    onClick={() => setIsBugReportOpen(true)}
                    className="text-slate-400 hover:text-white transition-colors text-sm"
                  >
                    Report a Bug
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => setIsFeedbackOpen(true)}
                    className="text-slate-400 hover:text-white transition-colors text-sm"
                  >
                    Feedback
                  </button>
                </li>
              </ul>
            </div>

            {/* Column 3: Connect */}
            <div>
              <h4 className="text-white font-semibold mb-4">Connect</h4>
              <div className="grid grid-cols-4 gap-3">
                {/* Twitter/X */}
                <a
                  href="https://x.com/skoowlai"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:border-purple-500/50 hover:bg-purple-500/10 hover:-translate-y-1 transition-all"
                >
                  <svg className="w-5 h-5 text-slate-400 group-hover:text-purple-400 transition-colors" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                </a>

                {/* Discord */}
                <a
                  href="https://discord.gg/QWJXV9k8"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:border-purple-500/50 hover:bg-purple-500/10 hover:-translate-y-1 transition-all"
                >
                  <svg className="w-5 h-5 text-slate-400 group-hover:text-purple-400 transition-colors" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                  </svg>
                </a>

                {/* TikTok */}
                <a
                  href="https://www.tiktok.com/@skoowlai"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:border-purple-500/50 hover:bg-purple-500/10 hover:-translate-y-1 transition-all"
                >
                  <svg className="w-5 h-5 text-slate-400 group-hover:text-purple-400 transition-colors" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
                  </svg>
                </a>

                {/* Instagram */}
                <a
                  href="https://www.instagram.com/skoowlai/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:border-purple-500/50 hover:bg-purple-500/10 hover:-translate-y-1 transition-all"
                >
                  <svg className="w-5 h-5 text-slate-400 group-hover:text-purple-400 transition-colors" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" />
                  </svg>
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div>
          <div className="max-w-7xl mx-auto px-6 py-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 text-center md:text-left">
              <p className="text-slate-500 text-sm order-2 md:order-1">
                © {new Date().getFullYear()} Skoowl AI. All rights reserved.
              </p>
              <p className="text-slate-500 text-sm order-1 md:order-2">
                Built with <span className="text-purple-400">💜</span> by Fais Wibowo
              </p>
            </div>
          </div>
        </div>
      </footer>

      {/* Bug Report Modal */}
      {isBugReportOpen && <BugReportModal isOpen={isBugReportOpen} onClose={() => setIsBugReportOpen(false)} />}

      {/* Feedback Modal */}
      {isFeedbackOpen && <FeedbackModal isOpen={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} />}

      {/* Pricing Modal */}
      {isPricingOpen && <PricingModal isOpen={isPricingOpen} onClose={() => setIsPricingOpen(false)} />}
    </div>
  );
}
