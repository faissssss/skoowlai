import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Define protected routes that require authentication
const isProtectedRoute = createRouteMatcher([
    "/dashboard(.*)",
    "/study(.*)",
    "/notes(.*)",
    "/quiz(.*)",
    "/mindmap(.*)",
]);

// Define public routes that don't require authentication
const isPublicRoute = createRouteMatcher([
    "/",
    "/sign-in(.*)",
    "/sign-up(.*)",
    "/share(.*)",
    "/api/webhooks(.*)",
]);

// Check if this is a webhook route - skip ALL middleware processing
function isWebhookRoute(req: NextRequest): boolean {
    return req.nextUrl.pathname.startsWith('/api/webhooks');
}

export default clerkMiddleware(async (auth, req) => {
    // CRITICAL: Skip ALL processing for webhook routes to prevent 307 redirects
    if (isWebhookRoute(req)) {
        return NextResponse.next();
    }

    // Force HTTPS in production
    if (process.env.NODE_ENV === "production" && req.headers.get("x-forwarded-proto") === "http") {
        return NextResponse.redirect(new URL(req.url.replace("http://", "https://"), req.url), 301);
    }

    // Protect routes that require authentication
    if (isProtectedRoute(req)) {
        await auth.protect();
    }
});

export const config = {
    matcher: [
        // Skip Next.js internals and all static files
        "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
        // Always run for API routes EXCEPT webhooks (webhooks are excluded to prevent redirect issues)
        "/(api(?!/webhooks)|trpc)(.*)",
    ],
};
