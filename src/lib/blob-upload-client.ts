'use client';

import { upload } from '@vercel/blob/client';
import type { UploadKind } from '@/lib/blob-storage';

interface BlobUploadProgressEvent {
  loaded: number;
  total: number;
  percentage: number;
}

export async function uploadFileToBlob(
  file: File,
  kind: UploadKind,
  options?: {
    onUploadProgress?: (progress: BlobUploadProgressEvent) => void;
  }
) {
  return upload(file.name, file, {
    access: 'private',
    handleUploadUrl: '/api/uploads/blob',
    clientPayload: JSON.stringify({ kind }),
    onUploadProgress: options?.onUploadProgress,
  });
}
