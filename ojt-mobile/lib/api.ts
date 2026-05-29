/**
 * Django API client for mobile app.
 */

// Replace with your actual development machine IP or production URL
const API_BASE_URL = 'http://127.0.0.1:8000/api'; 

let AUTH_TOKEN: string | null = null;

export function setAuthToken(token: string | null) {
  AUTH_TOKEN = token;
}

export async function post(endpoint: string, data: any) {
  try {
    const headers: any = {
      'Content-Type': 'application/json',
    };
    if (AUTH_TOKEN) headers['Authorization'] = `Bearer ${AUTH_TOKEN}`;

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });
    
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || 'Request failed');
    }
    return result;
  } catch (error) {
    console.error(`API Error (${endpoint}):`, error);
    throw error;
  }
}

export async function get(endpoint: string) {
  try {
    const headers: any = { 'Content-Type': 'application/json' };
    if (AUTH_TOKEN) headers['Authorization'] = `Bearer ${AUTH_TOKEN}`;

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'GET',
      headers,
    });
    
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || 'Request failed');
    }
    return result;
  } catch (error) {
    console.error(`API Error (${endpoint}):`, error);
    throw error;
  }
}

export const attendanceApi = {
  timeIn: (userId: string, applicationId: string) => 
    post('/attendance/time-in/', { user_id: userId, application_id: applicationId }),
  
  timeOut: (userId: string, applicationId: string) => 
    post('/attendance/time-out/', { user_id: userId, application_id: applicationId }),
  
  verifyQr: (qrData: string) => 
    post('/auth/verify-qr/', { qr_data: qrData }),
};

export const instructorApi = {
  listApplications: (opts?: { page?: number; page_size?: number; q?: string }) => {
    const qs = [] as string[];
    if (opts?.page) qs.push(`page=${opts.page}`);
    if (opts?.page_size) qs.push(`page_size=${opts.page_size}`);
    if (opts?.q) qs.push(`q=${encodeURIComponent(opts.q)}`);
    const suffix = qs.length ? `?${qs.join('&')}` : '';
    return get(`/instructor/applications/${suffix}`);
  },
  getTimeRecords: (applicationId: string) => get(`/instructor/time-records/?application_id=${applicationId}`),
  approveApplication: (applicationId: string) => post('/application/approve/', { application_id: applicationId }),
  rejectApplication: (applicationId: string, reason?: string) => post('/application/reject/', { application_id: applicationId, rejection_reason: reason || '' }),
};

export const mobileApi = {
  mobileRegister: (payload: any) => post('/mobile/register/', payload),
};

export const announcementApi = {
  list: (instructorId: string) => 
    get(`/announcement/list/?instructor_id=${instructorId}`),
  
  submit: (formData: any) => 
    post('/announcement/submit/', formData),
};

export const applicationApi = {
  submit: (formData: any) => 
    post('/application/submit/', formData),
};
