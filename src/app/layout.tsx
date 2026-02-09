import type { Metadata } from "next";
import { Inter, Poppins, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // Use non-www as the canonical base URL
  metadataBase: new URL('https://skoowlai.com'),
  // Canonical URL - tells Google this is the primary URL (prevents www vs non-www duplicates)
  alternates: {
    canonical: '/',
  },
  title: {
    default: "Skoowl AI - AI-Powered Study Assistant",
    template: "%s | Skoowl AI",
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
    url: "https://skoowlai.com",
    siteName: "Skoowl AI",
    title: "Skoowl AI - AI-Powered Study Assistant",
    description: "Turn your lectures into structured notes, flashcards, quizzes, and mind maps instantly.",
    images: [
      {
        url: "/preview.png?v=3",
        width: 1200,
        height: 630,
        alt: "Skoowl AI - AI-Powered Study Assistant",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Skoowl AI - AI-Powered Study Assistant",
    description: "Turn your lectures into structured notes, flashcards, quizzes, and mind maps instantly.",
    creator: "@skoowlai",
    site: "@skoowlai",
    images: [
      {
        url: "/preview.png?v=3",
        width: 1200,
        height: 630,
        alt: "Skoowl AI - AI-Powered Study Assistant",
      },
    ],
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
    icon: [
      { url: '/skoowl-logo.png?v=2', sizes: '512x512', type: 'image/png' },
      { url: '/skoowl-logo.png?v=2', sizes: 'any', type: 'image/png' }
    ],
    apple: '/skoowl-logo.png?v=2',
  },
};

import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "sonner";
import { TimerProvider } from "@/contexts/TimerContext";
import CookieConsent from "@/components/CookieConsent";
import GlobalLoaderWrapper from "@/components/GlobalLoaderWrapper";
import { ErrorModalProvider } from "@/components/ErrorModal";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      appearance={{
        variables: {
          colorPrimary: "#5B4DFF",
          colorBackground: "#0B0D14",
          colorInputBackground: "#1e293b",
          colorInputText: "#f8fafc",
          colorText: "#f8fafc",
          colorTextSecondary: "#94a3b8",
          borderRadius: "0.75rem",
          colorSuccess: "#10b981",
        },
        elements: {
          formButtonPrimary: "bg-primary text-primary-foreground hover:bg-primary/90",
          card: "bg-card border border-border",
          headerTitle: "text-foreground",
          headerSubtitle: "text-muted-foreground",
          socialButtonsBlockButton: "bg-secondary border-border hover:bg-secondary/80",
          formFieldInput: "bg-background border-border",
          footerActionLink: "text-primary hover:text-primary/80",
          // UserButton dropdown styling
          userButtonPopoverCard: "bg-card border border-border",
          userButtonPopoverActionButton: "text-foreground hover:bg-accent",
          userButtonPopoverActionButtonText: "text-foreground",
          userButtonPopoverActionButtonIcon: "text-muted-foreground",
          userButtonPopoverFooter: "hidden",
          userPreviewMainIdentifier: "text-foreground",
          userPreviewSecondaryIdentifier: "text-muted-foreground",
          // Clerk Billing - Pricing Table & Checkout styling
          pricingTableFeatureListItem: "text-foreground",
          pricingTableFeatureListItemIcon: "text-primary",
          badge: "bg-primary text-primary-foreground font-semibold",
          // Checkout modal z-index fix
          modalContent: "z-[99999]",
          modalBackdrop: "z-[99998]",
        },
      }}
    >
      <html lang="en" suppressHydrationWarning>
        <body
          className={`${inter.variable} ${poppins.variable} ${jetbrainsMono.variable} antialiased`}
        >
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            storageKey="studybuddy-theme"
          >
            <ErrorModalProvider>
              <GlobalLoaderWrapper>
                <TimerProvider>
                  {children}
                </TimerProvider>
              </GlobalLoaderWrapper>
              <Toaster />
              <CookieConsent />
            </ErrorModalProvider>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
