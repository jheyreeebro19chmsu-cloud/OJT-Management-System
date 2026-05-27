/**
 * Dynamic configuration loader for Capstone OJT System.
 * Detects the environment at runtime to seamlessly switch between local and production backends.
 */

export const getApiBase = (): string => {
  const envUrl = import.meta.env.VITE_DJANGO_API_URL;
  const securityKey = import.meta.env.VITE_SECURITY_API_KEY;

  // 1. If VITE_DJANGO_API_URL is configured and starts with http, use it
  if (envUrl && envUrl.startsWith('http')) {
    return envUrl.replace(/\/+$/, '');
  }

  // 2. Fallback: If VITE_SECURITY_API_KEY was misconfigured with the backend URL
  if (securityKey && securityKey.startsWith('http')) {
    return `${securityKey.replace(/\/+$/, '')}/api`;
  }

  // 3. Fallback: If running in production (on Vercel/Render) but env is unset, default to Render backend
  if (
    typeof window !== 'undefined' &&
    window.location &&
    window.location.hostname !== 'localhost' &&
    window.location.hostname !== '127.0.0.1'
  ) {
    return 'https://ojt-management-system-capstone-f35i.onrender.com/api';
  }

  // 4. Default for local development
  return 'http://localhost:8000/api';
};

export const getSecurityApiKey = (): string => {
  const securityKey = import.meta.env.VITE_SECURITY_API_KEY;
  // If the key starts with 'http', it was populated with the backend URL, so return empty string
  if (securityKey && securityKey.startsWith('http')) {
    return '';
  }
  return (securityKey || '').trim();
};

export const API_BASE = getApiBase();
export const SECURITY_API_KEY = getSecurityApiKey();

console.log(`[Config] Resolved API_BASE: "${API_BASE}"`);
