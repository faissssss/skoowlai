/**
 * MIME Type Validator
 * 
 * Server-side MIME type validation using magic number detection.
 * NEVER trust client-provided Content-Type headers.
 */

import { fileTypeFromBuffer } from 'file-type';

export interface MimeValidationResult {
  valid: boolean;
  detectedType: string | null;
  error?: string;
}

function isLikelyPlainText(buffer: Buffer): boolean {
  if (buffer.length === 0) return false;

  const sample = buffer.subarray(0, Math.min(buffer.length, 4096));
  let printable = 0;

  for (const byte of sample) {
    const isWhitespace = byte === 0x09 || byte === 0x0a || byte === 0x0d;
    const isPrintableAscii = byte >= 0x20 && byte <= 0x7e;

    if (isWhitespace || isPrintableAscii) {
      printable += 1;
      continue;
    }

    if (byte === 0x00) return false;
  }

  return printable / sample.length >= 0.9;
}

// Allowed MIME types for documents
export const ALLOWED_DOCUMENT_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
  'text/plain',
];

// Allowed MIME types for audio
export const ALLOWED_AUDIO_TYPES = [
  'audio/webm',
  'audio/mpeg',
  'audio/wav',
  'audio/mp4',
  'audio/ogg',
  'audio/x-m4a',
];

// All allowed types combined
export const ALL_ALLOWED_TYPES = [...ALLOWED_DOCUMENT_TYPES, ...ALLOWED_AUDIO_TYPES];

/**
 * Validate MIME type using magic number detection
 * 
 * @param buffer - File buffer to validate
 * @param allowedTypes - Array of allowed MIME types, or 'document' | 'audio' for presets
 * @returns Validation result with detected type
 */
export async function validateMimeType(
  buffer: Buffer,
  allowedTypes: string[] | 'document' | 'audio'
): Promise<MimeValidationResult> {
  try {
    // Detect actual MIME type from file content (magic numbers)
    const fileType = await fileTypeFromBuffer(buffer);

    // Determine allowed types
    let allowed: string[];
    if (allowedTypes === 'document') {
      allowed = ALLOWED_DOCUMENT_TYPES;
    } else if (allowedTypes === 'audio') {
      allowed = ALLOWED_AUDIO_TYPES;
    } else {
      allowed = allowedTypes;
    }

    // Plain text files typically do not have magic numbers.
    if (!fileType && allowed.includes('text/plain') && isLikelyPlainText(buffer)) {
      return {
        valid: true,
        detectedType: 'text/plain',
      };
    }

    if (!fileType) {
      return {
        valid: false,
        detectedType: null,
        error: 'Could not detect file type. File may be corrupted or unsupported.',
      };
    }

    // Check if detected type is in allowed list
    const isAllowed = allowed.includes(fileType.mime);

    if (!isAllowed) {
      return {
        valid: false,
        detectedType: fileType.mime,
        error: `File type '${fileType.mime}' is not allowed. Allowed types: ${allowed.join(', ')}`,
      };
    }

    return {
      valid: true,
      detectedType: fileType.mime,
    };
  } catch (error) {
    return {
      valid: false,
      detectedType: null,
      error: `MIME validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Log MIME type mismatch for security monitoring
 * 
 * @param userId - User ID who uploaded the file
 * @param fileName - Original file name
 * @param clientType - MIME type provided by client
 * @param detectedType - MIME type detected by server
 */
export function logMimeTypeMismatch(
  userId: string,
  fileName: string,
  clientType: string,
  detectedType: string | null
): void {
  console.warn('[Security] MIME type mismatch detected', {
    userId,
    fileName,
    clientProvidedType: clientType,
    serverDetectedType: detectedType,
    timestamp: new Date().toISOString(),
  });
}
