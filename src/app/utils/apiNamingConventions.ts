/**
 * API Naming Convention Utilities
 * 
 * Handles conversion between:
 * - Frontend: camelCase (JS/React standard)
 * - Backend: snake_case (Python/Django standard)
 */

/**
 * Convert camelCase to snake_case
 * @example
 * camelToSnake('firstName') // 'first_name'
 * camelToSnake('companyName') // 'company_name'
 */
export function camelToSnake(str: string): string {
  return str.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
}

/**
 * Convert snake_case to camelCase
 * @example
 * snakeToCamel('first_name') // 'firstName'
 * snakeToCamel('company_name') // 'companyName'
 */
export function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());
}

/**
 * Convert object keys from camelCase to snake_case (for API requests)
 */
export function objectToSnakeCase(obj: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = camelToSnake(key);
    result[snakeKey] = value;
  }
  return result;
}

/**
 * Convert object keys from snake_case to camelCase (for API responses)
 */
export function objectToCamelCase(obj: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = snakeToCamel(key);
    // Recursively convert nested objects
    result[camelKey] = typeof value === 'object' && value !== null ? objectToCamelCase(value) : value;
  }
  return result;
}

/**
 * Utility to prepare form data for API submission
 * Converts camelCase form state to snake_case for backend
 */
export function prepareFormForAPI(formData: Record<string, any>): Record<string, any> {
  return objectToSnakeCase(formData);
}

/**
 * Utility to parse API response into frontend format
 * Converts snake_case response to camelCase for state
 */
export function parseAPIResponse(response: Record<string, any>): Record<string, any> {
  return objectToCamelCase(response);
}
