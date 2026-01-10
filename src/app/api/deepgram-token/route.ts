import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimitFromRequest } from '@/lib/ratelimit';
import { createClient } from '@deepgram/sdk';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    // Rate limit check: Strict limit for token generation (10 req / 60s)
    const rateLimitResponse = await checkRateLimitFromRequest(req, 10, '60 s');
    if (rateLimitResponse) return rateLimitResponse;

    const apiKey = process.env.DEEPGRAM_API_KEY;

    if (!apiKey) {
        return NextResponse.json({ error: 'Deepgram API key not configured' }, { status: 500 });
    }

    try {
        const deepgram = createClient(apiKey);

        // Get project ID (users can optionally set DEEPGRAM_PROJECT_ID to save a roundtrip)
        let projectId = process.env.DEEPGRAM_PROJECT_ID;

        if (!projectId) {
            const { result: projectsResult, error: projectsError } = await deepgram.manage.getProjects();

            if (projectsError) {
                console.error('Deepgram projects error:', projectsError);
                throw new Error('Failed to get Deepgram projects');
            }

            if (!projectsResult?.projects?.[0]) {
                throw new Error('No Deepgram projects found');
            }

            projectId = projectsResult.projects[0].project_id;
        }

        // Create a temporary key with 60s TTL
        const { result: newKeyResult, error: newKeyError } = await deepgram.manage.createProjectKey(projectId, {
            comment: "Ephemeral Client Key",
            scopes: ["usage:write"],
            time_to_live_in_seconds: 60,
        });

        if (newKeyError) {
            console.error('Deepgram key creation error:', newKeyError);
            throw new Error('Failed to create temporary Deepgram key');
        }

        return NextResponse.json({
            wsUrl: 'wss://api.deepgram.com/v1/listen',
            queryParams: 'model=nova-3&language=en&punctuate=true&interim_results=true&smart_format=true&endpointing=300&encoding=linear16&sample_rate=16000',
            apiKey: newKeyResult.key,
        });

    } catch (error) {
        console.error('Error serving Deepgram token:', error);
        return NextResponse.json({ error: 'Failed to generate Deepgram token' }, { status: 500 });
    }
}
