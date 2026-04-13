"use client";

import { useState, useSyncExternalStore } from "react";

export default function CookieConsent() {
    const [isDismissed, setIsDismissed] = useState(false);
    const needsConsent = useSyncExternalStore(
        () => () => { },
        () => window.localStorage.getItem("cookie-consent") === null,
        () => false
    );

    const handleAccept = () => {
        localStorage.setItem("cookie-consent", "accepted");
        setIsDismissed(true);
    };

    const handleDecline = () => {
        localStorage.setItem("cookie-consent", "declined");
        setIsDismissed(true);
    };

    if (!needsConsent || isDismissed) return null;

    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-card border-t border-border shadow-lg">
            <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
                <p className="text-sm text-muted-foreground">
                    We use cookies to improve your experience.
                </p>
                <div className="flex gap-3">
                    <button
                        onClick={handleDecline}
                        className="px-4 py-2 text-sm font-medium text-muted-foreground bg-muted hover:bg-muted/80 rounded-lg transition-colors"
                    >
                        Decline
                    </button>
                    <button
                        onClick={handleAccept}
                        className="px-4 py-2 text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 rounded-lg transition-colors"
                    >
                        Accept
                    </button>
                </div>
            </div>
        </div>
    );
}
