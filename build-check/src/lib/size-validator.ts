/**
 * File Size Validator
 * 
 * Enforces maximum file size limits to prevent DoS attacks and resource exhaustion.
 */

// Size limits in bytes
export const SIZE_LIMITS = {
  DOCUMENT: 50 * 1024 * 1024, // 50MB for documents (PDF, DOCX, PPTX, TXT)
  AUDIO: 100 * 1024 * 1024,   // 100MB for audio files
  TEXT: 100 * 1024,            // 100KB for text input
} as const;

export interface SizeValidationResult {
  valid: boolean;
  fileSize: number;
  maxSize: number;
  error?: string;
}

/**
 * Validate file size against type-specific limits
 * 
 * @param fileSize - Size of the file in bytes
 * @param fileType - Type of file ('document' | 'audio')
 * @returns Validation result
 */
export function validateFileSize(
  fileSize: number,
  fileType: 'document' | 'audio'
): SizeValidationResult {
  const maxSize = fileType === 'document' ? SIZE_LIMITS.DOCUMENT : SIZE_LIMITS.AUDIO;

  if (fileSize > maxSize) {
    return {
      valid: false,
      fileSize,
      maxSize,
      error: `File size (${formatBytes(fileSize)}) exceeds maximum allowed size (${formatBytes(maxSize)}) for ${fileType} files.`,
    };
  }

  return {
    valid: true,
    fileSize,
    maxSize,
  };
}

/**
 * Validate text input size
 * 
 * @param text - Text content to validate
 * @returns Validation result
 */
export function validateTextSize(text: string): SizeValidationResult {
  const textSize = Buffer.byteLength(text, 'utf-8');
  const maxSize = SIZE_LIMITS.TEXT;

  if (textSize > maxSize) {
    return {
      valid: false,
      fileSize: textSize,
      maxSize,
      error: `Text content size (${formatBytes(textSize)}) exceeds maximum allowed size (${formatBytes(maxSize)}).`,
    };
  }

  return {
    valid: true,
    fileSize: textSize,
    maxSize,
  };
}

/**
 * Format bytes to human-readable string
 * 
 * @param bytes - Number of bytes
 * @returns Formatted string (e.g., "50 MB", "1.5 GB")
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}
