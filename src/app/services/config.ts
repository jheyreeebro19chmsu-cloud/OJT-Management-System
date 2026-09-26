/**
 * Dynamic configuration loader for Capstone OJT System.
 * Detects the environment at runtime to seamlessly switch between local and production backends.
 */

export const getApiBase = (): string => {
  const envUrl = import.meta.env.VITE_DJANGO_API_URL;
  const securityKey = import.meta.env.VITE_SECURITY_API_KEY;

  // 1. If VITE_DJANGO_API_URL is configured, valid, and not the dead Railway deployment
  if (envUrl && envUrl.startsWith('http') && !envUrl.includes('railway.app')) {
    return envUrl.replace(/\/+$/, '');
  }

  // 2. Fallback: If VITE_SECURITY_API_KEY was misconfigured with a backend URL (excluding Railway)
  if (securityKey && securityKey.startsWith('http') && !securityKey.includes('railway.app')) {
    return `${securityKey.replace(/\/+$/, '')}/api`;
  }

  // 3. If running on production or static host (including chmsuojtmis.site),
  // return empty string so pure Supabase + on-device features activate without localhost hangs.
  if (
    typeof window !== 'undefined' &&
    window.location &&
    (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1')
  ) {
    return '';
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

export const getAbsoluteUrl = (path: string): string => {
  const apiBaseClean = API_BASE.replace(/\/+$/, '');
  const cleanPath = path.startsWith('/api/') ? path.slice(4) : path;
  const joinPath = cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`;
  return `${apiBaseClean}${joinPath}`;
};

export const getPhotoUrl = (photoPath: string | null | undefined): string => {
  if (!photoPath) return '';
  // Handle object values stored accidentally (e.g., { url })
  try {
    if (typeof photoPath === 'object' && photoPath !== null) {
      const anyp: any = photoPath as any;
      if (typeof anyp.url === 'string' && anyp.url) photoPath = anyp.url;
      else return '';
    }
  } catch {
    return '';
  }

  const trimmed = String(photoPath).trim().replace(/^["']+|["']+$/g, '');
  if (!trimmed) return '';
  // Treat common sentinel values from storage providers as missing
  if (
    /^not\s*found$/i.test(trimmed) ||
    /not\s*found/i.test(trimmed) ||
    trimmed === 'None' ||
    trimmed === 'null' ||
    trimmed === 'undefined' ||
    trimmed === '[object Object]' ||
    trimmed === 'false'
  ) {
    return '';
  }

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:')) {
    return trimmed;
  }

  const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || 'https://wooighmdckuoebsuegzz.supabase.co').replace(/\/+$/, '');
  const supabaseStorageBase = `${supabaseUrl}/storage/v1/object/public`;
  const cleanPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;

  // If path refers to Supabase storage buckets, route directly to public storage
  const isSupabaseBucket =
    cleanPath.startsWith('/face-photos/') ||
    cleanPath.startsWith('/avatars/') ||
    cleanPath.startsWith('/time-records-photos/') ||
    cleanPath.startsWith('/documents/') ||
    cleanPath.startsWith('/trainee-documents/');

  if (isSupabaseBucket) {
    return `${supabaseStorageBase}${cleanPath}`;
  }

  // Profile photo format: <identifier>/profile_<timestamp>.jpg
  if (cleanPath.includes('/profile_') || /^\/[^/]+\/profile_/.test(cleanPath)) {
    return `${supabaseStorageBase}/face-photos${cleanPath}`;
  }

  if (API_BASE) {
    const serverRoot = API_BASE.replace(/\/api$/, '').replace(/\/+$/, '');
    return `${serverRoot}${cleanPath}`;
  }

  return `${supabaseStorageBase}${cleanPath}`;
};

console.log(`[Config] Resolved API_BASE: "${API_BASE}"`);
