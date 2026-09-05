export interface GeofenceApiResponse {
  inside: boolean;
  distance_m?: number | null;
  zone?: {
    name?: string;
    lat?: number;
    lng?: number;
    radius?: number;
  } | null;
  reason?: string;
  geofence_advisory?: boolean;
  advisory_note?: string;
}

export interface FaceVerifyResponse {
  success: boolean;
  matched?: boolean;
  distance?: number;
  tolerance?: number;
  confidence?: number;
  message?: string;
}

export interface FaceRegisterResponse {
  success: boolean;
  image_url?: string;
  message?: string;
}

export interface AttendancePhotoResponse {
  success: boolean;
  image_url?: string;
  message?: string;
}

import { API_BASE, SECURITY_API_KEY } from './config';
const FACE_TOLERANCE_ENV = import.meta.env.VITE_FACE_VERIFICATION_TOLERANCE;

function baseUrl() {
  if (!API_BASE) return '';
  return API_BASE.replace(/\/+$/, '');
}

export function isSecurityApiConfigured(): boolean {
  // Only treat the Django security backend as available when an explicit,
  // absolute backend URL is configured (VITE_DJANGO_API_URL / VITE_SECURITY_API_KEY).
  // The same-origin '/api' fallback in config.ts assumes a reverse proxy that
  // does not exist on this Vercel deployment, so it must NOT count as "configured" —
  // otherwise face verification silently calls a dead endpoint instead of falling
  // back to the working client-side (face-api.js) comparison.
  const base = baseUrl();
  return Boolean(base) && /^https?:\/\//i.test(base);
}

function securityHeaders(): Record<string, string> {
  const h: Record<string, string> = {};
  if (SECURITY_API_KEY) {
    h.Authorization = `Bearer ${SECURITY_API_KEY}`;
  }
  return h;
}

async function postJson<T>(path: string, payload: Record<string, unknown>, timeoutMs = 8000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${baseUrl()}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...securityHeaders(),
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const text = await res.text();
    if (!res.ok) {
      throw new Error(text || `Request failed with status ${res.status}`);
    }

    if (!text || !text.trim()) {
      return { success: true } as T;
    }

    try {
      return JSON.parse(text) as T;
    } catch {
      return { success: true, message: text } as T;
    }
  } finally {
    clearTimeout(timer);
  }
}

export async function checkGeofence(payload: {
  lat: number;
  lng: number;
  accuracy?: number;
  zones?: Array<{ name?: string; lat: number; lng: number; radius: number; active?: boolean }>;
}): Promise<GeofenceApiResponse> {
  return postJson<GeofenceApiResponse>('/geofence/check/', payload);
}

export async function verifyFace(payload: {
  employee_id?: string;
  registered_image?: string;
  captured_image: string;
  tolerance?: number;
}): Promise<FaceVerifyResponse> {
  const body: Record<string, unknown> = { ...payload };
  if (body.tolerance === undefined && FACE_TOLERANCE_ENV) {
    const t = parseFloat(FACE_TOLERANCE_ENV);
    if (!Number.isNaN(t)) body.tolerance = t;
  }
  return postJson<FaceVerifyResponse>('/face/verify/', body);
}

export async function registerFace(payload: { employee_id: string; image: string }): Promise<FaceRegisterResponse> {
  return postJson<FaceRegisterResponse>('/face/register/', payload);
}

export async function uploadAttendancePhoto(payload: {
  employee_id: string;
  action: 'in' | 'out';
  image: string;
}): Promise<AttendancePhotoResponse> {
  return postJson<AttendancePhotoResponse>('/attendance/photo/', payload);
}

export interface SecurityHealthResponse {
  status: string;
  face_recognition_installed?: boolean;
  geofence_advisory?: boolean;
  note?: string;
}

/** Unauthenticated probe (no API key). Use for admin diagnostics. */
export async function fetchSecurityHealth(timeoutMs = 5000): Promise<SecurityHealthResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${baseUrl()}/health/`, { signal: controller.signal });
    if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
    return res.json() as Promise<SecurityHealthResponse>;
  } finally {
    clearTimeout(timer);
  }
}