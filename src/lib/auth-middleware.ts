// Utility functions for authentication and validation

/**
 * Validates if a string is a valid CUID (Prisma's default ID format)
 */
export function isValidId(id: string): boolean {
  // CUID format: starts with 'c' followed by alphanumeric characters
  const cuidRegex = /^c[a-z0-9]{24}$/;
  // Also support longer CUID2 format
  const cuid2Regex = /^[a-z0-9]{24,32}$/;
  
  return cuidRegex.test(id) || cuid2Regex.test(id) || id.length >= 10;
}

/**
 * Validates Egyptian phone number format
 */
export function isValidEgyptianPhone(phone: string): boolean {
  // Egyptian mobile: starts with 01 followed by 0,1,2,5 and 8 more digits
  const egyptianMobileRegex = /^01[0125][0-9]{8}$/;
  return egyptianMobileRegex.test(phone);
}

/**
 * Sanitizes string input to prevent XSS
 */
export function sanitizeString(str: string): string {
  return str
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}
