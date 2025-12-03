// Authentication utilities for Chrome extension

const VALID_API_KEYS = [
  process.env.CHROME_EXTENSION_API_KEY || 'festifind-extension-key-2025'
];

/**
 * Validates Chrome extension API key
 * @param apiKey - The API key to validate
 * @returns boolean indicating if the key is valid
 */
export function validateExtensionApiKey(apiKey: string): boolean {
  return VALID_API_KEYS.includes(apiKey);
}

/**
 * Extracts API key from request headers
 * @param request - Next.js request object
 * @returns API key string or null
 */
export function getApiKeyFromRequest(request: Request): string | null {
  return request.headers.get('X-API-Key') || request.headers.get('Authorization')?.replace('Bearer ', '') || null;
} 