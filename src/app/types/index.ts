export interface Employee {
  id: string;
  name: string;
  employeeId: string;
  email: string;
  department: string;
  position: string;
  companyName: string;
  supervisorName: string;
  schoolName: string;
  course: string;
  startDate: string;
  endDate: string;
  requiredHours: number;
  photo?: string;
  faceRegistered: boolean;
  createdAt: string;
  active: boolean;
  registrationLocation?: { lat: number; lng: number };
  registrationAddress?: string;
}

export interface TimeRecord {
  id: string;
  employeeId: string;
  date: string;
  timeIn?: string;
  timeOut?: string;
  timeInLocation?: { lat: number; lng: number };
  timeOutLocation?: { lat: number; lng: number };
  timeInGeofenced: boolean;
  timeOutGeofenced: boolean;
  timeInFaceVerified: boolean;
  timeOutFaceVerified: boolean;
  timeInPhoto?: string;
  timeOutPhoto?: string;
  totalHours?: number;
  status: 'present' | 'late' | 'absent' | 'half-day' | 'overtime';
  notes?: string;
}

export interface GeofenceZone {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  radius: number;
  active: boolean;
}

export interface AppSettings {
  workStartTime: string;
  workEndTime: string;
  lateThresholdMinutes: number;
  geofenceEnabled: boolean;
  facialRecognitionEnabled: boolean;
}

export interface User {
  id: string;
  name: string;
  role: 'employee' | 'admin' | 'host';
  employeeId?: string;
}

export interface Evaluation {
  id: string;
  employeeId: string;
  evaluatedBy: string;
  attendanceScore: number;    // 0–100
  performanceScore: number;   // 0–100
  attitudeScore: number;      // 0–100
  punctualityScore: number;   // 0–100
  communicationScore: number; // 0–100
  overallScore: number;       // average
  grade: 'Excellent' | 'Very Good' | 'Good' | 'Satisfactory' | 'Needs Improvement';
  strengths: string;
  areasForImprovement: string;
  recommendations: string;
  evaluatedAt: string;
  status: 'draft' | 'final';
}

export interface HostSupervisor {
  id: string;
  name: string;
  email: string;
  companyName: string;
  position: string;
  active: boolean;
}

export interface HostFeedback {
  id: string;
  employeeId: string;
  hostName: string;
  hostCompany: string;
  hostPosition: string;
  hostEmail?: string;
  attendanceScore: number;
  performanceScore: number;
  attitudeScore: number;
  communicationScore: number;
  teamworkScore: number;
  overallScore: number;
  strengths: string;
  areasForImprovement: string;
  recommendation: 'Highly Recommended' | 'Recommended' | 'For Improvement' | 'Not Recommended';
  submittedAt: string;
  status: 'submitted' | 'reviewed' | 'archived';
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  photo?: string;
  reminder?: string;
  type: 'info' | 'warning' | 'success' | 'urgent';
  targetRole: 'all' | 'employee' | 'admin';
  isPinned: boolean;
  requiresSubmission?: boolean;
  deadlineAt?: string;
  comments?: string;
  createdAt: string;
  expiresAt?: string;
  createdBy: string;
  createdByRole?: 'admin' | 'host';
}

export interface AnnouncementSubmission {
  id: string;
  announcementId: string;
  employeeId: string;
  message: string;
  photo?: string;
  submittedAt: string;
}
