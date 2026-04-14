import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { checkCsrfOrigin } from '@/lib/csrf';
import { ALLOWED_AUDIO_TYPES, ALLOWED_DOCUMENT_TYPES } from '@/lib/mime-validator';
import { isBlobStorageConfigured, type UploadKind } from '@/lib/blob-storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function parseUploadKind(clientPayload: string | null | undefined): UploadKind {
  try {
    const parsed = clientPayload ? JSON.parse(clientPayload) : {};
    return parsed?.kind === 'audio' ? 'audio' : 'document';
  } catch {
    return 'document';
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const csrfError = checkCsrfOrigin(req);
  if (csrfError) return csrfError;

  const { user, errorResponse } = await requireAuth();
  if (errorResponse) return errorResponse;

  if (!isBlobStorageConfigured()) {
    return NextResponse.json(
      {
        error: 'Blob storage is not configured',
        details: 'Add BLOB_READ_WRITE_TOKEN in your environment to enable large uploads on Vercel.',
      },
      { status: 503 }
    );
  }

  try {
    const body = (await req.json()) as HandleUploadBody;

    const jsonResponse = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        const kind = parseUploadKind(clientPayload);

        return {
          access: 'private',
          addRandomSuffix: true,
          allowedContentTypes: kind === 'audio' ? ALLOWED_AUDIO_TYPES : ALLOWED_DOCUMENT_TYPES,
          tokenPayload: JSON.stringify({
            userId: user.id,
            kind,
          }),
        };
      },
      onUploadCompleted: async () => {
        // Upload completion is handled explicitly by the client after upload.
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to prepare upload' },
      { status: 400 }
    );
  }
}
