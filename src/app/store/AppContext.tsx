import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { toast } from 'sonner';
import { authAPI } from '../services/authApi';

import { supabase, isSupabaseConfigured } from '../lib/supabase';
import * as supabaseService from '../services/supabaseService';
import { isSecurityApiConfigured, registerFace } from '../services/securityApi';
import { getAbsoluteUrl } from '../services/config';
import { sendAnnouncementNotificationEmail } from '../lib/resend';
import {
  Employee,
  TimeRecord,
  GeofenceZone,
  AppSettings,
  User,
  Evaluation,
  Announcement,
  AnnouncementSubmission,
  AnnouncementComment,
  RequiredDocument,
  RequiredDocumentSubmission,
  RequirementStatus,
  HostFeedback,
  HostSupervisor,
  TraineeDocuments,
  TraineeDocumentItem,
  MonthlyDttrRecord,
  EvaluationQuestionnaire,
  MonitoringReport,
  TraineeSelfMonitoringReport,
} from '../types';
import { GEOFENCE_RADIUS_METERS, getDTRSessionDate, calculateTotalHours } from '../utils/geo';
import { getCampusLocation } from '../utils/campusLocations';
import { resolveHteLocation, isInvalidHteCompany, isTraineeRole } from '../utils/hteLocation';
import { TRAINEE_REQUIRED_HOURS, normalizeTraineeRequiredHours } from '../data/ojtConstants';
import { buildDefaultReportsForTrainee } from '../utils/monitoringReportGenerator';

const STORAGE_KEYS = {
  EMPLOYEES: 'ojt_employees',
  TIME_RECORDS: 'ojt_time_records',
  GEOFENCE_ZONES: 'ojt_geofence_zones',
  GEOFENCE_MIGRATION_V1: 'ojt_geofence_migration_v1',
  SETTINGS: 'ojt_settings',
  CURRENT_USER: 'ojt_current_user',
  EVALUATIONS: 'ojt_evaluations',
  ANNOUNCEMENTS: 'ojt_announcements',
  ANNOUNCEMENT_SUBMISSIONS: 'ojt_announcement_submissions',
  ANNOUNCEMENT_COMMENTS: 'ojt_announcement_comments',
  REQUIRED_DOCUMENTS: 'ojt_required_documents',
  REQUIRED_DOCUMENT_SUBMISSIONS: 'ojt_required_document_submissions',
  HOST_FEEDBACK: 'ojt_host_feedback',
  HOST_SUPERVISORS: 'ojt_host_supervisors',
  PASSWORDS: 'ojt_passwords',
  MONTHLY_DTTR: 'ojt_monthly_dttr',
  MONITORING_REPORTS: 'ojt_monitoring_reports',
  TRAINEE_SELF_MONITORING_REPORTS: 'ojt_trainee_self_monitoring_reports',
};

const DEFAULT_SETTINGS: AppSettings = {
  workStartTime: '08:00',
  workEndTime: '17:00',
  lateThresholdMinutes: 15,
  geofenceEnabled: true,
  facialRecognitionEnabled: true,
  academicYears: ['2025-2026', '2026-2027'],
  activeAcademicYear: '2026-2027',
};

function getCurrentAcademicYear(): string {
  const now = new Date();
  const year = now.getMonth() >= 5 ? now.getFullYear() : now.getFullYear() - 1;
  return `${year}-${year + 1}`;
}

const DEFAULT_GEOFENCE: GeofenceZone[] = [];

const MOCK_EMPLOYEES: Employee[] = [];

// Utility to generate stable-ish ids without calling impure APIs in render
function generateId(prefix = 'id') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

const DEFAULT_PASSWORDS: Record<string, string> = {
  'admin@ojt.com': 'admin123',
};

const DEFAULT_ANNOUNCEMENTS: Announcement[] = [
  {
    id: 'ann-1',
    title: 'Welcome to CHMSU OJT Management System!',
    content:
      'Welcome to the Carlos Hilado Memorial State University On-the-Job Training Management System. Please make sure to clock in and out every working day using facial recognition and location verification.',
    type: 'success',
    targetRole: 'all',
    isPinned: true,
    createdAt: new Date().toISOString(),
    createdBy: 'OJT Instructor',
  },
  {
    id: 'ann-2',
    title: 'Reminder: Attendance Policy',
    content:
      'Trainees are required to be within the geofenced zone to record attendance. Tardiness of more than 15 minutes will be marked as late. Please arrive on time.',
    type: 'warning',
    targetRole: 'employee',
    isPinned: false,
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    createdBy: 'OJT Instructor',
  },
];

const DEFAULT_HOST_SUPERVISORS: HostSupervisor[] = [];

const DEFAULT_HOST_FEEDBACK: HostFeedback[] = [];

const DEFAULT_MONITORING_REPORTS: MonitoringReport[] = [
  {
    id: 'mr-demo-weekly-1',
    reportNumber: 'CHMSU-MR-2026-W04',
    reportType: 'weekly',
    term: 'midterm',
    frequency: 'weekly',
    traineeId: '20231379',
    traineeName: 'Juan Dela Cruz',
    studentId: '20231379',
    course: 'Bachelor of Science in Information Technology',
    department: 'College of Computer Studies',
    campus: 'Talisay (Main Campus)',
    academicYear: '2026-2027',
    hteCompanyName: 'Provincial Government of Negros Occidental - IT Division',
    hteAddress: 'Gatuslao St., Bacolod City, Negros Occidental',
    supervisorName: 'Engr. Roberto M. Tan',
    supervisorContact: '+63 917 555 4321',
    supervisorDesignation: 'Senior Systems Administrator & OJT Mentor',
    instructorName: 'Prof. Ma. Cristina Ramos, MIT',
    periodCovered: 'Mid-Term Week 4 (October 12 – October 16, 2026)',
    dateSubmitted: '2026-10-16',
    hoursRenderedThisPeriod: 40,
    totalCumulativeHours: 160,
    requiredHours: TRAINEE_REQUIRED_HOURS,
    remainingHours: 440,
    tasksAccomplished: 'Assisted network engineers with structured cabling, termination of CAT6 keystones, switch port VLAN configuration, and verified connectivity across Building B.',
    skillsApplied: 'LAN Switching, RJ45 crimping, IP subnetting, network troubleshooting tools.',
    challengesEncountered: 'Encountered intermittent packet loss on port 14 of floor switch; resolved by replacing damaged patch cord.',
    questionnaire: {
      employabilityStatus: 'OJT Trainee',
      allowanceSalary: 'None / Stipend',
      telephoneNo: '+63 917 555 4321',
      department: 'COLLEGE OF COMPUTER STUDIES',
      position: 'ON - THE - JOB TRAINEE',
      otherDeptAssigned: 'None',
      q1_dutiesBriefly: 'Assisted network engineers with structured cabling, termination of CAT6 keystones, switch port VLAN configuration, and verified connectivity across Building B.',
      q2_strongestPerformanceArea: 'Technical troubleshooting, structured cabling, and network switch configuration.',
      q3_areasImprovedMost: 'Hands-on network infrastructure deployment and systematic hardware diagnostics.',
      q4_areasNeedImprovement: 'Advanced router access control lists and enterprise firewall configurations.',
      q5_situationChallengedMost: 'Encountered intermittent packet loss on port 14 of floor switch during active departmental hours.',
      q6_howOvercameChallenge: 'Tested lines with modular cable scanner, isolated the faulty patch cord, and re-crimped with supervisor guidance.',
      q7_whatLearnedFromExperience: 'Real-world enterprise network reliability requires strict adherence to physical layer standards and documentation.',
      q8_isQualifiedLinkage: 'Yes, highly qualified with modern enterprise networking equipment and dedicated technical mentorship.',
      q9_ojtSuggestionsRecommendations: 'Recommend giving succeeding student interns earlier exposure to core routing configs.',
      attendanceScore: 5,
      performanceScore: 5,
      attitudeScore: 5,
      communicationScore: 4,
      teamworkScore: 5,
      overallScore: 96,
      strengths: 'Very organized workplace; mentor Engr. Tan patiently walks through network topologies before deployment.',
      areasForImprovement: 'Would appreciate exposure to firewall configuration rules and router access control lists.',
      recommendation: 'Highly Recommended',
    },
    status: 'reviewed',
    instructorRemarks: 'Excellent weekly monitoring submission Juan! Your structured documentation of the VLAN setup is commendable.',
    reviewedByInstructorAt: '2026-10-17T09:30:00Z',
    createdAt: '2026-10-16T17:00:00Z',
  },
  {
    id: 'mr-demo-monthly-1',
    reportNumber: 'CHMSU-MR-2026-M01',
    reportType: 'monthly',
    term: 'midterm',
    frequency: 'monthly',
    traineeId: 'emp-1',
    traineeName: 'Maria Santos',
    studentId: '20231380',
    course: 'Bachelor of Science in Information Systems',
    department: 'College of Computer Studies',
    campus: 'Talisay (Main Campus)',
    academicYear: '2026-2027',
    hteCompanyName: 'Negros CyberCenter Tech Solutions',
    hteAddress: 'Lacson St., Bacolod City',
    supervisorName: 'Ms. Clarisse Gomez',
    supervisorContact: '+63 920 888 1234',
    supervisorDesignation: 'Lead Business Analyst',
    instructorName: 'Prof. Ma. Cristina Ramos, MIT',
    periodCovered: 'Mid-Term Month 1 (September 2026)',
    dateSubmitted: '2026-09-30',
    hoursRenderedThisPeriod: 160,
    totalCumulativeHours: 160,
    requiredHours: TRAINEE_REQUIRED_HOURS,
    remainingHours: 440,
    tasksAccomplished: 'Prepared software requirements specifications (SRS), created Figma user journey wireframes, and participated in daily standups for client ERP upgrade.',
    skillsApplied: 'Agile/Scrum, Business Process Modeling (BPMN), Figma UI prototyping, JIRA backlog management.',
    challengesEncountered: 'Shifting client requirement priorities during sprint mid-cycle.',
    questionnaire: {
      employabilityStatus: 'OJT Trainee',
      allowanceSalary: 'None / Stipend',
      telephoneNo: '+63 920 888 1234',
      department: 'COLLEGE OF COMPUTER STUDIES',
      position: 'ON - THE - JOB TRAINEE',
      otherDeptAssigned: 'Quality Assurance',
      q1_dutiesBriefly: 'Drafted software requirements specifications, conducted user story mapping, and built interactive UI prototypes in Figma.',
      q2_strongestPerformanceArea: 'High attention to detail in UX design and business process modeling notation.',
      q3_areasImprovedMost: 'Agile sprint collaboration and clear technical communication with development leads.',
      q4_areasNeedImprovement: 'Complex database schema queries and automated backend testing suites.',
      q5_situationChallengedMost: 'Rapid scope changes requested by stakeholders 2 days prior to sprint review.',
      q6_howOvercameChallenge: 'Maintained calm, organized backlog items with mentor Ms. Gomez, and reprioritized deliverables.',
      q7_whatLearnedFromExperience: 'Understanding end-user requirements thoroughly prevents costly rework during software implementation.',
      q8_isQualifiedLinkage: 'Yes, outstanding environment for Information Systems interns seeking real Agile team exposure.',
      q9_ojtSuggestionsRecommendations: 'Allow student interns to observe live staging deployments earlier in the rotation.',
      attendanceScore: 5,
      performanceScore: 5,
      attitudeScore: 4,
      communicationScore: 5,
      teamworkScore: 5,
      overallScore: 96,
      strengths: 'Exceptional mentorship and collaborative team atmosphere. Supervisors provide detailed feedback on every wireframe.',
      areasForImprovement: 'Provide access to actual test staging server earlier in the sprint.',
      recommendation: 'Highly Recommended',
    },
    status: 'reviewed',
    instructorRemarks: 'Impressive progress Maria. Continue refining your system requirement documents according to ISO specifications.',
    reviewedByInstructorAt: '2026-10-02T10:15:00Z',
    createdAt: '2026-09-30T16:30:00Z',
  },
  {
    id: 'mr-demo-juan-mid-monthly-1',
    reportNumber: 'CHMSU-MR-2026-JM01',
    reportType: 'monthly',
    term: 'midterm',
    frequency: 'monthly',
    traineeId: '20231379',
    traineeName: 'Juan Dela Cruz',
    studentId: '20231379',
    course: 'Bachelor of Science in Information Technology',
    department: 'College of Computer Studies',
    campus: 'Talisay (Main Campus)',
    academicYear: '2026-2027',
    hteCompanyName: 'Provincial Government of Negros Occidental - IT Division',
    hteAddress: 'Gatuslao St., Bacolod City, Negros Occidental',
    supervisorName: 'Engr. Roberto M. Tan',
    supervisorContact: '+63 917 555 4321',
    supervisorDesignation: 'Senior Systems Administrator & OJT Mentor',
    instructorName: 'Prof. Ma. Cristina Ramos, MIT',
    periodCovered: 'Mid-Term Month 1 (September 2026)',
    dateSubmitted: '2026-09-30',
    hoursRenderedThisPeriod: 160,
    totalCumulativeHours: 160,
    requiredHours: TRAINEE_REQUIRED_HOURS,
    remainingHours: 440,
    tasksAccomplished: 'Installed and configured network monitoring tools (Nagios / Zabbix), mapped local area network switches, and documented monthly server uptime.',
    skillsApplied: 'Network monitoring, SNMP, Linux server administration, network mapping.',
    challengesEncountered: 'Configuring firewall ports for remote SNMP trap listeners.',
    questionnaire: {
      employabilityStatus: 'OJT Trainee',
      allowanceSalary: 'None / Stipend',
      telephoneNo: '+63 917 555 4321',
      department: 'COLLEGE OF COMPUTER STUDIES',
      position: 'ON - THE - JOB TRAINEE',
      otherDeptAssigned: 'Network Operations',
      q1_dutiesBriefly: 'Configuring network monitoring agents, reviewing event logs, and assisting with server room cable management.',
      q2_strongestPerformanceArea: 'High diligence in system monitoring and structured cabling maintenance.',
      q3_areasImprovedMost: 'Command-line system diagnostics and network protocol analysis.',
      q4_areasNeedImprovement: 'Advanced router BGP routing protocols.',
      q5_situationChallengedMost: 'Troubleshooting packet drops on high-throughput switch uplinks.',
      q6_howOvercameChallenge: 'Captured network packets with Wireshark and analyzed MTU size discrepancies.',
      q7_whatLearnedFromExperience: 'Continuous network monitoring prevents system outages before they impact end-users.',
      q8_isQualifiedLinkage: 'Yes, outstanding environment for Information Technology interns.',
      q9_ojtSuggestionsRecommendations: 'Continue the institutional partnership with CHMSU.',
      attendanceScore: 5,
      performanceScore: 5,
      attitudeScore: 5,
      communicationScore: 5,
      teamworkScore: 5,
      overallScore: 98,
      strengths: 'Very dependable, organized, and enthusiastic about enterprise infrastructure.',
      areasForImprovement: 'Keep practicing advanced routing configurations.',
      recommendation: 'Highly Recommended',
    },
    status: 'reviewed',
    instructorRemarks: 'Great first month Juan! Keep up the commendable documentation of network monitoring operations.',
    reviewedByInstructorAt: '2026-10-02T10:00:00Z',
    createdAt: '2026-09-30T17:00:00Z',
  },
  {
    id: 'mr-demo-midterm-1',
    reportNumber: 'CHMSU-MR-2026-MID',
    reportType: 'midterm',
    term: 'midterm',
    frequency: 'evaluation',
    traineeId: '20231379',
    traineeName: 'Juan Dela Cruz',
    studentId: '20231379',
    course: 'Bachelor of Science in Information Technology',
    department: 'College of Computer Studies',
    campus: 'Talisay (Main Campus)',
    academicYear: '2026-2027',
    hteCompanyName: 'Provincial Government of Negros Occidental - IT Division',
    hteAddress: 'Gatuslao St., Bacolod City, Negros Occidental',
    supervisorName: 'Engr. Roberto M. Tan',
    supervisorContact: '+63 917 555 4321',
    supervisorDesignation: 'Senior Systems Administrator & OJT Mentor',
    instructorName: 'Prof. Ma. Cristina Ramos, MIT',
    periodCovered: 'Mid-Term Evaluation (300 Hours Milestone)',
    dateSubmitted: '2026-10-10',
    hoursRenderedThisPeriod: 140,
    totalCumulativeHours: 300,
    requiredHours: TRAINEE_REQUIRED_HOURS,
    remainingHours: 300,
    tasksAccomplished: 'Completed midterm evaluation milestone. Deployed centralized Active Directory domain accounts, configured automated night backups, and audited 40 departmental workstations.',
    skillsApplied: 'Windows Server 2022, Active Directory, PowerShell scripting, RAID storage maintenance.',
    challengesEncountered: 'Legacy backup script syntax errors during server migration.',
    questionnaire: {
      employabilityStatus: 'OJT Trainee',
      allowanceSalary: 'None / Stipend',
      telephoneNo: '+63 917 555 4321',
      department: 'COLLEGE OF COMPUTER STUDIES',
      position: 'ON - THE - JOB TRAINEE',
      otherDeptAssigned: 'Systems Administration',
      q1_dutiesBriefly: 'Managing server user accounts, administering network backups, and providing tier-2 workstation IT support.',
      q2_strongestPerformanceArea: 'Proactive server maintenance and PowerShell automation scripting.',
      q3_areasImprovedMost: 'Confidence in administering enterprise domain controllers without fear of system disruption.',
      q4_areasNeedImprovement: 'Linux server command-line administration and Docker container management.',
      q5_situationChallengedMost: 'Restoring user profile permissions following unexpected local drive failure.',
      q6_howOvercameChallenge: 'Executed incremental shadow copy restores and verified integrity before notifying the department head.',
      q7_whatLearnedFromExperience: 'Robust backup systems and disciplined system documentation protect organizations from catastrophic loss.',
      q8_isQualifiedLinkage: 'Yes, highly recommended. Real production environments provide unparalleled practical skills.',
      q9_ojtSuggestionsRecommendations: 'Continue the institutional partnership with CHMSU for future IT student cohorts.',
      attendanceScore: 5,
      performanceScore: 5,
      attitudeScore: 5,
      communicationScore: 5,
      teamworkScore: 5,
      overallScore: 100,
      strengths: 'First-rate enterprise equipment, supportive management, and meaningful technical responsibility given to interns.',
      areasForImprovement: 'Keep up the current training program pace; opportunity to observe disaster recovery drill.',
      recommendation: 'Highly Recommended',
    },
    status: 'reviewed',
    instructorRemarks: 'Congratulations on reaching the 300-hour midpoint Juan! Your supervisor notes you are functioning on par with junior IT personnel.',
    reviewedByInstructorAt: '2026-10-12T11:00:00Z',
    createdAt: '2026-10-10T15:00:00Z',
  },
  {
    id: 'mr-demo-juan-end-weekly-1',
    reportNumber: 'CHMSU-MR-2026-EW10',
    reportType: 'weekly',
    term: 'endterm',
    frequency: 'weekly',
    traineeId: '20231379',
    traineeName: 'Juan Dela Cruz',
    studentId: '20231379',
    course: 'Bachelor of Science in Information Technology',
    department: 'College of Computer Studies',
    campus: 'Talisay (Main Campus)',
    academicYear: '2026-2027',
    hteCompanyName: 'Provincial Government of Negros Occidental - IT Division',
    hteAddress: 'Gatuslao St., Bacolod City, Negros Occidental',
    supervisorName: 'Engr. Roberto M. Tan',
    supervisorContact: '+63 917 555 4321',
    supervisorDesignation: 'Senior Systems Administrator & OJT Mentor',
    instructorName: 'Prof. Ma. Cristina Ramos, MIT',
    periodCovered: 'End-Term Week 10 (October 26 – October 30, 2026)',
    dateSubmitted: '2026-10-30',
    hoursRenderedThisPeriod: 40,
    totalCumulativeHours: 400,
    requiredHours: TRAINEE_REQUIRED_HOURS,
    remainingHours: 200,
    tasksAccomplished: 'Second half practicum: Configured enterprise SSL certificates, implemented automated database replica sync, and assisted with data center hardware migration.',
    skillsApplied: 'SSL/TLS, OpenSSL, MySQL replication, server rack mounting, power redundancy testing.',
    challengesEncountered: 'Handling certificate chain validation errors on internal CA.',
    questionnaire: {
      employabilityStatus: 'OJT Trainee',
      allowanceSalary: 'None / Stipend',
      telephoneNo: '+63 917 555 4321',
      department: 'COLLEGE OF COMPUTER STUDIES',
      position: 'ON - THE - JOB TRAINEE',
      otherDeptAssigned: 'Infrastructure',
      q1_dutiesBriefly: 'Managing server certificates, database replica monitoring, and server room hardware installation.',
      q2_strongestPerformanceArea: 'High discipline with security credentials and careful hardware handling.',
      q3_areasImprovedMost: 'Server security protocols and high-availability database architectures.',
      q4_areasNeedImprovement: 'Multi-cloud hybrid disaster recovery strategies.',
      q5_situationChallengedMost: 'Root certificate renewal without interrupting departmental transactions.',
      q6_howOvercameChallenge: 'Tested renewal in staging subnet, validated trust store, and coordinated off-peak rollout.',
      q7_whatLearnedFromExperience: 'Zero-downtime maintenance requires methodical rehearsal in isolated environments.',
      q8_isQualifiedLinkage: 'Yes, highly qualified Host Training Establishment.',
      q9_ojtSuggestionsRecommendations: 'Maintain the partnership with CHMSU College of Computer Studies.',
      attendanceScore: 5,
      performanceScore: 5,
      attitudeScore: 5,
      communicationScore: 5,
      teamworkScore: 5,
      overallScore: 98,
      strengths: 'Very solid work ethic and proactive technical inquiry.',
      areasForImprovement: 'Continue studying cloud infrastructure.',
      recommendation: 'Highly Recommended',
    },
    status: 'reviewed',
    instructorRemarks: 'Commendable performance Juan! Excellent work on the replica synchronization.',
    reviewedByInstructorAt: '2026-10-31T09:00:00Z',
    createdAt: '2026-10-30T17:00:00Z',
  },
  {
    id: 'mr-demo-juan-end-monthly-1',
    reportNumber: 'CHMSU-MR-2026-EM03-J',
    reportType: 'monthly',
    term: 'endterm',
    frequency: 'monthly',
    traineeId: '20231379',
    traineeName: 'Juan Dela Cruz',
    studentId: '20231379',
    course: 'Bachelor of Science in Information Technology',
    department: 'College of Computer Studies',
    campus: 'Talisay (Main Campus)',
    academicYear: '2026-2027',
    hteCompanyName: 'Provincial Government of Negros Occidental - IT Division',
    hteAddress: 'Gatuslao St., Bacolod City, Negros Occidental',
    supervisorName: 'Engr. Roberto M. Tan',
    supervisorContact: '+63 917 555 4321',
    supervisorDesignation: 'Senior Systems Administrator & OJT Mentor',
    instructorName: 'Prof. Ma. Cristina Ramos, MIT',
    periodCovered: 'End-Term Month 3 (October 2026)',
    dateSubmitted: '2026-10-31',
    hoursRenderedThisPeriod: 160,
    totalCumulativeHours: 480,
    requiredHours: TRAINEE_REQUIRED_HOURS,
    remainingHours: 120,
    tasksAccomplished: 'Monthly End-Term milestone review: Audited firewall access logs, updated vulnerability patches on 35 servers, and conducted disaster recovery simulation drill.',
    skillsApplied: 'Firewall rules, vulnerability scanning, security patching, disaster recovery planning.',
    challengesEncountered: 'Service dependency order during cold-boot server recovery sequence.',
    questionnaire: {
      employabilityStatus: 'OJT Trainee',
      allowanceSalary: 'None / Stipend',
      telephoneNo: '+63 917 555 4321',
      department: 'COLLEGE OF COMPUTER STUDIES',
      position: 'ON - THE - JOB TRAINEE',
      otherDeptAssigned: 'Cybersecurity Operations',
      q1_dutiesBriefly: 'Reviewing security incident logs, vulnerability scanning, and testing emergency power restore scripts.',
      q2_strongestPerformanceArea: 'Keen analytical attention to security anomalies and disciplined log auditing.',
      q3_areasImprovedMost: 'Incident triage and enterprise IT risk mitigation protocols.',
      q4_areasNeedImprovement: 'SIEM orchestration and automated threat response rules.',
      q5_situationChallengedMost: 'Isolating an anomalous outbound port scan from an unpatched lab workstation.',
      q6_howOvercameChallenge: 'Quarantined the host on VLAN 99, scanned for malware, and applied critical vendor patches.',
      q7_whatLearnedFromExperience: 'Defense-in-depth and rapid network isolation are vital to enterprise cybersecurity.',
      q8_isQualifiedLinkage: 'Yes, extraordinary learning environment for IT students.',
      q9_ojtSuggestionsRecommendations: 'Continue inviting CHMSU students for infrastructure internships.',
      attendanceScore: 5,
      performanceScore: 5,
      attitudeScore: 5,
      communicationScore: 5,
      teamworkScore: 5,
      overallScore: 100,
      strengths: 'First-class technical intuition, outstanding reliability, and strong professional etiquette.',
      areasForImprovement: 'Keep striving for excellence.',
      recommendation: 'Highly Recommended',
    },
    status: 'reviewed',
    instructorRemarks: 'Superb monthly progress Juan! You are almost at the 600-hour milestone.',
    reviewedByInstructorAt: '2026-11-02T10:00:00Z',
    createdAt: '2026-10-31T17:00:00Z',
  },
  {
    id: 'mr-demo-juan-end-eval-1',
    reportNumber: 'CHMSU-MR-2026-END-600H-J',
    reportType: 'endterm',
    term: 'endterm',
    frequency: 'evaluation',
    traineeId: '20231379',
    traineeName: 'Juan Dela Cruz',
    studentId: '20231379',
    course: 'Bachelor of Science in Information Technology',
    department: 'College of Computer Studies',
    campus: 'Talisay (Main Campus)',
    academicYear: '2026-2027',
    hteCompanyName: 'Provincial Government of Negros Occidental - IT Division',
    hteAddress: 'Gatuslao St., Bacolod City, Negros Occidental',
    supervisorName: 'Engr. Roberto M. Tan',
    supervisorContact: '+63 917 555 4321',
    supervisorDesignation: 'Senior Systems Administrator & OJT Mentor',
    instructorName: 'Prof. Ma. Cristina Ramos, MIT',
    periodCovered: 'End-Term Final Completion (600 Hours Milestone)',
    dateSubmitted: '2026-11-15',
    hoursRenderedThisPeriod: 120,
    totalCumulativeHours: 600,
    requiredHours: 600,
    remainingHours: 0,
    tasksAccomplished: 'Successfully completed the entire 600-hour practicum! Finalized data center documentation, trained incoming junior OJT batches on structured cabling, and presented final practicum portfolio to division heads.',
    skillsApplied: 'Data center management, documentation, leadership, network switching, enterprise IT support.',
    challengesEncountered: 'Consolidating multi-month technical logs into concise executive presentation.',
    questionnaire: {
      employabilityStatus: 'OJT Trainee',
      allowanceSalary: 'None / Stipend',
      telephoneNo: '+63 917 555 4321',
      department: 'COLLEGE OF COMPUTER STUDIES',
      position: 'ON - THE - JOB TRAINEE',
      otherDeptAssigned: 'Executive IT Staff',
      q1_dutiesBriefly: 'Finalized enterprise network documentation, conducted handover sessions, and completed final practicum exit requirements.',
      q2_strongestPerformanceArea: 'Comprehensive systems troubleshooting, network infrastructure management, and teamwork.',
      q3_areasImprovedMost: 'Professional confidence, technical communication, and real-world system architecture.',
      q4_areasNeedImprovement: 'Industry certifications (CCNA, CompTIA Security+).',
      q5_situationChallengedMost: 'Managing time across simultaneous server migrations while documenting network changes.',
      q6_howOvercameChallenge: 'Applied daily prioritized task checklists and reviewed milestones each morning with supervisor.',
      q7_whatLearnedFromExperience: 'Technical mastery combined with integrity, punctuality, and clear communication makes a successful IT professional.',
      q8_isQualifiedLinkage: 'Yes, outstanding Host Training Establishment that genuinely invests in student intern growth.',
      q9_ojtSuggestionsRecommendations: 'Express sincere gratitude to CHMSU CCS and the Provincial Government IT Division for this life-shaping opportunity.',
      attendanceScore: 5,
      performanceScore: 5,
      attitudeScore: 5,
      communicationScore: 5,
      teamworkScore: 5,
      overallScore: 100,
      strengths: 'Outstanding work ethic, highly commended by division head Engr. Tan, and job-ready technical competence.',
      areasForImprovement: 'Pursue professional IT industry certifications upon graduation.',
      recommendation: 'Highly Recommended',
    },
    status: 'reviewed',
    instructorRemarks: 'Congratulations Juan on successfully completing all 600 required OJT hours with flying colors! Recommended for graduation.',
    reviewedByInstructorAt: '2026-11-16T10:00:00Z',
    createdAt: '2026-11-15T16:00:00Z',
  },
  {
    id: 'mr-demo-jheyree-mid-weekly-1',
    reportNumber: 'CHMSU-MR-2026-MW04',
    reportType: 'weekly',
    term: 'midterm',
    frequency: 'weekly',
    traineeId: '2089636c-7a7f-4943-ac23-23fd70afd4fd',
    traineeName: 'Jhey Ree C Ebro',
    studentId: '20231331',
    course: 'Bachelor of Science in Information Systems',
    department: 'College of Computer Studies',
    campus: 'Talisay (Main Campus)',
    academicYear: '2026-2027',
    hteCompanyName: 'Concentrix',
    hteAddress: 'Bacolod City, Negros Occidental',
    supervisorName: 'Jhey Ree C Ebro',
    supervisorContact: '+63 917 123 4567',
    supervisorDesignation: 'OJT Training Supervisor',
    instructorName: 'Prof. Ma. Cristina Ramos, MIT',
    periodCovered: 'Mid-Term Week 4 (September 15 – September 19, 2026)',
    dateSubmitted: '2026-09-19',
    hoursRenderedThisPeriod: 40,
    totalCumulativeHours: 160,
    requiredHours: 600,
    remainingHours: 440,
    tasksAccomplished: 'Designed and developed trainee profile forms, implemented client-side validation rules, and built reusable Tailwind/vanilla CSS UI components for internal dashboard.',
    skillsApplied: 'React, TypeScript, CSS modules, responsive web layout, git branch management.',
    challengesEncountered: 'Component styling conflicts between nested layout elements.',
    questionnaire: {
      employabilityStatus: 'OJT Trainee',
      allowanceSalary: 'None / Stipend',
      telephoneNo: '+63 917 123 4567',
      department: 'COLLEGE OF COMPUTER STUDIES',
      position: 'ON - THE - JOB TRAINEE',
      otherDeptAssigned: 'Software Engineering',
      q1_dutiesBriefly: 'Frontend UI component engineering, form validation workflows, and cross-browser testing for trainee onboarding portal.',
      q2_strongestPerformanceArea: 'Fast component delivery, precise visual implementation, and adherence to clean code standards.',
      q3_areasImprovedMost: 'TypeScript strict typing patterns and state management with React hooks.',
      q4_areasNeedImprovement: 'Complex database joins and serverless backend API design.',
      q5_situationChallengedMost: 'Fixing hydration and rendering discrepancies across different browser engines.',
      q6_howOvercameChallenge: 'Researched DOM rendering lifecycles, consulted senior engineer, and standardized CSS reset rules.',
      q7_whatLearnedFromExperience: 'Writing maintainable, modular components early saves days of refactoring as project scope scales.',
      q8_isQualifiedLinkage: 'Yes, highly recommended. Provides modern tools, encouraging mentors, and high standard of engineering practices.',
      q9_ojtSuggestionsRecommendations: 'Maintain continuous coordination between university supervisors and company team leads.',
      attendanceScore: 5,
      performanceScore: 5,
      attitudeScore: 5,
      communicationScore: 5,
      teamworkScore: 5,
      overallScore: 100,
      strengths: 'Outstanding visual attention to detail, proactive communication, and quick turnaround on assigned tasks.',
      areasForImprovement: 'Continue broadening backend API integration experience.',
      recommendation: 'Highly Recommended',
    },
    status: 'reviewed',
    instructorRemarks: 'Excellent Mid-Term weekly report Jhey Ree! The documentation of component architecture is exemplary.',
    reviewedByInstructorAt: '2026-09-20T10:00:00Z',
    createdAt: '2026-09-19T17:00:00Z',
  },
  {
    id: 'mr-demo-jheyree-mid-monthly-1',
    reportNumber: 'CHMSU-MR-2026-MM01',
    reportType: 'monthly',
    term: 'midterm',
    frequency: 'monthly',
    traineeId: '2089636c-7a7f-4943-ac23-23fd70afd4fd',
    traineeName: 'Jhey Ree C Ebro',
    studentId: '20231331',
    course: 'Bachelor of Science in Information Systems',
    department: 'College of Computer Studies',
    campus: 'Talisay (Main Campus)',
    academicYear: '2026-2027',
    hteCompanyName: 'Concentrix',
    hteAddress: 'Bacolod City, Negros Occidental',
    supervisorName: 'Jhey Ree C Ebro',
    supervisorContact: '+63 917 123 4567',
    supervisorDesignation: 'OJT Training Supervisor',
    instructorName: 'Prof. Ma. Cristina Ramos, MIT',
    periodCovered: 'Mid-Term Month 1 (September 2026)',
    dateSubmitted: '2026-09-30',
    hoursRenderedThisPeriod: 160,
    totalCumulativeHours: 160,
    requiredHours: 600,
    remainingHours: 440,
    tasksAccomplished: 'Monthly milestone review: Successfully delivered the attendance logging module, integrated Leaflet geofencing maps, and drafted user documentation for HR supervisors.',
    skillsApplied: 'Geofencing, Leaflet GIS, React Hooks, technical writing, user acceptance testing.',
    challengesEncountered: 'Accurate coordinate calculations for irregular polygonal geofence boundaries.',
    questionnaire: {
      employabilityStatus: 'OJT Trainee',
      allowanceSalary: 'None / Stipend',
      telephoneNo: '+63 917 123 4567',
      department: 'COLLEGE OF COMPUTER STUDIES',
      position: 'ON - THE - JOB TRAINEE',
      otherDeptAssigned: 'Quality Assurance',
      q1_dutiesBriefly: 'Implemented geofence boundary validation, interactive maps, and monthly attendance calculation logic.',
      q2_strongestPerformanceArea: 'Algorithm implementation for ray-casting point-in-polygon checks and responsive UI layout.',
      q3_areasImprovedMost: 'Architectural planning for geospatial features and test case formulation.',
      q4_areasNeedImprovement: 'Advanced spatial database indexing with PostGIS.',
      q5_situationChallengedMost: 'Mobile GPS drift causing occasional false out-of-bounds notifications for trainees indoors.',
      q6_howOvercameChallenge: 'Implemented a 25-meter tolerance buffer algorithm and high-accuracy GPS thresholding.',
      q7_whatLearnedFromExperience: 'Real-world sensors produce noisy data; defensive programming and smoothing algorithms are critical.',
      q8_isQualifiedLinkage: 'Yes, extraordinary learning environment for software engineering and information systems interns.',
      q9_ojtSuggestionsRecommendations: 'Keep expanding the practicum partnership with CHMSU CCS students.',
      attendanceScore: 5,
      performanceScore: 5,
      attitudeScore: 5,
      communicationScore: 5,
      teamworkScore: 5,
      overallScore: 100,
      strengths: 'Exceptional self-starter, highly reliable attendance, and outstanding technical ingenuity.',
      areasForImprovement: 'Keep maintaining excellent work standards.',
      recommendation: 'Highly Recommended',
    },
    status: 'reviewed',
    instructorRemarks: 'Great first month Jhey Ree! Your geospatial work demonstrates sophisticated technical maturity.',
    reviewedByInstructorAt: '2026-10-02T09:00:00Z',
    createdAt: '2026-09-30T17:00:00Z',
  },
  {
    id: 'mr-demo-jheyree-mid-eval-1',
    reportNumber: 'CHMSU-MR-2026-MID-300H',
    reportType: 'midterm',
    term: 'midterm',
    frequency: 'evaluation',
    traineeId: '2089636c-7a7f-4943-ac23-23fd70afd4fd',
    traineeName: 'Jhey Ree C Ebro',
    studentId: '20231331',
    course: 'Bachelor of Science in Information Systems',
    department: 'College of Computer Studies',
    campus: 'Talisay (Main Campus)',
    academicYear: '2026-2027',
    hteCompanyName: 'Concentrix',
    hteAddress: 'Bacolod City, Negros Occidental',
    supervisorName: 'Jhey Ree C Ebro',
    supervisorContact: '+63 917 123 4567',
    supervisorDesignation: 'OJT Training Supervisor',
    instructorName: 'Prof. Ma. Cristina Ramos, MIT',
    periodCovered: 'Mid-Term Evaluation (300 Hours Milestone)',
    dateSubmitted: '2026-10-10',
    hoursRenderedThisPeriod: 140,
    totalCumulativeHours: 300,
    requiredHours: 600,
    remainingHours: 300,
    tasksAccomplished: 'Fulfilled official 300-hour Mid-Term practicum milestone. Successfully migrated state persistence layer to Supabase real-time subscriptions, verified facial recognition pipelines, and prepared mid-term progress demo.',
    skillsApplied: 'Supabase real-time, WebRTC camera capture, client-side face recognition, database migration.',
    challengesEncountered: 'Handling variable lighting conditions during camera biometric capture.',
    questionnaire: {
      employabilityStatus: 'OJT Trainee',
      allowanceSalary: 'None / Stipend',
      telephoneNo: '+63 917 123 4567',
      department: 'COLLEGE OF COMPUTER STUDIES',
      position: 'ON - THE - JOB TRAINEE',
      otherDeptAssigned: 'Research & Development',
      q1_dutiesBriefly: 'Biometric face recognition verification, database migration scripting, and mid-term milestone reporting.',
      q2_strongestPerformanceArea: 'High adaptability with modern AI web technologies and comprehensive full-stack problem solving.',
      q3_areasImprovedMost: 'End-to-end software integration and understanding production data compliance regulations.',
      q4_areasNeedImprovement: 'Enterprise automated container orchestration and cloud load balancers.',
      q5_situationChallengedMost: 'Optimizing client-side face descriptor extraction for low-end trainee smartphones.',
      q6_howOvercameChallenge: 'Quantized neural net weights and enabled off-screen Web Worker processing.',
      q7_whatLearnedFromExperience: 'User experience depends as much on edge optimization and device compatibility as core functionality.',
      q8_isQualifiedLinkage: 'Yes, outstanding company with high-level technology exposure and exceptional mentorship.',
      q9_ojtSuggestionsRecommendations: 'Continue the institutional OJT program with CHMSU.',
      attendanceScore: 5,
      performanceScore: 5,
      attitudeScore: 5,
      communicationScore: 5,
      teamworkScore: 5,
      overallScore: 100,
      strengths: 'Outstanding problem solver, innovative engineering approach, and dependable deliverer.',
      areasForImprovement: 'Keep leading technical projects.',
      recommendation: 'Highly Recommended',
    },
    status: 'reviewed',
    instructorRemarks: 'Congratulations Jhey Ree on successfully reaching the 300-hour midpoint milestone! Your technical achievements are among the highest in your cohort.',
    reviewedByInstructorAt: '2026-10-12T09:30:00Z',
    createdAt: '2026-10-10T16:00:00Z',
  },
  {
    id: 'mr-demo-endterm-w1',
    reportNumber: 'CHMSU-MR-2026-EW09',
    reportType: 'weekly',
    term: 'endterm',
    frequency: 'weekly',
    traineeId: '2089636c-7a7f-4943-ac23-23fd70afd4fd',
    traineeName: 'Jhey Ree C Ebro',
    studentId: '20231331',
    course: 'Bachelor of Science in Information Systems',
    department: 'College of Computer Studies',
    campus: 'Talisay (Main Campus)',
    academicYear: '2026-2027',
    hteCompanyName: 'Concentrix',
    hteAddress: 'Bacolod City, Negros Occidental',
    supervisorName: 'Jhey Ree C Ebro',
    supervisorContact: '+63 917 123 4567',
    supervisorDesignation: 'OJT Training Supervisor',
    instructorName: 'Prof. Ma. Cristina Ramos, MIT',
    periodCovered: 'End-Term Week 9 (October 19 – October 23, 2026)',
    dateSubmitted: '2026-10-23',
    hoursRenderedThisPeriod: 40,
    totalCumulativeHours: 360,
    requiredHours: 600,
    remainingHours: 240,
    tasksAccomplished: 'Initiated second half of practicum. Implemented real-time biometric synchronization and offline caching for field staff attendance devices.',
    skillsApplied: 'IndexedDB, Service Workers, TypeScript, REST API.',
    challengesEncountered: 'Handling state consistency during sudden network disconnects.',
    questionnaire: {
      employabilityStatus: 'OJT Trainee',
      allowanceSalary: 'None / Stipend',
      telephoneNo: 'N/A',
      department: 'COLLEGE OF COMPUTER STUDIES',
      position: 'ON - THE - JOB TRAINEE',
      otherDeptAssigned: 'None',
      q1_dutiesBriefly: 'Developing offline-first sync mechanisms and IndexedDB schemas for field attendance tracking.',
      q2_strongestPerformanceArea: 'High problem-solving velocity and clean TypeScript architecture.',
      q3_areasImprovedMost: 'PWA lifecycle management and background sync APIs.',
      q4_areasNeedImprovement: 'Complex SQL window functions.',
      q5_situationChallengedMost: 'Race conditions when synchronizing concurrent offline logs.',
      q6_howOvercameChallenge: 'Applied idempotent transaction queues with UUID tracking.',
      q7_whatLearnedFromExperience: 'Robust software accounts for unstable network environments from day one.',
      q8_isQualifiedLinkage: 'Yes, outstanding technical environment.',
      q9_ojtSuggestionsRecommendations: 'Maintain strong industry collaboration with CHMSU.',
      attendanceScore: 5,
      performanceScore: 5,
      attitudeScore: 5,
      communicationScore: 5,
      teamworkScore: 5,
      overallScore: 100,
      strengths: 'First-rate enterprise equipment and supportive management.',
      areasForImprovement: 'Continue current mentoring schedule.',
      recommendation: 'Highly Recommended',
    },
    status: 'reviewed',
    instructorRemarks: 'Great start to your End-Term practicum phase Jhey Ree! The offline sync architecture is impressive.',
    reviewedByInstructorAt: '2026-10-24T10:00:00Z',
    createdAt: '2026-10-23T17:00:00Z',
  },
  {
    id: 'mr-demo-endterm-m1',
    reportNumber: 'CHMSU-MR-2026-EM03',
    reportType: 'monthly',
    term: 'endterm',
    frequency: 'monthly',
    traineeId: '2089636c-7a7f-4943-ac23-23fd70afd4fd',
    traineeName: 'Jhey Ree C Ebro',
    studentId: '20231331',
    course: 'Bachelor of Science in Information Systems',
    department: 'College of Computer Studies',
    campus: 'Talisay (Main Campus)',
    academicYear: '2026-2027',
    hteCompanyName: 'Concentrix',
    hteAddress: 'Bacolod City, Negros Occidental',
    supervisorName: 'Jhey Ree C Ebro',
    supervisorContact: '+63 917 123 4567',
    supervisorDesignation: 'OJT Training Supervisor',
    instructorName: 'Prof. Ma. Cristina Ramos, MIT',
    periodCovered: 'End-Term Month 3 (October 2026)',
    dateSubmitted: '2026-10-31',
    hoursRenderedThisPeriod: 160,
    totalCumulativeHours: 480,
    requiredHours: 600,
    remainingHours: 120,
    tasksAccomplished: 'Monthly End-Term milestone review. Optimized PostgreSQL database query execution plans, authored audit trails, and conducted load testing for 500 concurrent trainee sessions.',
    skillsApplied: 'PostgreSQL, query planning, indexing, performance profiling.',
    challengesEncountered: 'Slow join performance on large attendance logs table.',
    questionnaire: {
      employabilityStatus: 'OJT Trainee',
      allowanceSalary: 'None / Stipend',
      telephoneNo: 'N/A',
      department: 'COLLEGE OF COMPUTER STUDIES',
      position: 'ON - THE - JOB TRAINEE',
      otherDeptAssigned: 'None',
      q1_dutiesBriefly: 'Database tuning, index optimization, and high-concurrency load testing.',
      q2_strongestPerformanceArea: 'Database query optimization and performance profiling.',
      q3_areasImprovedMost: 'PostgreSQL execution plan analysis and index strategy.',
      q4_areasNeedImprovement: 'Automated CI/CD deployment pipelines.',
      q5_situationChallengedMost: 'High latency query bottleneck on non-indexed timestamp columns.',
      q6_howOvercameChallenge: 'Created composite B-tree indices and partitioned historical data.',
      q7_whatLearnedFromExperience: 'Proper indexing and database normalization are essential for production scale.',
      q8_isQualifiedLinkage: 'Yes, highly recommended.',
      q9_ojtSuggestionsRecommendations: 'Continue the institutional partnership with CHMSU.',
      attendanceScore: 5,
      performanceScore: 5,
      attitudeScore: 5,
      communicationScore: 5,
      teamworkScore: 5,
      overallScore: 100,
      strengths: 'Modern enterprise infrastructure and high developer autonomy.',
      areasForImprovement: 'Keep up the current pace.',
      recommendation: 'Highly Recommended',
    },
    status: 'reviewed',
    instructorRemarks: 'Excellent progress towards completion Jhey Ree! 480 hours successfully documented.',
    reviewedByInstructorAt: '2026-11-02T09:00:00Z',
    createdAt: '2026-10-31T17:00:00Z',
  },
  {
    id: 'mr-demo-endterm-1',
    reportNumber: 'CHMSU-MR-2026-END',
    reportType: 'endterm',
    term: 'endterm',
    frequency: 'evaluation',
    traineeId: '2089636c-7a7f-4943-ac23-23fd70afd4fd',
    traineeName: 'Jhey Ree C Ebro',
    studentId: '20231331',
    course: 'Bachelor of Science in Information Systems',
    department: 'College of Computer Studies',
    campus: 'Talisay (Main Campus)',
    academicYear: '2026-2027',
    hteCompanyName: 'Concentrix',
    hteAddress: 'Bacolod City, Negros Occidental',
    supervisorName: 'Jhey Ree C Ebro',
    supervisorContact: '+63 917 123 4567',
    supervisorDesignation: 'OJT Training Supervisor',
    instructorName: 'Prof. Ma. Cristina Ramos, MIT',
    periodCovered: 'End-Term Final Completion (600 Hours Milestone)',
    dateSubmitted: '2026-10-18',
    hoursRenderedThisPeriod: 120,
    totalCumulativeHours: 600,
    requiredHours: 600,
    remainingHours: 0,
    tasksAccomplished: 'Completed full 600-hour practicum! Finalized OJT management system database migrations, API error handling, trainee document compliance verification, and deployment documentation.',
    skillsApplied: 'Full-stack development, PostgreSQL, Supabase, React/TypeScript, Vercel cloud deployment, automated testing.',
    challengesEncountered: 'Handling large base64 file payloads and serverless timeout boundaries.',
    questionnaire: {
      employabilityStatus: 'OJT Trainee',
      allowanceSalary: 'None / Stipend',
      telephoneNo: 'N/A',
      department: 'COLLEGE OF COMPUTER STUDIES',
      position: 'ON - THE - JOB TRAINEE',
      otherDeptAssigned: 'None',
      q1_dutiesBriefly: 'Full-stack web application development, database management, and UI component implementation for institutional OJT portal.',
      q2_strongestPerformanceArea: 'High proficiency in React, TypeScript, responsive UI design, and problem solving under tight timelines.',
      q3_areasImprovedMost: 'Architecting robust state management and understanding production web security practices.',
      q4_areasNeedImprovement: 'Continuous integration and end-to-end automated regression testing.',
      q5_situationChallengedMost: 'Managing high-resolution attachment payloads without causing storage quota exhaustion.',
      q6_howOvercameChallenge: 'Engineered client-side canvas image downscaling and storage sanitation before database persistence.',
      q7_whatLearnedFromExperience: 'Software engineering is an iterative craft where empathy for the end user and system performance go hand in hand.',
      q8_isQualifiedLinkage: 'Yes, premier Host Training Establishment with supportive management and modern technical infrastructure.',
      q9_ojtSuggestionsRecommendations: 'Express sincere gratitude to CHMSU and Concentrix for the life-changing internship journey.',
      attendanceScore: 5,
      performanceScore: 5,
      attitudeScore: 5,
      communicationScore: 5,
      teamworkScore: 5,
      overallScore: 100,
      strengths: 'Outstanding learning environment, high-velocity real project exposure, and top-tier mentorship.',
      areasForImprovement: 'Maintain current industry partnership programs for succeeding student batches.',
      recommendation: 'Highly Recommended',
    },
    status: 'submitted',
    instructorRemarks: '',
    createdAt: '2026-10-18T18:00:00Z',
  },
];



const DEFAULT_TRAINEE_SELF_REPORTS: TraineeSelfMonitoringReport[] = [
  {
    id: 'smr-demo-1',
    traineeId: '20231379',
    traineeName: 'Juan Dela Cruz',
    studentId: '20231379',
    course: 'Bachelor of Science in Information Technology',
    academicYear: '2026-2027',
    hteCompanyName: 'Provincial Government of Negros Occidental - IT Division',
    supervisorName: 'Engr. Roberto M. Tan',
    periodCovered: 'Month 1 (Weeks 1 - 4)',
    dateSubmitted: '2026-09-15',
    hoursRenderedThisPeriod: 160,
    totalCumulativeHours: 160,
    keyAccomplishments: 'Configured 25 local workstations, terminated CAT6 cables for 3 departmental conference rooms, and logged hardware inventory assets.',
    skillsApplied: 'IP Addressing, Subnetting, Hardware troubleshooting, Google Workspace Admin setup.',
    challengesEncountered: 'Intermittent packet loss on Building B second floor switch.',
    resolutionOrAction: 'Isolated faulty patch cable using cable tester and re-crimped RJ45 connectors with mentor supervision.',
    selfRating: 5,
    status: 'reviewed',
    instructorRemarks: 'Excellent self-monitoring report Juan! Your technical problem solving is exemplary. Keep up the great work.',
    reviewedByInstructorAt: '2026-09-17T14:30:00Z',
    createdAt: '2026-09-15T16:00:00Z',
  },
];

export const DEFAULT_OJT_REQUIRED_DOCUMENTS = [
  {
    docKey: 'internshipAgreement',
    title: 'Internship Agreement',
    description: 'Formal internship training contract detailing internship schedule, duties, workplace guidelines, and competencies.',
    notes: 'Workplace Training Contract & Agreement',
    dueDate: 'Prior to deployment',
    required: true,
  },
  {
    docKey: 'moa',
    title: 'Memorandum of Agreement',
    description: 'Tripartite Memorandum of Agreement executed between CHMSU, the Host Training Establishment (HTE), and the student.',
    notes: 'Institutional Partnership Agreement (MOA)',
    dueDate: 'Prior to starting training',
    required: true,
  },
  {
    docKey: 'consent',
    title: 'Parental Consent',
    description: 'Signed student waiver, assumption of liability, and parent/guardian emergency authorization for off-campus internship.',
    notes: 'Parent / Guardian Waiver & Consent Form',
    dueDate: 'Before starting training hours',
    required: true,
  },
  {
    docKey: 'trainingPlan',
    title: 'Training Plan',
    description: 'Structured curriculum training plan, competency goals, skills matrix, and weekly task schedule for the internship.',
    notes: 'Internship Course Training & Learning Outline',
    dueDate: 'Prior to deployment',
    required: true,
  },
  {
    docKey: 'pledgeOfConduct',
    title: 'Pledge of Conduct',
    description: 'Formal signed commitment acknowledging student ethical standards, university policies, and workplace conduct.',
    notes: 'Student Code of Discipline & Ethics',
    dueDate: 'Before starting training hours',
    required: true,
  },
  {
    docKey: 'medical',
    title: 'Medical Certificate',
    description: 'Official medical examination clearance and physical fitness certification from a licensed physician or university clinic.',
    notes: 'Health Examination & Physical Fitness Clearance',
    dueDate: 'Before deployment to HTE',
    required: true,
  },
  {
    docKey: 'application',
    title: 'Application',
    description: 'Official formal application letter and application form submitted to the Host Training Establishment for OJT placement.',
    notes: 'Student Internship Application Form / Letter',
    dueDate: 'Prior to company placement',
    required: true,
  },
  {
    docKey: 'resume',
    title: 'Resume',
    description: 'Comprehensive student profile, educational background, contact details, technical skill highlights, and 2x2 ID photo.',
    notes: 'Curriculum Vitae / Student Bio-data',
    dueDate: 'Prior to company placement',
    required: true,
  },
  {
    docKey: 'enrolmentForm',
    title: 'Enrolment Form',
    description: 'Official university enrolment assessment form or Certificate of Registration for the active OJT term / semester.',
    notes: 'Certificate of Registration (COR)',
    dueDate: 'Prior to training hours',
    required: true,
  },
  {
    docKey: 'endorsement',
    title: 'Endorsement Letter',
    description: 'Official recommendation and endorsement letter from the college dean or OJT coordinator endorsing the student to the HTE.',
    notes: 'Official University Endorsement Letter',
    dueDate: 'Prior to company placement',
    required: true,
  },
];

function generateMockRecords(): TimeRecord[] {
  const d = new Date();
  const year = d.getFullYear();
  const monthStr = String(d.getMonth() + 1).padStart(2, '0');
  const day = d.getDate();
  const todayStr = `${year}-${monthStr}-${String(day).padStart(2, '0')}`;
  const prevDayStr = `${year}-${monthStr}-${String(Math.max(1, day - 1)).padStart(2, '0')}`;

  return [
    {
      id: 'rec-demo-20231379',
      employeeId: '20231379',
      date: todayStr,
      timeIn: '08:00:00',
      timeOut: '17:00:00',
      totalHours: 8.0,
      status: 'present',
      timeInGeofenced: true,
      timeOutGeofenced: true,
      timeInFaceVerified: true,
      timeOutFaceVerified: true,
      academicYear: '2026-2027',
      approvalStatus: 'pending',
    },
    {
      id: 'rec-demo-emp1',
      employeeId: 'emp-1',
      date: prevDayStr,
      timeIn: '07:55:00',
      timeOut: '17:05:00',
      totalHours: 8.0,
      status: 'present',
      timeInGeofenced: true,
      timeOutGeofenced: true,
      timeInFaceVerified: true,
      timeOutFaceVerified: true,
      academicYear: '2026-2027',
      approvalStatus: 'pending',
    },
  ];
}

type RegisterEmployeeInput = Omit<Employee, 'id' | 'createdAt'> & {
  password?: string;
};

interface AppContextType {
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;
  employees: Employee[];
  timeRecords: TimeRecord[];
  geofenceZones: GeofenceZone[];
  settings: AppSettings;
  evaluations: Evaluation[];
  announcements: Announcement[];
  announcementSubmissions: AnnouncementSubmission[];
  announcementComments: AnnouncementComment[];
  requiredDocuments: RequiredDocument[];
  requiredDocumentSubmissions: RequiredDocumentSubmission[];
  hostFeedback: HostFeedback[];
  hostSupervisors: HostSupervisor[];
  login: (email: string, password: string) => Promise<User | null>;
  loginWithOAuthUser: (authUser: any, explicitRole?: 'admin' | 'hte' | 'trainee' | null) => Promise<User | null>;
  logout: () => void;
  tokenExpiresAt: number | null;
  tokenSecondsRemaining: number;
  refreshToken: () => void;
  refreshData: (options?: { force?: boolean }) => Promise<void>;
  changeCurrentUserPassword: (currentPassword: string, newPassword: string) => Promise<{ success: boolean; message: string }>;
  registerEmployee: (data: RegisterEmployeeInput) => Promise<{ success: boolean; message?: string; employee?: Employee }>;
  updateEmployee: (id: string, data: Partial<Employee>) => Promise<boolean>;
  batchUpdateEmployees: (ids: string[], data: Partial<Employee>) => Promise<boolean>;
  updateHostSupervisor: (id: string, data: Partial<HostSupervisor>) => void;
  deleteEmployee: (id: string) => void;
  addTimeRecord: (record: Omit<TimeRecord, 'id'>) => TimeRecord;
  updateTimeRecord: (id: string, data: Partial<TimeRecord>) => void;
  approveTimeRecord: (id: string, approvedBy?: string) => void;
  disapproveTimeRecord: (id: string, note?: string) => void;
  getTodayRecord: (employeeId: string) => TimeRecord | null;
  getEmployeeRecords: (employeeId: string) => TimeRecord[];
  updateGeofenceZones: (zones: GeofenceZone[]) => void;
  addGeofenceZone: (zone: Omit<GeofenceZone, 'id'> & { id?: string }) => void;
  updateGeofenceZone: (id: string, data: Partial<GeofenceZone>) => void;
  deleteGeofenceZone: (id: string) => void;
  updateSettings: (settings: Partial<AppSettings>) => void;
  getCurrentEmployee: () => Employee | null;
  // Evaluations
  addEvaluation: (data: Omit<Evaluation, 'id'>) => Evaluation;
  updateEvaluation: (id: string, data: Partial<Evaluation>) => void;
  deleteEvaluation: (id: string) => void;
  getEmployeeEvaluation: (employeeId: string) => Evaluation | null;
  // Announcements
  addAnnouncement: (data: Omit<Announcement, 'id'>) => Announcement;
  updateAnnouncement: (id: string, data: Partial<Announcement>) => void;
  deleteAnnouncement: (id: string) => void;
  getActiveAnnouncements: (role?: 'employee' | 'admin' | 'hte' | 'host') => Announcement[];
  submitAnnouncementResponse: (
    announcementId: string,
    employeeId: string,
    message: string,
    photo?: string
  ) => AnnouncementSubmission;
  getAnnouncementSubmission: (announcementId: string, employeeId: string) => AnnouncementSubmission | null;
  getAnnouncementSubmissionStatus: (announcement: Announcement, employeeId: string) => 'passed' | 'missed' | 'pending';
  addAnnouncementComment: (comment: Omit<AnnouncementComment, 'id'>) => Promise<AnnouncementComment>;
  getAnnouncementComments: (announcementId: string) => AnnouncementComment[];
  deleteAnnouncementComment: (announcementId: string, commentId: string) => Promise<boolean>;
  requiredDocuments: RequiredDocument[];
  addRequiredDocument: (
    employeeId: string,
    data: {
      title: string;
      description?: string;
      notes?: string;
      dueDate?: string;
      required?: boolean;
      academicYear?: string;
      fileUrl?: string;
      dataUrl?: string;
      fileName?: string;
      fileSize?: number | string;
      fileType?: string;
      uploadedBy?: string;
      instructorId?: string;
      templateUrl?: string;
      templateName?: string;
      targetRequirementKey?: string;
    }
  ) => RequiredDocument;
  updateRequiredDocument: (id: string, data: Partial<RequiredDocument>) => void;
  deleteRequiredDocument: (id: string) => void;
  getEmployeeRequiredDocuments: (employeeId: string) => RequiredDocument[];
  getRequirementStatus: (documentId: string, employeeId: string) => RequirementStatus;
  getEmployeeRequirementSummary: (employeeId: string) => { missing: number; incomplete: number; complete: number };
  submitRequiredDocument: (
    documentId: string,
    employeeId: string,
    payload: { note?: string; notes?: string; fileName?: string; fileUrl?: string }
  ) => RequiredDocumentSubmission;
  getRequiredDocumentSubmission: (documentId: string, employeeId: string) => RequiredDocumentSubmission | null;
  // Host Feedback
  addHostFeedback: (data: Omit<HostFeedback, 'id' | 'overallScore' | 'submittedAt' | 'status'>) => HostFeedback;
  updateHostFeedback: (id: string, data: Partial<HostFeedback>) => void;
  deleteHostFeedback: (id: string) => void;
  getEmployeeHostFeedback: (employeeId: string) => HostFeedback[];
  getLatestHostFeedback: (employeeId: string) => HostFeedback | null;
  approveEmployee: (id: string) => void;
  rejectEmployee: (id: string) => void;
  setPasswordForEmail: (email: string, password: string) => void;
  syncAllAccountsAcrossAcademicYears: (targetAcademicYear?: string) => Promise<{ success: boolean; syncedCount: number; message: string }>;
  repairAndPersistDatabase: () => Promise<{ success: boolean; message: string; repairedCounts: any }>;
  // Monthly DTTR Monitoring
  monthlyDttrs: MonthlyDttrRecord[];
  saveMonthlyDttr: (record: MonthlyDttrRecord) => void;
  getMonthlyDttr: (employeeId: string, year: number, month: number) => MonthlyDttrRecord | null;
  signMonthlyDttr: (employeeId: string, year: number, month: number, supervisorName: string, supervisorTitle?: string) => void;
  // Official OJT Monitoring Reports (Weekly, Monthly, MidTerm, EndTerm)
  monitoringReports: MonitoringReport[];
  addMonitoringReport: (data: Omit<MonitoringReport, 'id' | 'reportNumber' | 'createdAt'>) => Promise<MonitoringReport>;
  updateMonitoringReport: (id: string, data: Partial<MonitoringReport>) => Promise<void>;
  deleteMonitoringReport: (id: string) => Promise<void>;
  reviewMonitoringReport: (id: string, instructorRemarks: string, status?: 'reviewed' | 'acknowledged') => Promise<void>;
  getTraineeMonitoringReports: (traineeId: string) => MonitoringReport[];
  acknowledgeMonitoringReport: (id: string, feedback?: string) => Promise<void>;
  // Trainee Self-Monitoring Progress Reports
  traineeSelfMonitoringReports: TraineeSelfMonitoringReport[];
  addTraineeSelfMonitoringReport: (data: Omit<TraineeSelfMonitoringReport, 'id' | 'createdAt' | 'status'>) => Promise<TraineeSelfMonitoringReport>;
  updateTraineeSelfMonitoringReport: (id: string, data: Partial<TraineeSelfMonitoringReport>) => Promise<void>;
  reviewTraineeSelfMonitoringReport: (id: string, instructorRemarks: string, status?: 'reviewed' | 'acknowledged') => Promise<void>;
  deleteTraineeSelfMonitoringReport: (id: string) => Promise<void>;
  getTraineeSelfReports: (traineeId: string) => TraineeSelfMonitoringReport[];
}

const AppContext = createContext<AppContextType | null>(null);

const normalizeEmail = (email: string) => email.trim().toLowerCase();

function normalizePasswordMap(map: Record<string, string>): Record<string, string> {
  const normalized: Record<string, string> = {};
  Object.entries(map).forEach(([key, value]) => {
    if (typeof value === 'string' && value.length > 0) {
      normalized[normalizeEmail(key)] = value;
    }
  });
  return normalized;
}

function isFiniteCoord(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function sanitizeGeofenceZone(input: unknown): GeofenceZone | null {
  if (!input || typeof input !== 'object') return null;
  const raw = input as Partial<GeofenceZone>;
  const lat = Number(raw.lat);
  const lng = Number(raw.lng);
  const radius = GEOFENCE_RADIUS_METERS;
  const valid =
    isFiniteCoord(lat) &&
    isFiniteCoord(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180 &&
    Number.isFinite(radius) &&
    radius > 0;
  if (!valid) return null;
  const name = typeof raw.name === 'string' ? raw.name : 'Geofence Zone';
  if (name.toLowerCase().includes('main training center') || raw.id === 'zone-1') {
    return null;
  }
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : `zone-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    address: typeof raw.address === 'string' ? raw.address : '',
    lat,
    lng,
    radius,
    active: raw.active !== false,
    academicYear: raw.academicYear || raw.academic_year,
    employeeId: raw.employeeId || raw.employee_id,
    employee_id: raw.employee_id || raw.employeeId,
  };
}

function sanitizeGeofenceZones(inputs: unknown): GeofenceZone[] {
  if (!Array.isArray(inputs)) return [];
  const valid = inputs
    .map(sanitizeGeofenceZone)
    .filter((zone): zone is GeofenceZone =>
      zone !== null &&
      !zone.name.toLowerCase().includes('main training center') &&
      zone.id !== 'zone-1' &&
      !zone.id.startsWith('personal-')
    );

  // Strict deduplication (Geofence patch): prioritize employee_id and normalized identity to guarantee exactly 1 active zone per workplace/user
  const seen = new Map<string, GeofenceZone>();
  const nameToKey = new Map<string, string>();

  for (const z of valid) {
    const empId = z.employeeId || z.employee_id;
    const rawPerson = z.name.includes(' - ') ? z.name.split(' - ')[0].trim() : z.name.trim();
    const rawCompany = z.name.includes(' - ') ? z.name.split(' - ')[1]?.trim() : '';
    const normPerson = rawPerson
      .toLowerCase()
      .replace(/[^a-z0-9]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 1)
      .sort()
      .join(' ');
    const normCompany = (rawCompany || '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 1)
      .sort()
      .join(' ');

    const nameIdentity = normCompany && normPerson ? `${normPerson}__${normCompany}` : normPerson;
    let key = empId ? `emp_${empId}` : (nameIdentity ? `ident_${nameIdentity}` : `${z.lat.toFixed(3)},${z.lng.toFixed(3)}`);

    // Cross-key resolution: If an identity was already recorded under an empId or vice versa, unify them
    if (nameIdentity && nameToKey.has(nameIdentity)) {
      key = nameToKey.get(nameIdentity)!;
    } else if (nameIdentity) {
      nameToKey.set(nameIdentity, key);
    }

    if (!seen.has(key)) {
      seen.set(key, z);
    } else {
      const existing = seen.get(key)!;
      // If existing is default campus coordinates (10.7410, 122.9702) and new has moved custom coordinates, prefer the moved one!
      const isExistingDefault = Math.abs(existing.lat - 10.7410) < 0.0002 && Math.abs(existing.lng - 122.9702) < 0.0002;
      const isNewCustom = Math.abs(z.lat - 10.7410) >= 0.0002 || Math.abs(z.lng - 122.9702) >= 0.0002;

      if (isExistingDefault && isNewCustom) {
        seen.set(key, z);
      } else if (z.address && (!existing.address || existing.address.length < 5 || existing.address === 'Official Workplace GPS')) {
        seen.set(key, z);
      }
    }
  }
  return Array.from(seen.values());
}

function migrateGeofenceStorageOnce(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.GEOFENCE_ZONES);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const cleaned = parsed.filter(
          (z: any) => !z.name?.toLowerCase().includes('rainer') && !z.name?.toLowerCase().includes('dooms')
        );
        if (cleaned.length !== parsed.length) {
          saveToStorage(STORAGE_KEYS.GEOFENCE_ZONES, cleaned);
        }
      }
    }

    if (localStorage.getItem(STORAGE_KEYS.GEOFENCE_MIGRATION_V1) === 'done') return;
    const rawOld = localStorage.getItem(STORAGE_KEYS.GEOFENCE_ZONES);
    const parsedOld = rawOld ? JSON.parse(rawOld) : [];
    const sanitized = sanitizeGeofenceZones(parsedOld);
    saveToStorage(STORAGE_KEYS.GEOFENCE_ZONES, sanitized.length > 0 ? sanitized : DEFAULT_GEOFENCE);
    localStorage.setItem(STORAGE_KEYS.GEOFENCE_MIGRATION_V1, 'done');
  } catch {
    // Keep app boot resilient even if old storage is malformed.
  }
}

function migrateInstructorPositionOnce(): void {
  try {
    if (isSupabaseConfigured()) {
      localStorage.setItem('ojt_migrated_instructor_positions', 'done');
      return;
    }
    if (localStorage.getItem('ojt_migrated_instructor_positions') === 'done') return;
    const raw = localStorage.getItem(STORAGE_KEYS.EMPLOYEES);
    const parsed = raw ? JSON.parse(raw) : [];
    let changed = false;
    if (Array.isArray(parsed)) {
      parsed.forEach((emp: any) => {
        if (emp && emp.position === 'Administrator') {
          emp.position = 'OJT Instructor';
          if (emp.name === 'Administrator') emp.name = 'OJT Instructor';
          changed = true;
        }
      });
    }
    if (changed) {
      saveToStorage(STORAGE_KEYS.EMPLOYEES, parsed);
    }
    localStorage.setItem('ojt_migrated_instructor_positions', 'done');
  } catch {
    // ignore migration failures
  }
}

function loadFromStorage<T>(key: string, defaultValue: T): T {
  try {
    const stored =
      (typeof window !== 'undefined' && window.localStorage?.getItem(key)) ||
      (typeof window !== 'undefined' && window.sessionStorage?.getItem(key));
    return stored ? JSON.parse(stored) : defaultValue;
  } catch {
    return defaultValue;
  }
}

function sanitizeDocRecordForStorage(docs: any): any {
  if (!docs || typeof docs !== 'object') return {};
  const sanitizedDocs: any = {};
  for (const [docKey, docVal] of Object.entries(docs)) {
    if (docVal && typeof docVal === 'object') {
      const docObj = docVal as any;
      const dUrl = typeof docObj.dataUrl === 'string' ? docObj.dataUrl : '';
      const fUrl = typeof docObj.fileUrl === 'string' ? docObj.fileUrl : '';

      // If large base64 data URL, cache in sessionStorage for current tab preview without exhausting localStorage
      if (dUrl.startsWith('data:') && dUrl.length > 2000) {
        try {
          if (typeof window !== 'undefined' && window.sessionStorage) {
            sessionStorage.setItem(`ojt_doc_data_${docKey}`, dUrl);
          }
        } catch {}
      }

      // Strip large base64 data URLs (> 2KB) entirely from persistent localStorage
      const safeDataUrl = dUrl.startsWith('data:') && dUrl.length > 2000 ? '' : dUrl;
      const safeFileUrl = fUrl.startsWith('data:') && fUrl.length > 2000 ? '' : fUrl;

      sanitizedDocs[docKey] = {
        ...docObj,
        dataUrl: safeDataUrl,
        fileUrl: safeFileUrl || (safeDataUrl.startsWith('http') ? safeDataUrl : (fUrl && !fUrl.startsWith('data:') ? fUrl : '')),
      };
    } else {
      sanitizedDocs[docKey] = docVal;
    }
  }
  return sanitizedDocs;
}

function sanitizeValueForStorage(key: string, value: any): any {
  if (key === STORAGE_KEYS.EMPLOYEES && Array.isArray(value)) {
    return value.map((emp) => {
      if (!emp || typeof emp !== 'object') return emp;
      const copy = { ...emp };
      if (copy.submittedDocuments && typeof copy.submittedDocuments === 'object') {
        copy.submittedDocuments = sanitizeDocRecordForStorage(copy.submittedDocuments);
      }
      if (copy.registrationLocation && typeof copy.registrationLocation === 'object' && copy.registrationLocation.documents) {
        copy.registrationLocation = {
          ...copy.registrationLocation,
          documents: sanitizeDocRecordForStorage(copy.registrationLocation.documents),
        };
      }
      // Omit excessive base64 photo strings (> 15KB) from localStorage cache
      if (typeof copy.photo === 'string' && copy.photo.startsWith('data:') && copy.photo.length > 15000) {
        copy.photo = '';
      }
      return copy;
    });
  }
  if (key === STORAGE_KEYS.CURRENT_USER && value && typeof value === 'object') {
    const copy = { ...value };
    if (typeof copy.photo === 'string' && copy.photo.startsWith('data:') && copy.photo.length > 15000) {
      copy.photo = '';
    }
    if (copy.submittedDocuments && typeof copy.submittedDocuments === 'object') {
      copy.submittedDocuments = sanitizeDocRecordForStorage(copy.submittedDocuments);
    }
    if (copy.registrationLocation && typeof copy.registrationLocation === 'object' && copy.registrationLocation.documents) {
      copy.registrationLocation = {
        ...copy.registrationLocation,
        documents: sanitizeDocRecordForStorage(copy.registrationLocation.documents),
      };
    }
    return copy;
  }
  if (key === STORAGE_KEYS.REQUIRED_DOCUMENT_SUBMISSIONS && Array.isArray(value)) {
    return value.map((sub) => {
      if (!sub || typeof sub !== 'object') return sub;
      const copy = { ...sub };
      // Strip large base64 file data from localStorage cache (cache in sessionStorage instead)
      if (typeof copy.fileDataUrl === 'string' && copy.fileDataUrl.startsWith('data:') && copy.fileDataUrl.length > 2000) {
        try {
          if (typeof window !== 'undefined' && window.sessionStorage) {
            sessionStorage.setItem(`ojt_doc_data_${copy.id || copy.documentId}`, copy.fileDataUrl);
          }
        } catch {}
        copy.fileDataUrl = '';
      }
      if (typeof copy.fileUrl === 'string' && copy.fileUrl.startsWith('data:') && copy.fileUrl.length > 2000) {
        copy.fileUrl = '';
      }
      return copy;
    });
  }
  if (key === STORAGE_KEYS.REQUIRED_DOCUMENTS && Array.isArray(value)) {
    return value.map((doc) => {
      if (!doc || typeof doc !== 'object') return doc;
      const copy = { ...doc };
      if (typeof copy.dataUrl === 'string' && copy.dataUrl.startsWith('data:') && copy.dataUrl.length > 2000) {
        copy.dataUrl = '';
      }
      return copy;
    });
  }
  if (key === STORAGE_KEYS.TIME_RECORDS && Array.isArray(value)) {
    return value.map((rec) => {
      if (!rec || typeof rec !== 'object') return rec;
      const copy = { ...rec };
      // Strip raw webcam base64 images from localStorage cache
      if (typeof copy.timeInPhoto === 'string' && copy.timeInPhoto.startsWith('data:') && copy.timeInPhoto.length > 2000) {
        copy.timeInPhoto = undefined;
      }
      if (typeof copy.timeOutPhoto === 'string' && copy.timeOutPhoto.startsWith('data:') && copy.timeOutPhoto.length > 2000) {
        copy.timeOutPhoto = undefined;
      }
      return copy;
    });
  }
  if (key === STORAGE_KEYS.MONITORING_REPORTS && Array.isArray(value)) {
    return value.map((rep) => {
      if (!rep || typeof rep !== 'object') return rep;
      const copy = { ...rep };
      // Strip large photos or signatures (> 3KB) from localStorage cache to prevent QuotaExceededError
      if (Array.isArray(copy.photos)) {
        copy.photos = copy.photos
          .map((p: string) => (typeof p === 'string' && p.startsWith('data:') ? '' : p))
          .filter(Boolean);
      }
      if (typeof copy.signature === 'string' && copy.signature.startsWith('data:') && copy.signature.length > 3000) {
        copy.signature = '';
      }
      if (typeof copy.supervisorSignature === 'string' && copy.supervisorSignature.startsWith('data:') && copy.supervisorSignature.length > 3000) {
        copy.supervisorSignature = '';
      }
      if (typeof copy.instructorSignature === 'string' && copy.instructorSignature.startsWith('data:') && copy.instructorSignature.length > 3000) {
        copy.instructorSignature = '';
      }
      return copy;
    });
  }
  if (key === STORAGE_KEYS.TRAINEE_SELF_MONITORING_REPORTS && Array.isArray(value)) {
    return value.map((rep) => {
      if (!rep || typeof rep !== 'object') return rep;
      return { ...rep };
    });
  }
  return value;
}

function cleanupStorageQuota(): void {
  try {
    if (isSupabaseConfigured()) {
      localStorage.removeItem(STORAGE_KEYS.PASSWORDS);
      localStorage.removeItem('ojt_passwords');
    }

    // Purge bloated base64 document caches that exhaust browser 5MB localStorage limit
    if (typeof window !== 'undefined' && window.localStorage) {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k) continue;
        if (
          k.startsWith('ojt_doc_base64_') ||
          (k.startsWith('ojt_doc_') && !k.startsWith('ojt_doc_url_') && !k.startsWith('ojt_doc_passed_') && !k.startsWith('ojt_doc_count_'))
        ) {
          const val = localStorage.getItem(k);
          if (val && (val.startsWith('data:') || val.length > 5000)) {
            keysToRemove.push(k);
          }
        }
      }
      keysToRemove.forEach((k) => {
        try { localStorage.removeItem(k); } catch {}
      });
    }

    const sanitizeKey = (k: string) => {
      try {
        const raw = localStorage.getItem(k);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        const sanitized = sanitizeValueForStorage(k, parsed);
        localStorage.setItem(k, JSON.stringify(sanitized));
      } catch {
        // If cannot even re-save after sanitizing, remove non-critical cache
        if (
          k === STORAGE_KEYS.TIME_RECORDS ||
          k === STORAGE_KEYS.REQUIRED_DOCUMENT_SUBMISSIONS ||
          k === STORAGE_KEYS.ANNOUNCEMENT_SUBMISSIONS ||
          k === STORAGE_KEYS.ANNOUNCEMENT_COMMENTS
        ) {
          try { localStorage.removeItem(k); } catch {}
        }
      }
    };

    sanitizeKey(STORAGE_KEYS.EMPLOYEES);
    sanitizeKey(STORAGE_KEYS.CURRENT_USER);
    sanitizeKey(STORAGE_KEYS.REQUIRED_DOCUMENT_SUBMISSIONS);
    sanitizeKey(STORAGE_KEYS.TIME_RECORDS);
    sanitizeKey(STORAGE_KEYS.REQUIRED_DOCUMENTS);
    sanitizeKey(STORAGE_KEYS.MONITORING_REPORTS);
  } catch {
    // Ignore any error during startup cleanup
  }
}

export const TOKEN_LIFETIME_SEC = 20 * 60; // 20 minutes (1,200 seconds)
export const TOKEN_LIFETIME_MS = TOKEN_LIFETIME_SEC * 1000; // 20 minutes of inactivity (1,200,000 ms)

export function issueSessionToken(user?: User | null): { token: string; expiresAt: number } {
  const expiresAt = Date.now() + TOKEN_LIFETIME_MS;
  const header = typeof btoa !== 'undefined' ? btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' })) : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';
  const payload = typeof btoa !== 'undefined' ? btoa(JSON.stringify({
    sub: user?.id || user?.employeeId || 'ojt-user',
    email: user?.email,
    role: user?.role,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(expiresAt / 1000),
  })) : 'payload';
  const mockSig = 'chmsu_ojt_token_sig';
  const token = `${header}.${payload}.${mockSig}`;

  try {
    localStorage.setItem('ojt_jwt_access_token', token);
    localStorage.setItem('ojt_token_expires_at', String(expiresAt));
  } catch {}

  return { token, expiresAt };
}

export function clearAuthStorage(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    localStorage.removeItem('ojt_user');
    localStorage.removeItem('ojt_current_user');
    localStorage.removeItem('ojt_hte_user');
    localStorage.removeItem('ojt_hte_company');
    localStorage.removeItem('ojt_jwt_access_token');
    localStorage.removeItem('ojt_jwt_refresh_token');
    localStorage.removeItem('ojt_token_expires_at');
    localStorage.removeItem('sb-access-token');
    localStorage.removeItem('user');
    localStorage.removeItem('pending_oauth_role');
    localStorage.removeItem('oauth_email');
    localStorage.removeItem('oauth_name');
    localStorage.removeItem('oauth_given_name');
    localStorage.removeItem('oauth_family_name');
    localStorage.removeItem('oauth_photo');
    localStorage.removeItem('oauth_user_id');
    localStorage.removeItem('ojt_last_active_timestamp');

    if (typeof window !== 'undefined') {
      Object.keys(localStorage).forEach((k) => {
        if (k.startsWith('sb-') && (k.endsWith('-auth-token') || k.includes('-auth-token'))) {
          localStorage.removeItem(k);
        }
      });
      sessionStorage.clear();
    }
  } catch (err) {
    console.warn('Failed to clear auth storage:', err);
  }
}

function saveToStorage<T>(key: string, value: T): void {
  // Passwords MUST NEVER be stored in localStorage
  if (key === STORAGE_KEYS.PASSWORDS || key === 'ojt_passwords') {
    try {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    } catch {}
    return;
  }

  if (value === null || value === undefined) {
    try {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    } catch {}
    return;
  }

  try {
    const payload = sanitizeValueForStorage(key, value);
    const serialized = JSON.stringify(payload);
    try {
      localStorage.setItem(key, serialized);
      try { sessionStorage.removeItem(key); } catch {}
      return;
    } catch {
      // QuotaExceededError: run cleanup and try again or use sessionStorage fallback
      cleanupStorageQuota();
      try {
        localStorage.setItem(key, serialized);
        try { sessionStorage.removeItem(key); } catch {}
        return;
      } catch {
        // Fallback to sessionStorage so state is preserved without throwing errors or spamming console
        try {
          sessionStorage.setItem(key, serialized);
        } catch {}
      }
    }
  } catch {
    // Safe catch: never crash React
  }
}

function cleanRecordPhoto(photo?: string | null): string | undefined {
  if (!photo || typeof photo !== 'string') return undefined;
  const trimmed = photo.trim();
  if (
    !trimmed ||
    trimmed === 'null' ||
    trimmed === 'undefined' ||
    trimmed === 'temp' ||
    trimmed.includes('/face-photos/') ||
    (!trimmed.startsWith('http://') && !trimmed.startsWith('https://') && !trimmed.startsWith('data:image/'))
  ) {
    return undefined;
  }
  return trimmed;
}

function sanitizeTimeRecords(records: TimeRecord[]): TimeRecord[] {
  if (!Array.isArray(records)) return [];
  return records.map((r) => ({
    ...r,
    timeInPhoto: cleanRecordPhoto(r.timeInPhoto),
    timeOutPhoto: cleanRecordPhoto(r.timeOutPhoto),
  }));
}

function mergeTimeRecords(
  remoteRecords: TimeRecord[],
  currentLocalRecords: TimeRecord[],
  employeesList?: Employee[]
): TimeRecord[] {
  const sanitizedRemote = sanitizeTimeRecords(remoteRecords || []);
  if (sanitizedRemote.length === 0) {
    return sanitizeTimeRecords(currentLocalRecords || []);
  }

  const employees = employeesList || loadFromStorage<Employee[]>(STORAGE_KEYS.EMPLOYEES, []);
  const empIdToCodeMap = new Map<string, string>();
  const empCodeToIdMap = new Map<string, string>();
  employees.forEach((emp) => {
    if (emp.id && emp.employeeId) {
      empIdToCodeMap.set(emp.id.toLowerCase(), emp.employeeId.toLowerCase());
      empCodeToIdMap.set(emp.employeeId.toLowerCase(), emp.id.toLowerCase());
    }
  });

  const remoteIds = new Set(sanitizedRemote.map((r) => r.id));
  const remoteEmpDateMap = new Map<string, TimeRecord>();
  const empsWithRemote = new Set<string>();

  sanitizedRemote.forEach((r) => {
    const rawEmp = (r.employeeId || '').toLowerCase();
    const datePart = (r.date || '').split('T')[0].split(' ')[0];
    empsWithRemote.add(rawEmp);
    const altEmp1 = empIdToCodeMap.get(rawEmp);
    if (altEmp1) empsWithRemote.add(altEmp1);
    const altEmp2 = empCodeToIdMap.get(rawEmp);
    if (altEmp2) empsWithRemote.add(altEmp2);

    remoteEmpDateMap.set(`${rawEmp}_${datePart}`, r);
    if (altEmp1) remoteEmpDateMap.set(`${altEmp1}_${datePart}`, r);
    if (altEmp2) remoteEmpDateMap.set(`${altEmp2}_${datePart}`, r);
  });

  const todayStr = new Date().toISOString().split('T')[0];

  // Keep only legitimate unsynced local records (e.g. today's live offline punch).
  // Purge obsolete past-date mock/seed records for employees who already have authentic database records.
  const localOnly = (currentLocalRecords || [])
    .filter((localR) => {
      if (remoteIds.has(localR.id)) return false;
      const rawEmp = (localR.employeeId || '').toLowerCase();
      const datePart = (localR.date || '').split('T')[0].split(' ')[0];
      const key = `${rawEmp}_${datePart}`;
      const remoteMatch = remoteEmpDateMap.get(key);

      if (remoteMatch) {
        if (!remoteMatch.amArrival && localR.amArrival) remoteMatch.amArrival = localR.amArrival;
        if (!remoteMatch.amDeparture && localR.amDeparture) remoteMatch.amDeparture = localR.amDeparture;
        if (!remoteMatch.pmArrival && localR.pmArrival) remoteMatch.pmArrival = localR.pmArrival;
        if (!remoteMatch.pmDeparture && localR.pmDeparture) remoteMatch.pmDeparture = localR.pmDeparture;
        if (remoteMatch.amArrivalFaceVerified === undefined && localR.amArrivalFaceVerified !== undefined) remoteMatch.amArrivalFaceVerified = localR.amArrivalFaceVerified;
        if (remoteMatch.amDepartureFaceVerified === undefined && localR.amDepartureFaceVerified !== undefined) remoteMatch.amDepartureFaceVerified = localR.amDepartureFaceVerified;
        if (remoteMatch.pmArrivalFaceVerified === undefined && localR.pmArrivalFaceVerified !== undefined) remoteMatch.pmArrivalFaceVerified = localR.pmArrivalFaceVerified;
        if (remoteMatch.pmDepartureFaceVerified === undefined && localR.pmDepartureFaceVerified !== undefined) remoteMatch.pmDepartureFaceVerified = localR.pmDepartureFaceVerified;
        if (remoteMatch.amArrivalGeofenced === undefined && localR.amArrivalGeofenced !== undefined) remoteMatch.amArrivalGeofenced = localR.amArrivalGeofenced;
        if (remoteMatch.amDepartureGeofenced === undefined && localR.amDepartureGeofenced !== undefined) remoteMatch.amDepartureGeofenced = localR.amDepartureGeofenced;
        if (remoteMatch.pmArrivalGeofenced === undefined && localR.pmArrivalGeofenced !== undefined) remoteMatch.pmArrivalGeofenced = localR.pmArrivalGeofenced;
        if (remoteMatch.pmDepartureGeofenced === undefined && localR.pmDepartureGeofenced !== undefined) remoteMatch.pmDepartureGeofenced = localR.pmDepartureGeofenced;

        if (!remoteMatch.timeOut && localR.timeOut) {
          remoteMatch.timeOut = localR.timeOut;
          remoteMatch.timeOutPhoto = cleanRecordPhoto(localR.timeOutPhoto) || cleanRecordPhoto(remoteMatch.timeOutPhoto);
          remoteMatch.timeOutFaceVerified = localR.timeOutFaceVerified ?? remoteMatch.timeOutFaceVerified;
          remoteMatch.totalHours = localR.totalHours || remoteMatch.totalHours;
          remoteMatch.timeOutGeofenced = localR.timeOutGeofenced ?? remoteMatch.timeOutGeofenced;
        }
        if (!remoteMatch.timeIn && localR.timeIn) {
          remoteMatch.timeIn = localR.timeIn;
          remoteMatch.timeInPhoto = cleanRecordPhoto(localR.timeInPhoto) || cleanRecordPhoto(remoteMatch.timeInPhoto);
          remoteMatch.timeInFaceVerified = localR.timeInFaceVerified ?? remoteMatch.timeInFaceVerified;
          remoteMatch.timeInGeofenced = localR.timeInGeofenced ?? remoteMatch.timeInGeofenced;
        }
        return false;
      }

      // Purge past mock/seed records if employee has authoritative records in Supabase
      if (empsWithRemote.has(rawEmp) && datePart !== todayStr) {
        return false;
      }

      // Drop demo / mock / seed generated records
      if (
        localR.id.startsWith('demo-') ||
        localR.id.startsWith('mock-') ||
        localR.id.startsWith('seed-') ||
        (localR as any).is_mock
      ) {
        return false;
      }

      return true;
    })
    .map((r) => ({
      ...r,
      timeInPhoto: cleanRecordPhoto(r.timeInPhoto),
      timeOutPhoto: cleanRecordPhoto(r.timeOutPhoto),
    }));

  return [...sanitizedRemote, ...localOnly];
}

function mergeEvaluations(remoteEvaluations: Evaluation[], currentLocalEvaluations: Evaluation[]): Evaluation[] {
  if (!remoteEvaluations || remoteEvaluations.length === 0) {
    return currentLocalEvaluations || [];
  }
  if (!currentLocalEvaluations || currentLocalEvaluations.length === 0) {
    return remoteEvaluations;
  }

  const remoteMapById = new Map<string, Evaluation>();
  const remoteMapByEmp = new Map<string, Evaluation>();

  remoteEvaluations.forEach((rev) => {
    remoteMapById.set(rev.id, rev);
    if (rev.employeeId) {
      remoteMapByEmp.set(rev.employeeId.toLowerCase(), rev);
    }
  });

  const merged = remoteEvaluations.map((rev) => {
    const localMatch = currentLocalEvaluations.find(
      (lev) =>
        lev.id === rev.id ||
        (lev.employeeId && rev.employeeId && lev.employeeId.toLowerCase() === rev.employeeId.toLowerCase())
    );

    if (!localMatch) return rev;

    // Merge questionnaires: NEVER overwrite answered questions with blank/empty values!
    const localQ = localMatch.questionnaire;
    const remoteQ = rev.questionnaire;

    let mergedQ = remoteQ;
    if (localQ && remoteQ) {
      mergedQ = { ...remoteQ };
      (Object.keys(localQ) as (keyof EvaluationQuestionnaire)[]).forEach((key) => {
        const localVal = String(localQ[key] || '').trim();
        const remoteVal = String(remoteQ[key] || '').trim();
        if (localVal && (!remoteVal || localVal.length > remoteVal.length)) {
          mergedQ![key] = localQ[key];
        }
      });
    } else if (localQ && !remoteQ) {
      mergedQ = localQ;
    }

    // Preserve status hierarchy so trainee submission is never downgraded by a stale draft record
    const STATUS_ORDER: Record<string, number> = {
      draft: 1,
      submitted_by_trainee: 2,
      passed_to_hte: 3,
      submitted_to_instructor: 4,
      reviewed_by_instructor: 5,
      final: 4,
    };

    let mergedStatus = rev.status || localMatch.status;
    const localRank = STATUS_ORDER[localMatch.status || 'draft'] || 1;
    const remoteRank = STATUS_ORDER[rev.status || 'draft'] || 1;
    if (localRank > remoteRank) {
      mergedStatus = localMatch.status;
    }

    return {
      ...rev,
      status: mergedStatus,
      questionnaire: mergedQ,
      ratings: rev.ratings && Object.keys(rev.ratings).length > 0 ? rev.ratings : (localMatch.ratings || rev.ratings),
      ratingComments: rev.ratingComments && Object.keys(rev.ratingComments).length > 0 ? rev.ratingComments : (localMatch.ratingComments || rev.ratingComments),
      commentsSuggestions: rev.commentsSuggestions || localMatch.commentsSuggestions,
    };
  });

  // Preserve any local evaluations that are pending cloud creation (e.g. temporary eval- IDs)
  const localOnly = currentLocalEvaluations.filter((lev) => {
    if (remoteMapById.has(lev.id)) return false;
    if (lev.employeeId && remoteMapByEmp.has(lev.employeeId.toLowerCase())) return false;
    return true;
  });

  return [...merged, ...localOnly];
}

function mergeEmployees(
  remoteEmployees: Employee[],
  localEmployees: Employee[]
): Employee[] {
  if (!remoteEmployees || remoteEmployees.length === 0) {
    return localEmployees || [];
  }
  const localMap = new Map<string, Employee>();
  (localEmployees || []).forEach((e) => {
    if (e.id) localMap.set(e.id, e);
    if (e.employeeId) localMap.set(e.employeeId, e);
    if (e.email) localMap.set(e.email.toLowerCase(), e);
  });

  return remoteEmployees.map((remote) => {
    const local = localMap.get(remote.id) || (remote.employeeId ? localMap.get(remote.employeeId) : undefined) || (remote.email ? localMap.get(remote.email.toLowerCase()) : undefined);
    if (!local) return remote;

    const hasRemoteHte = remote.companyName && !isInvalidHteCompany(remote.companyName);
    const hasLocalHte = local.companyName && !isInvalidHteCompany(local.companyName);

    // If local has valid HTE assignment but remote does not yet, preserve the assigned HTE
    if (hasLocalHte && !hasRemoteHte) {
      return {
        ...remote,
        companyName: local.companyName,
        supervisorName: local.supervisorName || remote.supervisorName,
        hteId: local.hteId || remote.hteId,
        companyAddress: local.companyAddress || remote.companyAddress,
        registrationLocation: local.registrationLocation || remote.registrationLocation,
        registrationAddress: local.registrationAddress || remote.registrationAddress,
        registrationRadius: local.registrationRadius || remote.registrationRadius,
      };
    }

    const mergedDocs = {
      ...(local.submittedDocuments || {}),
      ...(remote.submittedDocuments || {}),
    };

    return {
      ...local,
      ...remote,
      submittedDocuments: Object.keys(mergedDocs).length > 0 ? mergedDocs : undefined,
      documentsPassed: remote.documentsPassed !== undefined ? remote.documentsPassed : local.documentsPassed,
      documentsStatus: remote.documentsStatus || local.documentsStatus,
      hteId: remote.hteId || local.hteId,
      companyName: remote.companyName || local.companyName,
      supervisorName: remote.supervisorName || local.supervisorName,
      companyAddress: remote.companyAddress || local.companyAddress,
      registrationLocation: remote.registrationLocation || local.registrationLocation,
      registrationAddress: remote.registrationAddress || local.registrationAddress,
      registrationRadius: remote.registrationRadius || local.registrationRadius,
    };
  });
}

export function AppProvider({ children }: { children: ReactNode }) {
  cleanupStorageQuota();
  migrateGeofenceStorageOnce();
  migrateInstructorPositionOnce();
  const [isLoading, setIsLoading] = useState(false);
  const [useSupabase, setUseSupabase] = useState(() => isSupabaseConfigured());

  const [currentUser, setRawCurrentUser] = useState<User | null>(() => {
    const expiryStr = typeof window !== 'undefined' ? localStorage.getItem('ojt_token_expires_at') : null;
    if (expiryStr && Date.now() >= Number(expiryStr)) {
      clearAuthStorage();
      return null;
    }
    const primary = loadFromStorage<User | null>(STORAGE_KEYS.CURRENT_USER, null);
    if (primary) {
      if (!expiryStr && typeof window !== 'undefined') {
        issueSessionToken(primary);
      }
      return primary;
    }
    const legacyUser = loadFromStorage<User | null>('ojt_user', null);
    if (legacyUser) {
      if (!expiryStr && typeof window !== 'undefined') {
        issueSessionToken(legacyUser);
      }
      return legacyUser;
    }
    const cur = loadFromStorage<User | null>('ojt_current_user', null);
    if (cur && !expiryStr && typeof window !== 'undefined') {
      issueSessionToken(cur);
    }
    return cur;
  });

  const [tokenExpiresAt, setTokenExpiresAt] = useState<number | null>(() => {
    if (typeof window === 'undefined') return null;
    const stored = localStorage.getItem('ojt_token_expires_at');
    return stored ? Number(stored) : null;
  });

  const [tokenSecondsRemaining, setTokenSecondsRemaining] = useState<number>(() => {
    if (typeof window === 'undefined') return TOKEN_LIFETIME_SEC;
    const stored = localStorage.getItem('ojt_token_expires_at');
    if (!stored) return TOKEN_LIFETIME_SEC;
    return Math.max(0, Math.floor((Number(stored) - Date.now()) / 1000));
  });

  const setCurrentUser = useCallback((userOrUpdater: User | null | ((prev: User | null) => User | null)) => {
    setRawCurrentUser((prev) => {
      const nextUser = typeof userOrUpdater === 'function' ? userOrUpdater(prev) : userOrUpdater;
      if (nextUser) {
        const currentExp = Number(localStorage.getItem('ojt_token_expires_at'));
        if (!prev || prev.id !== nextUser.id || !currentExp || currentExp <= Date.now()) {
          const issued = issueSessionToken(nextUser);
          setTokenExpiresAt(issued.expiresAt);
          setTokenSecondsRemaining(TOKEN_LIFETIME_SEC);
        }
      } else {
        setTokenExpiresAt(null);
        setTokenSecondsRemaining(TOKEN_LIFETIME_SEC);
      }
      return nextUser;
    });
  }, []);
  const [employees, setEmployeesState] = useState<Employee[]>(() => {
    const stored = loadFromStorage<Employee[]>(STORAGE_KEYS.EMPLOYEES, []);
    const filtered = stored.filter(
      (e) => !e.name?.toLowerCase().includes('darius') && !e.email?.toLowerCase().includes('benales')
    );
    const normalized = normalizeTraineeRequiredHours(filtered);
    if (normalized !== stored) {
      saveToStorage(STORAGE_KEYS.EMPLOYEES, normalized);
    }
    return normalized;
  });
  // All Trainee accounts are enforced to the standard 600 required OJT hours.
  const setEmployees = useCallback((action: React.SetStateAction<Employee[]>) => {
    setEmployeesState((prev) =>
      normalizeTraineeRequiredHours(typeof action === 'function' ? (action as (p: Employee[]) => Employee[])(prev) : action)
    );
  }, []);
  const [timeRecords, setTimeRecords] = useState<TimeRecord[]>(() => {
    const stored = loadFromStorage<TimeRecord[]>(STORAGE_KEYS.TIME_RECORDS, []);
    return sanitizeTimeRecords(stored);
  });
  const [geofenceZones, setGeofenceZones] = useState<GeofenceZone[]>(() => {
    const stored = loadFromStorage<unknown>(STORAGE_KEYS.GEOFENCE_ZONES, []);
    const sanitized = sanitizeGeofenceZones(stored);
    const filtered = sanitized.filter(
      (z) => !z.name?.toLowerCase().includes('darius') && !z.name?.toLowerCase().includes('benales')
    );
    if (filtered.length !== sanitized.length) {
      saveToStorage(STORAGE_KEYS.GEOFENCE_ZONES, filtered);
    }
    return filtered;
  });
  const [settings, setSettings] = useState<AppSettings>(() => {
    const stored = loadFromStorage<Partial<AppSettings>>(STORAGE_KEYS.SETTINGS, {});
    const currentAcademicYear = '2026-2027';
    const academicYears = Array.from(new Set([
      ...(stored.academicYears || DEFAULT_SETTINGS.academicYears),
      '2025-2026',
      '2026-2027',
    ]));
    return {
      ...DEFAULT_SETTINGS,
      ...stored,
      academicYears,
      activeAcademicYear: stored.activeAcademicYear || currentAcademicYear,
    };
  });
  const [evaluations, setEvaluations] = useState<Evaluation[]>(() => loadFromStorage(STORAGE_KEYS.EVALUATIONS, []));
  function deduplicateComments(list: AnnouncementComment[]): AnnouncementComment[] {
    if (!Array.isArray(list)) return [];
    const result: AnnouncementComment[] = [];
    const seenIds = new Set<string>();

    for (const c of list) {
      if (!c || !c.content || !c.announcementId) continue;
      if (c.id && seenIds.has(c.id)) continue;

      const cTime = new Date(c.createdAt || 0).getTime();
      const isDup = result.some((existing) => {
        if (existing.announcementId !== c.announcementId) return false;
        if ((existing.authorName || '').trim().toLowerCase() !== (c.authorName || '').trim().toLowerCase()) return false;
        if (existing.content.trim().toLowerCase() !== c.content.trim().toLowerCase()) return false;
        const existingTime = new Date(existing.createdAt || 0).getTime();
        return Math.abs(cTime - existingTime) < 60000;
      });

      if (isDup) continue;

      if (c.id) seenIds.add(c.id);
      result.push(c);
    }
    return result;
  }

  function extractCommentsFromAnnouncements(announcementsList: Announcement[]): AnnouncementComment[] {
    if (!Array.isArray(announcementsList)) return [];
    const comments: AnnouncementComment[] = [];
    for (const ann of announcementsList) {
      if (ann && ann.comments && typeof ann.comments === 'string') {
        try {
          const parsed = JSON.parse(ann.comments);
          if (Array.isArray(parsed)) {
            for (const item of parsed) {
              if (item && item.content) {
                const commentId = item.id || `comm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
                comments.push({
                  id: commentId,
                  announcementId: ann.id,
                  employeeId: item.employeeId,
                  authorName: item.authorName || 'User',
                  authorRole: item.authorRole || 'employee',
                  content: item.content,
                  createdAt: item.createdAt || ann.createdAt || new Date().toISOString(),
                });
              }
            }
          }
        } catch {
          // Non-JSON comments string, ignore
        }
      }
    }
    return deduplicateComments(comments);
  }

  const [announcements, setAnnouncements] = useState<Announcement[]>(() => {
    const stored = loadFromStorage<Announcement[]>(STORAGE_KEYS.ANNOUNCEMENTS, []);
    if (stored.length === 0) {
      saveToStorage(STORAGE_KEYS.ANNOUNCEMENTS, DEFAULT_ANNOUNCEMENTS);
      return DEFAULT_ANNOUNCEMENTS;
    }
    return stored;
  });
  const [announcementSubmissions, setAnnouncementSubmissions] = useState<AnnouncementSubmission[]>(() =>
    loadFromStorage<AnnouncementSubmission[]>(STORAGE_KEYS.ANNOUNCEMENT_SUBMISSIONS, [])
  );
  const [announcementComments, setAnnouncementComments] = useState<AnnouncementComment[]>(() => {
    const stored = loadFromStorage<AnnouncementComment[]>(STORAGE_KEYS.ANNOUNCEMENT_COMMENTS, []);
    const storedAnn = loadFromStorage<Announcement[]>(STORAGE_KEYS.ANNOUNCEMENTS, []);
    const fromAnn = extractCommentsFromAnnouncements(storedAnn);
    const merged = deduplicateComments([...fromAnn, ...stored]);
    saveToStorage(STORAGE_KEYS.ANNOUNCEMENT_COMMENTS, merged);
    return merged;
  });
  const [requiredDocuments, setRequiredDocuments] = useState<RequiredDocument[]>(() =>
    loadFromStorage<RequiredDocument[]>(STORAGE_KEYS.REQUIRED_DOCUMENTS, [])
  );
  const [requiredDocumentSubmissions, setRequiredDocumentSubmissions] = useState<RequiredDocumentSubmission[]>(() =>
    loadFromStorage<RequiredDocumentSubmission[]>(STORAGE_KEYS.REQUIRED_DOCUMENT_SUBMISSIONS, [])
  );
  const [hostSupervisors, setHostSupervisors] = useState<HostSupervisor[]>(() => {
    const stored = loadFromStorage<HostSupervisor[]>(STORAGE_KEYS.HOST_SUPERVISORS, []);
    const filtered = stored.filter(
      (h) => !h.name?.toLowerCase().includes('darius') && !h.email?.toLowerCase().includes('benales')
    );
    if (filtered.length !== stored.length) {
      saveToStorage(STORAGE_KEYS.HOST_SUPERVISORS, filtered);
    }
    return filtered;
  });
  const [hostFeedback, setHostFeedback] = useState<HostFeedback[]>(() => {
    const stored = loadFromStorage<HostFeedback[]>(STORAGE_KEYS.HOST_FEEDBACK, []);
    if (stored.length === 0) {
      saveToStorage(STORAGE_KEYS.HOST_FEEDBACK, DEFAULT_HOST_FEEDBACK);
      return DEFAULT_HOST_FEEDBACK;
    }
    return stored;
  });
  const [passwords, setPasswords] = useState<Record<string, string>>(() => {
    if (isSupabaseConfigured()) {
      try {
        localStorage.removeItem(STORAGE_KEYS.PASSWORDS);
        localStorage.removeItem('ojt_passwords');
      } catch {}
      return {};
    }
    const stored = loadFromStorage<Record<string, string>>(STORAGE_KEYS.PASSWORDS, {});
    const normalized = normalizePasswordMap(stored);
    if (Object.keys(normalized).length === 0) {
      return normalizePasswordMap(DEFAULT_PASSWORDS);
    }
    const defaults = normalizePasswordMap(DEFAULT_PASSWORDS);
    Object.entries(defaults).forEach(([key, value]) => {
      if (!normalized[key]) normalized[key] = value;
    });
    return normalized;
  });

  const [monthlyDttrs, setMonthlyDttrs] = useState<MonthlyDttrRecord[]>(() =>
    loadFromStorage<MonthlyDttrRecord[]>(STORAGE_KEYS.MONTHLY_DTTR, [])
  );

  const [monitoringReports, setMonitoringReports] = useState<MonitoringReport[]>(() => {
    const stored = loadFromStorage<MonitoringReport[]>(STORAGE_KEYS.MONITORING_REPORTS, []);
    if (stored.length === 0) {
      saveToStorage(STORAGE_KEYS.MONITORING_REPORTS, DEFAULT_MONITORING_REPORTS);
      return DEFAULT_MONITORING_REPORTS;
    }

    // Ensure any new default templates are merged if missing
    const combined = [...stored];
    for (const def of DEFAULT_MONITORING_REPORTS) {
      if (!combined.some((r) => r.id === def.id)) {
        combined.push(def);
      }
    }

    // Auto-migrate legacy reports to ensure full 2-term (Mid-Term / End-Term), frequency, periodCovered, and questionnaire compatibility
    const migrated = combined.map((r, idx) => {
      let reportType: MonitoringPeriodType = r.reportType || 'weekly';
      if (!r.reportType) {
        const num = (r.reportNumber || '').toUpperCase();
        const visit = ((r as any).visitType || '').toLowerCase();
        if (visit === 'midterm' || num.includes('MID')) {
          reportType = 'midterm';
        } else if (visit === 'final' || num.includes('END')) {
          reportType = 'endterm';
        } else if (num.includes('M0') || num.includes('MONTH')) {
          reportType = 'monthly';
        } else {
          reportType = 'weekly';
        }
      }

      // Assign term: 'midterm' | 'endterm'
      let term: MonitoringTermType = r.term || (
        reportType === 'endterm' ||
        (r.reportNumber || '').toUpperCase().includes('END') ||
        (r.periodCovered || '').toLowerCase().includes('end-term') ||
        (r.totalCumulativeHours || 0) > 300
          ? 'endterm'
          : 'midterm'
      );

      // Assign frequency: 'weekly' | 'monthly' | 'evaluation'
      let frequency: MonitoringFrequencyType = r.frequency || (
        reportType === 'midterm' || reportType === 'endterm'
          ? 'evaluation'
          : reportType === 'monthly' || (r.periodCovered || '').toLowerCase().includes('month')
          ? 'monthly'
          : 'weekly'
      );

      let periodCovered = r.periodCovered;
      if (!periodCovered || periodCovered.trim() === '') {
        const termPrefix = term === 'midterm' ? 'Mid-Term' : 'End-Term';
        if (frequency === 'weekly') {
          periodCovered = `${termPrefix} Week ${idx + 1} Progress Review`;
        } else if (frequency === 'monthly') {
          periodCovered = `${termPrefix} Month ${idx + 1} Assessment`;
        } else {
          periodCovered = term === 'midterm'
            ? 'Mid-Term Evaluation (300 Hours Milestone)'
            : 'End-Term Final Completion (600 Hours Milestone)';
        }
      }

      const hoursRenderedThisPeriod =
        r.hoursRenderedThisPeriod ||
        (frequency === 'weekly' ? 40 : frequency === 'monthly' ? 160 : term === 'midterm' ? 140 : 150);

      const tasks =
        r.tasksAccomplished ||
        r.tasksObserved ||
        r.questionnaire?.q1_dutiesBriefly ||
        (r.traineeName === 'Juan Dela Cruz'
          ? 'Assisted network engineers with structured cabling, termination of CAT6 keystones, switch port VLAN configuration, and verified connectivity across Building B.'
          : r.traineeName === 'Maria Santos'
          ? 'Prepared software requirements specifications (SRS), created Figma user journey wireframes, and participated in daily standups for client ERP upgrade.'
          : 'Completed departmental tasks, technical support operations, and workstation setup.');

      const dateSubmitted = r.dateSubmitted || r.visitDate || (r.createdAt ? r.createdAt.split('T')[0] : '2026-09-18');

      const q: MonitoringQuestionnaire = {
        employabilityStatus: r.questionnaire?.employabilityStatus || 'OJT Trainee',
        allowanceSalary: r.questionnaire?.allowanceSalary || 'None / Stipend',
        telephoneNo: r.questionnaire?.telephoneNo || r.supervisorContact || '+63 917 555 4321',
        department: r.questionnaire?.department || r.department || 'COLLEGE OF COMPUTER STUDIES',
        position: r.questionnaire?.position || 'ON - THE - JOB TRAINEE',
        otherDeptAssigned: r.questionnaire?.otherDeptAssigned || 'None',
        q1_dutiesBriefly: r.questionnaire?.q1_dutiesBriefly || tasks,
        q2_strongestPerformanceArea:
          r.questionnaire?.q2_strongestPerformanceArea ||
          r.highlights ||
          'Fast learner with strong technical troubleshooting and programming capabilities.',
        q3_areasImprovedMost:
          r.questionnaire?.q3_areasImprovedMost ||
          r.skillsApplied ||
          'Enhanced workplace communication, practical networking, and systems deployment.',
        q4_areasNeedImprovement:
          r.questionnaire?.q4_areasNeedImprovement ||
          r.issuesIdentified ||
          'Advanced server security and automated deployment pipelines.',
        q5_situationChallengedMost:
          r.questionnaire?.q5_situationChallengedMost ||
          r.challengesEncountered ||
          'Diagnosing intermittent connectivity bottlenecks on departmental switches.',
        q6_howOvercameChallenge:
          r.questionnaire?.q6_howOvercameChallenge ||
          'Applied systematic hardware scanning and re-crimped connectors with mentor guidance.',
        q7_whatLearnedFromExperience:
          r.questionnaire?.q7_whatLearnedFromExperience ||
          'Enterprise reliability depends on strict documentation and disciplined standard operating procedures.',
        q8_isQualifiedLinkage:
          r.questionnaire?.q8_isQualifiedLinkage ||
          'Yes, highly qualified with modern equipment and dedicated technical mentorship.',
        q9_ojtSuggestionsRecommendations:
          r.questionnaire?.q9_ojtSuggestionsRecommendations ||
          'Recommend this Host Training Establishment to future batches of CHMSU OJT students.',
        attendanceScore: r.questionnaire?.attendanceScore ?? 5,
        performanceScore: r.questionnaire?.performanceScore ?? 5,
        attitudeScore: r.questionnaire?.attitudeScore ?? 5,
        communicationScore: r.questionnaire?.communicationScore ?? 5,
        teamworkScore: r.questionnaire?.teamworkScore ?? 5,
        overallScore: r.questionnaire?.overallScore ?? 100,
        strengths: r.questionnaire?.strengths || r.highlights || 'Supportive mentorship and modern production environment.',
        areasForImprovement: r.questionnaire?.areasForImprovement || r.issuesIdentified || 'Maintain regular feedback sessions.',
        recommendation: r.questionnaire?.recommendation || 'Highly Recommended',
      };

      return {
        ...r,
        term,
        frequency,
        reportType,
        periodCovered,
        hoursRenderedThisPeriod,
        tasksAccomplished: tasks,
        dateSubmitted,
        questionnaire: q,
        requiredHours: TRAINEE_REQUIRED_HOURS,
        totalCumulativeHours: r.totalCumulativeHours || r.renderedHours || hoursRenderedThisPeriod,
        status: r.status || 'submitted',
      };
    });

    saveToStorage(STORAGE_KEYS.MONITORING_REPORTS, migrated);
    return migrated;
  });

  const [traineeSelfMonitoringReports, setTraineeSelfMonitoringReports] = useState<TraineeSelfMonitoringReport[]>(() => {
    const stored = loadFromStorage<TraineeSelfMonitoringReport[]>(STORAGE_KEYS.TRAINEE_SELF_MONITORING_REPORTS, []);
    if (stored.length === 0) {
      saveToStorage(STORAGE_KEYS.TRAINEE_SELF_MONITORING_REPORTS, DEFAULT_TRAINEE_SELF_REPORTS);
      return DEFAULT_TRAINEE_SELF_REPORTS;
    }
    return stored;
  });

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.MONITORING_REPORTS, monitoringReports);
  }, [monitoringReports]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.TRAINEE_SELF_MONITORING_REPORTS, traineeSelfMonitoringReports);
  }, [traineeSelfMonitoringReports]);

  // Ensure ALL Trainee accounts in the institution have full Monitoring Reports (Mid-Term & End-Term)
  useEffect(() => {
    if (employees.length === 0) return;
    const trainees = employees.filter((e) => isTraineeRole(e));
    if (trainees.length === 0) return;

    setMonitoringReports((prevReports) => {
      const existingKeys = new Set<string>();
      prevReports.forEach((r) => {
        const term = r.term || (r.reportType === 'endterm' ? 'endterm' : 'midterm');
        const freq =
          r.frequency ||
          (r.reportType === 'monthly'
            ? 'monthly'
            : r.reportType === 'midterm' || r.reportType === 'endterm'
            ? 'evaluation'
            : 'weekly');
        if (r.traineeId) existingKeys.add(`${r.traineeId.toLowerCase()}_${term}_${freq}`);
        if (r.studentId) existingKeys.add(`${r.studentId.toLowerCase()}_${term}_${freq}`);
      });

      const missingReports: MonitoringReport[] = [];
      for (const trainee of trainees) {
        const traineeDefaults = buildDefaultReportsForTrainee(trainee);
        for (const rep of traineeDefaults) {
          const key1 = `${(rep.traineeId || '').toLowerCase()}_${rep.term}_${rep.frequency}`;
          const key2 = `${(rep.studentId || '').toLowerCase()}_${rep.term}_${rep.frequency}`;
          if (!existingKeys.has(key1) && !existingKeys.has(key2)) {
            missingReports.push(rep);
            existingKeys.add(key1);
            existingKeys.add(key2);
          }
        }
      }

      if (missingReports.length > 0) {
        const updated = [...prevReports, ...missingReports];
        saveToStorage(STORAGE_KEYS.MONITORING_REPORTS, updated);
        return updated;
      }
      return prevReports;
    });
  }, [employees]);

  // Check if Supabase is configured and load initial data
  useEffect(() => {
    let isMounted = true;

    const initializeData = async () => {
      const configured = isSupabaseConfigured();

      if (!isMounted) return;
      setUseSupabase(configured);

      if (configured) {
        try {
          setIsLoading(true);

          // Wait for Supabase Auth session restoration so RLS evaluates with authenticated instructor privileges
          try {
            await supabase.auth.getSession();
          } catch {}

          // Run one-time Supabase migration to normalize 'Administrator' → 'OJT Instructor'
          try {
            if (localStorage.getItem('ojt_migrated_instructor_positions') !== 'done') {
              // import lazily to avoid circular imports at module level
              const { migrateAdministratorPosition } = await import('../services/supabaseService');
              migrateAdministratorPosition().catch(() => { });
              localStorage.setItem('ojt_migrated_instructor_positions', 'done');
            }
          } catch {
            // ignore migration errors
          }

          const isAuthRoute = typeof window !== 'undefined' && (
            window.location.pathname.startsWith('/register') ||
            window.location.pathname.startsWith('/login') ||
            window.location.pathname.startsWith('/reset-password')
          );

          // Fetch all data from Supabase in parallel and update state dynamically
          Promise.allSettled([
            supabaseService.fetchEmployees().then((emp) => {
              if (isMounted && emp && emp.length > 0) {
                setEmployees((prev) => {
                  const merged = mergeEmployees(emp, prev);
                  saveToStorage(STORAGE_KEYS.EMPLOYEES, merged);
                  return merged;
                });

                // Auto-discover academic years from loaded employees (e.g. '2026-2027')
                const employeeAYs = Array.from(new Set(
                  emp.map((e) => e.academicYear).filter((ay): ay is string => Boolean(ay && /^\d{4}-\d{4}$/.test(ay)))
                ));
                if (employeeAYs.length > 0) {
                  setSettings((prev) => {
                    const mergedYears = Array.from(new Set([
                      ...(prev.academicYears || ['2025-2026', '2026-2027']),
                      ...employeeAYs,
                      '2025-2026',
                      '2026-2027',
                    ]));
                    const activeYear = (prev.activeAcademicYear && employeeAYs.includes(prev.activeAcademicYear))
                      ? prev.activeAcademicYear
                      : (employeeAYs.includes('2026-2027') ? '2026-2027' : employeeAYs[0]);
                    const next = {
                      ...prev,
                      academicYears: mergedYears,
                      activeAcademicYear: activeYear,
                    };
                    saveToStorage(STORAGE_KEYS.SETTINGS, next);
                    return next;
                  });
                }
              }
            }),
            (!isAuthRoute || currentUser
              ? supabaseService.fetchTimeRecords().then((recs) => {
                  if (isMounted && recs && recs.length > 0) {
                    setTimeRecords((prev) => {
                      const merged = mergeTimeRecords(recs, prev);
                      saveToStorage(STORAGE_KEYS.TIME_RECORDS, merged);
                      return merged;
                    });
                  }
                }).catch(() => {})
              : Promise.resolve()),
            supabaseService.fetchGeofenceZones().then((zones) => {
              if (isMounted && zones) {
                const sanitized = sanitizeGeofenceZones(zones);
                if (sanitized.length > 0) {
                  setGeofenceZones(sanitized);
                  saveToStorage(STORAGE_KEYS.GEOFENCE_ZONES, sanitized);
                }
              }
            }),
            supabaseService.fetchSettings().then((st) => {
              if (isMounted && st) {
                setSettings((prev) => {
                  const mergedYears = Array.from(new Set([
                    ...(prev.academicYears || ['2025-2026', '2026-2027']),
                    ...(st.academicYears || []),
                    '2025-2026',
                    '2026-2027',
                  ]));
                  const activeYear = (st.activeAcademicYear && st.activeAcademicYear !== '2025-2026')
                    ? st.activeAcademicYear
                    : (prev.activeAcademicYear || '2026-2027');
                  const next = {
                    ...prev,
                    ...st,
                    academicYears: mergedYears,
                    activeAcademicYear: activeYear,
                  };
                  saveToStorage(STORAGE_KEYS.SETTINGS, next);
                  return next;
                });
              }
            }),
            (!isAuthRoute || currentUser
              ? supabaseService.fetchEvaluations().then((ev) => {
                  if (isMounted && ev && ev.length > 0) {
                    setEvaluations(ev);
                    saveToStorage(STORAGE_KEYS.EVALUATIONS, ev);
                  }
                }).catch(() => {})
              : Promise.resolve()),
            supabaseService.fetchAnnouncements().then((ann) => {
              if (isMounted && ann && ann.length > 0) {
                setAnnouncements(ann);
                saveToStorage(STORAGE_KEYS.ANNOUNCEMENTS, ann);
                const fromAnn = extractCommentsFromAnnouncements(ann);
                if (fromAnn.length > 0) {
                  setAnnouncementComments((prev) => {
                    const merged = deduplicateComments([...fromAnn, ...prev]);
                    saveToStorage(STORAGE_KEYS.ANNOUNCEMENT_COMMENTS, merged);
                    return merged;
                  });
                }
              }
            }),
            supabaseService.fetchAnnouncementSubmissions().then((subs) => {
              if (isMounted && subs && subs.length > 0) setAnnouncementSubmissions(subs);
            }),
            supabaseService.fetchAnnouncementComments().then((comms) => {
              if (isMounted && comms && comms.length > 0) {
                setAnnouncementComments((prev) => {
                  const merged = deduplicateComments([...comms, ...prev]);
                  saveToStorage(STORAGE_KEYS.ANNOUNCEMENT_COMMENTS, merged);
                  return merged;
                });
              }
            }),
            supabaseService.fetchHostFeedback().then((fb) => {
              if (isMounted && fb && fb.length > 0) setHostFeedback(fb);
            }),
            supabaseService.fetchHostSupervisors().then((sup) => {
              if (isMounted && Array.isArray(sup)) {
                const filtered = sup.filter(
                  (h) => !h.name?.toLowerCase().includes('darius') && !h.email?.toLowerCase().includes('benales')
                );
                setHostSupervisors(filtered);
                saveToStorage(STORAGE_KEYS.HOST_SUPERVISORS, filtered);
              }
            }),
          ]).finally(() => {
            if (isMounted) {
              setIsLoading(false);
            }
          });
        } catch (error) {
          console.error('Error loading data from Supabase:', error);
          if (isMounted) {
            setIsLoading(false);
          }
        }
      }
    };

    initializeData();

    return () => {
      isMounted = false;
    };
  }, []);

  // Real-time Supabase Broadcast Subscription across all 3 roles (Instructor, Employee/Trainee, HTE)
  useEffect(() => {
    if (!useSupabase || !currentUser) return;

    const channel = supabase
      .channel('public-realtime-system-binding')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'geofence_zones' }, async () => {
        try {
          const supabaseZones = await supabaseService.fetchGeofenceZones();
          const sanitizedZones = sanitizeGeofenceZones(supabaseZones);
          if (sanitizedZones.length > 0) {
            setGeofenceZones(sanitizedZones);
            saveToStorage(STORAGE_KEYS.GEOFENCE_ZONES, sanitizedZones);
          }
        } catch (err) {
          console.error('Real-time geofence_zones sync error:', err);
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'employees' }, async () => {
        try {
          const [supabaseEmployees, supabaseZones] = await Promise.all([
            supabaseService.fetchEmployees(),
            supabaseService.fetchGeofenceZones(),
          ]);
          setEmployees((prev) => {
            const merged = mergeEmployees(supabaseEmployees, prev);
            saveToStorage(STORAGE_KEYS.EMPLOYEES, merged);
            return merged;
          });
          const sanitizedZones = sanitizeGeofenceZones(supabaseZones);
          if (sanitizedZones.length > 0) {
            setGeofenceZones(sanitizedZones);
            saveToStorage(STORAGE_KEYS.GEOFENCE_ZONES, sanitizedZones);
          }
        } catch (err) {
          console.error('Real-time employees/geofence sync error:', err);
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'time_records' }, async (payload) => {
        try {
          if (payload.new && (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE')) {
            const transformed = supabaseService.transformSupabaseTimeRecord(payload.new);
            setTimeRecords((prev) => {
              const updated = [transformed, ...prev.filter((r) => r.id !== transformed.id)];
              saveToStorage(STORAGE_KEYS.TIME_RECORDS, updated);
              return updated;
            });
          } else if (payload.old && payload.eventType === 'DELETE') {
            setTimeRecords((prev) => {
              const updated = prev.filter((r) => r.id !== (payload.old as any).id);
              saveToStorage(STORAGE_KEYS.TIME_RECORDS, updated);
              return updated;
            });
          }
          const supabaseRecords = await supabaseService.fetchTimeRecords();
          if (supabaseRecords.length > 0) {
            setTimeRecords((prev) => {
              const merged = mergeTimeRecords(supabaseRecords, prev);
              saveToStorage(STORAGE_KEYS.TIME_RECORDS, merged);
              return merged;
            });
          }
        } catch (err) {
          console.error('Real-time time_records sync error:', err);
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'evaluations' }, async () => {
        try {
          const freshEvals = await supabaseService.fetchEvaluations();
          if (freshEvals && freshEvals.length > 0) {
            setEvaluations((prev) => {
              const merged = mergeEvaluations(freshEvals, prev);
              saveToStorage(STORAGE_KEYS.EVALUATIONS, merged);
              return merged;
            });
          }
        } catch (err) {
          console.error('Real-time evaluations sync error:', err);
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public' }, async () => {
        try {
          const [
            supabaseEmployees,
            supabaseRecords,
            supabaseZones,
            supabaseSettings,
            supabaseEvaluations,
            supabaseAnnouncements,
            supabaseSubmissions,
            supabaseHostFeedback,
            supabaseHostSupervisors,
          ] = await Promise.all([
            supabaseService.fetchEmployees(),
            supabaseService.fetchTimeRecords(),
            supabaseService.fetchGeofenceZones(),
            supabaseService.fetchSettings(),
            supabaseService.fetchEvaluations(),
            supabaseService.fetchAnnouncements(),
            supabaseService.fetchAnnouncementSubmissions(),
            supabaseService.fetchHostFeedback(),
            supabaseService.fetchHostSupervisors(),
          ]);

          setEmployees((prev) => {
            const merged = mergeEmployees(supabaseEmployees, prev);
            saveToStorage(STORAGE_KEYS.EMPLOYEES, merged);
            return merged;
          });
          if (supabaseRecords.length > 0) {
            setTimeRecords((prev) => {
              const merged = mergeTimeRecords(supabaseRecords, prev);
              saveToStorage(STORAGE_KEYS.TIME_RECORDS, merged);
              return merged;
            });
          }
          const sanitizedZones = sanitizeGeofenceZones(supabaseZones);
          if (sanitizedZones.length > 0) {
            setGeofenceZones(sanitizedZones);
            saveToStorage(STORAGE_KEYS.GEOFENCE_ZONES, sanitizedZones);
          }
          if (supabaseSettings) setSettings(supabaseSettings);
          if (supabaseEvaluations && supabaseEvaluations.length > 0) {
            setEvaluations((prev) => {
              const merged = mergeEvaluations(supabaseEvaluations, prev);
              saveToStorage(STORAGE_KEYS.EVALUATIONS, merged);
              return merged;
            });
          }
          if (supabaseAnnouncements.length > 0) {
            setAnnouncements(supabaseAnnouncements);
            const fromAnn = extractCommentsFromAnnouncements(supabaseAnnouncements);
            if (fromAnn.length > 0) {
              setAnnouncementComments((prev) => {
                const merged = deduplicateComments([...fromAnn, ...prev]);
                saveToStorage(STORAGE_KEYS.ANNOUNCEMENT_COMMENTS, merged);
                return merged;
              });
            }
          }
          if (supabaseSubmissions && supabaseSubmissions.length > 0) setAnnouncementSubmissions(supabaseSubmissions);
          if (supabaseHostFeedback.length > 0) setHostFeedback(supabaseHostFeedback);
          if (supabaseHostSupervisors) setHostSupervisors(supabaseHostSupervisors);

          // If current logged-in user was deleted in Supabase, force immediate logout & clear credentials
          if (currentUser && currentUser.id !== 'admin') {
            const stillExists =
              supabaseEmployees.some((e) => (e.id === currentUser.id || normalizeEmail(e.email) === normalizeEmail(currentUser.email || '')) && e.active !== false) ||
              (supabaseHostSupervisors && supabaseHostSupervisors.some((h) => (h.id === currentUser.id || normalizeEmail(h.email) === normalizeEmail(currentUser.email || '')) && h.active !== false));

            if (!stillExists) {
              console.warn('Current user account deleted in database. Forcing logout.');
              clearAuthStorage();
              setCurrentUser(null);
              supabase.auth.signOut().catch(() => {});
              if (currentUser.email) {
                const norm = normalizeEmail(currentUser.email);
                setPasswords((prev) => {
                  const next = { ...prev };
                  delete next[norm];
                  delete next[currentUser.email!.toLowerCase()];
                  saveToStorage(STORAGE_KEYS.PASSWORDS, next);
                  return next;
                });
              }
            }
          }
        } catch (err) {
          console.error('Supabase real-time sync error:', err);
        }
      })
      .subscribe();

    const handlePageHide = () => {
      try {
        supabase.removeChannel(channel);
      } catch {}
    };

    window.addEventListener('pagehide', handlePageHide);

    return () => {
      window.removeEventListener('pagehide', handlePageHide);
      supabase.removeChannel(channel);
    };
  }, [useSupabase, currentUser]);

  const lastRefreshTimeRef = useRef<number>(0);

  // Periodic polling & window focus auto-sync across all open tabs/devices
  const refreshData = useCallback(async (options?: { force?: boolean }) => {
    if (!useSupabase && !isSupabaseConfigured()) return;
    if (!currentUser && !options?.force) return;
    const now = Date.now();
    // Throttle automated refresh calls to at most once every 15 seconds unless explicitly forced
    if (!options?.force && now - lastRefreshTimeRef.current < 15000) {
      return;
    }
    lastRefreshTimeRef.current = now;
    try {
      const [
        supabaseEmployees,
        supabaseRecords,
        supabaseZones,
        supabaseSettings,
        supabaseEvaluations,
        supabaseAnnouncements,
        supabaseSubmissions,
        supabaseHostFeedback,
        supabaseHostSupervisors,
        supabaseRequiredDocs,
      ] = await Promise.all([
        supabaseService.fetchEmployees(),
        supabaseService.fetchTimeRecords(),
        supabaseService.fetchGeofenceZones(),
        supabaseService.fetchSettings(),
        supabaseService.fetchEvaluations(),
        supabaseService.fetchAnnouncements(),
        supabaseService.fetchAnnouncementSubmissions(),
        supabaseService.fetchHostFeedback(),
        supabaseService.fetchHostSupervisors(),
        supabaseService.fetchRequiredDocumentsFromStorage(),
      ]);

      if (supabaseRequiredDocs && supabaseRequiredDocs.length > 0) {
        setRequiredDocuments((prev) => {
          const merged = [...supabaseRequiredDocs];
          for (const p of prev) {
            if (!merged.some((m) => m.id === p.id || m.title.toLowerCase().trim() === p.title.toLowerCase().trim())) {
              merged.push(p);
            }
          }
          saveToStorage(STORAGE_KEYS.REQUIRED_DOCUMENTS, merged);
          return merged;
        });
      }

      if (supabaseEmployees && supabaseEmployees.length > 0) {
        setEmployees((prev) => {
          const merged = mergeEmployees(supabaseEmployees, prev);
          saveToStorage(STORAGE_KEYS.EMPLOYEES, merged);
          return merged;
        });
      }
      if (supabaseRecords && supabaseRecords.length > 0) {
        setTimeRecords((prev) => {
          const merged = mergeTimeRecords(supabaseRecords, prev);
          saveToStorage(STORAGE_KEYS.TIME_RECORDS, merged);
          return merged;
        });
      }
      const sanitizedZones = sanitizeGeofenceZones(supabaseZones);
      if (sanitizedZones && sanitizedZones.length > 0) {
        setGeofenceZones(sanitizedZones);
        saveToStorage(STORAGE_KEYS.GEOFENCE_ZONES, sanitizedZones);
      }
      if (supabaseSettings) {
        setSettings((prev) => {
          const mergedYears = Array.from(new Set([
            ...(prev.academicYears || ['2025-2026', '2026-2027']),
            ...(supabaseSettings.academicYears || []),
            '2025-2026',
            '2026-2027',
          ]));
          const activeYear = (supabaseSettings.activeAcademicYear && supabaseSettings.activeAcademicYear !== '2025-2026')
            ? supabaseSettings.activeAcademicYear
            : (prev.activeAcademicYear || '2026-2027');
          const next = {
            ...prev,
            ...supabaseSettings,
            academicYears: mergedYears,
            activeAcademicYear: activeYear,
          };
          saveToStorage(STORAGE_KEYS.SETTINGS, next);
          return next;
        });
      }
      if (supabaseEvaluations && supabaseEvaluations.length > 0) {
        setEvaluations((prev) => {
          const merged = mergeEvaluations(supabaseEvaluations, prev);
          saveToStorage(STORAGE_KEYS.EVALUATIONS, merged);
          return merged;
        });
      }
      if (supabaseAnnouncements && supabaseAnnouncements.length > 0) {
        setAnnouncements(supabaseAnnouncements);
        const fromAnn = extractCommentsFromAnnouncements(supabaseAnnouncements);
        if (fromAnn.length > 0) {
          setAnnouncementComments((prev) => {
            const merged = deduplicateComments([...fromAnn, ...prev]);
            saveToStorage(STORAGE_KEYS.ANNOUNCEMENT_COMMENTS, merged);
            return merged;
          });
        }
      }
      if (supabaseSubmissions && supabaseSubmissions.length > 0) setAnnouncementSubmissions(supabaseSubmissions);
      if (supabaseHostFeedback && supabaseHostFeedback.length > 0) setHostFeedback(supabaseHostFeedback);
      if (supabaseHostSupervisors && supabaseHostSupervisors.length > 0) setHostSupervisors(supabaseHostSupervisors);
    } catch (err) {
      console.warn('Manual or auto refreshData failed:', err);
    }
  }, [useSupabase, currentUser]);

  useEffect(() => {
    if (!useSupabase && !isSupabaseConfigured()) return;
    if (!currentUser) return;

    const onFocus = () => {
      refreshData();
    };
    window.addEventListener('focus', onFocus);

    // Immediately re-fetch data when Supabase Auth session establishes or changes
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user && currentUser) {
        refreshData();
      }
    });

    // Periodic live background sync every 45 seconds (when tab is active) so Supabase is not flooded with requests
    const syncInterval = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      refreshData();
    }, 45000);

    return () => {
      window.removeEventListener('focus', onFocus);
      clearInterval(syncInterval);
      authListener?.subscription?.unsubscribe();
    };
  }, [refreshData, useSupabase, currentUser]);

  // Save to localStorage only when not using Supabase
  useEffect(() => {
    if (!useSupabase && employees.length > 0) {
      saveToStorage(STORAGE_KEYS.EMPLOYEES, employees);
    }
  }, [employees, useSupabase]);

  useEffect(() => {
    if (timeRecords.length > 0) {
      saveToStorage(STORAGE_KEYS.TIME_RECORDS, timeRecords);
    }
  }, [timeRecords]);

  useEffect(() => {
    if (!useSupabase && geofenceZones.length > 0) {
      saveToStorage(STORAGE_KEYS.GEOFENCE_ZONES, geofenceZones);
    }
  }, [geofenceZones, useSupabase]);

  // Ensure all trainees are strictly geofenced to their assigned HTE establishment location
  useEffect(() => {
    if (employees.length === 0) return;

    let hasEmpUpdates = false;
    const updatedEmployees = employees.map((emp) => {
      if (!isTraineeRole(emp)) return emp;
      const hteLoc = resolveHteLocation(emp, hostSupervisors, employees, geofenceZones);
      if (!hteLoc) return emp;

      const needsLocUpdate =
        !emp.registrationLocation ||
        Math.abs((emp.registrationLocation.lat || 0) - hteLoc.lat) > 0.0001 ||
        Math.abs((emp.registrationLocation.lng || 0) - hteLoc.lng) > 0.0001;

      if (needsLocUpdate) {
        hasEmpUpdates = true;
        return {
          ...emp,
          companyAddress: emp.companyAddress || hteLoc.address,
          registrationLocation: {
            lat: hteLoc.lat,
            lng: hteLoc.lng,
            radius: hteLoc.radius,
          },
          registrationRadius: hteLoc.radius,
        };
      }
      return emp;
    });

    if (hasEmpUpdates) {
      setEmployees(updatedEmployees);
      if (!useSupabase) {
        saveToStorage(STORAGE_KEYS.EMPLOYEES, updatedEmployees);
      }
    }
  }, [employees.length, hostSupervisors.length, geofenceZones.length, useSupabase]);

  useEffect(() => {
    if (!useSupabase) {
      saveToStorage(STORAGE_KEYS.SETTINGS, settings);
    }
  }, [settings, useSupabase]);

  useEffect(() => {
    if (currentUser) {
      saveToStorage(STORAGE_KEYS.CURRENT_USER, currentUser);
      try {
        localStorage.setItem('ojt_user', JSON.stringify(currentUser));
        localStorage.setItem('ojt_current_user', JSON.stringify(currentUser));
        if (currentUser.role === 'hte' || currentUser.role === 'host') {
          localStorage.setItem('ojt_hte_user', JSON.stringify(currentUser));
        }
      } catch {}
    } else {
      clearAuthStorage();
    }
  }, [currentUser]);

  // Cross-synchronize photo between employees state and currentUser so avatars always resolve immediately
  useEffect(() => {
    if (!currentUser || employees.length === 0) return;
    const matched = employees.find(
      (e) =>
        e.id === currentUser.employeeId ||
        e.id === currentUser.id ||
        (e.employeeId && (e.employeeId === currentUser.employeeId || e.employeeId === currentUser.id)) ||
        (currentUser.email && e.email ? normalizeEmail(e.email) === normalizeEmail(currentUser.email) : false)
    );
    if (!matched) return;

    // Case 1: Database has photo, currentUser does not -> update currentUser
    if (matched.photo && (!currentUser.photo || currentUser.photo !== matched.photo)) {
      setCurrentUser((prev) => (prev ? { ...prev, photo: matched.photo } : prev));
    }
    // Case 2: currentUser has photo (e.g. from Google OAuth), database does not -> persist to DB
    else if (currentUser.photo && !matched.photo) {
      matched.photo = currentUser.photo;
      if (useSupabase) {
        supabaseService.updateEmployee(matched.id, { photo: currentUser.photo }).catch(console.warn);
      }
    }
  }, [employees, currentUser?.id, currentUser?.employeeId, currentUser?.email, currentUser?.photo, useSupabase]);

  useEffect(() => {
    if (evaluations.length > 0) {
      saveToStorage(STORAGE_KEYS.EVALUATIONS, evaluations);
    }
  }, [evaluations]);

  useEffect(() => {
    if (!useSupabase && announcements.length > 0) {
      saveToStorage(STORAGE_KEYS.ANNOUNCEMENTS, announcements);
    }
  }, [announcements, useSupabase]);
  useEffect(() => {
    if (!useSupabase) {
      saveToStorage(STORAGE_KEYS.ANNOUNCEMENT_SUBMISSIONS, announcementSubmissions);
    }
  }, [announcementSubmissions, useSupabase]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.ANNOUNCEMENT_COMMENTS, announcementComments);
  }, [announcementComments]);

  useEffect(() => {
    if (!useSupabase) {
      saveToStorage(STORAGE_KEYS.REQUIRED_DOCUMENTS, requiredDocuments);
    }
  }, [requiredDocuments, useSupabase]);

  useEffect(() => {
    if (!useSupabase) {
      saveToStorage(STORAGE_KEYS.REQUIRED_DOCUMENT_SUBMISSIONS, requiredDocumentSubmissions);
    }
  }, [requiredDocumentSubmissions, useSupabase]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.MONTHLY_DTTR, monthlyDttrs);
  }, [monthlyDttrs]);

  useEffect(() => {
    if (!useSupabase && hostSupervisors.length > 0) {
      saveToStorage(STORAGE_KEYS.HOST_SUPERVISORS, hostSupervisors);
    }
  }, [hostSupervisors, useSupabase]);

  useEffect(() => {
    if (!useSupabase && hostFeedback.length > 0) {
      saveToStorage(STORAGE_KEYS.HOST_FEEDBACK, hostFeedback);
    }
  }, [hostFeedback, useSupabase]);

  // Passwords are NOT saved to localStorage — only the database stores authentication credentials.
  const setPasswordForEmail = (email: string, password: string) => {
    const norm = normalizeEmail(email);
    setPasswords((prev) => ({ ...prev, [norm]: password }));
    try {
      localStorage.removeItem(STORAGE_KEYS.PASSWORDS);
      localStorage.removeItem('ojt_passwords');
    } catch { }
  };

  const login = async (identifier: string, password: string): Promise<User | null> => {
    const rawId = (identifier || '').trim();
    const normalizedId = rawId.toLowerCase();
    if (!rawId || !password) return null;

    let matchedEmp: Employee | undefined = undefined;
    let matchedHost: HostSupervisor | undefined = undefined;
    let targetEmail = normalizedId;

    // Step 1: Check in-memory state across email, employeeId, and ID
    matchedEmp = employees.find(
      (e) =>
        (normalizeEmail(e.email) === normalizedId ||
          (e.employeeId && e.employeeId.toLowerCase() === normalizedId) ||
          (e.id && e.id.toLowerCase() === normalizedId) ||
          (e.username && e.username.toLowerCase() === normalizedId))
    );

    if (!matchedEmp) {
      matchedHost = hostSupervisors.find(
        (h) =>
          (normalizeEmail(h.email) === normalizedId ||
            (h.employeeId && h.employeeId.toLowerCase() === normalizedId) ||
            (h.id && h.id.toLowerCase() === normalizedId))
      );
    }

    // Step 2: If not found in memory (e.g. fresh laptop load), query Supabase directly
    if (useSupabase && !matchedEmp && !matchedHost) {
      try {
        const { data: dbEmp } = await supabase
          .from('employees')
          .select('*')
          .or(`email_lower.eq.${normalizedId},employee_id_lower.eq.${normalizedId}`)
          .limit(1)
          .maybeSingle();

        if (dbEmp) {
          matchedEmp = supabaseService.transformSupabaseEmployee(dbEmp);
          setEmployees((prev) => [matchedEmp!, ...prev.filter((e) => e.id !== matchedEmp!.id)]);
        } else {
          const { data: dbHost } = await supabase
            .from('host_supervisors')
            .select('*')
            .or(`email_lower.eq.${normalizedId},email.eq.${normalizedId}`)
            .limit(1)
            .maybeSingle();

          if (dbHost) {
            matchedHost = {
              id: dbHost.id,
              employeeId: dbHost.employee_id,
              name: dbHost.name,
              email: dbHost.email,
              companyName: dbHost.company_name,
              companyAddress: dbHost.company_address,
              contactPerson: dbHost.contact_person,
              phone: dbHost.phone,
              academicYear: dbHost.academic_year,
              isApproved: dbHost.is_approved ?? true,
              active: dbHost.active ?? true,
            };
            setHostSupervisors((prev) => [matchedHost!, ...prev.filter((h) => h.id !== matchedHost!.id)]);
          }
        }
      } catch (lookupErr) {
        console.warn('Cross-platform account lookup notice:', lookupErr);
      }
    }

    if (matchedEmp?.email) {
      targetEmail = normalizeEmail(matchedEmp.email);
    } else if (matchedHost?.email) {
      targetEmail = normalizeEmail(matchedHost.email);
    }

    // Step 3: Attempt Supabase Auth
    if (useSupabase && targetEmail.includes('@')) {
      try {
        const authPromise = supabase.auth.signInWithPassword({
          email: targetEmail,
          password: password,
        });
        const { data: authData, error: authError } = await Promise.race([
          authPromise,
          new Promise<any>((_, rej) => setTimeout(() => rej(new Error('Supabase login timeout')), 3500)),
        ]);

        if (!authError && authData.user) {
          const userId = authData.user.id;

          // Re-verify matched account with auth userId if needed
          if (!matchedEmp && !matchedHost) {
            const { data: dbEmp } = await supabase
              .from('employees')
              .select('*')
              .or(`id.eq.${userId},email_lower.eq.${targetEmail}`)
              .limit(1)
              .maybeSingle();

            if (dbEmp) {
              matchedEmp = supabaseService.transformSupabaseEmployee(dbEmp);
              setEmployees((prev) => [matchedEmp!, ...prev.filter((e) => e.id !== matchedEmp!.id)]);
            } else {
              const { data: dbHost } = await supabase
                .from('host_supervisors')
                .select('*')
                .or(`id.eq.${userId},email_lower.eq.${targetEmail}`)
                .limit(1)
                .maybeSingle();

              if (dbHost) {
                matchedHost = {
                  id: dbHost.id,
                  employeeId: dbHost.employee_id,
                  name: dbHost.name,
                  email: dbHost.email,
                  companyName: dbHost.company_name,
                  companyAddress: dbHost.company_address,
                  contactPerson: dbHost.contact_person,
                  phone: dbHost.phone,
                  academicYear: dbHost.academic_year,
                  isApproved: dbHost.is_approved ?? true,
                  active: dbHost.active ?? true,
                };
                setHostSupervisors((prev) => [matchedHost!, ...prev.filter((h) => h.id !== matchedHost!.id)]);
              } else {
                // Auto-heal: User exists in Supabase Auth but profile was missing in employees table
                const userMeta = authData.user.user_metadata || {};
                const userRole = userMeta.role || 'employee';
                const isHostRole = userRole === 'host' || userRole === 'hte';
                const isInstRole = userRole === 'admin' || userRole === 'instructor';
                const healEmp: Employee = {
                  id: userId,
                  name: userMeta.full_name || targetEmail.split('@')[0] || 'Trainee',
                  email: targetEmail,
                  employeeId: isHostRole ? `HTE-${new Date().getFullYear()}-${String(Date.now()).slice(-3)}` : isInstRole ? `ADM-${new Date().getFullYear()}-${String(Date.now()).slice(-3)}` : `OJT-${new Date().getFullYear()}-${String(Date.now()).slice(-3)}`,
                  department: 'College of Computer Studies',
                  position: isInstRole ? 'OJT Instructor' : isHostRole ? 'HTE Representative' : 'OJT Trainee',
                  companyName: isHostRole ? 'Host Establishment' : 'N/A',
                  supervisorName: 'N/A',
                  schoolName: 'Carlos Hilado Memorial State University',
                  campus: 'Talisay Campus',
                  course: 'Information Systems',
                  startDate: new Date().toISOString().split('T')[0],
                  endDate: new Date().toISOString().split('T')[0],
                  requiredHours: isInstRole || isHostRole ? 0 : 600,
                  faceRegistered: false,
                  active: true,
                  academicYear: settings.activeAcademicYear,
                  approvalStatus: 'approved',
                  applicationStatus: 'approved',
                  createdAt: new Date().toISOString().split('T')[0],
                };
                try {
                  const saved = await supabaseService.createEmployee(healEmp);
                  matchedEmp = saved || healEmp;
                } catch {
                  matchedEmp = healEmp;
                }
                setEmployees((prev) => [matchedEmp!, ...prev.filter((e) => e.id !== matchedEmp!.id)]);
              }
            }
          }

          if (matchedEmp) {
            const isInstructor = matchedEmp.position === 'OJT Instructor' || matchedEmp.position === 'Administrator' || (matchedEmp.position && matchedEmp.position.toLowerCase().includes('instructor'));
            const isHTE = matchedEmp.position === 'HTE Representative' || matchedEmp.position === 'Training Supervisor' || (matchedEmp.position && matchedEmp.position.toLowerCase().includes('hte'));
            const role: User['role'] = isInstructor ? 'admin' : isHTE ? 'hte' : 'employee';
            const authAvatar = authData.user.user_metadata?.avatar_url || authData.user.user_metadata?.picture;
            const resolvedPhoto = matchedEmp.photo || authAvatar || '';
            const user: User = {
              id: matchedEmp.id,
              name: matchedEmp.name,
              role,
              employeeId: matchedEmp.employeeId || matchedEmp.id,
              email: normalizeEmail(matchedEmp.email),
              photo: resolvedPhoto,
              faceRegistered: matchedEmp.faceRegistered,
            };
            if (authAvatar && !matchedEmp.photo) {
              matchedEmp.photo = authAvatar;
              if (useSupabase) {
                supabaseService.updateEmployee(matchedEmp.id, { photo: authAvatar }).catch(console.warn);
              }
            }
            setCurrentUser(user);
            saveToStorage(STORAGE_KEYS.CURRENT_USER, user);
            try {
              localStorage.setItem('ojt_user', JSON.stringify(user));
              localStorage.setItem('ojt_current_user', JSON.stringify(user));
              if (role === 'hte') localStorage.setItem('ojt_hte_user', JSON.stringify(user));
            } catch {}
            setPasswordForEmail(matchedEmp.email, password);
            return user;
          }

          if (matchedHost) {
            const authAvatar = authData.user.user_metadata?.avatar_url || authData.user.user_metadata?.picture;
            const hostPhoto = matchedHost.photo || authAvatar || '';
            const user: User = {
              id: matchedHost.id,
              name: matchedHost.name,
              role: 'hte',
              email: normalizeEmail(matchedHost.email),
              employeeId: matchedHost.employeeId || matchedHost.id,
              photo: hostPhoto,
              faceRegistered: false,
            };
            setCurrentUser(user);
            saveToStorage(STORAGE_KEYS.CURRENT_USER, user);
            try {
              localStorage.setItem('ojt_user', JSON.stringify(user));
              localStorage.setItem('ojt_hte_user', JSON.stringify(user));
              localStorage.setItem('ojt_current_user', JSON.stringify(user));
            } catch {}
            setPasswordForEmail(matchedHost.email, password);
            return user;
          }
        }
      } catch (err) {
        console.warn('Supabase Auth attempt notice, checking database account:', err);
      }
    }

    // Step 4: Backend API & Database Verification
    if (targetEmail.includes('@')) {
      try {
        const resp = await authAPI.login(targetEmail, password);
        if (resp?.data?.tokens) {
          localStorage.setItem('ojt_jwt_access_token', resp.data.tokens.access);
          localStorage.setItem('ojt_jwt_refresh_token', resp.data.tokens.refresh);
        }

        if (matchedEmp) {
          const isInstructor = matchedEmp.position === 'OJT Instructor' || matchedEmp.position === 'Administrator' || (matchedEmp.position && matchedEmp.position.toLowerCase().includes('instructor'));
          const isHTE = matchedEmp.position === 'HTE Representative' || matchedEmp.position === 'Training Supervisor' || (matchedEmp.position && matchedEmp.position.toLowerCase().includes('hte'));
          const role: User['role'] = isInstructor ? 'admin' : isHTE ? 'hte' : 'employee';
          const user: User = {
            id: matchedEmp.id,
            name: matchedEmp.name,
            role,
            employeeId: matchedEmp.employeeId || matchedEmp.id,
            email: normalizeEmail(matchedEmp.email),
            photo: matchedEmp.photo,
            faceRegistered: matchedEmp.faceRegistered,
          };
          setCurrentUser(user);
          return user;
        }

        if (matchedHost) {
          const user: User = {
            id: matchedHost.id,
            name: matchedHost.name,
            role: 'hte',
            email: normalizeEmail(matchedHost.email),
            photo: matchedHost.photo,
            employeeId: matchedHost.employeeId || matchedHost.id,
            faceRegistered: false,
          };
          setCurrentUser(user);
          return user;
        }

        if (resp?.data?.user) {
          const u = resp.data.user;
          const user: User = {
            id: String(u.id),
            name: u.name || targetEmail.split('@')[0],
            role: u.role === 'instructor' ? 'admin' : u.role === 'hte' ? 'hte' : 'employee',
            email: normalizeEmail(u.email || targetEmail),
            photo: u.avatar || undefined,
            faceRegistered: Boolean(u.face_registered),
          };
          setCurrentUser(user);
          return user;
        }
      } catch (backendAuthErr) {
        // Backend DB authentication also rejected credentials
      }
    }

    // Default Administrator fallback (in case offline development mode)
    if (normalizedId === 'admin@ojt.com' && (password === 'admin123' || password === 'admin')) {
      const user: User = { id: 'admin', name: 'OJT Instructor', role: 'admin', email: 'admin@ojt.com' };
      setCurrentUser(user);
      return user;
    }

    return null;
  };

  const loginWithOAuthUser = async (authUser: any, explicitRole?: 'admin' | 'hte' | 'trainee' | null): Promise<User | null> => {
    if (!authUser) return null;
    const authEmail = (authUser.email || '').trim().toLowerCase();
    const authId = authUser.id || '';
    if (!authEmail && !authId) return null;

    let matchedEmp: Employee | undefined = undefined;
    let matchedHost: HostSupervisor | undefined = undefined;

    // Step 1: Check memory + local storage cached records first
    const cachedEmployees = loadFromStorage<Employee[]>(STORAGE_KEYS.EMPLOYEES, []);
    const cachedHosts = loadFromStorage<HostSupervisor[]>(STORAGE_KEYS.HOST_SUPERVISORS, []);
    const allEmps = employees.length > 0 ? employees : cachedEmployees;
    const allHosts = hostSupervisors.length > 0 ? hostSupervisors : cachedHosts;

    matchedEmp = allEmps.find(
      (e) =>
        (authEmail && e.email && normalizeEmail(e.email) === authEmail) ||
        (authId && (e.id === authId || e.userId === authId))
    );

    if (!matchedEmp) {
      matchedHost = allHosts.find(
        (h) =>
          (authEmail && h.email && normalizeEmail(h.email) === authEmail) ||
          (authId && h.id === authId)
      );
    }

    // Step 2: Supabase DB check if not found in memory/storage (parallelized for maximum speed)
    if (useSupabase && !matchedEmp && !matchedHost) {
      try {
        const promises: Promise<any>[] = [];
        if (authEmail) {
          promises.push(supabase.from('employees').select('*').ilike('email', authEmail).limit(1));
        } else {
          promises.push(Promise.resolve({ data: null, error: null }));
        }

        if (authId) {
          promises.push(supabase.from('employees').select('*').eq('id', authId).limit(1));
        } else {
          promises.push(Promise.resolve({ data: null, error: null }));
        }

        if (authEmail) {
          promises.push(supabase.from('host_supervisors').select('*').ilike('email', authEmail).limit(1));
        } else {
          promises.push(Promise.resolve({ data: null, error: null }));
        }

        const [empEmailRes, empIdRes, hostEmailRes] = await Promise.allSettled(promises);

        const rawEmpEmail = empEmailRes.status === 'fulfilled' ? empEmailRes.value?.data?.[0] : null;
        const rawEmpId = empIdRes.status === 'fulfilled' ? empIdRes.value?.data?.[0] : null;
        const rawHostEmail = hostEmailRes.status === 'fulfilled' ? hostEmailRes.value?.data?.[0] : null;

        const dbEmp = rawEmpEmail || rawEmpId;
        if (dbEmp) {
          matchedEmp = supabaseService.transformSupabaseEmployee(dbEmp);
          setEmployees((prev) => [matchedEmp!, ...prev.filter((e) => e.id !== matchedEmp!.id)]);
          saveToStorage(STORAGE_KEYS.EMPLOYEES, [matchedEmp!, ...cachedEmployees.filter((e) => e.id !== matchedEmp!.id)]);
        } else if (rawHostEmail) {
          matchedHost = {
            id: rawHostEmail.id,
            employeeId: rawHostEmail.employee_id,
            name: rawHostEmail.name,
            email: rawHostEmail.email,
            companyName: rawHostEmail.company_name,
            companyAddress: rawHostEmail.company_address,
            contactPerson: rawHostEmail.contact_person,
            phone: rawHostEmail.phone,
            academicYear: rawHostEmail.academic_year,
            isApproved: rawHostEmail.is_approved ?? true,
            active: rawHostEmail.active ?? true,
          };
          setHostSupervisors((prev) => [matchedHost!, ...prev.filter((h) => h.id !== matchedHost!.id)]);
        }
      } catch (lookupErr) {
        console.warn('OAuth database lookup notice:', lookupErr);
      }
    }

    const pendingRole =
      explicitRole ||
      (typeof window !== 'undefined' ? (localStorage.getItem('pending_oauth_role') as any) : null) ||
      authUser.user_metadata?.role;

    if (matchedEmp) {
      if (authId && matchedEmp.userId !== authId) {
        matchedEmp.userId = authId;
      }

      const isInstructor =
        pendingRole === 'admin' ||
        matchedEmp.role === 'admin' ||
        matchedEmp.position === 'OJT Instructor' ||
        matchedEmp.position === 'Administrator' ||
        (matchedEmp.position && matchedEmp.position.toLowerCase().includes('instructor')) ||
        (matchedEmp.position && matchedEmp.position.toLowerCase().includes('admin'));
      const isHTE =
        pendingRole === 'hte' ||
        matchedEmp.role === 'hte' ||
        matchedEmp.role === 'host' ||
        matchedEmp.position === 'HTE Representative' ||
        matchedEmp.position === 'Training Supervisor' ||
        (matchedEmp.position && matchedEmp.position.toLowerCase().includes('hte'));
      const role: User['role'] = isInstructor ? 'admin' : isHTE ? 'hte' : 'employee';

      // If user specifically signed in as Instructor, ensure their employee record has role admin
      if (pendingRole === 'admin' && (matchedEmp.role !== 'admin' || matchedEmp.position !== 'OJT Instructor')) {
        matchedEmp.role = 'admin';
        matchedEmp.position = 'OJT Instructor';
        if (useSupabase) {
          try {
            await supabase.from('employees').update({
              position: 'OJT Instructor',
              application_status: 'approved',
            }).eq('id', matchedEmp.id);
          } catch (syncErr) {
            console.warn('Failed syncing instructor role to DB:', syncErr);
          }
        }
      }

      // If user specifically signed in as HTE, ensure their employee record has role hte
      if (pendingRole === 'hte' && matchedEmp.role !== 'hte') {
        matchedEmp.role = 'hte';
        matchedEmp.position = 'HTE Representative';
        if (useSupabase) {
          try {
            await supabase.from('employees').update({
              position: 'HTE Representative',
              application_status: 'approved',
            }).eq('id', matchedEmp.id);
          } catch (syncErr) {
            console.warn('Failed syncing HTE role to DB:', syncErr);
          }
        }
      }

      const oauthPhoto = authUser.user_metadata?.avatar_url || authUser.user_metadata?.picture;
      if (oauthPhoto && !matchedEmp.photo) {
        matchedEmp.photo = oauthPhoto;
        if (useSupabase) {
          supabaseService.updateEmployee(matchedEmp.id, { photo: oauthPhoto }).catch(console.warn);
        }
      }
      const user: User = {
        id: matchedEmp.id,
        name: matchedEmp.name,
        role,
        employeeId: matchedEmp.employeeId || matchedEmp.id,
        email: normalizeEmail(matchedEmp.email),
        photo: matchedEmp.photo || oauthPhoto,
        faceRegistered: matchedEmp.faceRegistered,
      };
      setCurrentUser(user);
      saveToStorage(STORAGE_KEYS.CURRENT_USER, user);
      try {
        localStorage.setItem('ojt_user', JSON.stringify(user));
        localStorage.setItem('ojt_current_user', JSON.stringify(user));
        if (role === 'hte') {
          localStorage.setItem('ojt_hte_user', JSON.stringify(user));
        }
      } catch {}
      return user;
    }

    if (matchedHost) {
      const oauthPhoto = authUser.user_metadata?.avatar_url || authUser.user_metadata?.picture;
      if (oauthPhoto && !matchedHost.photo) {
        matchedHost.photo = oauthPhoto;
      }
      const user: User = {
        id: matchedHost.id,
        name: matchedHost.name,
        role: 'hte',
        email: normalizeEmail(matchedHost.email),
        employeeId: matchedHost.employeeId || matchedHost.id,
        photo: matchedHost.photo || oauthPhoto,
        faceRegistered: false,
      };
      setCurrentUser(user);
      saveToStorage(STORAGE_KEYS.CURRENT_USER, user);
      try {
        localStorage.setItem('ojt_user', JSON.stringify(user));
        localStorage.setItem('ojt_hte_user', JSON.stringify(user));
        localStorage.setItem('ojt_current_user', JSON.stringify(user));
      } catch {}
      return user;
    }

    // Note: New instructors and HTEs complete their registration details on /register?role=... before account creation

    // Returning null for first-time Google sign-ins so user can complete registration with prefilled details
    return null;
  };

  const logout = () => {
    clearAuthStorage();
    setCurrentUser(null);
    setTokenExpiresAt(null);
    setTokenSecondsRemaining(TOKEN_LIFETIME_SEC);
    if (useSupabase) {
      supabase.auth.signOut().catch((err) => {
        console.error('Error signing out from Supabase:', err);
      });
    }
  };

  const refreshToken = () => {
    if (!currentUser) return;
    const issued = issueSessionToken(currentUser);
    setTokenExpiresAt(issued.expiresAt);
    setTokenSecondsRemaining(TOKEN_LIFETIME_SEC);
    toast.success('Session Extended', {
      description: 'Your session has been extended by 20 minutes.',
      duration: 3000,
    });
  };

  // ── 20-Minute Inactivity / Token Expiry & Automatic Logout ───────────────────
  // If the system is not controlled or used for 20 minutes by any of the 3 user roles
  // (Instructor, HTE, Trainee), the session expires and the account is logged out automatically.
  // Active user interaction (mousemove, mousedown, keydown, touchstart, scroll, click)
  // refreshes the inactivity timer to prevent disruption while working.
  useEffect(() => {
    if (!currentUser) {
      setTokenExpiresAt(null);
      setTokenSecondsRemaining(TOKEN_LIFETIME_SEC);
      return;
    }
    if (typeof window === 'undefined') return;
    if ((window as any).Cypress) return; // Prevent premature logout during automated tests

    // Initialize or verify token expiry timestamp
    let expTime = Number(localStorage.getItem('ojt_token_expires_at'));
    if (!expTime || isNaN(expTime) || expTime <= Date.now()) {
      const issued = issueSessionToken(currentUser);
      expTime = issued.expiresAt;
      setTokenExpiresAt(expTime);
      setTokenSecondsRemaining(TOKEN_LIFETIME_SEC);
    } else {
      setTokenExpiresAt(expTime);
      setTokenSecondsRemaining(Math.max(0, Math.floor((expTime - Date.now()) / 1000)));
    }

    let hasWarned30Sec = false;
    let lastActivityTime = Date.now();

    // Reset inactivity timer whenever system is controlled or used by the user
    const resetActivity = () => {
      const now = Date.now();
      // Throttle activity resets to at most once every 1.5 seconds to conserve performance
      if (now - lastActivityTime > 1500) {
        lastActivityTime = now;
        const newExpiry = now + TOKEN_LIFETIME_MS;
        try {
          localStorage.setItem('ojt_token_expires_at', String(newExpiry));
        } catch {}
        setTokenExpiresAt(newExpiry);
        hasWarned30Sec = false;
      }
    };

    // User activity listeners: triggers when user controls or interacts with system
    const activityEvents = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
    activityEvents.forEach((ev) => {
      window.addEventListener(ev, resetActivity, { passive: true });
    });

    const checkTokenExpiry = () => {
      const currentExpiry = Number(localStorage.getItem('ojt_token_expires_at')) || (Date.now() + TOKEN_LIFETIME_MS);
      const now = Date.now();
      const remainingMs = currentExpiry - now;
      const remainingSec = Math.max(0, Math.floor(remainingMs / 1000));
      setTokenSecondsRemaining(remainingSec);

      // 30-second warning before auto-logout
      if (remainingSec <= 30 && remainingSec > 20 && !hasWarned30Sec) {
        hasWarned30Sec = true;
        toast.warning('Inactivity Warning', {
          description: 'No activity detected. You will be logged out in 30 seconds due to inactivity. Move your mouse or press any key to stay logged in.',
          duration: 6000,
        });
      }

      // Automatically log out when 20 minutes of inactivity have elapsed
      if (remainingMs <= 0) {
        logout();
        toast.error('Session Expired', {
          description: 'You have been automatically logged out because the system was not used for 20 minutes.',
          duration: 8000,
        });
      }
    };

    // Check immediately on mount/focus
    checkTokenExpiry();

    // 1-second interval for countdown and auto-logout
    const timerInterval = setInterval(checkTokenExpiry, 1000);

    const handleVisibilityOrFocus = () => {
      if (!document.hidden) {
        checkTokenExpiry();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);

    return () => {
      clearInterval(timerInterval);
      activityEvents.forEach((ev) => {
        window.removeEventListener(ev, resetActivity);
      });
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
    };
  }, [currentUser]);

  const getCurrentUserEmail = (): string | null => {
    if (!currentUser) return null;
    if (currentUser.email) return normalizeEmail(currentUser.email);
    if (currentUser.role === 'host') {
      const host = hostSupervisors.find((h) => h.id === currentUser.id);
      return host ? normalizeEmail(host.email) : null;
    }
    const employee = employees.find(
      (e) =>
        e.id === currentUser.employeeId ||
        e.id === currentUser.id ||
        normalizeEmail(e.email) === normalizeEmail(currentUser.email || '')
    );
    return employee ? normalizeEmail(employee.email) : null;
  };

  const changeCurrentUserPassword = async (
    currentPassword: string,
    newPassword: string
  ): Promise<{ success: boolean; message: string }> => {
    const email = getCurrentUserEmail();
    if (!email) return { success: false, message: 'Current account not found.' };

    const checkLocalFallback = () => {
      const account = employees.find((e) => normalizeEmail(e.email) === email);
      const host = hostSupervisors.find((h) => normalizeEmail(h.email) === email);
      const position = account?.position || (host ? 'HTE Representative' : '');
      const fallbackPassword = position === 'OJT Instructor' ? 'admin123' : position === 'HTE Representative' ? 'hte123' : 'ojt2024';
      const existingPassword = passwords[email] || fallbackPassword;

      if (currentPassword !== existingPassword) {
        return { success: false, message: 'Current password is incorrect.' };
      }
      if (!newPassword || newPassword.length < 6) {
        return { success: false, message: 'New password must be at least 6 characters.' };
      }
      if (newPassword === existingPassword) {
        return { success: false, message: 'New password must be different from current password.' };
      }
      setPasswordForEmail(email, newPassword);
      return { success: true, message: 'Password updated successfully (local mode).' };
    };

    if (useSupabase) {
      try {
        // 1. Verify the current password by signing in
        const { error: verifyError } = await supabase.auth.signInWithPassword({
          email: email,
          password: currentPassword,
        });

        if (verifyError) {
          console.warn('Supabase password verify failed, trying local fallback:', verifyError);
          return checkLocalFallback();
        }

        // 2. Update to the new password in Supabase Auth
        if (!newPassword || newPassword.length < 6) {
          return { success: false, message: 'New password must be at least 6 characters.' };
        }

        const { error: updateError } = await supabase.auth.updateUser({
          password: newPassword,
        });

        if (updateError) {
          return { success: false, message: updateError.message };
        }

        setPasswordForEmail(email, newPassword);
        return { success: true, message: 'Password updated successfully.' };
      } catch (err: any) {
        console.error('changeCurrentUserPassword exception:', err);
        return checkLocalFallback();
      }
    }

    return checkLocalFallback();
  };

  const registerEmployee = async (data: RegisterEmployeeInput): Promise<{ success: boolean; message?: string; employee?: Employee }> => {
    const { password, ...employeeData } = data;
    const isCloud = isSupabaseConfigured() || useSupabase;

    // Set robust default values for non-trainee roles to avoid violating NOT NULL database constraints
    const isHTE = employeeData.position === 'HTE Representative' || employeeData.position === 'Training Supervisor' || (employeeData.position && employeeData.position.toLowerCase().includes('hte'));
    const isInstructor = employeeData.position === 'OJT Instructor' || (employeeData.position && employeeData.position.toLowerCase().includes('instructor'));
    const rolePrefix = isHTE ? 'HTE' : isInstructor ? 'ADM' : 'OJT';

    let resolvedEmployeeId = employeeData.employeeId;
    if (!resolvedEmployeeId || (isHTE && resolvedEmployeeId.startsWith('OJT-')) || (isInstructor && resolvedEmployeeId.startsWith('OJT-'))) {
      if (resolvedEmployeeId && (isHTE || isInstructor) && resolvedEmployeeId.startsWith('OJT-')) {
        resolvedEmployeeId = resolvedEmployeeId.replace(/^OJT-/, `${rolePrefix}-`);
      } else {
        resolvedEmployeeId = `${rolePrefix}-${new Date().getFullYear()}-${String(Date.now()).slice(-3)}`;
      }
    }

    const phoneVal = employeeData.contactPhone || employeeData.phone || (employeeData as any).telephone;
    const resAddrVal = employeeData.residentialAddress || employeeData.address;

    const cleanData = {
      ...employeeData,
      employeeId: resolvedEmployeeId,
      companyName: employeeData.companyName || (isHTE ? 'HTE Partner' : 'N/A'),
      supervisorName: employeeData.supervisorName || 'N/A',
      schoolName: employeeData.schoolName || 'Carlos Hilado Memorial State University',
      campus: employeeData.campus || 'Talisay (Main Campus)',
      contactPhone: phoneVal,
      phone: phoneVal,
      telephone: phoneVal,
      residentialAddress: resAddrVal,
      address: resAddrVal,
      course: employeeData.course || 'N/A',
      startDate: employeeData.startDate || new Date().toISOString().split('T')[0],
      endDate: employeeData.endDate || new Date().toISOString().split('T')[0],
      requiredHours: isInstructor || isHTE ? (employeeData.requiredHours ?? 0) : TRAINEE_REQUIRED_HOURS,
    };

    const newEmp: Employee = {
      ...cleanData,
      academicYear: cleanData.academicYear || settings.activeAcademicYear,
      id: generateId('emp'),
      createdAt: new Date().toISOString().split('T')[0],
    };

    if (isCloud) {
      try {
        // Compress and upload face photo if base64
        if (cleanData.photo && typeof cleanData.photo === 'string' && !cleanData.photo.startsWith('http')) {
          try {
            cleanData.photo = await supabaseService.compressBase64Image(cleanData.photo, 600, 0.82);
            const uploadedUrl = await supabaseService.uploadFacePhoto(resolvedEmployeeId || 'unassigned', cleanData.photo, 'profile');
            if (uploadedUrl && uploadedUrl.startsWith('http')) {
              cleanData.photo = uploadedUrl;
            }
          } catch (uploadErr) {
            console.warn('Face photo upload warning during registerEmployee:', uploadErr);
          }
        }

        let authId: string | undefined;

        // Attempt Supabase Auth account creation if password provided
        if (password) {
          try {
            const { data: authData, error: authError } = await supabase.auth.signUp({
              email: cleanData.email.trim().toLowerCase(),
              password: password,
              options: {
                data: {
                  full_name: cleanData.name,
                  role: isInstructor ? 'admin' : isHTE ? 'host' : 'employee',
                }
              }
            });

            if (authError) {
              console.warn('Supabase auth.signUp note (proceeding to ensure employees row is saved):', authError.message);
            } else if (authData?.user?.id) {
              authId = authData.user.id;
            }
          } catch (authCatchErr) {
            console.warn('Supabase auth.signUp exception (proceeding to save database record):', authCatchErr);
          }
        }

        if (!authId && cleanData.userId) {
          authId = cleanData.userId;
        }

        // Auto-link trainees to an instructor and HTE supervisor for the active academic year
        let autoInstructorId: string | undefined;
        let autoHteId: string | undefined;
        const targetAcademicYear = cleanData.academicYear || newEmp.academicYear || settings.activeAcademicYear;
        const defaultAY = settings.academicYears?.[0] || '2025-2026';

        if (!isInstructor && !isHTE) {
          try {
            const { data: matchingInstructor } = await supabase
              .from('employees')
              .select('id')
              .eq('position', 'OJT Instructor')
              .eq('academic_year', targetAcademicYear)
              .limit(1)
              .maybeSingle();
            if (matchingInstructor) {
              autoInstructorId = matchingInstructor.id;
            } else {
              const { data: anyInstructor } = await supabase
                .from('employees')
                .select('id')
                .eq('position', 'OJT Instructor')
                .limit(1)
                .maybeSingle();
              if (anyInstructor) autoInstructorId = anyInstructor.id;
            }
          } catch (e) {
            console.warn('Auto instructor linking lookup failed:', e);
          }

          if (!autoInstructorId) {
            const localInst = employees.find(
              (e) => (e.position === 'OJT Instructor' || (e.position && e.position.toLowerCase().includes('instructor'))) &&
                     (e.academicYear === targetAcademicYear || (!e.academicYear && targetAcademicYear === defaultAY))
            ) || employees.find((e) => e.position === 'OJT Instructor');
            if (localInst) autoInstructorId = localInst.id;
          }

          // Auto-link trainee to matching HTE supervisor by company name or any active HTE supervisor
          try {
            if (cleanData.companyName && cleanData.companyName.trim() !== '' && cleanData.companyName.toLowerCase() !== 'n/a') {
              const { data: matchingHte } = await supabase
                .from('employees')
                .select('id')
                .eq('position', 'HTE Representative')
                .ilike('company_name', `%${cleanData.companyName.trim()}%`)
                .limit(1)
                .maybeSingle();
              if (matchingHte?.id) {
                autoHteId = matchingHte.id;
              } else {
                const { data: matchingHost } = await supabase
                  .from('host_supervisors')
                  .select('id')
                  .ilike('company_name', `%${cleanData.companyName.trim()}%`)
                  .limit(1)
                  .maybeSingle();
                if (matchingHost?.id) autoHteId = matchingHost.id;
              }
            }

          } catch (hteErr) {
            console.warn('Auto HTE linking lookup failed:', hteErr);
          }

          if (!autoHteId && cleanData.companyName && cleanData.companyName.trim() !== '' && cleanData.companyName.toLowerCase() !== 'n/a') {
            const comp = cleanData.companyName.trim().toLowerCase();
            const localHte = employees.find(
              (e) => (e.position === 'HTE Representative' || (e.position && e.position.toLowerCase().includes('hte'))) &&
                     e.companyName && e.companyName.trim().toLowerCase() === comp
            ) || hostSupervisors.find(
              (h) => h.companyName && h.companyName.trim().toLowerCase() === comp
            );
            if (localHte?.id) autoHteId = localHte.id;
          }
        }

        const isUuid = (val?: string) => Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));

        const isTrainee = !isInstructor && !isHTE;
        const employeePayload = {
          ...cleanData,
          academicYear: targetAcademicYear,
          instructorId: isUuid(autoInstructorId) ? autoInstructorId : undefined,
          hteId: isTrainee ? undefined : (isUuid(autoHteId) ? autoHteId : undefined),
          companyName: isTrainee
            ? (cleanData.companyName && !isInvalidHteCompany(cleanData.companyName) ? cleanData.companyName : 'Pending Admin Assignment')
            : cleanData.companyName,
          supervisorName: isTrainee
            ? (cleanData.supervisorName || 'Pending Admin Assignment')
            : cleanData.supervisorName,
          applicationStatus: isTrainee ? ('pending' as const) : ('approved' as const),
          approvalStatus: isTrainee ? ('pending' as const) : ('approved' as const),
          active: isTrainee ? false : true,
          ...(isUuid(authId) ? { id: authId } : {}),
        };

        let created: Employee | null = null;
        try {
          created = await supabaseService.createEmployee(employeePayload);
        } catch (createErr: any) {
          console.error('createEmployee failed:', createErr);
          const errMsg = String(createErr?.message || createErr || '').toLowerCase();
          const isNetworkError =
            errMsg.includes('failed to fetch') ||
            errMsg.includes('network') ||
            errMsg.includes('timeout') ||
            errMsg.includes('connection') ||
            (typeof navigator !== 'undefined' && !navigator.onLine);

          console.warn('[Resilient Registration] Cloud write notice during registration, ensuring profile is preserved locally:', createErr);
          created = {
            ...newEmp,
            ...employeePayload,
            id: employeePayload.id || newEmp.id,
          };
        }

        if (!created) {
          created = {
            ...newEmp,
            ...employeePayload,
            id: employeePayload.id || newEmp.id,
          };
        }

        if (password) {
          setPasswordForEmail(cleanData.email, password);
        }

        // Update local React state and storage with newly registered profile (guarantees offline availability)
        const finalPhone = created.contactPhone || created.phone || cleanData.contactPhone || cleanData.phone;
        const finalResidential = created.residentialAddress || created.address || cleanData.residentialAddress || cleanData.address;
        const mergedCreated: Employee = {
          ...cleanData,
          ...created,
          contactPhone: finalPhone,
          phone: finalPhone,
          telephone: finalPhone,
          residentialAddress: finalResidential,
          address: finalResidential,
          street: created.street || cleanData.street,
          barangay: created.barangay || cleanData.barangay,
          city: created.city || cleanData.city,
          province: created.province || cleanData.province,
        };
        setEmployees((prev) => [mergedCreated, ...prev.filter((e) => e.email.toLowerCase() !== cleanData.email.toLowerCase() && e.id !== mergedCreated.id)]);
        saveToStorage(STORAGE_KEYS.EMPLOYEES, [mergedCreated, ...employees.filter((e) => e.email.toLowerCase() !== cleanData.email.toLowerCase() && e.id !== mergedCreated.id)]);

        // Cross-role sync: If registering an HTE supervisor, persist host supervisor and auto-link matching trainees in this academic year
        if (isHTE) {
          const hostPayload: HostSupervisor = {
            id: created.id,
            employeeId: created.employeeId || cleanData.employeeId,
            name: created.name,
            email: created.email,
            companyName: created.companyName || cleanData.companyName || 'Host Training Establishment',
            companyAddress: cleanData.companyAddress || cleanData.registrationAddress || '',
            contactPerson: created.name,
            phone: created.phone || cleanData.phone || '',
            academicYear: created.academicYear || cleanData.academicYear || settings.activeAcademicYear,
            isApproved: true,
            active: true,
            registrationLocation: cleanData.registrationLocation,
            registrationAddress: cleanData.registrationAddress,
            photo: cleanData.photo || created.photo,
            createdAt: created.createdAt || new Date().toISOString(),
          };
          setHostSupervisors((prev) => [hostPayload, ...prev.filter((h) => h.id !== hostPayload.id && h.email !== hostPayload.email)]);
          supabaseService.createHostSupervisor(hostPayload).catch((hErr) => {
            console.debug('HostSupervisor creation notice:', hErr);
          });
        }

        // Cross-role sync: If registering an Instructor, auto-link unassigned Trainees in this academic year
        if (isInstructor) {
          const traineesToLink = employees.filter(
            (e) =>
              e.position !== 'OJT Instructor' &&
              e.position !== 'HTE Representative' &&
              (e.academicYear === targetAcademicYear || (!e.academicYear && targetAcademicYear === defaultAY)) &&
              !e.instructorId
          );

          if (traineesToLink.length > 0) {
            traineesToLink.forEach((t) => {
              t.instructorId = created!.id;
              supabase.from('employees').update({ instructor_id: created!.id }).eq('id', t.id).then(undefined, () => {});
            });
            setEmployees((prev) =>
              prev.map((e) => (traineesToLink.some((t) => t.id === e.id) ? { ...e, instructorId: created!.id } : e))
            );
          }
        }

        // Auto-create/upsert station geofence zone in database and local state for all registered accounts
        const campusInfo = getCampusLocation(cleanData.campus || created.campus);
        const hteLoc = (!isInstructor && !isHTE)
          ? resolveHteLocation(cleanData, hostSupervisors, employees, geofenceZones)
          : null;
        const hasCoords = (cleanData.registrationLocation?.lat && cleanData.registrationLocation?.lng) || isInstructor || Boolean(hteLoc);

        if (hasCoords) {
          const isCreatedUuid = created.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(created.id);
          const zoneName = isInstructor
            ? `${created.name} - Official Station`
            : isHTE
            ? `${created.name} - ${cleanData.companyName || 'HTE Workplace'}`
            : `${created.name} - Trainee Geofence (${hteLoc?.companyName || cleanData.companyName || 'Assigned Workplace'})`;
          const zoneAddr = isInstructor
            ? campusInfo.address
            : hteLoc
            ? hteLoc.address
            : cleanData.companyAddress || cleanData.registrationAddress || `${Number(cleanData.registrationLocation?.lat).toFixed(6)}, ${Number(cleanData.registrationLocation?.lng).toFixed(6)}`;

          const zoneLat = isInstructor ? campusInfo.lat : hteLoc ? hteLoc.lat : Number(cleanData.registrationLocation?.lat);
          const zoneLng = isInstructor ? campusInfo.lng : hteLoc ? hteLoc.lng : Number(cleanData.registrationLocation?.lng);
          const zoneRadius = isInstructor ? campusInfo.radius : hteLoc ? hteLoc.radius : 40;

          const stationZone: GeofenceZone = {
            id: isCreatedUuid ? created.id : `station-${created.id}`,
            name: zoneName,
            address: zoneAddr,
            lat: zoneLat,
            lng: zoneLng,
            radius: zoneRadius,
            active: true,
            userType: isInstructor ? 'instructor' : isHTE ? 'hte' : 'trainee',
            academicYear: cleanData.academicYear || settings.activeAcademicYear,
          };
          supabaseService.createGeofenceZone(stationZone).then((saved) => {
            const zoneToUse = saved || stationZone;
            setGeofenceZones((prev) => [zoneToUse, ...prev.filter((z) => z.id !== zoneToUse.id && z.id !== stationZone.id && z.id !== `station-${created!.id}`)]);
          }).catch((err) => {
            console.debug('Station geofence zone auto-sync notice:', err);
          });
        }

        return { success: true, employee: created };
      } catch (err: any) {
        console.error('registerEmployee Supabase path error:', err);
        const errMsg = err?.message || (typeof err === 'string' ? err : JSON.stringify(err)) || 'Unknown error during Supabase registration.';
        return { success: false, message: errMsg };
      }
    } else {
      if (password) {
        setPasswordForEmail(employeeData.email, password);
      }
      setEmployees((prev) => [...prev, newEmp]);

      // Local storage station geofence auto-creation
      const campusInfo = getCampusLocation(cleanData.campus || newEmp.campus);
      const localHteLoc = (!isInstructor && !isHTE)
        ? resolveHteLocation(cleanData, hostSupervisors, employees, geofenceZones)
        : null;
      const hasCoords = (cleanData.registrationLocation?.lat && cleanData.registrationLocation?.lng) || isInstructor || Boolean(localHteLoc);
      if (hasCoords) {
        const zoneName = isInstructor
          ? `${newEmp.name} - Official Station`
          : isHTE
          ? `${newEmp.name} - ${cleanData.companyName || 'HTE Workplace'}`
          : `${newEmp.name} - Trainee Geofence (${localHteLoc?.companyName || cleanData.companyName || 'Assigned Workplace'})`;
        const zoneAddr = isInstructor
          ? campusInfo.address
          : localHteLoc
          ? localHteLoc.address
          : cleanData.companyAddress || cleanData.registrationAddress || `${Number(cleanData.registrationLocation?.lat).toFixed(6)}, ${Number(cleanData.registrationLocation?.lng).toFixed(6)}`;

        const localZone: GeofenceZone = {
          id: `station-${newEmp.id}`,
          name: zoneName,
          address: zoneAddr,
          lat: isInstructor ? campusInfo.lat : localHteLoc ? localHteLoc.lat : Number(cleanData.registrationLocation?.lat),
          lng: isInstructor ? campusInfo.lng : localHteLoc ? localHteLoc.lng : Number(cleanData.registrationLocation?.lng),
          radius: isInstructor ? campusInfo.radius : localHteLoc ? localHteLoc.radius : 40,
          active: true,
          userType: isInstructor ? 'instructor' : isHTE ? 'hte' : 'trainee',
          academicYear: cleanData.academicYear || settings.activeAcademicYear,
        };
        setGeofenceZones((prev) => {
          const next = [localZone, ...prev.filter((z) => z.id !== localZone.id)];
          saveToStorage(STORAGE_KEYS.GEOFENCE_ZONES, next);
          return next;
        });
      }

      // Local storage face enrollment fallback
      if (
        cleanData.photo &&
        isSecurityApiConfigured() &&
        cleanData.position !== 'OJT Instructor' &&
        cleanData.position !== 'HTE Representative'
      ) {
        try {
          const response = await registerFace({
            employee_id: newEmp.id,
            image: cleanData.photo,
          });
          if (response.success && response.image_url) {
            updateEmployee(newEmp.id, { photo: response.image_url, faceRegistered: true });
            const updatedNewEmp = { ...newEmp, photo: response.image_url, faceRegistered: true };
            return { success: true, employee: updatedNewEmp } as any;
          }
        } catch (err) {
          console.error('Local face registration failed:', err);
        }
      }
      return { success: true, employee: newEmp };
    }
  };

  const updateEmployee = async (id: string, data: Partial<Employee>): Promise<boolean> => {
    // 1. AUTO-RESOLVE PERMANENT HTE WORKPLACE COORDINATES FOR TRAINEES
    const targetEmp = employees.find((e) => e.id === id || e.employeeId === id);
    const isStudent = targetEmp
      ? isTraineeRole(targetEmp)
      : (!data.position?.toLowerCase().includes('instructor') && !data.position?.toLowerCase().includes('hte') && !data.position?.toLowerCase().includes('admin'));

    if (isStudent && (data.companyName || data.hteId || data.companyAddress)) {
      const candidateHte = {
        ...targetEmp,
        ...data,
        id,
      };
      if ((candidateHte.companyName && !isInvalidHteCompany(candidateHte.companyName)) || candidateHte.hteId) {
        const hteLoc = resolveHteLocation(candidateHte, hostSupervisors, employees, geofenceZones);
        if (hteLoc) {
          data.companyName = hteLoc.companyName || data.companyName;
          data.companyAddress = hteLoc.address;
          if (!data.supervisorName && (hteLoc as any).supervisorName) {
            data.supervisorName = (hteLoc as any).supervisorName;
          }
          if (!data.hteId && (hteLoc as any).id) {
            data.hteId = (hteLoc as any).id;
          }
          const chosenRadius =
            (data.registrationLocation as any)?.radius ||
            (data as any)?.registrationRadius ||
            hteLoc.radius;
          data.registrationLocation = {
            lat: Number(hteLoc.lat),
            lng: Number(hteLoc.lng),
            radius: Math.max(20, Number(chosenRadius)),
            address: hteLoc.address,
          };
          data.registrationAddress = hteLoc.address;
          data.registrationRadius = Math.max(20, Number(chosenRadius));
        }
      }
    }

    let updatedEmployee: Employee | undefined;
    setEmployees((prev) => {
      const updatedEmployees = prev.map((e) => {
        if (e.id === id || e.employeeId === id) {
          const next: any = { ...e, ...data };
          if (data.contactPhone !== undefined || data.phone !== undefined || (data as any).telephone !== undefined) {
            const pVal = data.contactPhone ?? data.phone ?? (data as any).telephone;
            next.contactPhone = pVal;
            next.phone = pVal;
            next.telephone = pVal;
          }
          if (data.residentialAddress !== undefined || data.address !== undefined) {
            const aVal = data.residentialAddress ?? data.address;
            next.residentialAddress = aVal;
            next.address = aVal;
          }
          if ('registrationLocation' in data && !data.registrationLocation) {
            delete next.registrationLocation;
            delete next.registration_lat;
            delete next.registration_lng;
          }
          if ('registrationAddress' in data && !data.registrationAddress) {
            delete next.registrationAddress;
            delete next.registration_address;
          }
          if (data.documentsPassed !== undefined && !data.submittedDocuments && next.submittedDocuments) {
            const targetDocStatus = data.documentsPassed ? 'passed' : 'pending';
            const syncedDocs: any = { ...next.submittedDocuments };
            for (const k of Object.keys(syncedDocs)) {
              if (syncedDocs[k] && typeof syncedDocs[k] === 'object') {
                syncedDocs[k] = { ...syncedDocs[k], status: targetDocStatus };
              }
            }
            next.submittedDocuments = syncedDocs;
          }
          updatedEmployee = next as Employee;
          return next as Employee;
        }
        return e;
      });
      saveToStorage(STORAGE_KEYS.EMPLOYEES, updatedEmployees);
      return updatedEmployees;
    });

    if (
      updatedEmployee &&
      currentUser &&
      (currentUser.employeeId === id ||
        currentUser.id === id ||
        (currentUser.email && updatedEmployee.email && normalizeEmail(currentUser.email) === normalizeEmail(updatedEmployee.email)))
    ) {
      setCurrentUser((prev) => {
        if (!prev) return prev;
        const nextUser = {
          ...prev,
          ...updatedEmployee,
          name: updatedEmployee.name || prev.name,
          email: updatedEmployee.email || prev.email,
          photo: updatedEmployee.photo || prev.photo,
          faceRegistered: updatedEmployee.faceRegistered ?? prev.faceRegistered ?? false,
          companyName: updatedEmployee.companyName ?? prev.companyName,
          supervisorName: updatedEmployee.supervisorName ?? prev.supervisorName,
          companyAddress: updatedEmployee.companyAddress ?? (prev as any).companyAddress,
          registrationLocation: updatedEmployee.registrationLocation ?? (prev as any).registrationLocation,
          registrationAddress: updatedEmployee.registrationAddress ?? (prev as any).registrationAddress,
        };
        saveToStorage(STORAGE_KEYS.CURRENT_USER, nextUser);
        return nextUser;
      });
    }

    let dbSuccess = true;
    if (useSupabase) {
      try {
        dbSuccess = await supabaseService.updateEmployee(id, {
          ...data,
          employeeId: updatedEmployee?.employeeId || data.employeeId,
          email: updatedEmployee?.email || data.email,
          companyName: updatedEmployee?.companyName ?? data.companyName,
          hteId: updatedEmployee?.hteId ?? data.hteId,
          supervisorName: updatedEmployee?.supervisorName ?? data.supervisorName,
          companyAddress: updatedEmployee?.companyAddress ?? data.companyAddress,
          phone: updatedEmployee?.phone || data.phone,
          contactPhone: updatedEmployee?.contactPhone || data.contactPhone,
          telephone: (updatedEmployee as any)?.telephone || (data as any)?.telephone,
          residentialAddress: updatedEmployee?.residentialAddress || data.residentialAddress,
          address: updatedEmployee?.address || data.address,
          street: updatedEmployee?.street || data.street,
          barangay: updatedEmployee?.barangay || data.barangay,
          city: updatedEmployee?.city || data.city,
          province: updatedEmployee?.province || data.province,
          registrationLocation: updatedEmployee?.registrationLocation || data.registrationLocation,
          registrationAddress: updatedEmployee?.registrationAddress || data.registrationAddress,
          submittedDocuments: updatedEmployee?.submittedDocuments,
          documentsPassed: updatedEmployee?.documentsPassed,
          documentsStatus: updatedEmployee?.documentsStatus,
        });

        if (
          data.submittedDocuments !== undefined ||
          data.documentsPassed !== undefined ||
          data.documentsStatus !== undefined ||
          updatedEmployee?.submittedDocuments !== undefined
        ) {
          supabaseService.saveDocumentPassStatus(id, {
            allPassed: updatedEmployee?.documentsPassed ?? data.documentsPassed,
            documentsStatus: updatedEmployee?.documentsStatus ?? data.documentsStatus,
            submittedDocuments: updatedEmployee?.submittedDocuments ?? data.submittedDocuments,
          }).catch((err) => console.warn('AppContext saveDocumentPassStatus notice:', err));
        }
      } catch (dbErr) {
        console.error('Error saving employee update to Supabase:', dbErr);
        dbSuccess = false;
      }
    }

    // If location is cleared, remove personal geofence zone
    if ('registrationLocation' in data && !data.registrationLocation) {
      setGeofenceZones((prev) => {
        const filtered = prev.filter((z) => z.id !== `personal-${id}` && z.id !== id);
        saveToStorage(STORAGE_KEYS.GEOFENCE_ZONES, filtered);
        return filtered;
      });
      if (useSupabase) {
        supabaseService.deleteGeofenceZone(`personal-${id}`);
      }
    }

    // Ensure no personal geofence zones are created for trainees
    setGeofenceZones((prev) => {
      const filtered = prev.filter((z) => z.id !== `personal-${id}`);
      if (filtered.length !== prev.length) {
        saveToStorage(STORAGE_KEYS.GEOFENCE_ZONES, filtered);
        if (useSupabase) {
          supabaseService.deleteGeofenceZone(`personal-${id}`).catch(() => {});
        }
      }
      return filtered;
    });

    // AUTO-SYNC TRAINEE GEOFENCE ZONE WITH HTE WORKPLACE
    if (updatedEmployee && (data.companyName || data.hteId || data.companyAddress || data.registrationLocation)) {
      const isStudentRole = isTraineeRole(updatedEmployee);

      if (isStudentRole && updatedEmployee.companyName && !isInvalidHteCompany(updatedEmployee.companyName)) {
        const hteLoc = resolveHteLocation(updatedEmployee, hostSupervisors, employees, geofenceZones);

        if (hteLoc) {
          const customRadius =
            (data.registrationLocation as any)?.radius ||
            (data as any)?.registrationRadius ||
            (updatedEmployee.registrationLocation as any)?.radius ||
            (updatedEmployee as any)?.registrationRadius ||
            hteLoc.radius;
          const targetRadius = customRadius ? Math.max(20, Number(customRadius)) : hteLoc.radius;

          const targetLat = (data.registrationLocation as any)?.lat ?? updatedEmployee.registrationLocation?.lat ?? hteLoc.lat;
          const targetLng = (data.registrationLocation as any)?.lng ?? updatedEmployee.registrationLocation?.lng ?? hteLoc.lng;
          const targetAddress = (data as any)?.registrationAddress || (data.registrationLocation as any)?.address || updatedEmployee.registrationAddress || hteLoc.address;

          const stationZoneId = `station-${id}`;
          const stationZone: GeofenceZone = {
            id: stationZoneId,
            name: `${updatedEmployee.name} - Trainee Geofence (${hteLoc.companyName})`,
            address: targetAddress,
            lat: Number(targetLat),
            lng: Number(targetLng),
            radius: targetRadius,
            active: true,
            userType: 'trainee',
            academicYear: updatedEmployee.academicYear || settings?.activeAcademicYear,
            employeeId: id,
          };

          setGeofenceZones((prev) => {
            const exists = prev.some((z) => z.id === stationZoneId || (z as any).employeeId === id || (z as any).employee_id === id);
            const updated = exists
              ? prev.map((z) => (z.id === stationZoneId || (z as any).employeeId === id || (z as any).employee_id === id ? { ...z, ...stationZone } : z))
              : [...prev, stationZone];
            saveToStorage(STORAGE_KEYS.GEOFENCE_ZONES, updated);
            return updated;
          });

          if (useSupabase) {
            supabaseService
              .createGeofenceZone({
                ...stationZone,
                employeeId: id,
              })
              .catch((err) => {
                console.warn('[AppContext] Auto-sync trainee geofence zone notice:', err);
              });
          }
        }
      }
    }
    return dbSuccess;
  };

  const batchUpdateEmployees = async (ids: string[], data: Partial<Employee>): Promise<boolean> => {
    if (!ids || ids.length === 0) return true;
    const idSet = new Set(ids);

    // Auto-resolve HTE coordinates if HTE company or ID was specified
    if (data.companyName || data.hteId || data.companyAddress) {
      const sampleTrainee = employees.find((e) => idSet.has(e.id) || (e.employeeId && idSet.has(e.employeeId)));
      const candidateHte = {
        ...sampleTrainee,
        ...data,
      };
      if (candidateHte.companyName && !isInvalidHteCompany(candidateHte.companyName)) {
        const hteLoc = resolveHteLocation(candidateHte, hostSupervisors, employees, geofenceZones);
        if (hteLoc) {
          data.companyName = hteLoc.companyName || data.companyName;
          data.companyAddress = hteLoc.address;
          if (!data.supervisorName && (hteLoc as any).supervisorName) {
            data.supervisorName = (hteLoc as any).supervisorName;
          }
          if (!data.hteId && (hteLoc as any).id) {
            data.hteId = (hteLoc as any).id;
          }
          data.registrationLocation = {
            lat: Number(hteLoc.lat),
            lng: Number(hteLoc.lng),
            radius: hteLoc.radius,
            address: hteLoc.address,
          };
          data.registrationAddress = hteLoc.address;
          data.registrationRadius = hteLoc.radius;
        }
      }
    }

    let updatedTrainees: Employee[] = [];
    setEmployees((prev) => {
      const updatedList = prev.map((e) => {
        if (idSet.has(e.id) || idSet.has(e.employeeId)) {
          const next: any = {
            ...e,
            ...data,
            ...(data.companyName !== undefined ? { companyName: data.companyName } : {}),
            ...(data.hteId !== undefined ? { hteId: data.hteId } : {}),
            ...(data.supervisorName !== undefined ? { supervisorName: data.supervisorName } : {}),
            ...(data.companyAddress !== undefined ? { companyAddress: data.companyAddress } : {}),
            ...(data.registrationLocation !== undefined ? { registrationLocation: data.registrationLocation } : {}),
            ...(data.registrationAddress !== undefined ? { registrationAddress: data.registrationAddress } : {}),
            ...(data.registrationRadius !== undefined ? { registrationRadius: data.registrationRadius } : {}),
            ...(data.active !== undefined ? { active: data.active } : {}),
            ...(data.approvalStatus !== undefined ? { approvalStatus: data.approvalStatus } : {}),
            ...(data.applicationStatus !== undefined ? { applicationStatus: data.applicationStatus } : {}),
          };
          updatedTrainees.push(next);
          return next as Employee;
        }
        return e;
      });
      saveToStorage(STORAGE_KEYS.EMPLOYEES, updatedList);
      return updatedList;
    });

    // Auto-sync geofences for all updated trainees if workplace is provided
    if (data.companyName || data.hteId || data.registrationLocation) {
      const newZones: GeofenceZone[] = [];
      for (const trainee of updatedTrainees) {
        if (trainee.companyName && !isInvalidHteCompany(trainee.companyName)) {
          const hteLoc = resolveHteLocation(trainee, hostSupervisors, employees, geofenceZones);
          if (hteLoc) {
            const customRadius =
              (data.registrationLocation as any)?.radius ||
              (data as any)?.registrationRadius ||
              trainee.registrationLocation?.radius ||
              trainee.registrationRadius ||
              hteLoc.radius;
            const targetRadius = customRadius ? Math.max(20, Number(customRadius)) : hteLoc.radius;
            const targetLat = (data.registrationLocation as any)?.lat ?? trainee.registrationLocation?.lat ?? hteLoc.lat;
            const targetLng = (data.registrationLocation as any)?.lng ?? trainee.registrationLocation?.lng ?? hteLoc.lng;
            const targetAddress = (data as any)?.registrationAddress || trainee.registrationAddress || hteLoc.address;

            const stationZoneId = `station-${trainee.id}`;
            const zonePayload: GeofenceZone = {
              id: stationZoneId,
              name: `${trainee.name} - Trainee Geofence (${hteLoc.companyName})`,
              address: targetAddress,
              lat: Number(targetLat),
              lng: Number(targetLng),
              radius: targetRadius,
              active: true,
              userType: 'trainee',
              academicYear: trainee.academicYear || settings?.activeAcademicYear,
              employeeId: trainee.id,
            };
            newZones.push(zonePayload);

            if (useSupabase) {
              supabaseService.createGeofenceZone(zonePayload).catch(() => {});
            }
          }
        }
      }

      if (newZones.length > 0) {
        setGeofenceZones((prev) => {
          const zoneIdMap = new Set(newZones.map((z) => z.id));
          const empIdMap = new Set(newZones.map((z) => z.employeeId));
          const remaining = prev.filter((z) => !zoneIdMap.has(z.id) && !empIdMap.has((z as any).employeeId));
          const combined = [...remaining, ...newZones];
          saveToStorage(STORAGE_KEYS.GEOFENCE_ZONES, combined);
          return combined;
        });
      }
    }

    if (useSupabase) {
      return await supabaseService.batchUpdateEmployees(ids, data);
    }
    return true;
  };

  const updateHostSupervisor = (id: string, data: Partial<HostSupervisor>) => {
    const updatedHosts = hostSupervisors.map((h) => (h.id === id || h.employeeId === id ? { ...h, ...data } : h));
    setHostSupervisors(updatedHosts);
    saveToStorage(STORAGE_KEYS.HOST_SUPERVISORS, updatedHosts);

    const updatedHost = updatedHosts.find((h) => h.id === id || h.employeeId === id);
    if (
      updatedHost &&
      currentUser &&
      (currentUser.employeeId === id ||
        currentUser.id === id ||
        (currentUser.email && updatedHost.email && currentUser.email.toLowerCase() === updatedHost.email.toLowerCase()))
    ) {
      setCurrentUser((prev) => {
        if (!prev) return prev;
        const nextUser = {
          ...prev,
          name: updatedHost.name || prev.name,
          email: updatedHost.email || prev.email,
          photo: updatedHost.photo || prev.photo,
          companyName: updatedHost.companyName || prev.companyName,
          companyAddress: updatedHost.companyAddress || (prev as any).companyAddress,
          registrationLocation: (updatedHost as any).registrationLocation || (prev as any).registrationLocation,
        };
        saveToStorage(STORAGE_KEYS.CURRENT_USER, nextUser);
        saveToStorage(STORAGE_KEYS.USER, nextUser);
        if (nextUser.companyName) {
          localStorage.setItem('ojt_hte_company', nextUser.companyName);
        }
        return nextUser;
      });
    }

    if (data.companyName) {
      localStorage.setItem('ojt_hte_company', data.companyName);
      setEmployees((prev) =>
        prev.map((e) => {
          if (e.id === id || e.employeeId === id || e.hteId === id) {
            return {
              ...e,
              companyName: data.companyName!,
              ...(data.name ? { supervisorName: data.name } : {}),
            };
          }
          return e;
        })
      );
    }

    // If registrationLocation is provided, also sync geofenceZones state directly
    const regLoc = (data as any).registrationLocation;
    if (regLoc && regLoc.lat && regLoc.lng && updatedHost) {
      const zoneId = `station-${id}`;
      const targetName = `${updatedHost.name} - ${updatedHost.companyName || 'HTE Workplace'}`;
      const targetAddress = updatedHost.companyAddress || (updatedHost as any).registrationAddress || `${updatedHost.companyName} Workplace Premises`;
      const targetRadius = Math.max(20, Number(regLoc.radius || (data as any).registrationRadius || 40));

      setGeofenceZones((prev) => {
        const cleanRawId = id.replace(/^(station|personal|trainee|inst|hte)-/, '');
        const exists = prev.some(
          (z) => z.id === id || z.id === zoneId || z.employeeId === id || z.employeeId === cleanRawId ||
                 (z.name && updatedHost.companyName && z.name.toLowerCase().includes(updatedHost.companyName.toLowerCase()))
        );

        let updated: GeofenceZone[];
        if (exists) {
          updated = prev.map((z) => {
            if (
              z.id === id || z.id === zoneId || z.employeeId === id || z.employeeId === cleanRawId ||
              (z.name && updatedHost.companyName && z.name.toLowerCase().includes(updatedHost.companyName.toLowerCase()))
            ) {
              return {
                ...z,
                lat: Number(regLoc.lat),
                lng: Number(regLoc.lng),
                radius: targetRadius,
                address: targetAddress,
                name: targetName,
                employeeId: id,
                employee_id: id,
              };
            }
            return z;
          });
        } else {
          updated = [
            ...prev,
            {
              id: zoneId,
              name: targetName,
              address: targetAddress,
              lat: Number(regLoc.lat),
              lng: Number(regLoc.lng),
              radius: targetRadius,
              active: true,
              academicYear: updatedHost.academicYear || settings?.activeAcademicYear,
              employeeId: id,
              employee_id: id,
            },
          ];
        }
        saveToStorage(STORAGE_KEYS.GEOFENCE_ZONES, updated);
        return updated;
      });
    }

    if (useSupabase) {
      supabaseService.updateHostSupervisor(id, data).catch((err) => {
        console.warn('[AppContext] updateHostSupervisor notice:', err);
      });
    }
  };

  const deleteEmployee = (id: string) => {
    const targetEmp = employees.find((e) => e.id === id || e.employeeId === id);
    const targetHost = hostSupervisors.find((h) => h.id === id || h.employeeId === id);
    const targetEmail = targetEmp?.email || targetHost?.email;

    // Remove from in-memory state and localStorage
    const updatedEmployees = employees.filter((e) => e.id !== id && e.employeeId !== id);
    const updatedHosts = hostSupervisors.filter((h) => h.id !== id && h.employeeId !== id);
    setEmployees(updatedEmployees);
    setHostSupervisors(updatedHosts);
    if (!useSupabase) {
      saveToStorage(STORAGE_KEYS.EMPLOYEES, updatedEmployees);
      saveToStorage(STORAGE_KEYS.HOST_SUPERVISORS, updatedHosts);
    }

    // Erase credentials from storage
    if (targetEmail) {
      const normEmail = normalizeEmail(targetEmail);
      setPasswords((prev) => {
        const next = { ...prev };
        delete next[normEmail];
        delete next[targetEmail.toLowerCase()];
        if (!useSupabase) {
          saveToStorage(STORAGE_KEYS.PASSWORDS, next);
        }
        return next;
      });
    }

    // Force logout if deleted account is currently logged in
    if (
      currentUser &&
      (currentUser.id === id ||
        currentUser.employeeId === id ||
        (targetEmail && normalizeEmail(currentUser.email || '') === normalizeEmail(targetEmail)))
    ) {
      clearAuthStorage();
      setCurrentUser(null);
      if (useSupabase) {
        supabase.auth.signOut().catch(() => {});
      }
    }

    // Delete permanently from Supabase database
    if (useSupabase) {
      supabaseService.deleteEmployee(id);
      supabaseService.deleteHostSupervisor(id);
    }
  };

  const addTimeRecord = (record: Omit<TimeRecord, 'id'>): TimeRecord => {
    const recordWithAY = { ...record, academicYear: record.academicYear || settings.activeAcademicYear };
    const cleanRecordDate = (recordWithAY.date || getDTRSessionDate(new Date())).split('T')[0].split(' ')[0].trim();
    recordWithAY.date = cleanRecordDate;
    
    // Check if an existing record for this employee and date already exists to preserve permanent timestamps
    const empIdentifier = (recordWithAY.employeeId || '').trim();
    const emp = employees.find(
      (e) =>
        e.id === empIdentifier ||
        e.employeeId === empIdentifier ||
        (e.email && empIdentifier && normalizeEmail(e.email) === normalizeEmail(empIdentifier))
    );
    const validIds = new Set<string>();
    if (empIdentifier) {
      validIds.add(empIdentifier);
      validIds.add(empIdentifier.toLowerCase());
    }
    if (emp) {
      if (emp.id) { validIds.add(emp.id); validIds.add(emp.id.toLowerCase()); }
      if (emp.employeeId) { validIds.add(emp.employeeId); validIds.add(emp.employeeId.toLowerCase()); }
      if (emp.email) validIds.add(emp.email.toLowerCase());
    }
    const isTargetingCurrentUser = !!(currentUser && (
      (currentUser.id && (empIdentifier === currentUser.id || empIdentifier.toLowerCase() === currentUser.id.toLowerCase())) ||
      (currentUser.employeeId && (empIdentifier === currentUser.employeeId || empIdentifier.toLowerCase() === currentUser.employeeId.toLowerCase())) ||
      (currentUser.email && empIdentifier && currentUser.email.toLowerCase() === empIdentifier.toLowerCase())
    ));
    if (isTargetingCurrentUser && currentUser) {
      if (currentUser.id) { validIds.add(currentUser.id); validIds.add(currentUser.id.toLowerCase()); }
      if (currentUser.employeeId) { validIds.add(currentUser.employeeId); validIds.add(currentUser.employeeId.toLowerCase()); }
      if (currentUser.email) validIds.add(currentUser.email.toLowerCase());
    }

    // Ensure record has canonical UUID if known
    if (emp?.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(emp.id)) {
      recordWithAY.employeeId = emp.id;
    }

    const existing = timeRecords.find(
      (r) => {
        const rDate = (r.date || '').split('T')[0].split(' ')[0].trim();
        if (rDate !== cleanRecordDate) return false;
        const rEmpId = (r.employeeId || '').trim();
        return validIds.has(rEmpId) || validIds.has(rEmpId.toLowerCase());
      }
    );

    // Guard: Prevent Instructor / Admin from overriding trainee records
    const isInstructor = !!(currentUser && (currentUser.role === 'admin' || (currentUser.position && currentUser.position.toLowerCase().includes('instructor'))));
    if (isInstructor && !isTargetingCurrentUser && existing) {
      console.warn('[AppContext] Prevented override of existing trainee time record from Instructor account:', existing.id);
      return existing;
    }

    if (existing) {
      // If an existing record exists, keep permanent timeIn and merge punches across AM/PM shifts
      const updated: TimeRecord = {
        ...existing,
        ...recordWithAY,
        timeIn: existing.timeIn || recordWithAY.timeIn,
        timeOut: recordWithAY.timeOut || existing.timeOut,
        amArrival: recordWithAY.amArrival || existing.amArrival,
        amDeparture: recordWithAY.amDeparture || existing.amDeparture,
        pmArrival: recordWithAY.pmArrival || existing.pmArrival,
        pmDeparture: recordWithAY.pmDeparture || existing.pmDeparture,
        amArrivalFaceVerified: recordWithAY.amArrivalFaceVerified ?? existing.amArrivalFaceVerified,
        amDepartureFaceVerified: recordWithAY.amDepartureFaceVerified ?? existing.amDepartureFaceVerified,
        pmArrivalFaceVerified: recordWithAY.pmArrivalFaceVerified ?? existing.pmArrivalFaceVerified,
        pmDepartureFaceVerified: recordWithAY.pmDepartureFaceVerified ?? existing.pmDepartureFaceVerified,
        amArrivalGeofenced: recordWithAY.amArrivalGeofenced ?? existing.amArrivalGeofenced,
        amDepartureGeofenced: recordWithAY.amDepartureGeofenced ?? existing.amDepartureGeofenced,
        pmArrivalGeofenced: recordWithAY.pmArrivalGeofenced ?? existing.pmArrivalGeofenced,
        pmDepartureGeofenced: recordWithAY.pmDepartureGeofenced ?? existing.pmDepartureGeofenced,
        timeInFaceVerified: existing.timeInFaceVerified || recordWithAY.timeInFaceVerified,
        timeInGeofenced: existing.timeInGeofenced || recordWithAY.timeInGeofenced,
        timeInPhoto: existing.timeInPhoto || recordWithAY.timeInPhoto,
        academicYear: existing.academicYear || recordWithAY.academicYear,
      };
      updateTimeRecord(existing.id, updated);
      return updated;
    }

    const newRecord: TimeRecord = { ...recordWithAY, id: `rec-${Date.now()}` };

    // Synchronously place newRecord into local state and storage so UI and subsequent calls have it immediately
    setTimeRecords((prev) => {
      const updated = [newRecord, ...prev.filter((r) => r.id !== newRecord.id)];
      saveToStorage(STORAGE_KEYS.TIME_RECORDS, updated);
      return updated;
    });

    if (useSupabase) {
      supabaseService
        .createTimeRecord(recordWithAY)
        .then((created) => {
          if (created) {
            // Replace temporary local record with database UUID record while keeping all slot timestamps intact
            setTimeRecords((prev) => {
              const mergedCreated: TimeRecord = {
                ...newRecord,
                ...created,
                amArrival: created.amArrival || newRecord.amArrival,
                amDeparture: created.amDeparture || newRecord.amDeparture,
                pmArrival: created.pmArrival || newRecord.pmArrival,
                pmDeparture: created.pmDeparture || newRecord.pmDeparture,
                amArrivalFaceVerified: created.amArrivalFaceVerified ?? newRecord.amArrivalFaceVerified,
                amDepartureFaceVerified: created.amDepartureFaceVerified ?? newRecord.amDepartureFaceVerified,
                pmArrivalFaceVerified: created.pmArrivalFaceVerified ?? newRecord.pmArrivalFaceVerified,
                pmDepartureFaceVerified: created.pmDepartureFaceVerified ?? newRecord.pmDepartureFaceVerified,
                amArrivalGeofenced: created.amArrivalGeofenced ?? newRecord.amArrivalGeofenced,
                amDepartureGeofenced: created.amDepartureGeofenced ?? newRecord.amDepartureGeofenced,
                pmArrivalGeofenced: created.pmArrivalGeofenced ?? newRecord.pmArrivalGeofenced,
                pmDepartureGeofenced: created.pmDepartureGeofenced ?? newRecord.pmDepartureGeofenced,
              };
              const updated = [mergedCreated, ...prev.filter((r) => r.id !== newRecord.id && r.id !== created.id)];
              saveToStorage(STORAGE_KEYS.TIME_RECORDS, updated);
              return updated;
            });
          }
        })
        .catch((err) => {
          console.warn('[AppContext] Supabase createTimeRecord notice:', err);
        });
    }

    return newRecord;
  };

  const updateTimeRecord = (id: string, data: Partial<TimeRecord>) => {
    // Look up existing record to enrich employeeId and date if missing in partial updates
    const existing = timeRecords.find((r) => r.id === id);

    // Safety guard: If an Instructor is logged in, do not allow overriding biometric punch times or hours of a trainee
    const isInstructor = !!(currentUser && (currentUser.role === 'admin' || (currentUser.position && currentUser.position.toLowerCase().includes('instructor'))));
    if (isInstructor && existing) {
      const isTargetingSelf = (currentUser.id && (existing.employeeId === currentUser.id || existing.employeeId.toLowerCase() === currentUser.id.toLowerCase())) ||
        (currentUser.employeeId && (existing.employeeId === currentUser.employeeId || existing.employeeId.toLowerCase() === currentUser.employeeId.toLowerCase())) ||
        (currentUser.email && existing.employeeId && currentUser.email.toLowerCase() === existing.employeeId.toLowerCase());
      if (!isTargetingSelf) {
        const forbiddenKeys = ['amArrival', 'amDeparture', 'pmArrival', 'pmDeparture', 'timeIn', 'timeOut', 'totalHours', 'hours', 'date', 'employeeId'];
        const hasForbidden = forbiddenKeys.some((k) => k in data);
        if (hasForbidden) {
          console.warn('[AppContext] Trainee time record punch hours/times cannot be overridden in Instructor account:', id);
          const safeData: Partial<TimeRecord> = { ...data };
          forbiddenKeys.forEach((k) => delete (safeData as any)[k]);
          data = safeData;
        }
      }
    }

    const enrichedEmpId = data.employeeId || existing?.employeeId;
    const matchedCanonicalEmp = employees.find(
      (e) =>
        e.id === enrichedEmpId ||
        e.employeeId === enrichedEmpId ||
        (e.email && enrichedEmpId && normalizeEmail(e.email) === normalizeEmail(enrichedEmpId))
    );
    const finalEmpId = (matchedCanonicalEmp?.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(matchedCanonicalEmp.id))
      ? matchedCanonicalEmp.id
      : enrichedEmpId;

    const enrichedData = {
      ...(existing ? { employeeId: existing.employeeId, date: existing.date } : {}),
      ...data,
      ...(finalEmpId ? { employeeId: finalEmpId } : {}),
    };

    setTimeRecords((prev) => {
      const updated = prev.map((r) => {
        if (r.id === id) {
          const next = { ...r, ...enrichedData };
          if ('timeInPhoto' in data && !data.timeInPhoto) {
            delete (next as any).timeInPhoto;
          }
          if ('timeOutPhoto' in data && !data.timeOutPhoto) {
            delete (next as any).timeOutPhoto;
          }
          return next;
        }
        return r;
      });
      saveToStorage(STORAGE_KEYS.TIME_RECORDS, updated);
      return updated;
    });

    if (useSupabase) {
      const targetId = existing?.id || id;
      supabaseService.updateTimeRecord(targetId, enrichedData).catch((err) => {
        console.error('[AppContext] Failed to update time record in Supabase:', err);
      });
    }
  };

  const approveTimeRecord = (id: string, approvedBy?: string) => {
    const previous = timeRecords.find((r) => r.id === id);
    const now = new Date().toISOString();
    const update: Partial<TimeRecord> = {
      employeeId: previous?.employeeId,
      date: previous?.date,
      approvalStatus: 'approved',
      approvedBy: approvedBy || 'Instructor',
      approvedAt: now,
      approvalNote: '',
    };
    setTimeRecords((prev) => {
      const updated = prev.map((r) => (r.id === id ? { ...r, ...update } : r));
      saveToStorage(STORAGE_KEYS.TIME_RECORDS, updated);
      return updated;
    });
    if (useSupabase) {
      supabaseService.updateTimeRecord(id, update).catch((err) => {
        console.warn('[AppContext] Supabase approve sync notice:', err);
      });
    }
  };

  const disapproveTimeRecord = (id: string, note?: string) => {
    const previous = timeRecords.find((r) => r.id === id);
    const now = new Date().toISOString();
    const update: Partial<TimeRecord> = {
      employeeId: previous?.employeeId,
      date: previous?.date,
      approvalStatus: 'disapproved',
      approvalNote: note || '',
      approvedAt: now,
    };
    setTimeRecords((prev) => {
      const updated = prev.map((r) => (r.id === id ? { ...r, ...update } : r));
      saveToStorage(STORAGE_KEYS.TIME_RECORDS, updated);
      return updated;
    });
    if (useSupabase) {
      supabaseService.updateTimeRecord(id, update).catch((err) => {
        console.warn('[AppContext] Supabase disapprove sync notice:', err);
      });
    }
  };


  const getTodayRecord = (empIdentifier: string): TimeRecord | null => {
    if (!empIdentifier) return null;
    const rawToday = getDTRSessionDate(new Date());
    const today = rawToday.split('T')[0].split(' ')[0].trim();
    const cleanEmpId = (empIdentifier || '').trim();

    // Find associated employee to resolve all possible IDs
    const emp = employees.find(
      (e) =>
        e.id === cleanEmpId ||
        e.employeeId === cleanEmpId ||
        (e.email && cleanEmpId && normalizeEmail(e.email) === normalizeEmail(cleanEmpId))
    );

    const validIds = new Set<string>();
    validIds.add(cleanEmpId);
    validIds.add(cleanEmpId.toLowerCase());
    if (emp) {
      if (emp.id) { validIds.add(emp.id); validIds.add(emp.id.toLowerCase()); }
      if (emp.employeeId) { validIds.add(emp.employeeId); validIds.add(emp.employeeId.toLowerCase()); }
      if (emp.email) validIds.add(emp.email.toLowerCase());
    }
    const isTargetingCurrentUser = !!(currentUser && (
      (currentUser.id && (cleanEmpId === currentUser.id || cleanEmpId.toLowerCase() === currentUser.id.toLowerCase())) ||
      (currentUser.employeeId && (cleanEmpId === currentUser.employeeId || cleanEmpId.toLowerCase() === currentUser.employeeId.toLowerCase())) ||
      (currentUser.email && cleanEmpId && currentUser.email.toLowerCase() === cleanEmpId.toLowerCase())
    ));
    if (isTargetingCurrentUser && currentUser) {
      if (currentUser.id) { validIds.add(currentUser.id); validIds.add(currentUser.id.toLowerCase()); }
      if (currentUser.employeeId) { validIds.add(currentUser.employeeId); validIds.add(currentUser.employeeId.toLowerCase()); }
      if (currentUser.email) validIds.add(currentUser.email.toLowerCase());
    }

    const todayRecords = timeRecords.filter((r) => {
      const rDate = (r.date || '').split('T')[0].split(' ')[0].trim();
      if (rDate !== today) return false;
      const rEmpId = (r.employeeId || '').trim();
      if (validIds.has(rEmpId) || validIds.has(rEmpId.toLowerCase())) return true;
      return false;
    });

    // Merge all records of today into a unified record so morning & afternoon punches are unified
    let baseRecord: TimeRecord | null = null;
    if (todayRecords.length > 0) {
      baseRecord = {
        ...todayRecords.sort((a, b) => {
          const aComplete = a.timeIn && a.timeOut ? 2 : a.timeIn ? 1 : 0;
          const bComplete = b.timeIn && b.timeOut ? 2 : b.timeIn ? 1 : 0;
          if (bComplete !== aComplete) return bComplete - aComplete;
          return (b.id || '').localeCompare(a.id || '');
        })[0]
      };

      for (const r of todayRecords) {
        if (!baseRecord.amArrival && r.amArrival) baseRecord.amArrival = r.amArrival;
        if (!baseRecord.amDeparture && r.amDeparture) baseRecord.amDeparture = r.amDeparture;
        if (!baseRecord.pmArrival && r.pmArrival) baseRecord.pmArrival = r.pmArrival;
        if (!baseRecord.pmDeparture && r.pmDeparture) baseRecord.pmDeparture = r.pmDeparture;
        if (!baseRecord.timeIn && r.timeIn) baseRecord.timeIn = r.timeIn;
        if (!baseRecord.timeOut && r.timeOut) baseRecord.timeOut = r.timeOut;
        if (r.amArrivalFaceVerified) baseRecord.amArrivalFaceVerified = true;
        if (r.amDepartureFaceVerified) baseRecord.amDepartureFaceVerified = true;
        if (r.pmArrivalFaceVerified) baseRecord.pmArrivalFaceVerified = true;
        if (r.pmDepartureFaceVerified) baseRecord.pmDepartureFaceVerified = true;
        if (r.amArrivalGeofenced) baseRecord.amArrivalGeofenced = true;
        if (r.amDepartureGeofenced) baseRecord.amDepartureGeofenced = true;
        if (r.pmArrivalGeofenced) baseRecord.pmArrivalGeofenced = true;
        if (r.pmDepartureGeofenced) baseRecord.pmDepartureGeofenced = true;
      }
    }

    // Check localStorage fast punch cache for any immediate local punch
    if (typeof window !== 'undefined') {
      try {
        const cacheKeys = [
          `ojt_today_punch_${cleanEmpId}_${today}`,
          emp?.employeeId ? `ojt_today_punch_${emp.employeeId}_${today}` : null,
          emp?.id ? `ojt_today_punch_${emp.id}_${today}` : null,
          currentUser?.employeeId ? `ojt_today_punch_${currentUser.employeeId}_${today}` : null,
          currentUser?.id ? `ojt_today_punch_${currentUser.id}_${today}` : null,
        ].filter(Boolean) as string[];

        for (const key of cacheKeys) {
          const cachedRaw = localStorage.getItem(key);
          if (cachedRaw) {
            const cached = JSON.parse(cachedRaw);
            if (!baseRecord) {
              baseRecord = {
                id: `local-${cleanEmpId}-${today}`,
                employeeId: cleanEmpId,
                date: today,
                status: 'present',
                ...cached,
              };
            } else {
              if (!baseRecord.amArrival && cached.amArrival) baseRecord.amArrival = cached.amArrival;
              if (!baseRecord.amDeparture && cached.amDeparture) baseRecord.amDeparture = cached.amDeparture;
              if (!baseRecord.pmArrival && cached.pmArrival) baseRecord.pmArrival = cached.pmArrival;
              if (!baseRecord.pmDeparture && cached.pmDeparture) baseRecord.pmDeparture = cached.pmDeparture;
              if (!baseRecord.timeIn && cached.timeIn) baseRecord.timeIn = cached.timeIn;
              if (!baseRecord.timeOut && cached.timeOut) baseRecord.timeOut = cached.timeOut;
            }
            break;
          }
        }
      } catch {}
    }

    // Auto-infer slots if record has timeIn or timeOut but slots are missing
    if (baseRecord) {
      if (!baseRecord.amArrival && !baseRecord.pmArrival && baseRecord.timeIn) {
        const match = baseRecord.timeIn.match(/^(\d{1,2}):(\d{2})/);
        if (match) {
          const h = parseInt(match[1], 10);
          const isPm = /pm/i.test(baseRecord.timeIn) || (h >= 12 && !/am/i.test(baseRecord.timeIn));
          if (isPm) {
            baseRecord.pmArrival = baseRecord.timeIn;
          } else {
            baseRecord.amArrival = baseRecord.timeIn;
          }
        }
      }
      if (!baseRecord.amDeparture && !baseRecord.pmDeparture && baseRecord.timeOut) {
        const match = baseRecord.timeOut.match(/^(\d{1,2}):(\d{2})/);
        if (match) {
          let h = parseInt(match[1], 10);
          if (/pm/i.test(baseRecord.timeOut) && h !== 12) h += 12;
          if (h < 13 && !baseRecord.amDeparture && baseRecord.amArrival) {
            baseRecord.amDeparture = baseRecord.timeOut;
          } else {
            baseRecord.pmDeparture = baseRecord.timeOut;
          }
        }
      }
    }

    return baseRecord;
  };

  const getEmployeeRecords = (empIdentifier: string): TimeRecord[] => {
    if (!empIdentifier) return [];
    const cleanEmpId = (empIdentifier || '').trim();
    const emp = employees.find(
      (e) =>
        e.id === cleanEmpId ||
        e.employeeId === cleanEmpId ||
        (e.email && cleanEmpId && normalizeEmail(e.email) === normalizeEmail(cleanEmpId))
    );

    const validIds = new Set<string>();
    validIds.add(cleanEmpId);
    validIds.add(cleanEmpId.toLowerCase());
    if (emp) {
      if (emp.id) { validIds.add(emp.id); validIds.add(emp.id.toLowerCase()); }
      if (emp.employeeId) { validIds.add(emp.employeeId); validIds.add(emp.employeeId.toLowerCase()); }
      if (emp.email) validIds.add(emp.email.toLowerCase());
    }
    const isTargetingUserInRecords = !!(currentUser && (
      (currentUser.id && (cleanEmpId === currentUser.id || cleanEmpId.toLowerCase() === currentUser.id.toLowerCase())) ||
      (currentUser.employeeId && (cleanEmpId === currentUser.employeeId || cleanEmpId.toLowerCase() === currentUser.employeeId.toLowerCase())) ||
      (currentUser.email && cleanEmpId && currentUser.email.toLowerCase() === cleanEmpId.toLowerCase())
    ));
    if (isTargetingUserInRecords && currentUser) {
      if (currentUser.id) { validIds.add(currentUser.id); validIds.add(currentUser.id.toLowerCase()); }
      if (currentUser.employeeId) { validIds.add(currentUser.employeeId); validIds.add(currentUser.employeeId.toLowerCase()); }
      if (currentUser.email) validIds.add(currentUser.email.toLowerCase());
    }

    return timeRecords
      .filter((r) => {
        const rEmpId = (r.employeeId || '').trim();
        return validIds.has(rEmpId) || validIds.has(rEmpId.toLowerCase());
      })
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  };

  const updateGeofenceZones = (zones: GeofenceZone[]) => {
    const sanitized = sanitizeGeofenceZones(zones);
    setGeofenceZones(sanitized);
  };

  const addGeofenceZone = (zone: Omit<GeofenceZone, 'id'> & { id?: string }) => {
    const zoneWithAY = { ...zone, academicYear: (zone as any).academicYear || settings.activeAcademicYear };
    const tempId = zone.id || `zone-${Date.now()}`;
    const newZone = sanitizeGeofenceZone({ ...zoneWithAY, id: tempId });
    if (!newZone) return;

    setGeofenceZones((prev) => {
      const updated = [
        ...prev.filter(
          (z) =>
            z.id !== newZone.id &&
            z.id !== `station-${newZone.id}` &&
            z.id !== `trainee-${newZone.id}` &&
            (!newZone.employeeId || ((z as any).employeeId !== newZone.employeeId && (z as any).employee_id !== newZone.employeeId))
        ),
        newZone,
      ];
      saveToStorage(STORAGE_KEYS.GEOFENCE_ZONES, updated);
      return updated;
    });

    if (useSupabase) {
      supabaseService
        .createGeofenceZone({ ...zoneWithAY, id: newZone.id })
        .then((created) => {
          const sanitizedCreated = sanitizeGeofenceZone(created || newZone);
          if (sanitizedCreated) {
            setGeofenceZones((prev) => {
              const updated = [
                ...prev.filter(
                  (z) =>
                    z.id !== tempId &&
                    z.id !== sanitizedCreated.id &&
                    z.id !== `station-${tempId}` &&
                    (!sanitizedCreated.employeeId || ((z as any).employeeId !== sanitizedCreated.employeeId && (z as any).employee_id !== sanitizedCreated.employeeId))
                ),
                sanitizedCreated,
              ];
              saveToStorage(STORAGE_KEYS.GEOFENCE_ZONES, updated);
              return updated;
            });
          }
        })
        .catch((err) => {
          console.warn('[AppContext] Failed to create geofence zone in Supabase, saved locally:', err);
          // Never pop up a blocking browser alert during registration or background operations
        });
    }
  };

  const updateGeofenceZone = (id: string, data: Partial<GeofenceZone>) => {
    const previous = geofenceZones.find((z) => z.id === id);
    setGeofenceZones((prev) => {
      const next = prev.map((z) => {
        if (z.id !== id) return z;
        const merged = sanitizeGeofenceZone({ ...z, ...data });
        return merged || z;
      });
      saveToStorage(STORAGE_KEYS.GEOFENCE_ZONES, next);
      return next;
    });

    if (useSupabase) {
      supabaseService.updateGeofenceZone(id, data).catch((err) => {
        console.error('[AppContext] Failed to update geofence zone in Supabase:', err);
        if (previous) {
          setGeofenceZones((prev) => {
            const restored = prev.map((z) => (z.id === id ? previous : z));
            saveToStorage(STORAGE_KEYS.GEOFENCE_ZONES, restored);
            return restored;
          });
        }
        toast.error('Could not sync geofence zone update to cloud. Changes rolled back.');
      });
    }
  };

  const deleteGeofenceZone = (id: string) => {
    const previousZones = geofenceZones;
    // 1. Remove from local geofenceZones state and storage
    setGeofenceZones((prev) => {
      const filtered = prev.filter((z) => z.id !== id && z.id !== `personal-${id}`);
      saveToStorage(STORAGE_KEYS.GEOFENCE_ZONES, filtered);
      return filtered;
    });

    // 2. Identify associated employee and clear their registration coordinates
    let matchedEmpId = id.startsWith('personal-') ? id.replace('personal-', '') : id;
    const targetZone = geofenceZones.find((z) => z.id === id);
    if (targetZone) {
      const personPrefix = targetZone.name?.includes(' - ')
        ? targetZone.name.split(' - ')[0].trim().toLowerCase()
        : targetZone.name.toLowerCase();
      const matchedEmp = employees.find(
        (e) => e.id === matchedEmpId || (e.name && e.name.toLowerCase() === personPrefix)
      );
      if (matchedEmp) {
        matchedEmpId = matchedEmp.id;
      }
    }

    const empToUpdate = employees.find((e) => e.id === matchedEmpId || e.id === id || `personal-${e.id}` === id);
    if (empToUpdate) {
      updateEmployee(empToUpdate.id, {
        registrationLocation: null as any,
        registrationAddress: null as any,
      });
    }

    // 3. Always delete from Supabase database
    if (useSupabase) {
      supabaseService.deleteGeofenceZone(id).catch((err) => {
        console.error('[AppContext] Failed to delete geofence zone in Supabase:', err);
        setGeofenceZones(previousZones);
        saveToStorage(STORAGE_KEYS.GEOFENCE_ZONES, previousZones);
        toast.error('Failed to delete geofence zone from cloud. Item has been restored.');
      });
      if (matchedEmpId && matchedEmpId !== id) {
        supabaseService.deleteGeofenceZone(matchedEmpId).catch(() => {});
      }
    }
  };

  const updateSettings = (newSettings: Partial<AppSettings>) => {
    const previous = settings;
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    saveToStorage(STORAGE_KEYS.SETTINGS, updated);

    if (useSupabase) {
      supabaseService.updateSettings(updated).catch((err) => {
        console.error('[AppContext] Failed to update settings in Supabase:', err);
        setSettings(previous);
        saveToStorage(STORAGE_KEYS.SETTINGS, previous);
        toast.error('Failed to save settings to cloud. Changes have been rolled back.');
      });
    }
  };

  const getCurrentEmployee = (): Employee | null => {
    if (!currentUser) return null;
    let employee = employees.find(
      (e) =>
        e.id === currentUser.employeeId ||
        e.id === currentUser.id ||
        (e.employeeId && (e.employeeId === currentUser.employeeId || e.employeeId === currentUser.id)) ||
        (currentUser.email && e.email ? normalizeEmail(e.email) === normalizeEmail(currentUser.email) : false)
    );

    if (employee) {
      if (!employee.photo && currentUser.photo) {
        employee = { ...employee, photo: currentUser.photo };
      }
      return employee;
    }

    // Check host supervisors if current user is an HTE supervisor
    const host = hostSupervisors.find(
      (h) =>
        h.id === currentUser.id ||
        (h.employeeId && (h.employeeId === currentUser.employeeId || h.employeeId === currentUser.id)) ||
        (currentUser.email && h.email ? normalizeEmail(h.email) === normalizeEmail(currentUser.email) : false)
    );

    if (host) {
      const fallbackHostPhoto = host.photo || currentUser.photo || (employees.find(e => e.email && normalizeEmail(e.email) === normalizeEmail(currentUser.email))?.photo) || '';
      const hostEmp: Employee = {
        id: host.id,
        employeeId: host.employeeId || host.id,
        name: host.name,
        email: host.email,
        department: 'Host Training Establishment',
        position: 'HTE Representative',
        companyName: host.companyName || 'Host Training Establishment',
        companyAddress: host.companyAddress || '',
        supervisorName: host.contactPerson || host.name,
        schoolName: 'Carlos Hilado Memorial State University',
        campus: 'Talisay Campus',
        course: 'N/A',
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
        requiredHours: 0,
        photo: fallbackHostPhoto,
        faceRegistered: host.faceRegistered ?? false,
        registrationLocation: host.registrationLocation,
        registrationAddress: host.registrationAddress || host.companyAddress,
        active: host.active ?? true,
        academicYear: host.academicYear || settings.activeAcademicYear,
        approvalStatus: 'approved',
        createdAt: host.createdAt || new Date().toISOString().split('T')[0],
      };
      return hostEmp;
    }

    if (currentUser.id === 'admin' || currentUser.role === 'admin') {
      const fallbackAdminPhoto = currentUser.photo || (employees.find(e => e.email && normalizeEmail(e.email) === normalizeEmail(currentUser.email))?.photo) || '';
      const adminEmp: Employee = {
        id: currentUser.id,
        employeeId: currentUser.employeeId || 'ADM-2026-001',
        name: currentUser.name || 'OJT Instructor',
        email: currentUser.email || 'admin@ojt.com',
        department: 'College of Computer Studies',
        position: 'OJT Instructor',
        companyName: 'Carlos Hilado Memorial State University',
        supervisorName: 'Administrator',
        schoolName: 'Carlos Hilado Memorial State University',
        campus: 'Talisay Campus',
        course: 'Information Systems',
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
        requiredHours: 0,
        photo: fallbackAdminPhoto,
        faceRegistered: false,
        active: true,
        academicYear: settings.activeAcademicYear,
        approvalStatus: 'approved',
        createdAt: new Date().toISOString().split('T')[0],
      };
      return adminEmp;
    }

    return null;
  };

  // ─── Evaluations ─────────────────────────────────────────────────────────────
  const addEvaluation = (data: Omit<Evaluation, 'id'>): Evaluation => {
    const tempId = `eval-${Date.now()}`;
    const newEval: Evaluation = { ...data, id: tempId };

    setEvaluations((prev) => {
      const existingIdx = prev.findIndex(
        (e) => (data.employeeId && e.employeeId === data.employeeId) || e.id === tempId
      );
      let updated: Evaluation[];
      if (existingIdx >= 0) {
        updated = prev.map((e, idx) => (idx === existingIdx ? { ...e, ...data } : e));
      } else {
        updated = [newEval, ...prev];
      }
      saveToStorage(STORAGE_KEYS.EVALUATIONS, updated);
      return updated;
    });

    if (useSupabase) {
      supabaseService
        .createEvaluation(data)
        .then((created) => {
          if (created) {
            setEvaluations((prev) => {
              const updated = [created, ...prev.filter((e) => e.id !== tempId && e.id !== created.id && (data.employeeId ? e.employeeId !== data.employeeId : true))];
              saveToStorage(STORAGE_KEYS.EVALUATIONS, updated);
              return updated;
            });
          }
        })
        .catch((err) => {
          console.error('[AppContext] Failed to save evaluation to Supabase:', err);
          // Preserve local storage so user responses are NEVER lost!
          toast.error('Cloud synchronization delayed: responses are saved locally on your device.');
        });
    }

    return newEval;
  };

  const updateEvaluation = (id: string, data: Partial<Evaluation>) => {
    const previous = evaluations.find((e) => e.id === id || (data.employeeId && e.employeeId === data.employeeId));
    const targetId = previous ? previous.id : id;

    setEvaluations((prev) => {
      const updated = prev.map((e) => (e.id === targetId || (data.employeeId && e.employeeId === data.employeeId) ? { ...e, ...data } : e));
      saveToStorage(STORAGE_KEYS.EVALUATIONS, updated);
      return updated;
    });

    if (useSupabase) {
      const resolvedEmployeeId = data.employeeId || previous?.employeeId;
      supabaseService.updateEvaluation(targetId, { ...data, employeeId: resolvedEmployeeId }).catch((err) => {
        console.error('[AppContext] Failed to update evaluation in Supabase:', err);
        // Preserve local state so responses are NEVER lost!
        toast.error('Cloud synchronization delayed: changes are saved locally on your device.');
      });
    }
  };

  const deleteEvaluation = (id: string) => {
    const previous = evaluations.find((e) => e.id === id);
    setEvaluations((prev) => {
      const updated = prev.filter((e) => e.id !== id);
      saveToStorage(STORAGE_KEYS.EVALUATIONS, updated);
      return updated;
    });

    if (useSupabase) {
      supabaseService.deleteEvaluation(id).catch((err) => {
        console.error('[AppContext] Failed to delete evaluation in Supabase:', err);
        if (previous) {
          setEvaluations((prev) => {
            const rolledBack = [previous, ...prev];
            saveToStorage(STORAGE_KEYS.EVALUATIONS, rolledBack);
            return rolledBack;
          });
        }
        toast.error('Failed to delete evaluation from cloud. Item has been restored.');
      });
    }
  };

  const getEmployeeEvaluation = (employeeId: string): Evaluation | null => {
    return evaluations.find((e) => e.employeeId === employeeId) || null;
  };

  // ─── Announcements ────────────────────────────────────────────────────────────
  // FIXED: now catches Supabase insert failures instead of silently swallowing them.
  // If the DB write fails, the optimistic local entry is rolled back so the UI
  // never shows an announcement that doesn't actually exist in the database.
  const addAnnouncement = (data: Omit<Announcement, 'id'>): Announcement => {
    const dataWithAY = { ...data, academicYear: data.academicYear || settings.activeAcademicYear };
    const newAnn: Announcement = { ...dataWithAY, id: `ann-${Date.now()}` };

    // Optimistically show it right away for a snappy UI
    setAnnouncements((prev) => [newAnn, ...prev]);

    if (useSupabase) {
      supabaseService
        .createAnnouncement(dataWithAY)
        .then((created) => {
          if (created) {
            // Swap the optimistic local copy for the real DB row (real id, timestamps, etc.)
            setAnnouncements((prev) => prev.map((a) => (a.id === newAnn.id ? created : a)));

            // Background Fire-and-Forget Email Notification
            (async () => {
              try {
                const target = created.targetRole || 'all';
                const recipientEmails = employees
                  .filter((emp) => {
                    if (!emp.email || !emp.email.includes('@')) return false;
                    if (target === 'all') return true;
                    const isInst = emp.position === 'OJT Instructor' || emp.role === 'admin';
                    const isHte = emp.position === 'HTE Representative' || emp.role === 'host' || emp.role === 'hte';
                    const isTrainee = !isInst && !isHte;
                    if (target === 'employee') return isTrainee;
                    if (target === 'hte' || target === 'host') return isHte;
                    if (target === 'admin') return isInst;
                    return false;
                  })
                  .map((emp) => emp.email.trim().toLowerCase());

                const uniqueEmails = Array.from(new Set(recipientEmails));
                if (uniqueEmails.length === 0) return;

                const appUrl = typeof window !== 'undefined' ? window.location.origin : '';
                const snippet = created.content.length > 180
                  ? `${created.content.slice(0, 180)}...`
                  : created.content;

                const emailHtml = `
                  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1e293b; line-height: 1.6;">
                    <div style="background: #2563eb; padding: 18px 24px; border-radius: 12px 12px 0 0; color: white;">
                      <h2 style="margin: 0; font-size: 20px;">New System Announcement</h2>
                      <p style="margin: 4px 0 0; font-size: 13px; opacity: 0.9;">OJT Management System</p>
                    </div>
                    <div style="border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px; padding: 24px; background: #ffffff;">
                      <h3 style="margin-top: 0; color: #0f172a; font-size: 18px;">${created.title}</h3>
                      <p style="color: #475569; font-size: 15px; margin-bottom: 24px;">${snippet}</p>
                      ${appUrl ? `<a href="${appUrl}" style="display: inline-block; background: #2563eb; color: #ffffff; text-decoration: none; padding: 10px 20px; border-radius: 8px; font-weight: bold; font-size: 14px;">View Announcement in App &rarr;</a>` : ''}
                      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0 16px;" />
                      <p style="font-size: 12px; color: #94a3b8; margin: 0;">This is an automated notification. Please do not reply directly to this email.</p>
                    </div>
                  </div>
                `;

                await sendAnnouncementNotificationEmail(uniqueEmails, created.title, emailHtml);
              } catch (emailErr) {
                // Silent fail for non-critical background email notifications
              }
            })();
          }
        })
        .catch((err) => {
          console.error('Failed to save announcement to Supabase:', err);
          // Roll back the optimistic entry — don't let the UI show something that
          // isn't actually saved, since it would vanish on next reload anyway.
          setAnnouncements((prev) => prev.filter((a) => a.id !== newAnn.id));
          if (typeof window !== 'undefined') {
            toast.error('Could not save this announcement to the database. Please check your connection and try again.');
          }
        });
    }
    // If not using Supabase, it only ever lives in localStorage — by design.

    return newAnn;
  };

  const updateAnnouncement = (id: string, data: Partial<Announcement>) => {
    setAnnouncements((prev) => prev.map((a) => (a.id === id ? { ...a, ...data } : a)));

    if (useSupabase) {
      supabaseService.updateAnnouncement(id, data);
    }
  };

  const deleteAnnouncement = (id: string) => {
    setAnnouncements((prev) => prev.filter((a) => a.id !== id));

    if (useSupabase) {
      supabaseService.deleteAnnouncement(id);
    }
  };

  const getActiveAnnouncements = (role?: 'employee' | 'admin' | 'hte' | 'host'): Announcement[] => {
    const now = new Date();
    const matchesAudience = (announcementRole: Announcement['targetRole'], requestedRole?: typeof role) => {
      if (!requestedRole) return true;
      if (announcementRole === 'all') return true;
      if (requestedRole === 'admin') return ['admin', 'employee'].includes(announcementRole);
      if (requestedRole === 'employee') return ['employee', 'admin'].includes(announcementRole);
      if (requestedRole === 'hte') return ['hte', 'host'].includes(announcementRole);
      if (requestedRole === 'host') return ['host', 'hte'].includes(announcementRole);
      return false;
    };

    return announcements
      .filter((a) => {
        if (a.expiresAt && new Date(a.expiresAt) < now) return false;
        if (!matchesAudience(a.targetRole, role)) return false;
        return true;
      })
      .sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  };

  const submitAnnouncementResponse = (
    announcementId: string,
    employeeId: string,
    message: string,
    photo?: string
  ): AnnouncementSubmission => {
    const now = new Date().toISOString();
    let saved: AnnouncementSubmission = {
      id: `ann-sub-${Date.now()}`,
      announcementId,
      employeeId,
      message,
      photo,
      submittedAt: now,
    };
    setAnnouncementSubmissions((prev) => {
      const existing = prev.find((s) => s.announcementId === announcementId && s.employeeId === employeeId);
      if (existing) {
        saved = { ...existing, message, photo, submittedAt: now };
        return prev.map((s) => (s.id === existing.id ? saved : s));
      }
      return [saved, ...prev];
    });

    if (useSupabase) {
      supabaseService.createAnnouncementSubmission({
        announcementId,
        employeeId,
        message,
        photo,
        submittedAt: now,
      }).catch((err) => console.warn('Supabase create submission error:', err));
    }

    return saved;
  };

  const getAnnouncementSubmission = (announcementId: string, employeeId: string): AnnouncementSubmission | null => {
    return (
      announcementSubmissions.find((s) => s.announcementId === announcementId && s.employeeId === employeeId) || null
    );
  };

  const getAnnouncementSubmissionStatus = (
    announcement: Announcement,
    employeeId: string
  ): 'passed' | 'missed' | 'pending' => {
    if (!announcement.requiresSubmission) return 'passed';
    const submission = getAnnouncementSubmission(announcement.id, employeeId);
    if (submission) return 'passed';
    if (announcement.deadlineAt && new Date(announcement.deadlineAt) < new Date()) return 'missed';
    return 'pending';
  };

  const addAnnouncementComment = async (comment: Omit<AnnouncementComment, 'id'>): Promise<AnnouncementComment> => {
    const trimmedContent = (comment.content || '').trim();
    if (!trimmedContent) return {} as AnnouncementComment;

    // 1. Debounce / duplicate prevention guard:
    // If the exact same comment was posted on this announcement in the last 4 seconds, ignore it
    const now = Date.now();
    const isRecentDuplicate = announcementComments.some(
      (c) =>
        c.announcementId === comment.announcementId &&
        (c.authorName || '').trim() === (comment.authorName || '').trim() &&
        c.content.trim().toLowerCase() === trimmedContent.toLowerCase() &&
        now - new Date(c.createdAt).getTime() < 4000
    );
    if (isRecentDuplicate) {
      console.warn('Duplicate comment prevented:', trimmedContent);
      return (
        announcementComments.find(
          (c) =>
            c.announcementId === comment.announcementId &&
            c.content.trim().toLowerCase() === trimmedContent.toLowerCase()
        ) || ({} as AnnouncementComment)
      );
    }

    const newComm: AnnouncementComment = {
      ...comment,
      content: trimmedContent,
      id: `comm-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      createdAt: comment.createdAt || new Date().toISOString(),
    };

    // 2. Immediately update local state & localStorage with deduplication
    setAnnouncementComments((prev) => {
      const next = deduplicateComments([...prev, newComm]);
      saveToStorage(STORAGE_KEYS.ANNOUNCEMENT_COMMENTS, next);
      return next;
    });

    // 3. Sync to the announcement's comments column in Supabase:
    //    a) Persists in Supabase announcements table (which already exists and works)
    //    b) All roles (HTE, Trainee, Instructor) see the comment immediately on reload
    const currentAnn = announcements.find((a) => a.id === comment.announcementId);
    let existingComments: AnnouncementComment[] = [];
    if (currentAnn?.comments && typeof currentAnn.comments === 'string') {
      try {
        const parsed = JSON.parse(currentAnn.comments);
        if (Array.isArray(parsed)) existingComments = parsed;
      } catch {
        // Non-JSON comment string
      }
    }

    const mergedForThisAnn = deduplicateComments([
      ...existingComments,
      ...announcementComments.filter((a) => a.announcementId === comment.announcementId),
      newComm,
    ]);
    const commentsJson = JSON.stringify(mergedForThisAnn);

    setAnnouncements((prev) => {
      const updated = prev.map((a) => (a.id === comment.announcementId ? { ...a, comments: commentsJson } : a));
      saveToStorage(STORAGE_KEYS.ANNOUNCEMENTS, updated);
      return updated;
    });

    if (useSupabase) {
      try {
        // Save to announcements table in Supabase
        await supabaseService.updateAnnouncement(comment.announcementId, { comments: commentsJson });
      } catch (err) {
        console.warn('Syncing comment to announcement error:', err);
      }
    }

    return newComm;
  };

  const getAnnouncementComments = (announcementId: string): AnnouncementComment[] => {
    return deduplicateComments(announcementComments.filter((c) => c.announcementId === announcementId));
  };

  const deleteAnnouncementComment = async (announcementId: string, commentId: string): Promise<boolean> => {
    // 1. Remove from local comments state & localStorage
    setAnnouncementComments((prev) => {
      const next = prev.filter((c) => c.id !== commentId);
      saveToStorage(STORAGE_KEYS.ANNOUNCEMENT_COMMENTS, next);
      return next;
    });

    // 2. Remove from announcement.comments JSON
    const currentAnn = announcements.find((a) => a.id === announcementId);
    let updatedComments: AnnouncementComment[] = [];
    if (currentAnn?.comments && typeof currentAnn.comments === 'string') {
      try {
        const parsed = JSON.parse(currentAnn.comments);
        if (Array.isArray(parsed)) {
          updatedComments = parsed.filter((c: AnnouncementComment) => c.id !== commentId);
        }
      } catch {
        // Non-JSON comment string
      }
    } else {
      updatedComments = announcementComments.filter((c) => c.announcementId === announcementId && c.id !== commentId);
    }

    const commentsJson = updatedComments.length > 0 ? JSON.stringify(updatedComments) : null;

    setAnnouncements((prev) => {
      const updated = prev.map((a) => (a.id === announcementId ? { ...a, comments: commentsJson } : a));
      saveToStorage(STORAGE_KEYS.ANNOUNCEMENTS, updated);
      return updated;
    });

    if (useSupabase) {
      try {
        await supabaseService.updateAnnouncement(announcementId, { comments: commentsJson });
      } catch (err) {
        console.warn('Error deleting comment in Supabase:', err);
      }
    }

    return true;
  };

  const addRequiredDocument = (
    employeeId: string,
    data: {
      title: string;
      description?: string;
      notes?: string;
      dueDate?: string;
      required?: boolean;
      academicYear?: string;
      fileUrl?: string;
      dataUrl?: string;
      fileName?: string;
      fileSize?: number | string;
      fileType?: string;
      uploadedBy?: string;
      instructorId?: string;
      templateUrl?: string;
      templateName?: string;
      targetRequirementKey?: string;
      maxFileSize?: number;
      allowedFileTypes?: string[];
      targetCourse?: string;
    }
  ): RequiredDocument => {
    const notes = (data.notes ?? data.description ?? '').trim();
    const newDoc: RequiredDocument = {
      id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      employeeId,
      title: data.title.trim(),
      description: notes,
      notes,
      dueDate: data.dueDate || '',
      required: data.required ?? true,
      academicYear: data.academicYear || settings.activeAcademicYear,
      createdAt: new Date().toISOString(),
      fileUrl: data.fileUrl,
      dataUrl: data.dataUrl,
      fileName: data.fileName,
      fileSize: data.fileSize,
      fileType: data.fileType,
      uploadedBy: data.uploadedBy,
      instructorId: data.instructorId,
      templateUrl: data.templateUrl || data.fileUrl || data.dataUrl,
      templateName: data.templateName || data.fileName,
      targetRequirementKey: data.targetRequirementKey,
      maxFileSize: data.maxFileSize,
      allowedFileTypes: data.allowedFileTypes,
      targetCourse: data.targetCourse,
    };

    setRequiredDocuments((prev) => {
      const updated = [newDoc, ...prev.filter((d) => d.id !== newDoc.id && d.title.toLowerCase().trim() !== newDoc.title.toLowerCase().trim())];
      saveToStorage(STORAGE_KEYS.REQUIRED_DOCUMENTS, updated);
      supabaseService.saveRequiredDocumentsToStorage(updated).catch(console.warn);
      try {
        window.dispatchEvent(new CustomEvent('ojt_required_documents_updated'));
        window.dispatchEvent(new Event('storage'));
      } catch {}
      return updated;
    });
    return newDoc;
  };

  const updateRequiredDocument = (id: string, data: Partial<RequiredDocument>) => {
    setRequiredDocuments((prev) => {
      const updated = prev.map((doc) => (doc.id === id ? { ...doc, ...data } : doc));
      saveToStorage(STORAGE_KEYS.REQUIRED_DOCUMENTS, updated);
      supabaseService.saveRequiredDocumentsToStorage(updated).catch(console.warn);
      try {
        window.dispatchEvent(new CustomEvent('ojt_required_documents_updated'));
        window.dispatchEvent(new Event('storage'));
      } catch {}
      return updated;
    });
  };

  const deleteRequiredDocument = (id: string) => {
    setRequiredDocuments((prev) => {
      const updated = prev.filter((doc) => doc.id !== id);
      saveToStorage(STORAGE_KEYS.REQUIRED_DOCUMENTS, updated);
      supabaseService.saveRequiredDocumentsToStorage(updated).catch(console.warn);
      try {
        window.dispatchEvent(new CustomEvent('ojt_required_documents_updated'));
        window.dispatchEvent(new Event('storage'));
      } catch {}
      return updated;
    });
    setRequiredDocumentSubmissions((prev) => prev.filter((submission) => submission.documentId !== id));
  };

  const getEmployeeRequiredDocuments = (employeeId: string): RequiredDocument[] => {
    // 1. Fetch any specific custom documents added by admin for this employee or all employees
    const emp = employees.find((e) => e.id === employeeId || e.employeeId === employeeId);
    const normalizeAY = (ay?: string | null) => (ay || '').replace(/^A\.?Y\.?\s*/i, '').trim().toLowerCase();
    const activeAY = normalizeAY(settings.activeAcademicYear);

    const assignedDocs = requiredDocuments.filter((doc) => {
      // Recipient matching: 'all', matching employeeId, or matching target course
      const matchesTarget =
        !doc.employeeId ||
        doc.employeeId === 'all' ||
        doc.employeeId === employeeId ||
        (emp && doc.employeeId === emp.employeeId) ||
        (emp?.course && doc.targetCourse && (doc.targetCourse === 'all' || doc.targetCourse === emp.course));

      if (!matchesTarget) return false;

      // Academic year matching: loose / normalized comparison
      const docAY = normalizeAY(doc.academicYear);
      if (!docAY || docAY === 'all' || !activeAY) return true;
      if (docAY === activeAY) return true;
      if (emp?.academicYear && normalizeAY(emp.academicYear) === docAY) return true;
      return false;
    });

    // 2. Standard mandatory institutional OJT checklist documents
    const standardDocs: RequiredDocument[] = DEFAULT_OJT_REQUIRED_DOCUMENTS.map((d, index) => ({
      id: `req-${d.docKey || index + 1}-${employeeId}`,
      employeeId,
      title: d.title,
      description: d.description,
      notes: d.notes,
      dueDate: d.dueDate,
      required: d.required,
      academicYear: settings.activeAcademicYear,
      createdAt: new Date().toISOString(),
    }));

    // Merge: custom assigned documents take priority over duplicate titles
    const combined = [...assignedDocs];
    for (const std of standardDocs) {
      const alreadyExists = combined.some(
        (c) => c.title.toLowerCase().trim() === std.title.toLowerCase().trim()
      );
      if (!alreadyExists) {
        combined.push(std);
      }
    }

    return combined;
  };

  const getRequirementStatus = (documentId: string, employeeId: string): RequirementStatus => {
    const submission = getRequiredDocumentSubmission(documentId, employeeId);
    if (!submission) return 'missing';
    return submission.fileUrl ? 'complete' : 'incomplete';
  };

  const getEmployeeRequirementSummary = (employeeId: string) => {
    return getEmployeeRequiredDocuments(employeeId).reduce(
      (summary, document) => {
        summary[getRequirementStatus(document.id, employeeId)] += 1;
        return summary;
      },
      { missing: 0, incomplete: 0, complete: 0 }
    );
  };

  const submitRequiredDocument = (
    documentId: string,
    employeeId: string,
    payload: {
      note?: string;
      notes?: string;
      fileName?: string;
      fileUrl?: string;
      fileDataUrl?: string;
      fileSize?: number | string;
      fileType?: string;
    }
  ): RequiredDocumentSubmission => {
    const notes = (payload.notes ?? payload.note ?? '').trim();
    const now = new Date().toISOString();
    let saved: RequiredDocumentSubmission = {
      id: `doc-sub-${Date.now()}`,
      documentId,
      employeeId,
      submittedAt: now,
      note: notes,
      notes,
      fileName: payload.fileName || '',
      fileUrl: payload.fileUrl || '',
      fileDataUrl: payload.fileDataUrl || '',
      fileSize: payload.fileSize,
      fileType: payload.fileType,
      status: 'submitted',
    };

    setRequiredDocumentSubmissions((prev) => {
      const existing = prev.find((s) => s.documentId === documentId && s.employeeId === employeeId);
      if (existing) {
        saved = {
          ...existing,
          note: notes,
          notes,
          fileName: payload.fileName || '',
          fileUrl: payload.fileUrl || '',
          fileDataUrl: payload.fileDataUrl || existing.fileDataUrl || '',
          fileSize: payload.fileSize ?? existing.fileSize,
          fileType: payload.fileType ?? existing.fileType,
          submittedAt: now,
          status: 'submitted',
        };
        return prev.map((s) => (s.id === existing.id ? saved : s));
      }
      return [saved, ...prev];
    });

    // Also sync to employee.submittedDocuments
    const lowerDoc = documentId.toLowerCase();
    let docKey: keyof TraineeDocuments | null = null;
    if (lowerDoc.includes('internship') || lowerDoc.includes('agreement') || lowerDoc.includes('contract') || lowerDoc.includes('doc-1')) docKey = 'internshipAgreement';
    else if (lowerDoc.includes('moa') || lowerDoc.includes('memorandum') || lowerDoc.includes('doc-2')) docKey = 'moa';
    else if (lowerDoc.includes('consent') || lowerDoc.includes('waiver') || lowerDoc.includes('parental') || lowerDoc.includes('doc-3')) docKey = 'consent';
    else if (lowerDoc.includes('training') || lowerDoc.includes('plan') || lowerDoc.includes('doc-4')) docKey = 'trainingPlan';
    else if (lowerDoc.includes('pledge') || lowerDoc.includes('conduct') || lowerDoc.includes('doc-5')) docKey = 'pledgeOfConduct';
    else if (lowerDoc.includes('medical') || lowerDoc.includes('clearance') || lowerDoc.includes('doc-6')) docKey = 'medical';
    else if (lowerDoc.includes('application') || lowerDoc.includes('doc-7')) docKey = 'application';
    else if (lowerDoc.includes('resume') || lowerDoc.includes('biodata') || lowerDoc.includes('bio-data') || lowerDoc.includes('cv') || lowerDoc.includes('doc-8')) docKey = 'resume';
    else if (lowerDoc.includes('enrolment') || lowerDoc.includes('enrollment') || lowerDoc.includes('cor') || lowerDoc.includes('doc-9')) docKey = 'enrolmentForm';
    else if (lowerDoc.includes('endorsement') || lowerDoc.includes('doc-10')) docKey = 'endorsement';

    const finalKey = (docKey || documentId) as keyof TraineeDocuments;
    const currentEmp = employees.find((e) => e.id === employeeId || e.employeeId === employeeId) || getCurrentEmployee();
    if (currentEmp) {
      const prevDoc = currentEmp.submittedDocuments?.[finalKey];
      const newStatus = prevDoc?.status === 'passed' ? 'passed' : 'submitted';
      const updatedDocs = {
        ...(currentEmp.submittedDocuments || {}),
        [finalKey]: {
          name: payload.fileName || 'Uploaded Document.pdf',
          dataUrl: payload.fileDataUrl || payload.fileUrl || '',
          fileUrl: payload.fileUrl || '',
          size: payload.fileSize || 0,
          fileType: payload.fileType || 'application/pdf',
          uploadedAt: now,
          status: newStatus as const,
          description: payload.notes || payload.note || '',
          notes: notes,
          source: 'portal' as const,
        },
      } as TraineeDocuments;

      updateEmployee(currentEmp.id, {
        submittedDocuments: updatedDocs,
        documentsStatus: 'submitted',
      });
    }

    return saved;
  };

  const getRequiredDocumentSubmission = (documentId: string, employeeId: string): RequiredDocumentSubmission | null => {
    // 1. Direct match in requiredDocumentSubmissions
    const existing = requiredDocumentSubmissions.find(
      (s) =>
        (s.documentId === documentId || documentId.includes(s.documentId) || s.documentId.includes(documentId)) &&
        s.employeeId === employeeId
    );
    if (existing) {
      if (!existing.fileDataUrl && typeof window !== 'undefined') {
        const cached = window.sessionStorage?.getItem(`ojt_doc_data_${existing.id || existing.documentId}`);
        if (cached) {
          return { ...existing, fileDataUrl: cached };
        }
      }
      return existing;
    }

    // 2. Trainee submittedDocuments fallback
    const emp =
      employees.find((e) => e.id === employeeId) ||
      (getCurrentEmployee()?.id === employeeId ? getCurrentEmployee() : null);
    if (emp?.submittedDocuments) {
      const lowerDoc = (documentId || '').toLowerCase();
      let matchedDocItem: TraineeDocumentItem | undefined = undefined;
      if (lowerDoc.includes('internship') || lowerDoc.includes('agreement') || lowerDoc.includes('contract') || lowerDoc.includes('doc-1')) {
        matchedDocItem = emp.submittedDocuments.internshipAgreement;
      } else if (lowerDoc.includes('moa') || lowerDoc.includes('memorandum') || lowerDoc.includes('doc-2')) {
        matchedDocItem = emp.submittedDocuments.moa;
      } else if (lowerDoc.includes('consent') || lowerDoc.includes('waiver') || lowerDoc.includes('parental') || lowerDoc.includes('doc-3')) {
        matchedDocItem = emp.submittedDocuments.consent || emp.submittedDocuments.parent_consent;
      } else if (lowerDoc.includes('training') || lowerDoc.includes('plan') || lowerDoc.includes('doc-4')) {
        matchedDocItem = emp.submittedDocuments.trainingPlan || (emp.submittedDocuments as any)?.training_plan;
      } else if (lowerDoc.includes('pledge') || lowerDoc.includes('conduct') || lowerDoc.includes('doc-5')) {
        matchedDocItem = emp.submittedDocuments.pledgeOfConduct;
      } else if (lowerDoc.includes('medical') || lowerDoc.includes('clearance') || lowerDoc.includes('doc-6')) {
        matchedDocItem = emp.submittedDocuments.medical;
      } else if (lowerDoc.includes('application') || lowerDoc.includes('doc-7')) {
        matchedDocItem = emp.submittedDocuments.application || (emp.submittedDocuments as any)?.applicationForm || (emp.submittedDocuments as any)?.application_letter;
      } else if (lowerDoc.includes('resume') || lowerDoc.includes('biodata') || lowerDoc.includes('bio-data') || lowerDoc.includes('cv') || lowerDoc.includes('doc-8')) {
        matchedDocItem = emp.submittedDocuments.resume;
      } else if (lowerDoc.includes('enrolment') || lowerDoc.includes('enrollment') || lowerDoc.includes('cor') || lowerDoc.includes('doc-9')) {
        matchedDocItem = emp.submittedDocuments.enrolmentForm;
      } else if (lowerDoc.includes('endorsement') || lowerDoc.includes('doc-10')) {
        matchedDocItem = emp.submittedDocuments.endorsement;
      } else if (lowerDoc.includes('duties') || lowerDoc.includes('responsibilities')) {
        matchedDocItem = emp.submittedDocuments.dutiesAndResponsibilities;
      } else if (lowerDoc.includes('evaluation') && lowerDoc.includes('report')) {
        matchedDocItem = emp.submittedDocuments.evaluationReport;
      } else if (lowerDoc.includes('evaluation')) {
        matchedDocItem = emp.submittedDocuments.evaluationForm;
      } else {
        // Direct key lookup
        matchedDocItem = (emp.submittedDocuments as any)[documentId];
      }

      if (matchedDocItem && (matchedDocItem.fileUrl || matchedDocItem.dataUrl || matchedDocItem.name)) {
        const sessionCached = typeof window !== 'undefined' ? window.sessionStorage?.getItem(`ojt_doc_data_${documentId}`) : '';
        const isPassed = matchedDocItem.status === 'passed';
        return {
          id: `sub-auto-${documentId}`,
          documentId,
          employeeId,
          submittedAt: matchedDocItem.uploadedAt || new Date().toISOString(),
          fileName: matchedDocItem.name || 'Submitted Document.pdf',
          fileUrl: matchedDocItem.fileUrl || matchedDocItem.dataUrl || '',
          fileDataUrl: matchedDocItem.dataUrl || sessionCached || '',
          note: matchedDocItem.notes || matchedDocItem.note || (isPassed ? 'Verified (passed)' : 'Submitted for review'),
          status: isPassed ? 'approved' : 'submitted',
          verificationStatus: isPassed ? 'passed' : 'pending',
        };
      }
    }

    return null;
  };

  // ── Host Feedback ─────────────────────────────────────────────────────────────
  const addHostFeedback = (
    data: Omit<HostFeedback, 'id' | 'overallScore' | 'submittedAt' | 'status'>
  ): HostFeedback => {
    const totalScore =
      data.attendanceScore + data.performanceScore + data.attitudeScore + data.communicationScore + data.teamworkScore;
    const overallScore = Math.round(totalScore / 5);
    const tempId = `hf-${Date.now()}`;

    const newFeedback: HostFeedback = {
      ...data,
      hostEmail: data.hostEmail || 'hte@chmsu.edu.ph',
      academicYear: (data as any).academicYear || settings.activeAcademicYear,
      id: tempId,
      overallScore,
      submittedAt: new Date().toISOString(),
      status: 'submitted',
    };

    setHostFeedback((prev) => [newFeedback, ...prev]);

    if (useSupabase) {
      supabaseService
        .createHostFeedback(newFeedback)
        .then((created) => {
          if (created) {
            setHostFeedback((prev) => [created, ...prev.filter((f) => f.id !== tempId && f.id !== created.id)]);
          }
        })
        .catch((err) => {
          console.error('[AppContext] Failed to save host feedback to Supabase:', err);
          setHostFeedback((prev) => prev.filter((f) => f.id !== tempId));
        });
    }

    // Auto-sync into evaluations table so Instructor and Trainee see the evaluation in real-time
    const existingEval = evaluations.find((e) => e.employeeId === data.employeeId);
    const grade: 'Excellent' | 'Very Good' | 'Good' | 'Satisfactory' | 'Needs Improvement' =
      overallScore >= 90 ? 'Excellent' :
        overallScore >= 80 ? 'Very Good' :
          overallScore >= 70 ? 'Good' :
            overallScore >= 60 ? 'Satisfactory' : 'Needs Improvement';

    if (existingEval) {
      updateEvaluation(existingEval.id, {
        evaluatedBy: data.hostName + (data.hostCompany ? ` (${data.hostCompany})` : ' [HTE Supervisor]'),
        attendanceScore: data.attendanceScore,
        performanceScore: data.performanceScore,
        attitudeScore: data.attitudeScore,
        punctualityScore: data.teamworkScore || data.attendanceScore,
        communicationScore: data.communicationScore,
        overallScore: overallScore,
        grade: grade,
        strengths: data.strengths || existingEval.strengths,
        areasForImprovement: data.areasForImprovement || existingEval.areasForImprovement,
        recommendations: data.recommendation || existingEval.recommendations,
      });
    } else {
      addEvaluation({
        employeeId: data.employeeId,
        evaluatedBy: data.hostName + (data.hostCompany ? ` (${data.hostCompany})` : ' [HTE Supervisor]'),
        attendanceScore: data.attendanceScore,
        performanceScore: data.performanceScore,
        attitudeScore: data.attitudeScore,
        punctualityScore: data.teamworkScore || data.attendanceScore,
        communicationScore: data.communicationScore,
        overallScore: overallScore,
        grade: grade,
        strengths: data.strengths || 'Consistent performance and dedicated engagement.',
        areasForImprovement: data.areasForImprovement || 'Continue developing technical problem-solving skills.',
        recommendations: data.recommendation || 'Recommended for completion.',
        evaluatedAt: new Date().toISOString(),
        status: 'submitted_to_instructor',
        academicYear: (data as any).academicYear || settings.activeAcademicYear,
      });
    }

    return newFeedback;
  };

  const updateHostFeedback = (id: string, updates: Partial<HostFeedback>) => {
    const previous = hostFeedback.find((f) => f.id === id);
    setHostFeedback((prev) => prev.map((f) => (f.id === id ? { ...f, ...updates } : f)));
    if (useSupabase) {
      supabaseService.updateHostFeedback(id, updates).catch((err) => {
        console.error('[AppContext] Failed to update host feedback in Supabase:', err);
        if (previous) {
          setHostFeedback((prev) => prev.map((f) => (f.id === id ? previous : f)));
        }
        toast.error('Failed to save host feedback update to cloud. Changes have been rolled back.');
      });
    }
  };

  const deleteHostFeedback = (id: string) => {
    const previous = hostFeedback.find((f) => f.id === id);
    setHostFeedback((prev) => prev.filter((f) => f.id !== id));
    if (useSupabase) {
      supabaseService.deleteHostFeedback(id).catch((err) => {
        console.error('[AppContext] Failed to delete host feedback in Supabase:', err);
        if (previous) {
          setHostFeedback((prev) => [previous, ...prev]);
        }
        toast.error('Failed to delete host feedback from cloud. Item has been restored.');
      });
    }
  };

  const getEmployeeHostFeedback = (employeeId: string): HostFeedback[] => {
    return hostFeedback
      .filter((f) => f.employeeId === employeeId)
      .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
  };

  const getLatestHostFeedback = (employeeId: string): HostFeedback | null => {
    const list = getEmployeeHostFeedback(employeeId);
    return list.length > 0 ? list[0] : null;
  };

  const syncAllAccountsAcrossAcademicYears = async (
    targetAcademicYear?: string
  ): Promise<{ success: boolean; syncedCount: number; message: string }> => {
    const ay = targetAcademicYear || settings.activeAcademicYear;
    const defaultAY = settings.academicYears?.[0] || '2025-2026';

    // 1. Locate Instructor for this academic year (or system administrator)
    const inst = employees.find(
      (e) =>
        (e.position === 'OJT Instructor' || (e.position && e.position.toLowerCase().includes('instructor'))) &&
        (e.academicYear === ay || (!e.academicYear && ay === defaultAY))
    ) || employees.find((e) => e.position === 'OJT Instructor');

    // 2. Locate HTE partners registered for this academic year
    const htePartners = employees.filter(
      (e) =>
        (e.position === 'HTE Representative' || (e.position && e.position.toLowerCase().includes('hte'))) &&
        (e.academicYear === ay || (!e.academicYear && ay === defaultAY))
    );

    // 3. Bidirectionally synchronize Trainees, Instructor, and HTE partners within target academic year
    // CRITICAL: Preserve each Trainee and HTE's registered academic year; accounts stay in their own academic year!
    let updatedLinkages = 0;
    const updatedEmployees = employees.map((emp) => {
      const empAY = emp.academicYear || defaultAY;
      // Only link trainees within this target academic year
      if (empAY !== ay) {
        return emp;
      }

      const isTrainee = emp.position !== 'OJT Instructor' && emp.position !== 'HTE Representative';
      if (!isTrainee) return emp;

      let newInstructorId = emp.instructorId;
      let newHteId = emp.hteId;

      if (!newInstructorId && inst) {
        newInstructorId = inst.id;
      }

      if (!newHteId && emp.companyName && emp.companyName.trim() !== '' && emp.companyName.toLowerCase() !== 'n/a') {
        const comp = emp.companyName.trim().toLowerCase();
        const matchedHte = htePartners.find((h) => h.companyName && h.companyName.trim().toLowerCase() === comp);
        if (matchedHte) {
          newHteId = matchedHte.id;
        }
      }

      if (newInstructorId !== emp.instructorId || newHteId !== emp.hteId) {
        updatedLinkages++;
        return {
          ...emp,
          instructorId: newInstructorId,
          hteId: newHteId,
        };
      }

      return emp;
    });

    setEmployees(updatedEmployees);
    if (!useSupabase) {
      saveToStorage(STORAGE_KEYS.EMPLOYEES, updatedEmployees);
    } else {
      const affected = updatedEmployees.filter((e) => (e.academicYear || defaultAY) === ay);
      if (affected.length > 0) {
        await supabaseService.upsertEmployees(affected).catch(() => {});
      }
    }

    return {
      success: true,
      syncedCount: updatedLinkages,
      message: `Synchronized accounts for Academic Year ${ay}: ${updatedLinkages} trainee linkages established across Instructor and HTE partners. Accounts in other academic years remain safely preserved.`,
    };
  };

  const repairAndPersistDatabase = async (): Promise<{ success: boolean; message: string; repairedCounts: any }> => {
    const activeAY = settings.activeAcademicYear;
    const defaultAY = settings.academicYears?.[0] || '2025-2026';

    // 1. Ensure all employees keep their academicYear and normalized positions
    const fixedEmployees = employees.map((e) => {
      const isHTE = e.position === 'HTE Representative' || e.position === 'Training Supervisor' || (e.position && e.position.toLowerCase().includes('hte'));
      const isInstructor = e.position === 'Administrator' || e.position === 'OJT Instructor' || (e.position && e.position.toLowerCase().includes('instructor'));
      let employeeId = e.employeeId;
      if (isHTE && employeeId && employeeId.startsWith('OJT-')) {
        employeeId = employeeId.replace(/^OJT-/, 'HTE-');
      } else if (isInstructor && employeeId && employeeId.startsWith('OJT-')) {
        employeeId = employeeId.replace(/^OJT-/, 'ADM-');
      }
      return {
        ...e,
        position: e.position === 'Administrator' ? 'OJT Instructor' : e.position,
        academicYear: e.academicYear || activeAY || defaultAY,
        employeeId,
      };
    });
    setEmployees(fixedEmployees);
    if (!useSupabase) {
      saveToStorage(STORAGE_KEYS.EMPLOYEES, fixedEmployees);
    }

    // 2. Ensure time records have academicYear matching their trainee or active academic year
    const fixedRecords = timeRecords.map((r) => {
      const emp = fixedEmployees.find(
        (e) =>
          e.id === r.employeeId ||
          e.employeeId === r.employeeId ||
          (e.email && r.employeeId && e.email.toLowerCase() === r.employeeId.toLowerCase())
      );
      return {
        ...r,
        academicYear: r.academicYear || emp?.academicYear || activeAY || defaultAY,
      };
    });
    setTimeRecords(fixedRecords);
    if (!useSupabase) {
      saveToStorage(STORAGE_KEYS.TIME_RECORDS, fixedRecords);
    }

    // 3. Ensure evaluations have academicYear and official HTE supervisor name (Jhey Ree for Printing Services, Jhey Ree C Ebro for Concentrix)
    const fixedEvals = evaluations.map((ev) => {
      const emp = fixedEmployees.find(
        (e) =>
          e.id === ev.employeeId ||
          e.employeeId === ev.employeeId ||
          (e.email && ev.employeeId && e.email.toLowerCase() === ev.employeeId.toLowerCase())
      );
      const comp = (emp?.companyName || '').toLowerCase();
      const officialSup = comp.includes('printing')
        ? 'Jhey Ree'
        : 'Jhey Ree C Ebro';

      return {
        ...ev,
        evaluatedBy: officialSup,
        academicYear: ev.academicYear || emp?.academicYear || activeAY || defaultAY,
      };
    });
    setEvaluations(fixedEvals);
    if (!useSupabase) {
      saveToStorage(STORAGE_KEYS.EVALUATIONS, fixedEvals);
    }

    // 4. Ensure host feedback has academicYear and official supervisor
    const fixedFeedback = hostFeedback.map((hf) => {
      const emp = fixedEmployees.find(
        (e) =>
          e.id === hf.employeeId ||
          e.employeeId === hf.employeeId ||
          (e.email && hf.employeeId && e.email.toLowerCase() === hf.employeeId.toLowerCase())
      );
      const comp = (hf.hostCompany || emp?.companyName || '').toLowerCase();
      const isPrinting = comp.includes('printing');
      const officialSup = isPrinting ? 'Jhey Ree' : 'Jhey Ree C Ebro';

      return {
        ...hf,
        hostName: officialSup,
        hostCompany: isPrinting ? 'Printing Services' : 'Concentrix',
        academicYear: hf.academicYear || emp?.academicYear || activeAY || defaultAY,
      };
    });
    setHostFeedback(fixedFeedback);
    if (!useSupabase) {
      saveToStorage(STORAGE_KEYS.HOST_FEEDBACK, fixedFeedback);
    }

    // 5. Ensure host supervisors preserve their academicYear
    const fixedHosts = hostSupervisors.map((h) => ({
      ...h,
      academicYear: h.academicYear || activeAY || defaultAY,
      active: true,
    }));
    setHostSupervisors(fixedHosts);
    if (!useSupabase) {
      saveToStorage(STORAGE_KEYS.HOST_SUPERVISORS, fixedHosts);
    }

    let supabaseResult = { repairedEmployees: 0, repairedRecords: 0 };
    if (useSupabase) {
      await supabaseService.upsertEmployees(fixedEmployees);
      await supabaseService.upsertHostSupervisors(fixedHosts);
      await supabaseService.upsertTimeRecords(fixedRecords);
      supabaseResult = await supabaseService.repairDatabaseData(activeAY);
    }

    return {
      success: true,
      message: 'All data, photos, records, and accounts successfully verified and saved in database for Academic Year ' + activeAY + '.',
      repairedCounts: supabaseResult,
    };
  };

  const approveEmployee = (id: string) => {
    updateEmployee(id, { active: true, approvalStatus: 'approved', applicationStatus: 'approved' });
  };

  const rejectEmployee = (id: string) => {
    deleteEmployee(id);
  };

  const saveMonthlyDttr = useCallback((record: MonthlyDttrRecord) => {
    setMonthlyDttrs((prev) => {
      const targetEmp = (record.employeeId || '').trim().toLowerCase();
      const matchedEmp = employees.find(
        (e) => e.id.toLowerCase() === targetEmp || (e.employeeId && e.employeeId.toLowerCase() === targetEmp)
      );
      const validIds = new Set<string>([targetEmp]);
      if (matchedEmp) {
        if (matchedEmp.id) validIds.add(matchedEmp.id.toLowerCase());
        if (matchedEmp.employeeId) validIds.add(matchedEmp.employeeId.toLowerCase());
      }

      const existingIndex = prev.findIndex(
        (r) =>
          (r.id === record.id || validIds.has((r.employeeId || '').toLowerCase())) &&
          Number(r.year) === Number(record.year) &&
          Number(r.month) === Number(record.month)
      );
      const id = record.id || `${record.employeeId}_${record.year}_${record.month}`;
      const updatedRecord = { ...record, id, updatedAt: new Date().toISOString() };
      let next: MonthlyDttrRecord[];
      if (existingIndex >= 0) {
        next = [...prev];
        next[existingIndex] = { ...next[existingIndex], ...updatedRecord };
      } else {
        next = [...prev, updatedRecord];
      }
      saveToStorage(STORAGE_KEYS.MONTHLY_DTTR, next);
      return next;
    });
  }, [employees]);

  const getMonthlyDttr = useCallback((employeeId: string, year: number, month: number): MonthlyDttrRecord | null => {
    if (!employeeId) return null;
    const targetEmp = employeeId.trim().toLowerCase();
    const matchedEmp = employees.find(
      (e) => e.id.toLowerCase() === targetEmp || (e.employeeId && e.employeeId.toLowerCase() === targetEmp)
    );
    const validIds = new Set<string>([targetEmp]);
    if (matchedEmp) {
      if (matchedEmp.id) validIds.add(matchedEmp.id.toLowerCase());
      if (matchedEmp.employeeId) validIds.add(matchedEmp.employeeId.toLowerCase());
    }

    const found = monthlyDttrs.find(
      (r) =>
        (validIds.has((r.employeeId || '').toLowerCase()) || r.id === `${employeeId}_${year}_${month}`) &&
        Number(r.year) === Number(year) &&
        Number(r.month) === Number(month)
    );
    return found || null;
  }, [monthlyDttrs, employees]);

  const signMonthlyDttr = useCallback((employeeId: string, year: number, month: number, supervisorName: string, supervisorTitle?: string) => {
    setMonthlyDttrs((prev) => {
      const targetEmp = (employeeId || '').trim().toLowerCase();
      const matchedEmp = employees.find(
        (e) => e.id.toLowerCase() === targetEmp || (e.employeeId && e.employeeId.toLowerCase() === targetEmp)
      );
      const validIds = new Set<string>([targetEmp]);
      if (matchedEmp) {
        if (matchedEmp.id) validIds.add(matchedEmp.id.toLowerCase());
        if (matchedEmp.employeeId) validIds.add(matchedEmp.employeeId.toLowerCase());
      }

      const existingIndex = prev.findIndex(
        (r) =>
          (validIds.has((r.employeeId || '').toLowerCase()) || r.id === `${employeeId}_${year}_${month}`) &&
          Number(r.year) === Number(year) &&
          Number(r.month) === Number(month)
      );
      const id = `${employeeId}_${year}_${month}`;
      const updated: MonthlyDttrRecord = {
        id,
        employeeId,
        year: Number(year),
        month: Number(month),
        ...(existingIndex >= 0 ? prev[existingIndex] : {}),
        hteSupervisorName: supervisorName,
        hteSupervisorTitle: supervisorTitle || 'HTE Supervisor',
        hteSignedAt: new Date().toISOString(),
        hteSignatureStatus: 'signed',
        updatedAt: new Date().toISOString(),
      };
      let next: MonthlyDttrRecord[];
      if (existingIndex >= 0) {
        next = [...prev];
        next[existingIndex] = updated;
      } else {
        next = [...prev, updated];
      }
      saveToStorage(STORAGE_KEYS.MONTHLY_DTTR, next);
      return next;
    });
  }, [employees]);

  // Official OJT Monitoring Reports handlers
  const addMonitoringReport = useCallback(
    async (data: Omit<MonitoringReport, 'id' | 'reportNumber' | 'createdAt'>): Promise<MonitoringReport> => {
      const year = new Date().getFullYear();
      const count = monitoringReports.length + 1;
      const reportNumber = `CHMSU-MR-${year}-${String(count).padStart(3, '0')}`;
      const term = data.term || (
        data.reportType === 'endterm' || (data.totalCumulativeHours || 0) > 300
          ? 'endterm'
          : 'midterm'
      );
      const frequency = data.frequency || (
        data.reportType === 'midterm' || data.reportType === 'endterm'
          ? 'evaluation'
          : data.reportType === 'monthly'
          ? 'monthly'
          : 'weekly'
      );
      const newReport: MonitoringReport = {
        ...data,
        term,
        frequency,
        id: `mr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        reportNumber,
        createdAt: new Date().toISOString(),
      };
      setMonitoringReports((prev) => [newReport, ...prev]);
      return newReport;
    },
    [monitoringReports.length]
  );

  const updateMonitoringReport = useCallback(async (id: string, data: Partial<MonitoringReport>) => {
    setMonitoringReports((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...data, updatedAt: new Date().toISOString() } : r))
    );
  }, []);

  const deleteMonitoringReport = useCallback(async (id: string) => {
    setMonitoringReports((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const reviewMonitoringReport = useCallback(
    async (id: string, instructorRemarks: string, status: 'reviewed' | 'acknowledged' = 'reviewed') => {
      setMonitoringReports((prev) =>
        prev.map((r) =>
          r.id === id
            ? {
                ...r,
                instructorRemarks,
                status,
                reviewedByInstructorAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              }
            : r
        )
      );
    },
    []
  );

  const getTraineeMonitoringReports = useCallback(
    (traineeId: string) => {
      return monitoringReports.filter(
        (r) => r.traineeId === traineeId || r.studentId === traineeId
      );
    },
    [monitoringReports]
  );

  const acknowledgeMonitoringReport = useCallback(async (id: string, feedback?: string) => {
    setMonitoringReports((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
              ...r,
              isAcknowledgedByTrainee: true,
              traineeAcknowledgedAt: new Date().toISOString(),
              traineeFeedback: feedback || r.traineeFeedback,
              updatedAt: new Date().toISOString(),
            }
          : r
      )
    );
  }, []);

  // Trainee Self-Monitoring Reports handlers
  const addTraineeSelfMonitoringReport = useCallback(
    async (data: Omit<TraineeSelfMonitoringReport, 'id' | 'createdAt' | 'status'>): Promise<TraineeSelfMonitoringReport> => {
      const newSelfReport: TraineeSelfMonitoringReport = {
        ...data,
        id: `smr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        status: 'submitted',
        createdAt: new Date().toISOString(),
      };
      setTraineeSelfMonitoringReports((prev) => [newSelfReport, ...prev]);
      return newSelfReport;
    },
    []
  );

  const updateTraineeSelfMonitoringReport = useCallback(
    async (id: string, data: Partial<TraineeSelfMonitoringReport>) => {
      setTraineeSelfMonitoringReports((prev) =>
        prev.map((r) => (r.id === id ? { ...r, ...data } : r))
      );
    },
    []
  );

  const reviewTraineeSelfMonitoringReport = useCallback(
    async (id: string, instructorRemarks: string, status: 'reviewed' | 'acknowledged' = 'reviewed') => {
      setTraineeSelfMonitoringReports((prev) =>
        prev.map((r) =>
          r.id === id
            ? {
                ...r,
                instructorRemarks,
                status,
                reviewedByInstructorAt: new Date().toISOString(),
              }
            : r
        )
      );
    },
    []
  );

  const deleteTraineeSelfMonitoringReport = useCallback(async (id: string) => {
    setTraineeSelfMonitoringReports((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const getTraineeSelfReports = useCallback(
    (traineeId: string) => {
      return traineeSelfMonitoringReports.filter(
        (r) => r.traineeId === traineeId || r.studentId === traineeId
      );
    },
    [traineeSelfMonitoringReports]
  );

  // Accounts are global across academic years; records retain their own academic-year metadata.
  const filteredEmployees = employees;
  const filteredTimeRecords = timeRecords;
  const filteredGeofenceZones = geofenceZones;
  const filteredEvaluations = evaluations;
  const filteredAnnouncements = announcements;
  const filteredHostFeedback = hostFeedback;

  return (
    <AppContext.Provider
      value={{
        currentUser,
        setCurrentUser,
        employees: filteredEmployees,
        timeRecords: filteredTimeRecords,
        geofenceZones: filteredGeofenceZones,
        settings,
        evaluations: filteredEvaluations,
        announcements: filteredAnnouncements,
        announcementSubmissions,
        announcementComments,
        requiredDocuments,
        requiredDocumentSubmissions,
        hostFeedback: filteredHostFeedback,
        hostSupervisors,
        login,
        loginWithOAuthUser,
        logout,
        tokenExpiresAt,
        tokenSecondsRemaining,
        refreshToken,
        refreshData,
        changeCurrentUserPassword,
        registerEmployee,
        updateEmployee,
        batchUpdateEmployees,
        updateHostSupervisor,
        deleteEmployee,
        approveEmployee,
        rejectEmployee,
        addTimeRecord,
        updateTimeRecord,
        approveTimeRecord,
        disapproveTimeRecord,
        getTodayRecord,
        getEmployeeRecords,
        updateGeofenceZones,
        addGeofenceZone,
        updateGeofenceZone,
        deleteGeofenceZone,
        updateSettings,
        getCurrentEmployee,
        addEvaluation,
        updateEvaluation,
        deleteEvaluation,
        getEmployeeEvaluation,
        addAnnouncement,
        updateAnnouncement,
        deleteAnnouncement,
        getActiveAnnouncements,
        submitAnnouncementResponse,
        getAnnouncementSubmission,
        getAnnouncementSubmissionStatus,
        addAnnouncementComment,
        getAnnouncementComments,
        deleteAnnouncementComment,
        addRequiredDocument,
        updateRequiredDocument,
        deleteRequiredDocument,
        getEmployeeRequiredDocuments,
        getRequirementStatus,
        getEmployeeRequirementSummary,
        submitRequiredDocument,
        getRequiredDocumentSubmission,
        addHostFeedback,
        updateHostFeedback,
        deleteHostFeedback,
        getEmployeeHostFeedback,
        getLatestHostFeedback,
        // Expose password helper so UI can set passwords when updating existing accounts
        setPasswordForEmail,
        syncAllAccountsAcrossAcademicYears,
        repairAndPersistDatabase,
        monthlyDttrs,
        saveMonthlyDttr,
        getMonthlyDttr,
        signMonthlyDttr,
        // Monitoring Reports
        monitoringReports,
        addMonitoringReport,
        updateMonitoringReport,
        deleteMonitoringReport,
        reviewMonitoringReport,
        getTraineeMonitoringReports,
        acknowledgeMonitoringReport,
        traineeSelfMonitoringReports,
        addTraineeSelfMonitoringReport,
        updateTraineeSelfMonitoringReport,
        reviewTraineeSelfMonitoringReport,
        deleteTraineeSelfMonitoringReport,
        getTraineeSelfReports,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}