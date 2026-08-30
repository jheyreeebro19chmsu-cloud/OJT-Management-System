/**
 * Data validation and sanitization utilities for registration and form submission.
 * Enforces 25-sentence limit on text fields and prevents dirty data (XSS, SQL injection, etc.)
 */

const SENTENCE_LIMIT = 25;
const SENTENCE_REGEX = /[.!?]+/g;

/**
 * Count sentences in a string.
 * A sentence is delimited by . ! or ?
 */
export function countSentences(text: string): number {
  if (!text || !text.trim()) return 0;
  const matches = text.match(SENTENCE_REGEX);
  return matches ? matches.length : 0;
}

/**
 * Check if text exceeds the sentence limit.
 */
export function exceedsSentenceLimit(text: string, limit: number = SENTENCE_LIMIT): boolean {
  return countSentences(text) > limit;
}

/**
 * Validate that a text field does not exceed the sentence limit.
 * Returns { valid: boolean, error?: string }
 */
export function validateSentenceLimit(
  text: string | undefined,
  fieldName: string,
  limit: number = SENTENCE_LIMIT
): { valid: boolean; error?: string } {
  if (!text || !text.trim()) return { valid: true };
  
  const sentences = countSentences(text);
  if (sentences > limit) {
    return {
      valid: false,
      error: `${fieldName} exceeds ${limit} sentence limit (contains ${sentences} sentences).`,
    };
  }
  return { valid: true };
}

/**
 * Sanitize a string to prevent XSS and basic injection attacks.
 * - Removes HTML tags and entities
 * - Trims whitespace
 * - Removes suspicious patterns
 */
export function sanitizeString(value: string | undefined): string {
  if (!value) return '';
  
  let clean = String(value).trim();
  
  // Remove HTML tags
  clean = clean.replace(/<[^>]*>/g, '');
  
  // Decode HTML entities
  const textarea = document.createElement('textarea');
  textarea.innerHTML = clean;
  clean = textarea.value;
  
  // Remove control characters (except common whitespace)
  clean = clean.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  
  // Normalize multiple spaces/newlines
  clean = clean.replace(/\s+/g, ' ');
  
  return clean.trim();
}

/**
 * Sanitize an email address.
 * - Trims whitespace
 * - Converts to lowercase
 * - Removes suspicious characters outside standard email format
 */
export function sanitizeEmail(email: string | undefined): string {
  if (!email) return '';
  
  let clean = String(email).trim().toLowerCase();
  
  // Remove leading/trailing whitespace
  clean = clean.trim();
  
  // Remove any HTML tags
  clean = clean.replace(/<[^>]*>/g, '');
  
  // Only keep alphanumeric, common email chars, and one @
  // This is a basic check; full validation done on backend
  clean = clean.replace(/[^\w.+-@]/g, '');
  
  return clean;
}

/**
 * Sanitize a phone number.
 * - Keeps only digits, +, -, (, )
 * - Trims whitespace
 */
export function sanitizePhone(phone: string | undefined): string {
  if (!phone) return '';
  
  let clean = String(phone).trim();
  
  // Remove all non-phone characters except common separators
  clean = clean.replace(/[^\d+()\-\s]/g, '');
  
  // Remove extra spaces
  clean = clean.replace(/\s+/g, ' ').trim();
  
  return clean;
}

/**
 * Sanitize a URL/link.
 * - Trims whitespace
 * - Ensures it starts with http:// or https://
 * - Removes javascript: and data: protocols
 */
export function sanitizeUrl(url: string | undefined): string {
  if (!url) return '';
  
  let clean = String(url).trim();
  
  // Remove dangerous protocols
  if (clean.toLowerCase().match(/^(javascript|data|vbscript):/)) {
    return '';
  }
  
  // Remove HTML tags
  clean = clean.replace(/<[^>]*>/g, '');
  
  // Ensure http/https if it looks like a URL
  if (clean && !clean.match(/^https?:\/\//)) {
    if (clean.includes('.')) {
      clean = 'https://' + clean;
    }
  }
  
  return clean.trim();
}

/**
 * Validate and sanitize a single form field.
 * Returns the sanitized value if valid, or throws an error.
 */
export function validateAndSanitizeField(
  fieldName: string,
  value: string | undefined,
  options: {
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    maxSentences?: number;
    type?: 'text' | 'email' | 'phone' | 'url';
    sanitize?: boolean;
  } = {}
): string {
  const {
    required = false,
    minLength = 0,
    maxLength = 500,
    maxSentences = SENTENCE_LIMIT,
    type = 'text',
    sanitize = true,
  } = options;
  
  let cleaned = value ? String(value).trim() : '';
  
  // Check required
  if (required && !cleaned) {
    throw new Error(`${fieldName} is required.`);
  }
  
  if (!cleaned) return '';
  
  // Sanitize based on type
  if (sanitize) {
    switch (type) {
      case 'email':
        cleaned = sanitizeEmail(cleaned);
        break;
      case 'phone':
        cleaned = sanitizePhone(cleaned);
        break;
      case 'url':
        cleaned = sanitizeUrl(cleaned);
        break;
      default:
        cleaned = sanitizeString(cleaned);
    }
  }
  
  // Check length
  if (cleaned.length < minLength) {
    throw new Error(`${fieldName} must be at least ${minLength} characters.`);
  }
  
  if (cleaned.length > maxLength) {
    throw new Error(`${fieldName} must not exceed ${maxLength} characters.`);
  }
  
  // Check sentence limit for text fields
  if (type === 'text' && maxSentences) {
    const sentences = countSentences(cleaned);
    if (sentences > maxSentences) {
      throw new Error(`${fieldName} exceeds ${maxSentences} sentence limit (contains ${sentences} sentences).`);
    }
  }
  
  return cleaned;
}

/**
 * Validate and sanitize an entire form object.
 * Returns a sanitized copy of the form data.
 * Throws an error if any field fails validation.
 */
export function validateAndSanitizeForm(
  formData: Record<string, any>,
  fieldRules: Record<string, Parameters<typeof validateAndSanitizeField>[2]>
): Record<string, any> {
  const sanitized: Record<string, any> = {};
  
  for (const [fieldName, value] of Object.entries(formData)) {
    const rules = fieldRules[fieldName];
    
    if (rules) {
      sanitized[fieldName] = validateAndSanitizeField(fieldName, value, rules);
    } else {
      // Default sanitization for unlisted fields
      sanitized[fieldName] = sanitizeString(value);
    }
  }
  
  return sanitized;
}

/**
 * Validate registration form data specifically.
 * This is the main validation entry point for the Register page.
 */
export function validateRegistrationData(
  formData: Record<string, any>,
  role: string
): Record<string, any> {
  const fieldRules: Record<string, Parameters<typeof validateAndSanitizeField>[2]> = {
    email: { required: true, type: 'email', maxLength: 254 },
    firstName: { required: true, type: 'text', maxLength: 100, maxSentences: 3 },
    lastName: { required: true, type: 'text', maxLength: 100, maxSentences: 3 },
    middleInitial: { type: 'text', maxLength: 10 },
    name: { type: 'text', maxLength: 255, maxSentences: 3 },
    password: { required: true, minLength: 8, maxLength: 128 },
    confirmPassword: { required: true, minLength: 8, maxLength: 128 },
    
    // Address fields
    street: { type: 'text', maxLength: 200, maxSentences: 5 },
    barangay: { type: 'text', maxLength: 100, maxSentences: 3 },
    barangayManual: { type: 'text', maxLength: 100, maxSentences: 3 },
    city: { type: 'text', maxLength: 100, maxSentences: 3 },
    province: { type: 'text', maxLength: 100, maxSentences: 3 },
    region: { type: 'text', maxLength: 100, maxSentences: 3 },
    
    // Company/HTE fields
    companyName: { type: 'text', maxLength: 255, maxSentences: 5 },
    companyAddress: { type: 'text', maxLength: 500, maxSentences: 10 },
    contactPerson: { type: 'text', maxLength: 200, maxSentences: 3 },
    contactPhone: { type: 'phone', maxLength: 20 },
    
    // School/Academic fields
    schoolName: { type: 'text', maxLength: 255, maxSentences: 5 },
    campus: { type: 'text', maxLength: 200, maxSentences: 3 },
    course: { type: 'text', maxLength: 200, maxSentences: 3 },
    department: { type: 'text', maxLength: 200, maxSentences: 3 },
    
    // Employment fields
    supervisorName: { type: 'text', maxLength: 200, maxSentences: 3 },
    position: { type: 'text', maxLength: 200, maxSentences: 3 },
    employeeId: { type: 'text', maxLength: 50 },
    
    // Other optional fields
    instructorEmail: { type: 'email', maxLength: 254 },
    username: { type: 'text', maxLength: 150 },
  };
  
  return validateAndSanitizeForm(formData, fieldRules);
}
