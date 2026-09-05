export interface Employee {
  id: string;
  name: string;
  employeeId: string;
  username?: string;
  email: string;
  department: string;
  position: string;
  companyName: string;
  supervisorName: string;
  schoolName: string;
  campus?: string;
  course: string;
  startDate: string;
  endDate: string;
  requiredHours: number;
  photo?: string;
  schoolLogo?: string;
  faceRegistered: boolean;
  createdAt: string;
  active: boolean;
  instructorId?: string;
  hteId?: string;
  linkedAt?: string;
  registrationLocation?: { lat: number; lng: number };
  registrationAddress?: string;
  firstName?: string;
  lastName?: string;
  middleInitial?: string;
  companyAddress?: string;
  contactPerson?: string;
  contactPhone?: string;
  academicYear?: string;
  approvalStatus?: 'pending' | 'approved' | 'rejected';
  /** Backed by the `application_status` column in Supabase. Source of truth for the login gate. */
  applicationStatus?: 'unregistered' | 'pending' | 'approved' | 'rejected';
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
  academicYear?: string;
  approvalStatus?: 'approved' | 'disapproved' | 'pending';
  approvalNote?: string;
  approvedBy?: string;
  approvedAt?: string;
}

export interface GeofenceZone {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  radius: number;
  active: boolean;
  academicYear?: string;
}

export interface AppSettings {
  workStartTime: string;
  workEndTime: string;
  lateThresholdMinutes: number;
  geofenceEnabled: boolean;
  facialRecognitionEnabled: boolean;
  academicYears: string[];
  activeAcademicYear: string;
}

export interface User {
  id: string;
  name: string;
  role: 'employee' | 'admin' | 'host' | 'hte';
  employeeId?: string;
  email?: string;
  photo?: string;
  faceRegistered?: boolean;
}

export interface Evaluation {
  id: string;
  employeeId: string;
  evaluatedBy: string;
  attendanceScore: number; // 0–100
  performanceScore: number; // 0–100
  attitudeScore: number; // 0–100
  punctualityScore: number; // 0–100
  communicationScore: number; // 0–100
  overallScore: number; // average
  grade: 'Excellent' | 'Very Good' | 'Good' | 'Satisfactory' | 'Needs Improvement';
  strengths: string;
  areasForImprovement: string;
  recommendations: string;
  evaluatedAt: string;
  status: 'draft' | 'final';
  academicYear?: string;
}

export interface HostSupervisor {
  id: string;
  name: string;
  email: string;
  companyName: string;
  position: string;
  active: boolean;
  academicYear?: string;
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
  academicYear?: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  photo?: string;
  reminder?: string;
  type: 'info' | 'warning' | 'success' | 'urgent';
  targetRole: 'all' | 'employee' | 'admin' | 'hte' | 'host';
  isPinned: boolean;
  requiresSubmission?: boolean;
  deadlineAt?: string;
  comments?: string;
  createdAt: string;
  expiresAt?: string;
  createdBy: string;
  createdByRole?: 'admin' | 'host' | 'employee';
  academicYear?: string;
}

export interface AnnouncementSubmission {
  id: string;
  announcementId: string;
  employeeId: string;
  message: string;
  photo?: string;
  submittedAt: string;
}

export interface RequiredDocument {
  id: string;
  employeeId: string;
  title: string;
  description?: string;
  notes?: string;
  dueDate?: string;
  required: boolean;
  academicYear?: string;
  createdAt: string;
}

export interface RequiredDocumentSubmission {
  id: string;
  documentId: string;
  employeeId: string;
  submittedAt: string;
  note?: string;
  notes?: string;
  fileName?: string;
  fileUrl?: string;
  status: 'pending' | 'submitted' | 'approved' | 'rejected';
  verificationStatus?: 'passed' | 'failed' | 'pending';
}

export type RequirementStatus = 'missing' | 'incomplete' | 'complete';