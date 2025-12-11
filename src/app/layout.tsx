import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://www.skoowlai.com'),
  // Canonical URL - tells Google this is the primary URL (prevents duplicates)
  alternates: {
    canonical: 'https://www.skoowlai.com',
  },
  title: {
    default: "skoowl ai - AI-Powered Study Assistant",
    template: "%s | skoowl ai",
  },
  description: "Your Personal AI Study Buddy. Turn any document into Smart Notes, Quizzes, Flashcards, and Mind Maps. Study smarter with AI.",
  keywords: [
    "AI study assistant",
    "flashcards",
    "quizzes",
    "mind maps",
    "smart notes",
    "study tools",
    "AI learning",
    "PDF summarizer",
    "YouTube summarizer",
    "lecture notes",
    "spaced repetition",
  ],
  authors: [{ name: "Skoowl AI" }],
  creator: "Skoowl AI",
  publisher: "Skoowl AI",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://www.skoowlai.com",
    siteName: "skoowl ai",
    title: "skoowl ai - AI-Powered Study Assistant",
    description: "Your Personal AI Study Buddy. Turn any document into Smart Notes, Quizzes, Flashcards, and Mind Maps.",
    images: [
      {
        url: "/skoowl-logo.png",
        width: 512,
        height: 512,
        alt: "skoowl ai logo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "skoowl ai - AI-Powered Study Assistant",
    description: "Turn any document into Smart Notes, Quizzes, Flashcards, and Mind Maps.",
    creator: "@skoowlai",
    images: ["/skoowl-logo.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: "/skoowl-logo.png",
    apple: "/skoowl-logo.png",
    shortcut: "/skoowl-logo.png",
  },
};

import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "sonner";
import { TimerProvider } from "@/contexts/TimerContext";
import CookieConsent from "@/components/CookieConsent";
import GlobalLoaderWrapper from "@/components/GlobalLoaderWrapper";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      appearance={{
        variables: {
          colorPrimary: "#8b5cf6",
          colorBackground: "#0f172a",
          colorInputBackground: "#1e293b",
          colorInputText: "#f8fafc",
          colorText: "#f8fafc",
          colorTextSecondary: "#94a3b8",
          borderRadius: "0.75rem",
        },
        elements: {
          formButtonPrimary: "bg-violet-600 hover:bg-violet-500",
          card: "bg-slate-900 border border-white/10",
          headerTitle: "text-white",
          headerSubtitle: "text-slate-400",
          socialButtonsBlockButton: "bg-slate-800 border-white/10 hover:bg-slate-700",
          formFieldInput: "bg-slate-800 border-white/10",
          footerActionLink: "text-violet-400 hover:text-violet-300",
          // UserButton dropdown styling
          userButtonPopoverCard: "bg-slate-900 border border-white/10",
          userButtonPopoverActionButton: "text-slate-300 hover:bg-slate-800",
          userButtonPopoverActionButtonText: "text-slate-300",
          userButtonPopoverActionButtonIcon: "text-slate-400",
          userButtonPopoverFooter: "hidden",
          userPreviewMainIdentifier: "text-white",
          userPreviewSecondaryIdentifier: "text-slate-400",
        },
      }}
    >
      <html lang="en" suppressHydrationWarning>
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        >
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            storageKey="studybuddy-theme"
          >
            <GlobalLoaderWrapper>
              <TimerProvider>
                {children}
              </TimerProvider>
            </GlobalLoaderWrapper>
            <Toaster />
            <CookieConsent />
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}

