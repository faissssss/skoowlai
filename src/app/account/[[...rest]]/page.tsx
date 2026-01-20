"use client";

import { UserProfile } from "@clerk/nextjs";

export default function AccountPage() {
    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4">
            <UserProfile
                path="/account"
                appearance={{
                    elements: {
                        rootBox: "mx-auto",
                        card: "shadow-xl"
                    }
                }}
            />
        </div>
    );
}
