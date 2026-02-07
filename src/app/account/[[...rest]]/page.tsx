"use client";

import { UserProfile } from "@clerk/nextjs";

export default function AccountPage() {
    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
            <UserProfile
                path="/account"
                appearance={{
                    elements: {
                        rootBox: "mx-auto",
                        card: "shadow-xl",
                        pageTitle: "text-white",
                        pageSubtitle: "text-white",
                    }
                }}
            />
        </div>
    );
}
