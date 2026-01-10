import { NextRequest, NextResponse } from "next/server";
import { checkRateLimitFromRequest } from '@/lib/ratelimit';

interface FeedbackPayload {
    type: "feature" | "improvement" | "general";
    category: string;
    summary: string;
    details: string;
    user: {
        name: string;
        email: string;
    } | null;
}

const typeConfig = {
    feature: {
        color: 0x57F287,  // Green
        emoji: "💡",
        label: "New Feature Idea",
    },
    improvement: {
        color: 0xEB459E,  // Pink
        emoji: "❤️",
        label: "Improvement",
    },
    general: {
        color: 0x3498DB,  // Blue
        emoji: "💬",
        label: "General Feedback",
    },
};

export async function POST(request: NextRequest) {
    // Rate limit check: Very strict for feedback spam prevention (5 req / 60s)
    const rateLimitResponse = await checkRateLimitFromRequest(request, 5, '60 s');
    if (rateLimitResponse) return rateLimitResponse;

    try {
        const body: FeedbackPayload = await request.json();
        const { type, category, summary, details, user } = body;

        // Validate required fields
        if (!summary) {
            return NextResponse.json(
                { error: "Summary is required" },
                { status: 400 }
            );
        }

        const webhookUrl = process.env.DISCORD_FEEDBACKS_WEBHOOK_URL;

        if (!webhookUrl) {
            console.error("DISCORD_FEEDBACKS_WEBHOOK_URL is not configured");
            return NextResponse.json(
                { error: "Feedback service is not configured" },
                { status: 500 }
            );
        }

        const config = typeConfig[type] || typeConfig.general;

        // Build Discord embed
        const embed = {
            title: `${config.emoji} ${config.label}: ${summary}`,
            color: config.color,
            fields: [
                {
                    name: "📂 Category",
                    value: category.charAt(0).toUpperCase() + category.slice(1),
                    inline: true,
                },
                {
                    name: "👤 User",
                    value: user ? `${user.name} (${user.email})` : "Guest",
                    inline: true,
                },
                ...(details ? [{
                    name: "📝 Details",
                    value: details.length > 1024 ? details.slice(0, 1021) + "..." : details,
                    inline: false,
                }] : []),
            ],
            timestamp: new Date().toISOString(),
            footer: {
                text: "skoowl ai Feedback",
            },
        };

        // Send to Discord
        const discordResponse = await fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                embeds: [embed],
            }),
        });

        if (!discordResponse.ok) {
            console.error("Discord webhook failed:", await discordResponse.text());
            return NextResponse.json(
                { error: "Failed to send feedback" },
                { status: 500 }
            );
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Feedback error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
