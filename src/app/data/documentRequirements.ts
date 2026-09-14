import {
  Award,
  BookOpen,
  Briefcase,
  Building,
  ClipboardList,
  FileCheck,
  FileText,
  GraduationCap,
  HeartHandshake,
  LucideIcon,
  Shield,
  User,
} from 'lucide-react';
import { TraineeDocuments } from '../types';

export interface RequiredDocMetadata {
  key: keyof TraineeDocuments;
  id: string;
  num: string;
  title: string;
  subtitle: string;
  desc: string;
  icon: LucideIcon;
  color: string;
  badgeColor: string;
}

export const REQUIRED_TRAINEE_DOCUMENTS: RequiredDocMetadata[] = [
  {
    key: 'pledgeOfConduct',
    id: 'doc-pledge',
    num: '1',
    title: 'Pledge of Conduct',
    subtitle: 'Student Code of Discipline & Ethics',
    desc: 'Formal signed commitment acknowledging student ethical standards, university policies, and workplace conduct.',
    icon: FileCheck,
    color: 'from-blue-500 to-indigo-600',
    badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
  },
  {
    key: 'medical',
    id: 'doc-medical',
    num: '2',
    title: 'Medical Certificate',
    subtitle: 'Health & Physical Fitness Clearance',
    desc: 'Official medical examination clearance and physical fitness certification from a licensed physician or university clinic.',
    icon: Shield,
    color: 'from-emerald-500 to-teal-600',
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  },
  {
    key: 'enrolmentForm',
    id: 'doc-enrolment',
    num: '3',
    title: 'Enrolment Form',
    subtitle: 'Certificate of Registration (COR)',
    desc: 'Official university enrolment assessment form or Certificate of Registration for the active OJT term / semester.',
    icon: GraduationCap,
    color: 'from-cyan-500 to-blue-600',
    badgeColor: 'bg-cyan-100 text-cyan-800 border-cyan-200',
  },
  {
    key: 'consent',
    id: 'doc-consent',
    num: '4',
    title: 'Parental Consent for Student Internship',
    subtitle: 'Parent / Guardian Waiver & Consent',
    desc: 'Signed student waiver, assumption of liability, and parent/guardian emergency authorization for off-campus internship.',
    icon: HeartHandshake,
    color: 'from-violet-500 to-purple-600',
    badgeColor: 'bg-violet-100 text-violet-800 border-violet-200',
  },
  {
    key: 'resume',
    id: 'doc-resume',
    num: '5',
    title: 'Resume',
    subtitle: 'Curriculum Vitae / Student Bio-data',
    desc: 'Comprehensive student profile, educational background, contact details, technical skill highlights, and 2x2 ID photo.',
    icon: User,
    color: 'from-amber-500 to-orange-600',
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
  },
  {
    key: 'dutiesAndResponsibilities',
    id: 'doc-duties',
    num: '6',
    title: 'Duties and Responsibilities of BSIS Trainees',
    subtitle: 'Terms of Reference & Scope of Work',
    desc: 'Detailed terms of reference and signed acknowledgment of the specific workplace duties assigned to the BSIS intern.',
    icon: Briefcase,
    color: 'from-fuchsia-500 to-pink-600',
    badgeColor: 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200',
  },
  {
    key: 'moa',
    id: 'doc-moa',
    num: '7',
    title: 'Memorandum of Agreement',
    subtitle: 'Institutional Partnership Agreement (MOA)',
    desc: 'Tripartite Memorandum of Agreement executed between CHMSU, the Host Training Establishment (HTE), and the student.',
    icon: Building,
    color: 'from-slate-600 to-slate-800',
    badgeColor: 'bg-slate-100 text-slate-800 border-slate-200',
  },
  {
    key: 'internshipAgreement',
    id: 'doc-agreement',
    num: '8',
    title: 'Internship Agreement',
    subtitle: 'Workplace Training Contract',
    desc: 'Formal internship contract detailing training schedule, workplace policies, supervisor guidance, and competencies.',
    icon: ClipboardList,
    color: 'from-indigo-500 to-blue-700',
    badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  },
  {
    key: 'evaluationForm',
    id: 'doc-evaluation',
    num: '9',
    title: 'On The Job Training Evaluation Form',
    subtitle: 'Official Performance Appraisal Sheet',
    desc: 'Standard university performance evaluation form to be completed and signed by the designated HTE supervisor.',
    icon: Award,
    color: 'from-rose-500 to-red-600',
    badgeColor: 'bg-rose-100 text-rose-800 border-rose-200',
  },
  {
    key: 'evaluationReport',
    id: 'doc-report',
    num: '10',
    title: 'Evaluation Report',
    subtitle: 'Official Trainee Performance Assessment',
    desc: 'Comprehensive post-training performance report, competency appraisal ratings, and final evaluation summary from the HTE.',
    icon: FileText,
    color: 'from-emerald-600 to-teal-700',
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  },
];

export const REQUIRED_TRAINEE_DOC_KEYS: (keyof TraineeDocuments)[] = [
  'pledgeOfConduct',
  'medical',
  'enrolmentForm',
  'consent',
  'resume',
  'dutiesAndResponsibilities',
  'moa',
  'internshipAgreement',
  'evaluationForm',
  'evaluationReport',
];
