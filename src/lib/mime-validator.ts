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

    if (!fileType) {
      return {
        valid: false,
        detectedType: null,
        error: 'Could not detect file type. File may be corrupted or unsupported.',
      };
    }

    // Determine allowed types
    let allowed: string[];
    if (allowedTypes === 'document') {
      allowed = ALLOWED_DOCUMENT_TYPES;
    } else if (allowedTypes === 'audio') {
      allowed = ALLOWED_AUDIO_TYPES;
    } else {
      allowed = allowedTypes;
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
