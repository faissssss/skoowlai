import { get } from '@vercel/blob';

export type UploadKind = 'document' | 'audio';

export interface UploadedBlobReference {
  pathname: string;
  contentType?: string;
  originalName?: string;
  size?: number;
  url?: string;
}

export function isBlobStorageConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export async function downloadPrivateBlobToBuffer(pathname: string): Promise<{
  buffer: Buffer;
  contentType: string;
}> {
  const result = await get(pathname, { access: 'private' });

  if (!result || result.statusCode !== 200 || !result.stream) {
    throw new Error(`Blob not found for pathname: ${pathname}`);
  }

  const buffer = Buffer.from(await new Response(result.stream).arrayBuffer());

  return {
    buffer,
    contentType: result.blob.contentType || 'application/octet-stream',
  };
}
