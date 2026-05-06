/**
 * HTE (Host Training Establishment) API service.
 * Handles all backend API calls for HTE dashboard, secured with JWT Bearer tokens.
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

interface ApiResponse<T> {
  success?: boolean;
  error?: string;
  [key: string]: T | any;
}

interface HTEDashboardMetrics {
  total_applications: number;
  status_counts: {
    pending: number;
    approved: number;
    rejected: number;
    completed: number;
    cancelled: number;
  };
  total_required_hours: number;
  total_rendered_hours: number;
  total_remaining_hours: number;
  unique_students: number;
}

interface HTEApplication {
  id: number;
  student_name: string;
  student_email: string;
  status: string;
  required_hours: number;
  rendered_hours: number;
  remaining_hours: number;
  start_date: string;
  end_date: string;
  company_name: string;
}

interface TimeRecord {
  id: number;
  student_name: string;
  application_id: number;
  date: string;
  time_in?: string;
  time_out?: string;
  hours_rendered: number;
  is_approved: boolean;
  notes: string;
}

interface AccessRequest {
  id: number;
  application_id: number;
  student_name: string;
  status: string;
  requested_at: string;
  approved_at?: string;
  rejection_reason?: string;
}

interface Registration {
  id: number;
  employee_id: string;
  image_url?: string;
  created_at: string;
}

/**
 * Get JWT token from localStorage
 */
function getAuthToken(): string | null {
  return localStorage.getItem('ojt_jwt_access_token');
}

/**
 * Set Authorization header with JWT token
 */
function getHeaders(): HeadersInit {
  const token = getAuthToken();
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
  };
}

/**
 * Get HTE dashboard metrics and recent activity
 */
export async function getHTEDashboard(): Promise<
  ApiResponse<{ metrics: HTEDashboardMetrics; recent_time_records: TimeRecord[] }>
> {
  try {
    const response = await fetch(`${API_BASE}/security/hte/dashboard/`, {
      method: 'GET',
      headers: getHeaders(),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      return { success: false, error: data.error || `HTTP ${response.status}` };
    }

    const data = await response.json();
    return { success: true, ...data };
  } catch (err) {
    console.error('HTE Dashboard Error:', err);
    return { success: false, error: String(err) };
  }
}

/**
 * Get list of applications assigned to the HTE
 */
export async function getHTEApplications(): Promise<ApiResponse<{ applications: HTEApplication[] }>> {
  try {
    const response = await fetch(`${API_BASE}/security/hte/applications/`, {
      method: 'GET',
      headers: getHeaders(),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      return { success: false, error: data.error || `HTTP ${response.status}` };
    }

    const data = await response.json();
    return { success: true, ...data };
  } catch (err) {
    console.error('Get Applications Error:', err);
    return { success: false, error: String(err) };
  }
}

/**
 * Get time records for HTE's applications
 */
export async function getHTETimeRecords(): Promise<ApiResponse<{ time_records: TimeRecord[] }>> {
  try {
    const response = await fetch(`${API_BASE}/security/hte/time-records/`, {
      method: 'GET',
      headers: getHeaders(),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      return { success: false, error: data.error || `HTTP ${response.status}` };
    }

    const data = await response.json();
    return { success: true, ...data };
  } catch (err) {
    console.error('Get Time Records Error:', err);
    return { success: false, error: String(err) };
  }
}

/**
 * Get HTE access requests
 */
export async function getHTEAccessRequests(): Promise<ApiResponse<{ access_requests: AccessRequest[] }>> {
  try {
    const response = await fetch(`${API_BASE}/security/hte/access-requests/`, {
      method: 'GET',
      headers: getHeaders(),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      return { success: false, error: data.error || `HTTP ${response.status}` };
    }

    const data = await response.json();
    return { success: true, ...data };
  } catch (err) {
    console.error('Get Access Requests Error:', err);
    return { success: false, error: String(err) };
  }
}

/**
 * Get face registrations for HTE's employees
 */
export async function getHTERegistrations(): Promise<ApiResponse<{ registrations: Registration[] }>> {
  try {
    const response = await fetch(`${API_BASE}/security/hte/registrations/`, {
      method: 'GET',
      headers: getHeaders(),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      return { success: false, error: data.error || `HTTP ${response.status}` };
    }

    const data = await response.json();
    return { success: true, ...data };
  } catch (err) {
    console.error('Get Registrations Error:', err);
    return { success: false, error: String(err) };
  }
}

/**
 * Approve an access request
 */
export async function approveHTEAccessRequest(requestId: number): Promise<ApiResponse<void>> {
  try {
    const response = await fetch(`${API_BASE}/security/hte/approve-access/`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ request_id: requestId }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      return { success: false, error: data.error || `HTTP ${response.status}` };
    }

    const data = await response.json();
    return { success: true, ...data };
  } catch (err) {
    console.error('Approve Access Error:', err);
    return { success: false, error: String(err) };
  }
}

/**
 * Reject an access request
 */
export async function rejectHTEAccessRequest(requestId: number, reason?: string): Promise<ApiResponse<void>> {
  try {
    const response = await fetch(`${API_BASE}/security/hte/reject-access/`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ request_id: requestId, rejection_reason: reason || '' }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      return { success: false, error: data.error || `HTTP ${response.status}` };
    }

    const data = await response.json();
    return { success: true, ...data };
  } catch (err) {
    console.error('Reject Access Error:', err);
    return { success: false, error: String(err) };
  }
}

/**
 * Check if HTE is authenticated
 */
export function isHTEAuthenticated(): boolean {
  return !!getAuthToken();
}

/**
 * Clear HTE authentication
 */
export function clearHTEAuth(): void {
  localStorage.removeItem('ojt_jwt_access_token');
  localStorage.removeItem('ojt_jwt_refresh_token');
  localStorage.removeItem('ojt_hte_user');
}
