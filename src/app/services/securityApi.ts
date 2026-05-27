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
  return Boolean(baseUrl());
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

    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `Request failed with status ${res.status}`);
    }

    return res.json() as Promise<T>;
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
