/**
 * Django API client for mobile app.
 */

// Replace with your actual development machine IP or production URL
const API_BASE_URL = 'http://127.0.0.1:8000/api'; 

export async function post(endpoint: string, data: any) {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
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
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
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
