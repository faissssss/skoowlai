import { NextRequest, NextResponse } from "next/server";
import { checkRateLimitFromRequest } from '@/lib/ratelimit';

interface BugReportPayload {
    title: string;
    description: string;
    severity: "low" | "medium" | "critical";
    screenshot: string | null; // base64 data URL
    pageUrl: string;
    userAgent: string;
    user: {
        name: string;
        email: string;
    } | null;
}

const severityColors = {
    low: 0x3b82f6,      // Blue
    medium: 0xeab308,   // Yellow
    critical: 0xef4444, // Red
};

const severityEmojis = {
    low: "🔵",
    medium: "🟡",
    critical: "🔴",
};

function parseUserAgent(ua: string): string {
    if (!ua) return "Unknown";

    // Detect browser
    let browser = "Unknown Browser";
    if (ua.includes("Edg/")) {
        const match = ua.match(/Edg\/(\d+)/);
        browser = `Edge ${match?.[1] || ""}`;
    } else if (ua.includes("Chrome/") && !ua.includes("Edg/")) {
        const match = ua.match(/Chrome\/(\d+)/);
        browser = `Chrome ${match?.[1] || ""}`;
    } else if (ua.includes("Firefox/")) {
        const match = ua.match(/Firefox\/(\d+)/);
        browser = `Firefox ${match?.[1] || ""}`;
    } else if (ua.includes("Safari/") && !ua.includes("Chrome/")) {
        const match = ua.match(/Version\/(\d+)/);
        browser = `Safari ${match?.[1] || ""}`;
    } else if (ua.includes("Opera") || ua.includes("OPR/")) {
        const match = ua.match(/(?:Opera|OPR)\/(\d+)/);
        browser = `Opera ${match?.[1] || ""}`;
    }

    // Detect OS
    let os = "Unknown OS";
    if (ua.includes("Windows NT 10.0")) {
        os = "Windows 10/11";
    } else if (ua.includes("Windows NT 6.3")) {
        os = "Windows 8.1";
    } else if (ua.includes("Windows NT 6.1")) {
        os = "Windows 7";
    } else if (ua.includes("Mac OS X")) {
        const match = ua.match(/Mac OS X (\d+[._]\d+)/);
        os = `macOS ${match?.[1]?.replace("_", ".") || ""}`;
    } else if (ua.includes("Linux")) {
        os = "Linux";
    } else if (ua.includes("Android")) {
        const match = ua.match(/Android (\d+)/);
        os = `Android ${match?.[1] || ""}`;
    } else if (ua.includes("iPhone") || ua.includes("iPad")) {
        const match = ua.match(/OS (\d+)/);
        os = `iOS ${match?.[1] || ""}`;
    }

    // Detect device type
    let device = "Desktop";
    if (ua.includes("Mobile") || ua.includes("Android") || ua.includes("iPhone")) {
        device = "Mobile";
    } else if (ua.includes("iPad") || ua.includes("Tablet")) {
        device = "Tablet";
    }

    return `${browser} on ${os} (${device})`;
}

export async function POST(request: NextRequest) {
    // Rate limit check: Very strict for bug report spam prevention (5 req / 60s)
    const rateLimitResponse = await checkRateLimitFromRequest(request, 5, '60 s');
    if (rateLimitResponse) return rateLimitResponse;

    try {
        const body: BugReportPayload = await request.json();
        const { title, description, severity, screenshot, pageUrl, userAgent, user } = body;

        // Validate required fields
        if (!title || !description) {
            return NextResponse.json(
                { error: "Title and description are required" },
                { status: 400 }
            );
        }

        const webhookUrl = process.env.DISCORD_BUGREPORTS_WEBHOOK_URL;

        if (!webhookUrl) {
            console.error("DISCORD_BUGREPORTS_WEBHOOK_URL is not configured");
            return NextResponse.json(
                { error: "Bug report service is not configured" },
                { status: 500 }
            );
        }

        // Build Discord embed
        const embed = {
            title: `🪲 New Bug Report: ${title}`,
            color: severityColors[severity],
            fields: [
                {
                    name: "👤 User",
                    value: user ? `${user.name} (${user.email})` : "Guest",
                    inline: true,
                },
                {
                    name: `${severityEmojis[severity]} Severity`,
                    value: severity.charAt(0).toUpperCase() + severity.slice(1),
                    inline: true,
                },
                {
                    name: "📍 Page",
                    value: pageUrl || "Unknown",
                    inline: false,
                },
                {
                    name: "📝 Description",
                    value: description.length > 1024 ? description.slice(0, 1021) + "..." : description,
                    inline: false,
                },
                {
                    name: "🌐 Browser",
                    value: parseUserAgent(userAgent),
                    inline: false,
                },
            ],
            timestamp: new Date().toISOString(),
            footer: {
                text: "skoowl ai Bug Reports",
            },
            image: undefined as { url: string } | undefined,
        };

        // Prepare form data for Discord (supports file uploads)
        const formData = new FormData();

        // If screenshot is provided, attach it as a file
        if (screenshot) {
            try {
                // Convert base64 to blob
                const base64Data = screenshot.split(",")[1];
                const mimeType = screenshot.match(/data:(.*?);/)?.[1] || "image/png";
                const binaryData = Buffer.from(base64Data, "base64");
                const blob = new Blob([binaryData], { type: mimeType });

                // Get file extension from mime type
                const ext = mimeType.split("/")[1]?.replace("jpeg", "jpg") || "png";
                const filename = `screenshot.${ext}`;

                // Append file to form data
                formData.append("files[0]", blob, filename);

                // Reference the attachment in the embed
                embed.image = { url: "attachment://" + filename };
            } catch (err) {
                console.error("Failed to process screenshot:", err);
            }
        }

        // Add the payload JSON
        formData.append("payload_json", JSON.stringify({
            embeds: [embed],
        }));

        // Send to Discord with multipart form data
        const discordResponse = await fetch(webhookUrl, {
            method: "POST",
            body: formData,
        });

        if (!discordResponse.ok) {
            console.error("Discord webhook failed:", await discordResponse.text());
            return NextResponse.json(
                { error: "Failed to send bug report" },
                { status: 500 }
            );
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Bug report error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
