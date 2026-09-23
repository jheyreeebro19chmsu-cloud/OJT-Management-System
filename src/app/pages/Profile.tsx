import {
  User,
  Building,
  GraduationCap,
  Clock,
  Camera,
  Edit2,
  Check,
  CheckCircle,
  FileCheck,
  X,
  MapPin,
  Award,
  Star,
  KeyRound,
  Download,
  Eye,
  Printer,
  Navigation,
  Loader2,
  Upload,
  FileText,
  AlertCircle,
  RefreshCw,
  Trash2,
  Phone,
} from 'lucide-react';
import { motion } from 'motion/react';
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

import { useApp } from '../store/AppContext';
import type { Employee } from '../types';
import type { TraineeDocuments, TraineeDocumentItem } from '../types';
import { campusOptions, departmentOptions, getCoursesForDepartment } from '../data/academicOptions';
import { getPhotoUrl } from '../services/config';
import { isSecurityApiConfigured, registerFace } from '../services/securityApi';
import { getCurrentLocation, reverseGeocode } from '../utils/geo';
import { readAsDataUrl } from './Announcements';
import AvatarEditor from '../components/AvatarEditor';
import { FaceCapture } from '../components/FaceCapture';
import { STANDARD_REQUIRED_DOCS } from './Documents';
import { REQUIRED_TRAINEE_DOC_KEYS } from '../data/documentRequirements';
import { downloadDocument, getFileCategory } from '../utils/attachmentHelper';
import { GeofenceMap } from '../components/GeofenceMap';


const GRADE_CONFIG = {
  Excellent: { color: 'text-green-700', bg: 'bg-green-100' },
  'Very Good': { color: 'text-blue-700', bg: 'bg-blue-100' },
  Good: { color: 'text-sky-700', bg: 'bg-sky-100' },
  Satisfactory: { color: 'text-yellow-700', bg: 'bg-yellow-100' },
  'Needs Improvement': { color: 'text-red-700', bg: 'bg-red-100' },
};

const CRITERIA_LABELS: Record<string, string> = {
  attendanceScore: 'Attendance',
  performanceScore: 'Performance',
  attitudeScore: 'Attitude',
  punctualityScore: 'Punctuality',
  communicationScore: 'Communication',
};

// Small presentational components must be declared at module scope
function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">{icon}</div>
        <h3 className="font-bold text-gray-800 text-sm">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between py-2 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-500 shrink-0 w-28">{label}</span>
      <span className="text-xs font-medium text-gray-800 text-right flex-1 ml-2">{value || '—'}</span>
    </div>
  );
}

// Utility to safely format dates without throwing on invalid values
function safeFormatDate(value: any, options?: Intl.DateTimeFormatOptions) {
  try {
    const d = new Date(value);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-US', options || { month: 'long', day: 'numeric', year: 'numeric' });
  } catch {
    return '—';
  }
}

export function Profile() {
  const {
    currentUser,
    getCurrentEmployee,
    getEmployeeRecords,
    updateEmployee,
    getEmployeeEvaluation,
    getLatestHostFeedback,
    changeCurrentUserPassword,
    settings,
    addGeofenceZone,
  } = useApp();
  const [syncingLocation, setSyncingLocation] = useState(false);
  const [resolvedGpsAddress, setResolvedGpsAddress] = useState<string>('');
  const rawEmployee = getCurrentEmployee();

  useEffect(() => {
    if (rawEmployee?.registrationLocation?.lat && rawEmployee?.registrationLocation?.lng) {
      const empAny = rawEmployee as any;
      const homeAddr = [empAny?.street, empAny?.barangay, empAny?.city, empAny?.province, empAny?.region].filter(Boolean).join(', ');
      const reg = rawEmployee.registrationAddress || '';
      const isHomeDupe = Boolean(homeAddr && empAny?.barangay && reg.toLowerCase().includes(empAny.barangay.toLowerCase()));

      if (!reg || isHomeDupe) {
        reverseGeocode(rawEmployee.registrationLocation.lat, rawEmployee.registrationLocation.lng).then((resolved) => {
          if (resolved && resolved !== reg) {
            setResolvedGpsAddress(resolved);
            if (rawEmployee.id && isHomeDupe) {
              updateEmployee(rawEmployee.id, { registrationAddress: resolved });
            }
          }
        });
      }
    }
  }, [rawEmployee?.registrationLocation, rawEmployee?.registrationAddress]);
  const employee: Employee = rawEmployee || {
    id: currentUser?.id || currentUser?.employeeId || `emp-${Date.now()}`,
    employeeId: currentUser?.employeeId || currentUser?.id || 'OJT-STUDENT',
    name: currentUser?.name || 'Trainee Student',
    email: currentUser?.email || '',
    department: (currentUser as any)?.department || 'College of Computer Studies',
    position: (currentUser as any)?.position || 'OJT Trainee',
    companyName: (currentUser as any)?.companyName || 'Host Training Establishment',
    supervisorName: (currentUser as any)?.supervisorName || 'HTE Supervisor',
    schoolName: (currentUser as any)?.schoolName || 'Carlos Hilado Memorial State University',
    campus: (currentUser as any)?.campus || 'Talisay Campus',
    course: (currentUser as any)?.course || 'BS Information Technology',
    startDate: (currentUser as any)?.startDate || new Date().toISOString().split('T')[0],
    endDate: (currentUser as any)?.endDate || new Date().toISOString().split('T')[0],
    requiredHours: (currentUser as any)?.requiredHours || 486,
    photo: currentUser?.photo || '',
    faceRegistered: currentUser?.faceRegistered ?? false,
    active: true,
    academicYear: (currentUser as any)?.academicYear || settings.activeAcademicYear,
    approvalStatus: 'approved',
    createdAt: new Date().toISOString().split('T')[0],
  };
  const records = getEmployeeRecords(employee.id);
  const evaluation = getEmployeeEvaluation(employee.id);
  const hostFeedback = getLatestHostFeedback(employee.id);
  const [editing, setEditing] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [previewDocModal, setPreviewDocModal] = useState<{ title: string; fileName?: string; fileUrl?: string; note?: string; date?: string } | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [showAvatarEditor, setShowAvatarEditor] = useState(false);
  const [faceCaptureOpen, setFaceCaptureOpen] = useState(false);

  const initialRegLoc = (employee as any)?.registrationLocation;
  const isCoordStr = (val?: string) => Boolean(val && /^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/.test(String(val).trim()));
  const initialPhone =
    employee.phone ||
    employee.contactPhone ||
    employee.telephone ||
    initialRegLoc?.phone ||
    initialRegLoc?.contactPhone ||
    initialRegLoc?.telephone ||
    '';
  const initialResidential =
    employee.residentialAddress ||
    initialRegLoc?.residentialAddress ||
    initialRegLoc?.homeAddress ||
    (!isCoordStr(employee.address) ? employee.address : undefined) ||
    (!isCoordStr(initialRegLoc?.address) ? initialRegLoc?.address : undefined) ||
    [employee.street || initialRegLoc?.street, employee.barangay || initialRegLoc?.barangay, employee.city || initialRegLoc?.city, employee.province || initialRegLoc?.province]
      .filter(Boolean)
      .join(', ') ||
    '';

  const [form, setForm] = useState({
    name: employee.name || '',
    email: employee.email || '',
    phone: initialPhone,
    residentialAddress: initialResidential,
    street: employee.street || initialRegLoc?.street || '',
    barangay: employee.barangay || initialRegLoc?.barangay || '',
    city: employee.city || initialRegLoc?.city || '',
    province: employee.province || initialRegLoc?.province || '',
    supervisorName: employee.supervisorName || '',
    campus: employee.campus || '',
    department: employee.department || '',
    course: employee.course || '',
  });

  useEffect(() => {
    if (!editing && employee) {
      const regAny = (employee as any)?.registrationLocation;
      const isC = (val?: string) => Boolean(val && /^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/.test(String(val).trim()));
      const ph =
        employee.phone ||
        employee.contactPhone ||
        employee.telephone ||
        regAny?.phone ||
        regAny?.contactPhone ||
        regAny?.telephone ||
        '';
      const res =
        employee.residentialAddress ||
        regAny?.residentialAddress ||
        regAny?.homeAddress ||
        (!isC(employee.address) ? employee.address : undefined) ||
        (!isC(regAny?.address) ? regAny?.address : undefined) ||
        [employee.street || regAny?.street, employee.barangay || regAny?.barangay, employee.city || regAny?.city, employee.province || regAny?.province]
          .filter(Boolean)
          .join(', ') ||
        '';
      setForm((prev) => ({
        ...prev,
        name: employee.name || prev.name,
        email: employee.email || prev.email,
        phone: ph || prev.phone,
        residentialAddress: res || prev.residentialAddress,
        street: employee.street || regAny?.street || prev.street,
        barangay: employee.barangay || regAny?.barangay || prev.barangay,
        city: employee.city || regAny?.city || prev.city,
        province: employee.province || regAny?.province || prev.province,
        supervisorName: employee.supervisorName || prev.supervisorName,
        campus: employee.campus || prev.campus,
        department: employee.department || prev.department,
        course: employee.course || prev.course,
      }));
    }
  }, [employee, editing]);
  const [docUploadingKey, setDocUploadingKey] = useState<string | null>(null);
  const [passwordForm, setPasswordForm] = useState({ current: '', new: '', confirm: '' });

  const submittedDocs: TraineeDocuments = employee?.submittedDocuments || {};
  const docKeys = REQUIRED_TRAINEE_DOC_KEYS;
  const totalRequired = docKeys.length;
  const uploadedDocCount = docKeys.filter((k) => Boolean(submittedDocs[k]?.dataUrl || submittedDocs[k]?.name)).length;

  const handleProfileDocUpload = (docKey: keyof TraineeDocuments, file: File | null) => {
    if (!file) return;

    // Validate file type — Pictures (JPG, PNG, WEBP), PDF, Word (DOC, DOCX)
    const ALLOWED_MIME = [
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    const ALLOWED_EXT = /\.(pdf|jpg|jpeg|png|webp|doc|docx)$/i;
    if (!ALLOWED_MIME.includes(file.type) && !ALLOWED_EXT.test(file.name)) {
      toast.error(
        `Unsupported file type: "${file.name.split('.').pop()?.toUpperCase() || 'Unknown'}". Accepted formats: Pictures (JPG, PNG, WEBP), PDF, and Word documents (DOC, DOCX).`
      );
      return;
    }

    // Check size limit: max 10MB
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size exceeds 10MB limit. Please choose a file up to 10MB.');
      return;
    }

    setDocUploadingKey(docKey);
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const newDocItem: TraineeDocumentItem = {
        name: file.name,
        size: file.size,
        dataUrl,
        fileType: file.type || 'application/octet-stream',
        uploadedAt: new Date().toISOString(),
        // Pending until OJT Coordinator reviews
        status: 'pending',
      };
      const updatedDocs: TraineeDocuments = {
        ...(employee?.submittedDocuments || {}),
        [docKey]: newDocItem,
      };
      updateEmployee(employee.id, {
        submittedDocuments: updatedDocs,
        documentsPassed: false,
        documentsStatus: 'submitted',
      });
      setDocUploadingKey(null);
      const meta = STANDARD_REQUIRED_DOCS.find((d) => d.key === docKey);
      toast.success(`${meta?.title || 'Document'} submitted! Pending coordinator review.`);
    };
    reader.onerror = () => {
      setDocUploadingKey(null);
      toast.error('Failed to read file. Please try again.');
    };
    reader.readAsDataURL(file);
  };

  const handleProfileFaceSuccess = async (img?: string) => {
    if (!img || !employee) return;
    setFaceCaptureOpen(false);
    setAvatarPreview(img);
    try {
      if (isSecurityApiConfigured()) {
        const resp = await registerFace({ employee_id: String(employee.id), image: img });
        if (resp.success && resp.image_url) {
          updateEmployee(employee.id, { photo: resp.image_url, faceRegistered: true });
          toast.success('Face registered and profile picture updated!');
          return;
        }
      }
      updateEmployee(employee.id, { photo: img, faceRegistered: true });
      toast.success('Face registered and profile picture updated!');
    } catch (err: any) {
      console.error('Face registration error:', err);
      updateEmployee(employee.id, { photo: img, faceRegistered: true });
      toast.success('Profile photo updated with face scan!');
    }
  };

  const totalHours = records.reduce((s, r) => s + (r.totalHours || 0), 0);
  const presentDays = records.filter((r) => r.status === 'present' || r.status === 'overtime').length;
  const reqHours = Number(employee.requiredHours) || 0;
  const progressPct = reqHours > 0 ? Math.min((totalHours / reqHours) * 100, 100) : 0;

  const handleSave = () => {
    const finalAddress = form.residentialAddress?.trim() || [form.street, form.barangay, form.city, form.province].filter(Boolean).join(', ');

    updateEmployee(employee.id, {
      ...form,
      phone: form.phone,
      contactPhone: form.phone,
      telephone: form.phone,
      residentialAddress: finalAddress,
      address: finalAddress,
    });
    setEditing(false);
    toast.success('Personal and contact information updated!');
  };

  const handlePasswordChange = async () => {
    const result = await changeCurrentUserPassword(passwordForm.current, passwordForm.new);
    if (result.success) {
      toast.success(result.message);
      setPasswordForm({ current: '', new: '', confirm: '' });
    } else {
      toast.error(result.message);
    }
  };

  return (
    <div className="space-y-4">
      {/* Live Face Scanner Modal */}
      {faceCaptureOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-800 text-base">Facial Recognition Enrollment</h3>
              <button
                onClick={() => setFaceCaptureOpen(false)}
                className="p-1 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <p className="text-xs text-gray-500">
              Align your face inside the circle to enroll your biometrics and automatically update your official profile photo.
            </p>
            <FaceCapture
              mode="register"
              employeeName={employee.name}
              onSuccess={handleProfileFaceSuccess}
              onCancel={() => setFaceCaptureOpen(false)}
              autoStart
            />
          </div>
        </div>
      )}

      {/* Profile Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-blue-800 to-blue-900 rounded-3xl p-5 text-white"
      >
        <div className="flex items-start gap-4">
          <div className="relative">
            <div className="w-16 h-16 bg-blue-700 rounded-2xl flex items-center justify-center overflow-hidden border-2 border-white/20 shadow-inner">
              {avatarPreview ? (
                <img src={avatarPreview} alt="avatar preview" className="w-full h-full object-cover" />
              ) : employee.photo || currentUser?.photo ? (
                <img
                  src={getPhotoUrl(employee.photo || currentUser?.photo || '')}
                  alt={employee.name}
                  className="w-full h-full object-cover"
                  style={{ transform: 'scaleX(-1)' }}
                />
              ) : (
                <User size={28} className="text-blue-300" />
              )}
            </div>
            {employee.faceRegistered && (
              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center border-2 border-blue-800">
                <Camera size={9} className="text-white" />
              </div>
            )}
            <button
              onClick={() => setShowAvatarEditor(true)}
              className="absolute -top-1 -right-1 bg-white rounded-full p-1 border border-gray-200 shadow hover:bg-gray-50"
              title="Upload photo"
            >
              <Edit2 size={12} className="text-slate-600" />
            </button>
          </div>

          {showAvatarEditor && employee && (
            <AvatarEditor employeeId={String(employee.id)} onClose={() => setShowAvatarEditor(false)} />
          )}
          <div className="flex-1">
            <h2 className="font-bold text-lg leading-tight">{employee.name}</h2>
            <p className="text-blue-200 text-sm">{employee.employeeId}</p>
            <p className="text-blue-300 text-xs mt-0.5">
              {employee.position} • {employee.department}
            </p>
            {employee.faceRegistered ? (
              <button
                onClick={() => setFaceCaptureOpen(true)}
                className="mt-2 inline-flex items-center gap-1.5 text-xs text-green-300 hover:text-green-100 bg-white/10 hover:bg-white/20 px-2.5 py-1 rounded-lg transition-colors border border-green-400/30"
              >
                <Camera size={12} />
                <span>Face Enrolled (Click to Retake)</span>
              </button>
            ) : (
              <button
                onClick={() => setFaceCaptureOpen(true)}
                className="mt-2 inline-flex items-center gap-1.5 text-xs text-amber-200 hover:text-white bg-amber-500/30 hover:bg-amber-500/50 px-2.5 py-1 rounded-lg transition-colors border border-amber-300/30 font-semibold"
              >
                <Camera size={12} />
                <span>Scan Face & Set Profile Pic</span>
              </button>
            )}
          </div>
        </div>

        {/* Progress */}
        <div className="mt-4">
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-blue-200">OJT Progress</span>
            <span className="text-white font-medium">
              {totalHours.toFixed(1)} / {employee.requiredHours} hrs ({Math.round(progressPct)}%)
            </span>
          </div>
          <div className="h-2 bg-blue-700 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-sky-400 to-green-400 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 1, delay: 0.2 }}
            />
          </div>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-2 mt-4">
          <div className="bg-white/15 rounded-xl p-2 text-center">
            <p className="font-bold">{presentDays}</p>
            <p className="text-blue-200 text-xs">Present</p>
          </div>
          <div className="bg-white/15 rounded-xl p-2 text-center">
            <p className="font-bold">{records.filter((r) => r.status === 'late').length}</p>
            <p className="text-blue-200 text-xs">Late Days</p>
          </div>
          <div className="bg-white/15 rounded-xl p-2 text-center">
            <p className="font-bold">{totalHours.toFixed(0)}</p>
            <p className="text-blue-200 text-xs">Total Hrs</p>
          </div>
        </div>
      </motion.div>

      {evaluation &&
        (evaluation.status === 'final' ||
          evaluation.status === 'submitted_to_instructor' ||
          evaluation.status === 'reviewed_by_instructor') &&
        (() => {
          const gc = GRADE_CONFIG[evaluation.grade];
          return (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 }}
              className={`rounded-2xl p-5 border ${gc.bg} shadow-sm`}
            >
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-white/60 rounded-lg flex items-center justify-center">
                  <Award size={16} className={gc.color} />
                </div>
                <h3 className={`font-bold text-sm ${gc.color}`}>OJT Evaluation Result</h3>
                {evaluation.status === 'reviewed_by_instructor' ? (
                  <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                    ✓ Verified by Instructor
                  </span>
                ) : (
                  <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                    Pending Instructor Review
                  </span>
                )}
              </div>

              <div className="text-center mb-4">
                <p className={`text-4xl font-bold ${gc.color}`}>{evaluation.overallScore}%</p>
                <p className={`text-lg font-semibold mt-1 ${gc.color}`}>{evaluation.grade}</p>
                <p className="text-xs text-gray-500 mt-1">{safeFormatDate(evaluation.evaluatedAt, { month: 'short', day: 'numeric', year: 'numeric' })}</p>
              </div>

              {/* Score breakdown */}
              <div className="space-y-2 mb-4">
                {Object.entries(CRITERIA_LABELS).map(([key, label]) => {
                  const score = evaluation[key as keyof typeof evaluation] as number;
                  return (
                    <div key={key}>
                      <div className="flex justify-between text-xs mb-0.5">
                        <span className="text-gray-600">{label}</span>
                        <span className="font-semibold text-gray-800">{score}%</span>
                      </div>
                      <div className="h-1.5 bg-white/60 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${score >= 90 ? 'bg-green-500' : score >= 80 ? 'bg-blue-500' : score >= 70 ? 'bg-sky-500' : score >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`}
                          style={{ width: `${score}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {evaluation.strengths && (
                <div className="bg-white/50 rounded-xl p-3 mb-2">
                  <p className="text-xs font-semibold text-gray-500 mb-1">Strengths</p>
                  <p className="text-sm text-gray-700">{evaluation.strengths}</p>
                </div>
              )}
              {evaluation.recommendations && (
                <div className="bg-white/50 rounded-xl p-3">
                  <p className="text-xs font-semibold text-gray-500 mb-1">Recommendations</p>
                  <p className="text-sm text-gray-700">{evaluation.recommendations}</p>
                </div>
              )}
              <div className="mt-3 pt-3 border-t border-slate-200/50 flex justify-end">
                <Link
                  to="/app/evaluation"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-700 hover:text-blue-900 bg-white/80 hover:bg-white px-3 py-1.5 rounded-xl transition-all shadow-xs"
                >
                  <Award size={13} /> Open OJT Questionnaire →
                </Link>
              </div>
            </motion.div>
          );
        })()}

      {hostFeedback && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100"
        >
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
              <Star size={15} className="text-amber-700" />
            </div>
            <div>
              <h3 className="font-bold text-gray-800 text-sm">Host Establishment Feedback</h3>
              <p className="text-xs text-gray-500">
                {hostFeedback.hostCompany} - {hostFeedback.hostName}
              </p>
            </div>
            <span className="ml-auto text-xs text-gray-400">{safeFormatDate(hostFeedback.submittedAt, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-amber-50 rounded-xl p-3 text-center">
              <p className="text-xs text-amber-700">Overall Score</p>
              <p className="text-xl font-bold text-amber-800">{hostFeedback.overallScore}%</p>
            </div>
            <div className="bg-amber-50 rounded-xl p-3 text-center">
              <p className="text-xs text-amber-700">Recommendation</p>
              <p className="text-sm font-semibold text-amber-800">{hostFeedback.recommendation}</p>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 text-xs mb-4">
            <div className="bg-gray-50 rounded-xl p-2 text-center">
              Attendance: <span className="font-semibold">{hostFeedback.attendanceScore}%</span>
            </div>
            <div className="bg-gray-50 rounded-xl p-2 text-center">
              Performance: <span className="font-semibold">{hostFeedback.performanceScore}%</span>
            </div>
            <div className="bg-gray-50 rounded-xl p-2 text-center">
              Attitude: <span className="font-semibold">{hostFeedback.attitudeScore}%</span>
            </div>
            <div className="bg-gray-50 rounded-xl p-2 text-center">
              Communication: <span className="font-semibold">{hostFeedback.communicationScore}%</span>
            </div>
            <div className="bg-gray-50 rounded-xl p-2 text-center">
              Teamwork: <span className="font-semibold">{hostFeedback.teamworkScore}%</span>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs font-semibold text-gray-500 mb-1">Strengths</p>
              <p className="text-sm text-gray-700">{hostFeedback.strengths || '-'}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs font-semibold text-gray-500 mb-1">Areas for Improvement</p>
              <p className="text-sm text-gray-700">{hostFeedback.areasForImprovement || '-'}</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Required Documents */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.09 }}
        className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <FileCheck size={15} className="text-blue-700" />
            </div>
            <div>
              <h3 className="font-bold text-gray-800 text-sm">Required Documents</h3>
              <p className="text-[10px] text-gray-500 mt-0.5">{uploadedDocCount}/4 submitted</p>
            </div>
          </div>
          <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${
            uploadedDocCount === totalRequired
              ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
              : 'bg-amber-50 text-amber-700 border-amber-300'
          }`}>
            {uploadedDocCount === totalRequired ? '✓ All Submitted' : `${totalRequired - uploadedDocCount} Missing`}
          </span>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-4">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-700"
            style={{ width: `${(uploadedDocCount / totalRequired) * 100}%` }}
          />
        </div>

        <div className="space-y-2">
          {STANDARD_REQUIRED_DOCS.map((item) => {
            const doc = submittedDocs[item.key];
            const hasFile = Boolean(doc?.dataUrl || doc?.name);
            const isPassed = doc?.status === 'passed' && hasFile;
            const isPending = (doc?.status === 'pending' || !doc?.status) && hasFile;
            const isUploading = docUploadingKey === item.key;

            return (
              <div
                key={item.key}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                  isPassed
                    ? 'bg-emerald-50 border-emerald-200'
                    : isPending
                      ? 'bg-blue-50 border-blue-200'
                      : 'bg-gray-50 border-gray-100'
                }`}
              >
                {/* Status icon */}
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                  isPassed ? 'bg-emerald-100' : isPending ? 'bg-blue-100' : 'bg-gray-200'
                }`}>
                  {isPassed ? (
                    <Check size={13} className="text-emerald-700 stroke-[3]" />
                  ) : isPending ? (
                    <Clock size={13} className="text-blue-600" />
                  ) : (
                    <AlertCircle size={13} className="text-gray-400" />
                  )}
                </div>

                {/* Doc info */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-800 truncate">{item.title}</p>
                  {hasFile && doc ? (
                    <p className="text-[10px] text-gray-500 truncate">
                      {doc.name}
                      {isPassed && ' · Approved'}
                      {isPending && ' · Pending Review'}
                    </p>
                  ) : (
                    <p className="text-[10px] text-gray-400">Not yet submitted</p>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {hasFile && doc?.dataUrl && (
                    <button
                      type="button"
                      onClick={() =>
                        setPreviewDocModal({
                          title: item.title,
                          fileName: doc.name,
                          fileUrl: doc.dataUrl,
                          date: doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString() : '',
                        })
                      }
                      className="p-1.5 rounded-lg bg-white border border-gray-200 text-gray-500 hover:text-blue-600 hover:border-blue-300 transition-all"
                      title="View document"
                    >
                      <Eye size={13} />
                    </button>
                  )}
                  {hasFile && doc?.dataUrl && (
                    <button
                      type="button"
                      onClick={() => downloadDocument(doc.dataUrl!, doc.name || `${item.key}_document`)}
                      className="p-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-600 hover:bg-emerald-100 transition-all"
                      title="Download document"
                    >
                      <Download size={13} />
                    </button>
                  )}
                  <label
                    htmlFor={`profile-doc-${item.key}`}
                    className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                      isUploading
                        ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                        : hasFile
                          ? 'bg-white border-gray-200 text-gray-500 hover:text-blue-600 hover:border-blue-300'
                          : 'bg-blue-600 border-blue-600 text-white hover:bg-blue-700'
                    }`}
                    title={hasFile ? 'Replace document' : 'Upload document'}
                  >
                    <Upload size={13} className={isUploading ? 'animate-spin' : ''} />
                    <input
                      type="file"
                      id={`profile-doc-${item.key}`}
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      className="hidden"
                      disabled={isUploading}
                      onChange={(e) => handleProfileDocUpload(item.key, e.target.files?.[0] || null)}
                    />
                  </label>
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-[10px] text-gray-400 mt-3 text-center">
          Accepted formats: Pictures (JPG, PNG, WEBP), PDF, Word (DOC, DOCX) · Up to 10MB per file · Downloadable anytime
        </p>
      </motion.div>

      {/* Editable Personal Info */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <User size={15} className="text-blue-700" />
            </div>
            <h3 className="font-bold text-gray-800 text-sm">Personal Information</h3>
          </div>
          {!editing ? (
            <button
              onClick={() => setEditing(true)}
              className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              <Edit2 size={12} /> Edit
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                className="text-xs text-green-600 hover:text-green-800 flex items-center gap-1"
              >
                <Check size={12} /> Save
              </button>
              <button
                onClick={() => setEditing(false)}
                className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
              >
                <X size={12} /> Cancel
              </button>
            </div>
          )}
        </div>
        {editing ? (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">Full Name</label>
              <input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">Email</label>
              <input
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">Contact / Telephone Number</label>
              <input
                value={form.phone}
                onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                placeholder="e.g. +639123456789 or 09123456789"
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
              <p className="text-[11px] text-gray-400 mt-0.5">Mobile phone or landline telephone number</p>
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">Residential Address (Home)</label>
              <input
                value={form.residentialAddress}
                onChange={(e) => setForm((p) => ({ ...p, residentialAddress: e.target.value }))}
                placeholder="House No., Street, Barangay, City/Municipality, Province"
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-[11px] text-gray-400 mt-0.5">Your official home residence (not the GPS / clock-in location)</p>
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">Supervisor Name</label>
              <input
                value={form.supervisorName}
                onChange={(e) => setForm((p) => ({ ...p, supervisorName: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">Campus</label>
              <select
                value={form.campus}
                onChange={(e) => setForm((p) => ({ ...p, campus: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Campus</option>
                {campusOptions.map((campus) => <option key={campus} value={campus}>{campus}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">Department</label>
              <select
                value={form.department}
                onChange={(e) => setForm((p) => ({ ...p, department: e.target.value, course: '' }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Department</option>
                {departmentOptions.map((department) => <option key={department} value={department}>{department}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">Course</label>
              <select
                value={form.course}
                onChange={(e) => setForm((p) => ({ ...p, course: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Course</option>
                {getCoursesForDepartment(form.department, form.campus).map((course) => <option key={course} value={course}>{course}</option>)}
              </select>
            </div>
          </div>
        ) : (
          <div>
            <InfoRow label="Full Name" value={employee.name} />
            <InfoRow label="Email" value={employee.email} />
            <InfoRow
              label="Contact / Telephone"
              value={
                form.phone ? (
                  <a href={`tel:${form.phone}`} className="text-blue-600 hover:underline font-semibold">
                    {form.phone}
                  </a>
                ) : (
                  <span className="text-gray-400">Not specified</span>
                )
              }
            />
            <InfoRow
              label="Residential Address"
              value={form.residentialAddress || <span className="text-gray-400">Not recorded</span>}
            />
            <InfoRow label="Supervisor" value={employee.supervisorName} />
            <InfoRow label="Department" value={employee.department} />
            <InfoRow label="Campus" value={employee.campus || 'Not specified'} />
            <InfoRow label="Course" value={employee.course} />
            {employee.registrationAddress && (
              <div className="flex items-start gap-2 py-2 border-b border-gray-50">
                <MapPin size={12} className="text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-gray-500">Registered Station (GPS)</p>
                  <p className="text-xs font-mono text-gray-700 mt-0.5">{employee.registrationAddress}</p>
                </div>
              </div>
            )}
            {/* Fallback to raw GPS coordinates if address missing */}
            {(!employee.registrationAddress && (employee as any).registrationLocation) && (
              <InfoRow label="Registered Location" value={`${(employee as any).registrationLocation.lat.toFixed(5)}, ${(employee as any).registrationLocation.lng.toFixed(5)}`} />
            )}
          </div>
        )}
      </motion.div>

      {/* Security Settings */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12 }}
        className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100"
      >
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center">
            <KeyRound size={15} className="text-indigo-700" />
          </div>
          <h3 className="font-bold text-gray-800 text-sm">Security</h3>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 font-medium block mb-1">Current Password</label>
            <input
              type="password"
              value={passwordForm.current}
              onChange={(e) => setPasswordForm((p) => ({ ...p, current: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="••••••••"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium block mb-1">New Password</label>
            <input
              type="password"
              value={passwordForm.new}
              onChange={(e) => setPasswordForm((p) => ({ ...p, new: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Min 8 characters"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium block mb-1">Confirm New Password</label>
            <input
              type="password"
              value={passwordForm.confirm}
              onChange={(e) => setPasswordForm((p) => ({ ...p, confirm: e.target.value }))}
              className={`w-full px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${passwordForm.confirm && passwordForm.new !== passwordForm.confirm ? 'border-red-300' : 'border-gray-200'}`}
              placeholder="••••••••"
            />
          </div>
          <button
            onClick={handlePasswordChange}
            disabled={
              !passwordForm.current ||
              !passwordForm.new ||
              passwordForm.new !== passwordForm.confirm ||
              passwordForm.new.length < 8
            }
            className="w-full py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 transition-all"
          >
            Update Password
          </button>
        </div>
      </motion.div>

      {/* Permanent Registered Location & Geofence */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }}>
        <Section title="Permanent Geofence & Location" icon={<MapPin size={15} className="text-blue-700" />}>
          <InfoRow
            label="Registered Address"
            value={resolvedGpsAddress || employee.registrationAddress || 'Assigned Establishment Location'}
          />
          <InfoRow
            label="GPS Coordinates"
            value={
              employee.registrationLocation?.lat && employee.registrationLocation?.lng
                ? `${employee.registrationLocation.lat.toFixed(6)}, ${employee.registrationLocation.lng.toFixed(6)}`
                : 'Locked upon registration'
            }
          />
          <InfoRow
            label="Geofence Radius"
            value="100 meters (Permanent Radius)"
          />
          <InfoRow
            label="Enrollment Status"
            value={
              <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full text-xs">
                <CheckCircle size={12} /> Active ({employee.academicYear || settings.activeAcademicYear})
              </span>
            }
          />
          <div className="pt-3 mt-2 border-t border-gray-100 flex items-center justify-between gap-2">
            <span className="text-[11px] text-gray-500 font-medium">Real-time attendance calibration</span>
            <button
              type="button"
              onClick={async () => {
                setSyncingLocation(true);
                try {
                  const position = await getCurrentLocation();
                  const { latitude, longitude, accuracy } = position.coords;
                  const resolvedAddress = await reverseGeocode(latitude, longitude);

                  await updateEmployee(employee.id, {
                    registrationLocation: { lat: latitude, lng: longitude },
                    registrationAddress: resolvedAddress,
                  });

                  addGeofenceZone({
                    id: `personal-${employee.id}`,
                    name: `${employee.name} - ${employee.companyName || 'Assigned Workplace'}`,
                    address: resolvedAddress,
                    lat: latitude,
                    lng: longitude,
                    radius: 100,
                    active: true,
                    academicYear: settings.activeAcademicYear,
                  });

                  toast.success(`Location calibrated to real-time GPS: ${resolvedAddress}`);
                } catch (err) {
                  console.error('Failed to sync location:', err);
                  toast.error('Could not lock real-time GPS. Please allow location permissions in your browser.');
                } finally {
                  setSyncingLocation(false);
                }
              }}
              disabled={syncingLocation}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
            >
              {syncingLocation ? (
                <>
                  <Loader2 size={12} className="animate-spin" />
                  <span>Locking GPS...</span>
                </>
              ) : (
                <>
                  <Navigation size={12} />
                  <span>Sync Real-Time GPS</span>
                </>
              )}
            </button>
          </div>

          {employee.registrationLocation?.lat && employee.registrationLocation?.lng && (
            <div className="mt-3 rounded-2xl overflow-hidden border border-gray-200">
              <div className="px-3 py-2 bg-slate-50 border-b border-gray-100 flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                  <MapPin size={13} className="text-blue-600" />
                  Calibrated Workplace Geofence
                </span>
                <span className="font-mono text-slate-500 text-[11px]">
                  {employee.registrationLocation.lat.toFixed(5)}, {employee.registrationLocation.lng.toFixed(5)}
                </span>
              </div>
              <GeofenceMap
                zones={[
                  {
                    id: `personal-${employee.id}`,
                    name: `${employee.name} - ${employee.companyName || 'Assigned Workplace'}`,
                    address: employee.registrationAddress || 'Calibrated Workplace GPS',
                    lat: employee.registrationLocation.lat,
                    lng: employee.registrationLocation.lng,
                    radius: 100,
                    active: true,
                  },
                ]}
                focusCoords={{
                  lat: employee.registrationLocation.lat,
                  lng: employee.registrationLocation.lng,
                }}
                className="h-56"
                allowFullscreen={false}
                allowResize={false}
              />
            </div>
          )}
        </Section>
      </motion.div>

      {/* Company Info */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <Section title="Company Information" icon={<Building size={15} className="text-blue-700" />}>
          <InfoRow label="Company" value={employee.companyName} />
          <InfoRow label="Department" value={employee.department} />
          <InfoRow label="Position" value={employee.position} />
          <InfoRow label="Start Date" value={safeFormatDate(employee.startDate)} />
          <InfoRow label="End Date" value={safeFormatDate(employee.endDate)} />
        </Section>
      </motion.div>

      {/* School Info */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Section title="School Information" icon={<GraduationCap size={15} className="text-blue-700" />}>
          <InfoRow label="School" value={employee.schoolName} />
          <InfoRow label="Course" value={employee.course} />
          <InfoRow label="Required Hours" value={`${employee.requiredHours} hours`} />
        </Section>
      </motion.div>

      {/* Schedule */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
        <Section title="Schedule Info" icon={<Clock size={15} className="text-blue-700" />}>
          <InfoRow label="OJT Start" value={safeFormatDate(employee.startDate)} />
          <InfoRow label="OJT End" value={safeFormatDate(employee.endDate)} />
          <InfoRow
            label="Hours Left"
            value={`${Math.max(0, (reqHours || 0) - totalHours).toFixed(1)} hrs remaining`}
          />
        </Section>
      </motion.div>

      {/* Individual Document Preview & Print Modal */}
      {previewDocModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 no-print">
          <div className="bg-white rounded-3xl p-6 max-w-2xl w-full shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3">
              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-gray-900 text-sm sm:text-base truncate">{previewDocModal.title}</h3>
                <p className="text-xs text-gray-500 font-mono truncate">{previewDocModal.fileName || 'Attached Document'}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 transition-all shadow-sm cursor-pointer"
                >
                  <Printer size={14} /> Print
                </button>
                {previewDocModal.fileUrl && (
                  <button
                    type="button"
                    onClick={() => downloadDocument(previewDocModal.fileUrl!, previewDocModal.fileName)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-semibold hover:bg-emerald-700 transition-all shadow-sm cursor-pointer"
                    title="Download document"
                  >
                    <Download size={14} /> Download
                  </button>
                )}
                <button
                  onClick={() => setPreviewDocModal(null)}
                  className="p-1 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 p-2 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs text-slate-600">
                  <div className="flex flex-wrap items-baseline gap-1.5">
                    <strong className="text-slate-800 shrink-0">Student Name:</strong>
                    <span className="font-semibold text-slate-900 break-words">{employee.name}</span>
                  </div>
                  <div className="flex flex-wrap items-baseline gap-1.5">
                    <strong className="text-slate-800 shrink-0">Student ID:</strong>
                    <span className="font-mono text-slate-900">{employee.employeeId}</span>
                  </div>
                  <div className="flex flex-wrap items-baseline gap-1.5">
                    <strong className="text-slate-800 shrink-0">Department:</strong>
                    <span className="text-slate-900 break-words">{employee.department}</span>
                  </div>
                  <div className="flex flex-wrap items-baseline gap-1.5">
                    <strong className="text-slate-800 shrink-0">Date Submitted:</strong>
                    <span className="text-slate-900">{previewDocModal.date}</span>
                  </div>
                </div>
                {previewDocModal.note && (
                  <div className="text-xs text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-200 mt-2">
                    <strong className="text-slate-800">Submission Note: </strong>
                    <span className="break-all text-[11px] text-slate-600 leading-relaxed">{previewDocModal.note}</span>
                  </div>
                )}
              </div>

              {previewDocModal.fileUrl ? (
                (() => {
                  const cat = getFileCategory(previewDocModal.fileName || previewDocModal.fileUrl);
                  const isImg =
                    cat === 'picture' ||
                    previewDocModal.fileUrl.startsWith('data:image/') ||
                    previewDocModal.fileUrl.match(/\.(jpeg|jpg|gif|png|webp)$/i);
                  const isWord =
                    cat === 'doc' ||
                    previewDocModal.fileUrl.startsWith('data:application/msword') ||
                    previewDocModal.fileUrl.startsWith('data:application/vnd') ||
                    previewDocModal.fileName?.match(/\.(doc|docx)$/i);

                  if (isImg) {
                    return (
                      <div className="flex flex-col items-center justify-center gap-3 bg-black/5 p-3 rounded-xl border border-slate-200">
                        <img
                          src={previewDocModal.fileUrl}
                          alt="Document preview"
                          className="max-h-[500px] object-contain rounded-lg shadow-sm"
                        />
                        <button
                          type="button"
                          onClick={() => downloadDocument(previewDocModal.fileUrl!, previewDocModal.fileName)}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-2 shadow-sm transition-all cursor-pointer"
                        >
                          <Download size={14} /> Download Picture
                        </button>
                      </div>
                    );
                  }

                  if (isWord) {
                    return (
                      <div className="w-full max-w-md mx-auto bg-white rounded-3xl p-6 border border-blue-200 shadow-md text-center">
                        <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3 border border-blue-100 shadow-inner">
                          <FileText size={36} className="stroke-[2.2]" />
                        </div>
                        <span className="px-3 py-1 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-800 border border-blue-200 uppercase tracking-wider inline-block mb-2">
                          Microsoft Word Document
                        </span>
                        <h4 className="text-base font-bold text-slate-900 mb-1">{previewDocModal.title}</h4>
                        <p className="text-xs text-slate-500 font-mono mb-4 break-all">{previewDocModal.fileName}</p>

                        <p className="text-[11px] text-slate-500 mb-4 leading-relaxed">
                          Word documents download directly to open with Microsoft Word, Google Docs, or Office apps.
                        </p>

                        <button
                          type="button"
                          onClick={() => downloadDocument(previewDocModal.fileUrl!, previewDocModal.fileName)}
                          className="w-full py-3 px-5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-extrabold inline-flex items-center justify-center gap-2 shadow-lg shadow-blue-200 transition-all cursor-pointer"
                        >
                          <Download size={15} /> Download Word Document
                        </button>
                      </div>
                    );
                  }

                  return (
                    <iframe
                      src={previewDocModal.fileUrl}
                      className="w-full h-96 rounded-xl border border-slate-200 bg-white"
                      title="Document PDF Preview"
                    />
                  );
                })()
              ) : (
                <p className="text-center py-10 text-xs text-gray-500">No media preview available for this document.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default Profile;
