export interface Employee {
  id: string;
  name: string;
  employeeId: string;
  username?: string;
  email: string;
  phone?: string;
  role?: 'employee' | 'admin' | 'hte' | 'host';
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
  userId?: string;
  instructorId?: string;
  hteId?: string;
  linkedAt?: string;
  registrationLocation?: { lat: number; lng: number; radius?: number };
  registrationRadius?: number;
  registrationAddress?: string;
  address?: string;
  street?: string;
  barangay?: string;
  city?: string;
  province?: string;
  region?: string;
  firstName?: string;
  lastName?: string;
  middleInitial?: string;
  companyAddress?: string;
  contactPerson?: string;
  contactPhone?: string;
  academicYear?: string;
  approvalStatus?: 'pending' | 'approved' | 'rejected';
  applicationStatus?: 'unregistered' | 'pending' | 'approved' | 'rejected';
  documentsPassed?: boolean;
  documentsStatus?: 'passed' | 'pending' | 'submitted' | 'incomplete' | 'partial';
  submittedDocuments?: TraineeDocuments;
}

export interface TraineeDocumentItem {
  name: string;
  size?: string | number;
  dataUrl?: string;
  fileType?: string;
  uploadedAt: string;
  status: 'passed' | 'pending';
}

export interface TraineeDocuments {
  pledgeOfConduct?: TraineeDocumentItem;
  medical?: TraineeDocumentItem;
  enrolmentForm?: TraineeDocumentItem;
  consent?: TraineeDocumentItem;
  resume?: TraineeDocumentItem;
  dutiesAndResponsibilities?: TraineeDocumentItem;
  moa?: TraineeDocumentItem;
  internshipAgreement?: TraineeDocumentItem;
  evaluationForm?: TraineeDocumentItem;
  evaluationReport?: TraineeDocumentItem;
  // Legacy / backward-compatible aliases
  endorsement?: TraineeDocumentItem;
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
  instructorName?: string;
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

export interface EvaluationCriterion {
  id: string;
  number: number;
  text: string;
}

export interface EvaluationCategory {
  id: 'workHabits' | 'workSkills' | 'socialSkills';
  title: string;
  items: EvaluationCriterion[];
}

export const CHMSU_RATING_SCALE = [
  { value: 5, label: 'Exceed job requirements', description: "The students' performance was impressive and exceeded what was normally expected of them in this position." },
  { value: 4, label: 'Fully met job requirement', description: 'Performance is what is expected of a person in his/her position.' },
  { value: 3, label: 'Met normal job requirements with few exceptions', description: 'Improvements in performance are needed in one or more elements.' },
  { value: 2, label: 'Met minimum job requirements', description: 'Work improvement plans were needed to bring performance to a satisfactory level.' },
  { value: 1, label: 'Did not meet job requirements', description: 'Significant performance improvement is urgently needed.' },
  { value: 0, label: 'NA', description: 'Not applicable' },
] as const;

export const CHMSU_EVALUATION_CATEGORIES: EvaluationCategory[] = [
  {
    id: 'workHabits',
    title: 'WORK HABITS',
    items: [
      { id: 'wh_1', number: 1, text: 'Punctual' },
      { id: 'wh_2', number: 2, text: 'Reports regularly' },
      { id: 'wh_3', number: 3, text: 'Perform tasks without much supervision.' },
      { id: 'wh_4', number: 4, text: 'Practices self-discipline in his/her work.' },
      { id: 'wh_5', number: 5, text: 'Demonstrate dedication and commitment to the task assigned to him/her.' },
    ],
  },
  {
    id: 'workSkills',
    title: 'WORK SKILLS',
    items: [
      { id: 'ws_1', number: 1, text: 'Demonstrates the ability to operate machines needed on the job.' },
      { id: 'ws_2', number: 2, text: 'Handles the details of the work assigned to him/her.' },
      { id: 'ws_3', number: 3, text: 'Shows flexibility (whenever the need arises) in the process of going through his/her task.' },
      { id: 'ws_4', number: 4, text: 'Manifest thoroughness and precise attention to detail.' },
      { id: 'ws_5', number: 5, text: 'Fully understands the linkage or connection between his/her task to previous, intervening, and subsequent tasks.' },
      { id: 'ws_6', number: 6, text: 'Usually comes up with sound suggestions to problems.' },
    ],
  },
  {
    id: 'socialSkills',
    title: 'SOCIAL SKILLS',
    items: [
      { id: 'ss_1', number: 1, text: 'Shows tact in dealing with different people with whom he/she comes in contact.' },
      { id: 'ss_2', number: 2, text: 'Shows respect and courtesy in dealing with peers and superiors.' },
      { id: 'ss_3', number: 3, text: 'Willingly help others (whenever necessary) in their task performance.' },
      { id: 'ss_4', number: 4, text: 'Is capable of learning from and listening to co-workers.' },
      { id: 'ss_5', number: 5, text: 'Shows appreciation and gratitude for any form of assistance granted to him/her by others.' },
      { id: 'ss_6', number: 6, text: 'Shows poise and self-confidence and is always well-groomed.' },
      { id: 'ss_7', number: 7, text: 'Shows emotional maturity.' },
    ],
  },
];

export type EmployabilityStatus =
  | 'OJT Trainee'
  | 'Contractual'
  | 'Regular'
  | 'Probationary'
  | 'Casual'
  | 'Applicant';

export interface EvaluationQuestionnaire {
  companyAddress?: string;
  contactPerson?: string;
  trainingDateFrom?: string;
  trainingDateTo?: string;
  dateOfEvaluation?: string;
  dateOfLastEvaluation?: string;
  employabilityStatus?: EmployabilityStatus | string;
  employedCompanyName?: string;
  allowanceSalary?: string;
  telephoneNo?: string;
  department?: string;
  position?: string;
  otherDeptAssigned?: string;

  // 9 CHMSU Official Evaluation Questions
  q1_dutiesBriefly?: string;
  q2_strongestPerformanceArea?: string;
  q3_areasImprovedMost?: string;
  q4_areasNeedImprovement?: string;
  q5_situationChallengedMost?: string;
  q6_howOvercameChallenge?: string;
  q7_whatLearnedFromExperience?: string;
  q8_isQualifiedLinkage?: string;
  q9_ojtSuggestionsRecommendations?: string;
}

export interface Evaluation {
  id: string;
  employeeId: string;
  evaluatedBy: string;
  evaluatorName?: string;
  evaluatorPosition?: string;
  date?: string;

  // Official CHMSU CCS 1-5 criteria ratings (e.g. { wh_1: 5, wh_2: 4, ... })
  ratings?: Record<string, number>;
  categoryScores?: {
    workHabits: number; // average out of 5
    workSkills: number;
    socialSkills: number;
  };
  ratingComments?: {
    workHabits?: string;
    workSkills?: string;
    socialSkills?: string;
    [key: string]: string | undefined;
  };
  overallRating?: number; // 1.00 to 5.00
  commentsSuggestions?: string;

  // Official CHMSU CCS Page 2 Questionnaire & Training Details
  questionnaire?: EvaluationQuestionnaire;

  // Compatibility & database fields
  totalScore?: number;
  attendanceScore: number; // 0–100
  performanceScore: number; // 0–100
  attitudeScore: number; // 0–100
  punctualityScore: number; // 0–100
  communicationScore: number; // 0–100
  overallScore: number; // average (0–100)
  grade: 'Excellent' | 'Very Good' | 'Good' | 'Satisfactory' | 'Needs Improvement';
  strengths: string;
  areasForImprovement: string;
  recommendations: string;
  evaluatedAt: string;
  status: 'draft' | 'final' | 'submitted_to_instructor' | 'reviewed_by_instructor';
  instructorViewedAt?: string;
  instructorViewedBy?: string;
  academicYear?: string;
}

export interface MonthlyDttrDayEntry {
  day: number;
  amArrival?: string;
  amDeparture?: string;
  pmArrival?: string;
  pmDeparture?: string;
  hours?: number;
  tasks?: string;
}

export interface MonthlyDttrRecord {
  id: string; // e.g. `${employeeId}_${year}_${month}`
  employeeId: string;
  year: number;
  month: number; // 1-12
  academicYear?: string;
  customEntries?: Record<number, MonthlyDttrDayEntry>;
  hteSupervisorName?: string;
  hteSupervisorTitle?: string;
  hteSignedAt?: string;
  hteSignatureStatus?: 'signed' | 'pending';
  hteSignatureNotes?: string;
  studentSignedAt?: string;
  updatedAt?: string;
}

export interface HostSupervisor {
  id: string;
  name: string;
  email: string;
  employeeId?: string;
  companyName: string;
  companyAddress?: string;
  contactPerson?: string;
  phone?: string;
  position?: string;
  active: boolean;
  isApproved?: boolean;
  academicYear?: string;
  registrationLocation?: { lat: number; lng: number; radius?: number };
  registrationRadius?: number;
  registrationAddress?: string;
  photo?: string;
  faceRegistered?: boolean;
  createdAt?: string;
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

export interface AnnouncementComment {
  id: string;
  announcementId: string;
  employeeId?: string;
  authorName: string;
  authorRole: 'admin' | 'host' | 'employee' | 'trainee';
  content: string;
  createdAt: string;
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