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
    key: 'internshipAgreement',
    id: 'doc-agreement',
    num: '1',
    title: 'Internship Agreement',
    subtitle: 'Workplace Training Contract & Agreement',
    desc: 'Formal internship training contract detailing internship schedule, duties, workplace guidelines, and competencies.',
    icon: ClipboardList,
    color: 'from-blue-600 to-indigo-700',
    badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
  },
  {
    key: 'moa',
    id: 'doc-moa',
    num: '2',
    title: 'Memorandum of Agreement',
    subtitle: 'Institutional Partnership Agreement (MOA)',
    desc: 'Tripartite Memorandum of Agreement executed between CHMSU, the Host Training Establishment (HTE), and the student.',
    icon: Building,
    color: 'from-slate-600 to-slate-800',
    badgeColor: 'bg-slate-100 text-slate-800 border-slate-200',
  },
  {
    key: 'consent',
    id: 'doc-consent',
    num: '3',
    title: 'Parental Consent',
    subtitle: 'Parent / Guardian Waiver & Consent Form',
    desc: 'Signed student waiver, assumption of liability, and parent/guardian emergency authorization for off-campus internship.',
    icon: HeartHandshake,
    color: 'from-violet-500 to-purple-600',
    badgeColor: 'bg-violet-100 text-violet-800 border-violet-200',
  },
  {
    key: 'trainingPlan',
    id: 'doc-training-plan',
    num: '4',
    title: 'Training Plan',
    subtitle: 'Internship Course Training & Learning Outline',
    desc: 'Structured curriculum training plan, competency goals, skills matrix, and weekly task schedule for the internship.',
    icon: BookOpen,
    color: 'from-emerald-500 to-teal-600',
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  },
  {
    key: 'pledgeOfConduct',
    id: 'doc-pledge',
    num: '5',
    title: 'Pledge of Conduct',
    subtitle: 'Student Code of Discipline & Ethics',
    desc: 'Formal signed commitment acknowledging student ethical standards, university policies, and workplace conduct.',
    icon: FileCheck,
    color: 'from-indigo-500 to-blue-600',
    badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  },
  {
    key: 'medical',
    id: 'doc-medical',
    num: '6',
    title: 'Medical Certificate',
    subtitle: 'Health & Physical Fitness Clearance',
    desc: 'Official medical examination clearance and physical fitness certification from a licensed physician or university clinic.',
    icon: Shield,
    color: 'from-teal-500 to-emerald-600',
    badgeColor: 'bg-teal-100 text-teal-800 border-teal-200',
  },
  {
    key: 'application',
    id: 'doc-application',
    num: '7',
    title: 'Application',
    subtitle: 'Student Internship Application Form / Letter',
    desc: 'Official formal application letter and application form submitted to the Host Training Establishment for OJT placement.',
    icon: FileText,
    color: 'from-amber-500 to-orange-600',
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
  },
  {
    key: 'resume',
    id: 'doc-resume',
    num: '8',
    title: 'Resume',
    subtitle: 'Curriculum Vitae / Student Bio-data',
    desc: 'Comprehensive student profile, educational background, contact details, technical skill highlights, and 2x2 ID photo.',
    icon: User,
    color: 'from-rose-500 to-pink-600',
    badgeColor: 'bg-rose-100 text-rose-800 border-rose-200',
  },
  {
    key: 'enrolmentForm',
    id: 'doc-enrolment',
    num: '9',
    title: 'Enrolment Form',
    subtitle: 'Certificate of Registration (COR)',
    desc: 'Official university enrolment assessment form or Certificate of Registration for the active OJT term / semester.',
    icon: GraduationCap,
    color: 'from-cyan-500 to-blue-600',
    badgeColor: 'bg-cyan-100 text-cyan-800 border-cyan-200',
  },
  {
    key: 'endorsement',
    id: 'doc-endorsement',
    num: '10',
    title: 'Endorsement Letter',
    subtitle: 'Official University Endorsement Letter',
    desc: 'Official recommendation and endorsement letter from the college dean or OJT coordinator endorsing the student to the HTE.',
    icon: Award,
    color: 'from-purple-500 to-indigo-700',
    badgeColor: 'bg-purple-100 text-purple-800 border-purple-200',
  },
];

export const REQUIRED_TRAINEE_DOC_KEYS: (keyof TraineeDocuments)[] = [
  'internshipAgreement',
  'moa',
  'consent',
  'trainingPlan',
  'pledgeOfConduct',
  'medical',
  'application',
  'resume',
  'enrolmentForm',
  'endorsement',
];

export function getTraineeDocItem(
  submittedDocs: TraineeDocuments | undefined,
  key: keyof TraineeDocuments
): import('../types').TraineeDocumentItem | undefined {
  if (!submittedDocs) return undefined;
  if (submittedDocs[key]) return submittedDocs[key];
  if (key === 'trainingPlan' && submittedDocs.dutiesAndResponsibilities) return submittedDocs.dutiesAndResponsibilities;
  if (key === 'application' && (submittedDocs.evaluationForm || submittedDocs.evaluationReport)) return submittedDocs.evaluationForm || submittedDocs.evaluationReport;
  if (key === 'consent' && (submittedDocs.parent_consent || submittedDocs.parentalConsent)) return submittedDocs.parent_consent || submittedDocs.parentalConsent;
  if (key === 'internshipAgreement' && (submittedDocs.internship_agreement || submittedDocs.agreement)) return submittedDocs.internship_agreement || submittedDocs.agreement;
  if (key === 'moa' && (submittedDocs.memorandumOfAgreement || (submittedDocs as any).moaDoc)) return submittedDocs.memorandumOfAgreement || (submittedDocs as any).moaDoc;
  if (key === 'medical' && (submittedDocs.medicalCertificate || (submittedDocs as any).medCert)) return submittedDocs.medicalCertificate || (submittedDocs as any).medCert;
  if (key === 'endorsement' && (submittedDocs.endorsementLetter || (submittedDocs as any).endorsementDoc)) return submittedDocs.endorsementLetter || (submittedDocs as any).endorsementDoc;
  return undefined;
}
