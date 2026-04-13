/**
 * Text Input Size Validation
 * 
 * Validates text input sizes to prevent DoS attacks and excessive memory usage.
 * Enforces a 100KB limit on text content across all API routes.
 */

/**
 * Maximum text content size in bytes (100KB)
 */
export const MAX_TEXT_SIZE = 100 * 1024; // 100KB

/**
 * Validation result interface
 */
export interface TextValidationResult {
  valid: boolean;
  error?: string;
  size?: number;
}

/**
 * Validate text input size
 * 
 * @param text - The text content to validate
 * @param maxSize - Maximum allowed size in bytes (default: 100KB)
 * @returns Validation result with error message if invalid
 */
export function validateTextSize(
  text: string,
  maxSize: number = MAX_TEXT_SIZE
): TextValidationResult {
  if (!text) {
    return { valid: true, size: 0 };
  }

  // Calculate byte size (UTF-8 encoding)
  const byteSize = new TextEncoder().encode(text).length;

  if (byteSize > maxSize) {
    return {
      valid: false,
      error: `Text content too large. Maximum size is ${Math.floor(maxSize / 1024)}KB, received ${Math.floor(byteSize / 1024)}KB`,
      size: byteSize,
    };
  }

  return {
    valid: true,
    size: byteSize,
  };
}

/**
 * Validate multiple text fields
 * 
 * @param fields - Object with field names and text values
 * @param maxSize - Maximum allowed size per field in bytes (default: 100KB)
 * @returns Validation result with field-specific errors
 */
export function validateTextFields(
  fields: Record<string, string>,
  maxSize: number = MAX_TEXT_SIZE
): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  for (const [fieldName, text] of Object.entries(fields)) {
    const result = validateTextSize(text, maxSize);
    if (!result.valid && result.error) {
      errors[fieldName] = result.error;
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}
