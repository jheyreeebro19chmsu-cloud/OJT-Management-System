import axios, { AxiosError } from 'axios';

const API_BASE = (import.meta as ImportMeta).env.VITE_DJANGO_API_URL as string | undefined ?? 'http://localhost:8000/api';

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest?.headers?.authorization?.includes('refresh')) {
      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken) {
        try {
          const response = await axios.post(`${API_BASE}/auth/token/refresh/`, {
            refresh: refreshToken,
          });
          localStorage.setItem('access_token', response.data.access);
          api.defaults.headers.authorization = `Bearer ${response.data.access}`;
          return api(originalRequest!);
        } catch {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

export interface User {
  id: number;
  email: string;
  name: string;
  role: 'student' | 'instructor' | 'hte';
  [key: string]: any;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  tokens: {
    access: string;
    refresh: string;
  };
  user: User;
}

export interface OTPResponse {
  success: boolean;
  message: string;
  expires_in_minutes?: number;
}

// OTP Endpoints
export const authAPI = {
  // OTP
  requestOTP: (email: string, fullName: string) =>
    api.post<OTPResponse>('/auth/request-otp/', { email, full_name: fullName }),

  verifyOTP: (email: string, otpCode: string) =>
    api.post<{ success: boolean; message: string }>('/auth/verify-otp/', { email, otp_code: otpCode }),

  // Authentication
  login: (email: string, password: string) =>
    api.post<AuthResponse>('/auth/login/', { email, password }),

  // Student Registration
  registerStudent: (data: {
    email: string;
    password: string;
    first_name: string;
    last_name: string;
    middle_initial?: string;
    age?: number;
    address?: string;
  }) => api.post<AuthResponse>('/auth/register-student/', data),

  // Instructor Registration
  registerInstructor: (data: {
    email: string;
    password: string;
    first_name: string;
    last_name: string;
    course?: string;
    department?: string;
    institution?: string;
  }) => api.post<AuthResponse>('/auth/register-instructor/', data),

  // HTE Registration
  registerHTE: (data: {
    email: string;
    first_name: string;
    last_name: string;
    company_name: string;
    company_address: string;
    contact_person?: string;
    contact_phone?: string;
  }) => api.post<AuthResponse>('/auth/register-hte/', data),

  // OJT Application
  submitApplication: (data: {
    user_id: number;
    instructor_id: number;
    company_name: string;
    company_address: string;
    gps_latitude: number;
    gps_longitude: number;
    geofence_radius?: number;
    start_date: string;
    end_date: string;
    required_hours: number;
  }) =>
    api.post<{ success: boolean; message: string; application_id: number; status: string }>(
      '/application/submit/',
      data
    ),

  approveApplication: (applicationId: number) =>
    api.post<{ success: boolean; message: string; application_id: number }>('/application/approve/', {
      application_id: applicationId,
    }),

  rejectApplication: (applicationId: number, rejectionReason: string) =>
    api.post<{ success: boolean; message: string; application_id: number }>('/application/reject/', {
      application_id: applicationId,
      rejection_reason: rejectionReason,
    }),

  // Time Tracking
  timeIn: (userId: number, applicationId: number, gpsLatitude: number, gpsLongitude: number) =>
    api.post<{ success: boolean; message: string; time_in: string }>('/attendance/time-in/', {
      user_id: userId,
      application_id: applicationId,
      gps_latitude: gpsLatitude,
      gps_longitude: gpsLongitude,
    }),

  timeOut: (userId: number, applicationId: number) =>
    api.post<{ success: boolean; message: string; time_out: string; hours_rendered: number }>(
      '/attendance/time-out/',
      {
        user_id: userId,
        application_id: applicationId,
      }
    ),

  // Announcements
  postAnnouncement: (instructorId: number, formData: FormData) =>
    api.post<{ success: boolean; message: string; announcement_id: number }>(
      '/announcement/post/',
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
      }
    ),

  getAnnouncements: (instructorId: number) =>
    api.get<{ announcements: any[] }>('/announcement/list/', { params: { instructor_id: instructorId } }),

  // HTE Access
  requestHTEAccess: (hteId: number, applicationId: number) =>
    api.post<{ success: boolean; message: string; request_id: number }>('/hte/request-access/', {
      hte_id: hteId,
      application_id: applicationId,
    }),

  approveHTEAccess: (requestId: number) =>
    api.post<{ success: boolean; message: string; request_id: number }>('/hte/approve-access/', {
      request_id: requestId,
    }),

  rejectHTEAccess: (requestId: number, reason: string) =>
    api.post<{ success: boolean; message: string; request_id: number }>('/hte/reject-access/', {
      request_id: requestId,
      reason,
    }),
};

export default api;
