// ===========================================
// Signalmash Connect - Shared Utilities
// ===========================================

/**
 * Format phone number to E.164 format
 */
export function formatPhoneE164(phone: string, countryCode = '1'): string {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');

  // If already has country code (11 digits for US)
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }

  // If 10 digits (US without country code)
  if (digits.length === 10) {
    return `+${countryCode}${digits}`;
  }

  // If already in international format
  if (digits.length > 10) {
    return `+${digits}`;
  }

  return phone;
}

/**
 * Format phone number for display
 */
export function formatPhoneDisplay(phone: string): string {
  const digits = phone.replace(/\D/g, '');

  if (digits.length === 11 && digits.startsWith('1')) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }

  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  return phone;
}

/**
 * Validate E.164 phone number
 */
export function isValidE164(phone: string): boolean {
  return /^\+[1-9]\d{1,14}$/.test(phone);
}

/**
 * Validate email address
 */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Validate EIN (Employer Identification Number)
 */
export function isValidEIN(ein: string): boolean {
  // EIN format: XX-XXXXXXX
  const cleaned = ein.replace(/\D/g, '');
  return cleaned.length === 9;
}

/**
 * Format EIN for display
 */
export function formatEIN(ein: string): string {
  const digits = ein.replace(/\D/g, '');
  if (digits.length === 9) {
    return `${digits.slice(0, 2)}-${digits.slice(2)}`;
  }
  return ein;
}

/**
 * Generate a random string
 */
export function generateRandomString(length = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Sleep for a specified number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelay?: number;
    maxDelay?: number;
    factor?: number;
  } = {}
): Promise<T> {
  const { maxRetries = 3, initialDelay = 1000, maxDelay = 30000, factor = 2 } = options;

  let lastError: Error | undefined;
  let delay = initialDelay;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt < maxRetries) {
        await sleep(delay);
        delay = Math.min(delay * factor, maxDelay);
      }
    }
  }

  throw lastError;
}

/**
 * Truncate string with ellipsis
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return `${str.slice(0, maxLength - 3)}...`;
}

/**
 * Parse pagination params with defaults
 */
export function parsePaginationParams(params: {
  page?: string | number;
  limit?: string | number;
  sortBy?: string;
  sortOrder?: string;
}): {
  page: number;
  limit: number;
  skip: number;
  sortBy?: string;
  sortOrder: 'asc' | 'desc';
} {
  const page = Math.max(1, Number(params.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(params.limit) || 20));
  const skip = (page - 1) * limit;
  const sortOrder = params.sortOrder === 'asc' ? 'asc' : 'desc';

  return {
    page,
    limit,
    skip,
    ...(params.sortBy !== undefined && { sortBy: params.sortBy }),
    sortOrder,
  };
}

/**
 * Create pagination metadata
 */
export function createPaginationMeta(
  total: number,
  page: number,
  limit: number
): {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
} {
  const totalPages = Math.ceil(total / limit);
  return {
    page,
    limit,
    total,
    totalPages,
    hasMore: page < totalPages,
  };
}

/**
 * Mask sensitive data for logging
 */
export function maskSensitiveData(
  data: Record<string, unknown>,
  sensitiveKeys: string[] = ['password', 'token', 'secret', 'key', 'accessToken', 'refreshToken']
): Record<string, unknown> {
  const masked: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    if (sensitiveKeys.some((sk) => key.toLowerCase().includes(sk.toLowerCase()))) {
      masked[key] = '***MASKED***';
    } else if (typeof value === 'object' && value !== null) {
      masked[key] = maskSensitiveData(value as Record<string, unknown>, sensitiveKeys);
    } else {
      masked[key] = value;
    }
  }

  return masked;
}

/**
 * Deep clone an object
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}

/**
 * Check if value is empty (null, undefined, empty string, empty array, empty object)
 */
export function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

/**
 * Remove undefined values from object
 */
export function removeUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, value]) => value !== undefined)
  ) as Partial<T>;
}
