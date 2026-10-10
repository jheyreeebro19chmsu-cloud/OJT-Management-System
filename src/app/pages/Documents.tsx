import React, { useState, useMemo } from 'react';
import {
  FileText,
  FileCheck,
  Shield,
  User,
  Upload,
  Trash2,
  Eye,
  Check,
  Clock,
  AlertTriangle,
  Download,
  Printer,
  X,
  ArrowLeft,
  CheckCircle2,
  RefreshCw,
  Info,
  Image as ImageIcon,
  File as FileGeneric,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'sonner';

import { useApp } from '../store/AppContext';
import { TraineeDocuments, TraineeDocumentItem } from '../types';
import { uploadDocumentToStorage, saveDocumentPassStatus } from '../services/supabaseService';
import { REQUIRED_TRAINEE_DOCUMENTS, REQUIRED_TRAINEE_DOC_KEYS } from '../data/documentRequirements';
import { downloadDocument, getFileCategory } from '../utils/attachmentHelper';

export const STANDARD_REQUIRED_DOCS = REQUIRED_TRAINEE_DOCUMENTS;

interface PreviewModalState {
  key?: string;
  title: string;
  subtitle?: string;
  fileName: string;
  dataUrl?: string;
  uploadedAt?: string;
  fileSize?: string | number;
  status: 'passed' | 'pending';
  description?: string;
  notes?: string;
}

interface SubmitDialogState {
  docKey: string;
  title: string;
  file: File;
  previewUrl: string;
  description: string;
  notes: string;
}

export function Documents() {
  const navigate = useNavigate();
  const { currentUser, getCurrentEmployee, updateEmployee, getEmployeeRequiredDocuments } = useApp();
  const employee = getCurrentEmployee();

  const [previewDoc, setPreviewDoc] = useState<PreviewModalState | null>(null);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [submitDialog, setSubmitDialog] = useState<SubmitDialogState | null>(null);

  const submittedDocs: TraineeDocuments = employee?.submittedDocuments || {};

  // Helper to safely get document item supporting legacy aliases
  const getDocItem = (key: string): TraineeDocumentItem | undefined => {
    if (submittedDocs[key]) return submittedDocs[key];
    if (key === 'consent' && submittedDocs.parent_consent) return submittedDocs.parent_consent;
    if (key === 'moa' && (submittedDocs.memorandum || submittedDocs.moa)) return submittedDocs.memorandum || submittedDocs.moa;
    if (key === 'medical' && submittedDocs.clearance) return submittedDocs.clearance;
    if (key === 'endorsement' && (submittedDocs.endorsement_letter || submittedDocs.endorsementLetter)) return submittedDocs.endorsement_letter || submittedDocs.endorsementLetter;
    if (key === 'application' && (submittedDocs.applicationForm || submittedDocs.application_letter || submittedDocs.applicationLetter)) return submittedDocs.applicationForm || submittedDocs.application_letter || submittedDocs.applicationLetter;
    if (key === 'trainingPlan' && submittedDocs.training_plan) return submittedDocs.training_plan;
    if (key === 'internshipAgreement' && submittedDocs.agreement) return submittedDocs.agreement;
    // Check case-insensitive key
    const foundKey = Object.keys(submittedDocs).find((k) => k.toLowerCase() === key.toLowerCase());
    return foundKey ? submittedDocs[foundKey] : undefined;
  };

  const customRequiredDocs = employee?.id ? getEmployeeRequiredDocuments(employee.id) : [];
  const allDocRequirements = useMemo(() => {
    const list = [...STANDARD_REQUIRED_DOCS];
    for (const custom of customRequiredDocs) {
      const isAlreadyCovered = list.some((d) => {
        const dTitle = d.title.toLowerCase();
        const cTitle = custom.title.toLowerCase();
        return (
          dTitle === cTitle ||
          d.key === custom.id ||
          d.id === custom.id ||
          custom.id.includes(d.key) ||
          (cTitle.includes('medical') && dTitle.includes('medical')) ||
          (cTitle.includes('resume') && dTitle.includes('resume')) ||
          (cTitle.includes('consent') && dTitle.includes('consent')) ||
          (cTitle.includes('memorandum') && dTitle.includes('memorandum')) ||
          (cTitle.includes('pledge') && dTitle.includes('pledge')) ||
          (cTitle.includes('enrolment') && dTitle.includes('enrolment')) ||
          (cTitle.includes('internship') && dTitle.includes('internship')) ||
          (cTitle.includes('training') && dTitle.includes('training')) ||
          (cTitle.includes('application') && dTitle.includes('application')) ||
          (cTitle.includes('endorsement') && dTitle.includes('endorsement'))
        );
      });
      if (!isAlreadyCovered) {
        list.push({
          key: custom.id as any,
          id: custom.id,
          num: String(list.length + 1),
          title: custom.title,
          subtitle: custom.notes || 'Institutional Required Document',
          desc: custom.description || 'Departmental required credential for OJT compliance.',
          icon: FileText,
          color: 'from-blue-600 to-indigo-700',
          badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-200',
        });
      }
    }
    return list;
  }, [customRequiredDocs]);

  const totalRequired = allDocRequirements.length;
  const uploadedCount = allDocRequirements.filter((k) => {
    const doc = getDocItem(k.key);
    return Boolean(doc?.dataUrl || doc?.name);
  }).length;
  const passedCount = allDocRequirements.filter((k) => {
    const doc = getDocItem(k.key);
    return doc?.status === 'passed' && Boolean(doc?.dataUrl || doc?.name);
  }).length;
  const isAllPassed =
    uploadedCount === totalRequired &&
    (passedCount === totalRequired || (employee?.documentsPassed === true && employee?.documentsStatus === 'passed'));
  const isPendingVerification =
    !isAllPassed &&
    (employee?.documentsPassed === false ||
      employee?.documentsStatus === 'pending' ||
      employee?.documentsStatus === 'partial' ||
      employee?.documentsStatus === 'incomplete' ||
      uploadedCount < totalRequired);
  const isSubmittedAwaitingReview = uploadedCount === totalRequired && !isAllPassed;
  const missingDocs = useMemo(() => {
    return allDocRequirements.filter((item) => {
      const doc = getDocItem(item.key);
      return !doc?.dataUrl && !doc?.name;
    });
  }, [allDocRequirements, submittedDocs]);
  const missingCount = missingDocs.length;
  const progressPercent = totalRequired > 0 ? Math.round((uploadedCount / totalRequired) * 100) : 100;

  const resolveDocDataUrl = (docKey: string, docItem?: TraineeDocumentItem): string => {
    const isBadUrl = (u?: string) =>
      !u ||
      typeof u !== 'string' ||
      u.includes('NoSuchKey') ||
      u.includes('NoSuchBucket') ||
      u.includes('Bucket not found') ||
      u.includes('statusCode') ||
      u.includes('documents/unassigned/moa_');
    const empId = employee?.id || employee?.employeeId || currentUser?.employeeId || '';

    // 1. If docItem has valid base64 dataUrl, use it immediately (zero network failure)
    if (docItem?.dataUrl && !isBadUrl(docItem.dataUrl)) {
      if (docItem.dataUrl.startsWith('data:') || docItem.dataUrl.startsWith('blob:')) {
        return docItem.dataUrl;
      }
    }

    // 2. Check dedicated base64 cache in localStorage
    try {
      const b64 =
        localStorage.getItem(`ojt_doc_base64_${empId}_${docKey}`) ||
        localStorage.getItem(`ojt_doc_base64_${docKey}`);
      if (b64 && (b64.startsWith('data:') || b64.startsWith('blob:'))) {
        return b64;
      }
    } catch {}

    // 3. If docItem has a working remote URL (fileUrl or dataUrl), use it
    if (docItem?.dataUrl && !isBadUrl(docItem.dataUrl)) return docItem.dataUrl;
    if ((docItem as any)?.fileUrl && !isBadUrl((docItem as any).fileUrl)) return (docItem as any).fileUrl;

    // 4. Check general localStorage cache
    try {
      const cached =
        localStorage.getItem(`ojt_doc_${empId}_${docKey}`) ||
        localStorage.getItem(`ojt_doc_${docKey}`) ||
        localStorage.getItem(`ojt_doc_current_${docKey}`);
      if (cached && !isBadUrl(cached)) return cached;
    } catch {}

    return '';
  };

  const ALLOWED_MIME = [
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/jfif',
    'image/pjpeg',
    'image/bmp',
    'image/heic',
    'image/heif',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/octet-stream',
    'application/x-zip-compressed',
    'application/vnd.ms-word',
  ];
  const ALLOWED_EXT = /\.(pdf|jpg|jpeg|jfif|png|webp|heic|heif|bmp|doc|docx|docs)$/i;

  const onSelectFile = (docKey: string, title: string, file: File | null) => {
    if (!file) return;

    if (!ALLOWED_MIME.includes(file.type) && !ALLOWED_EXT.test(file.name)) {
      toast.error(
        `Unsupported file type: "${file.name.split('.').pop()?.toUpperCase() || 'Unknown'}". Accepted formats: Pictures (JPG, PNG, WEBP), PDF, and Word documents (DOC, DOCX).`
      );
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size exceeds 10MB limit. Please upload a file up to 10MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      setSubmitDialog({
        docKey,
        title,
        file,
        previewUrl: e.target?.result as string,
        description: submittedDocs[docKey]?.description || '',
        notes: submittedDocs[docKey]?.notes || '',
      });
    };
    reader.readAsDataURL(file);
  };

  const handleFileUpload = (docKey: string, file: File | null, customDescription?: string, customNotes?: string) => {
    if (!file) return;

    if (!ALLOWED_MIME.includes(file.type) && !ALLOWED_EXT.test(file.name)) {
      toast.error(
        `Unsupported file type: "${file.name.split('.').pop()?.toUpperCase() || 'Unknown'}". Accepted formats: Pictures (JPG, PNG, WEBP), PDF, and Word documents (DOC, DOCX).`
      );
      return;
    }

    // Check size limit: max 10MB (supports 5–10MB picture and document files)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size exceeds 10MB limit. Please upload a file up to 10MB.');
      return;
    }

    setUploadingKey(docKey);
    const reader = new FileReader();

    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      const empId = employee?.id || employee?.employeeId || currentUser?.employeeId || '';

      // Cache base64 locally permanently so user can view/download even offline or if storage is unreachable
      try {
        localStorage.setItem(`ojt_doc_base64_${empId}_${docKey}`, dataUrl);
        localStorage.setItem(`ojt_doc_base64_${docKey}`, dataUrl);
        localStorage.setItem(`ojt_doc_${empId}_${docKey}`, dataUrl);
        localStorage.setItem(`ojt_doc_${docKey}`, dataUrl);
      } catch {}

      // Attempt cloud storage upload for permanent URL
      let remoteUrl = '';
      try {
        const storedUrl = await uploadDocumentToStorage(empId, docKey, file, file.name);
        if (storedUrl && storedUrl.startsWith('http') && !storedUrl.includes('NoSuchKey')) {
          remoteUrl = storedUrl;
          try {
            localStorage.setItem(`ojt_doc_url_${empId}_${docKey}`, storedUrl);
          } catch {}
        }
      } catch (uploadErr) {
        console.warn('Document storage upload notice:', uploadErr);
      }

      const newDocItem: TraineeDocumentItem = {
        name: file.name,
        size: file.size,
        dataUrl: dataUrl, // Preserve working base64 so preview/download never breaks
        fileUrl: remoteUrl || dataUrl, // Public URL when available for instructor/coordinator review
        fileType: file.type || 'application/octet-stream',
        uploadedAt: new Date().toISOString(),
        status: 'pending',
        description: (customDescription ?? submittedDocs[docKey]?.description ?? '').trim(),
        notes: (customNotes ?? submittedDocs[docKey]?.notes ?? '').trim(),
      };

      const updatedDocs: TraineeDocuments = {
        ...submittedDocs,
        [docKey]: newDocItem,
      };

      const newUploadedCount = allDocRequirements.filter((k) => Boolean(updatedDocs[k.key]?.dataUrl || updatedDocs[k.key]?.name)).length;
      const allDocsPassed = newUploadedCount === totalRequired && allDocRequirements.every((k) => updatedDocs[k.key]?.status === 'passed');

      if (employee) {
        const finalDocStatus = allDocsPassed ? 'passed' : newUploadedCount === totalRequired ? 'submitted' : 'partial';
        updateEmployee(employee.id, {
          submittedDocuments: updatedDocs,
          documentsPassed: allDocsPassed,
          documentsStatus: finalDocStatus,
        });

        // Direct persistent database save for document pass / upload status
        saveDocumentPassStatus(employee.id || employee.employeeId, {
          docKey,
          status: 'pending',
          allPassed: allDocsPassed,
          documentsStatus: finalDocStatus,
          submittedDocuments: updatedDocs,
          documentItem: newDocItem,
        });
      }

      setUploadingKey(null);
      setSubmitDialog(null);
      const meta = allDocRequirements.find((d) => d.key === docKey);
      toast.success(`${meta?.title || 'Document'} submitted! Pending coordinator review.`);
    };

    reader.onerror = () => {
      setUploadingKey(null);
      setSubmitDialog(null);
      toast.error('Failed to read file. Please try again.');
    };

    reader.readAsDataURL(file);
  };

  const handleRemoveDoc = (docKey: string) => {
    const updatedDocs: TraineeDocuments = { ...submittedDocs };
    delete (updatedDocs as any)[docKey];
    if (docKey === 'consent') delete (updatedDocs as any).parent_consent;
    if (docKey === 'moa') delete (updatedDocs as any).endorsement;
    if (docKey === 'medical') delete (updatedDocs as any).clearance;
    for (const k of Object.keys(updatedDocs)) {
      if (k.toLowerCase() === docKey.toLowerCase()) {
        delete (updatedDocs as any)[k];
      }
    }

    const empId = employee?.id || employee?.employeeId || currentUser?.employeeId || '';
    try {
      localStorage.removeItem(`ojt_doc_${empId}_${docKey}`);
      localStorage.removeItem(`ojt_doc_${docKey}`);
      localStorage.removeItem(`ojt_doc_base64_${empId}_${docKey}`);
      localStorage.removeItem(`ojt_doc_base64_${docKey}`);
      localStorage.removeItem(`ojt_doc_url_${empId}_${docKey}`);
      localStorage.removeItem(`ojt_doc_current_${docKey}`);
    } catch {}

    const remainingCount = allDocRequirements.filter((req) => {
      const doc =
        updatedDocs[req.key as keyof TraineeDocuments] ||
        (req.key === 'consent' ? (updatedDocs as any).parent_consent : undefined) ||
        (req.key === 'moa' ? (updatedDocs as any).endorsement : undefined) ||
        (req.key === 'medical' ? (updatedDocs as any).clearance : undefined);
      return Boolean(doc?.dataUrl || doc?.name);
    }).length;

    if (employee) {
      const removalStatus = remainingCount > 0 ? 'partial' : 'incomplete';
      updateEmployee(employee.id, {
        submittedDocuments: updatedDocs,
        documentsPassed: false,
        documentsStatus: removalStatus,
      });
      saveDocumentPassStatus(employee.id || employee.employeeId, {
        allPassed: false,
        documentsStatus: remainingCount > 0 ? 'partial' : 'pending',
        submittedDocuments: updatedDocs,
      }).catch(console.warn);
    }

    const meta = allDocRequirements.find((d) => d.key === docKey);
    toast.info(`${meta?.title || 'Document'} removed. Status changed to PENDING.`);
  };

  const formatFileSize = (bytes?: string | number) => {
    if (!bytes) return '';
    const num = Number(bytes);
    if (isNaN(num)) return '';
    if (num < 1024) return `${num} B`;
    if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB`;
    return `${(num / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-6 pb-12 max-w-5xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              to="/app"
              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors"
            >
              <ArrowLeft size={14} /> Back to Dashboard
            </Link>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
            <FileCheck className="text-blue-600" size={26} /> OJT Documents
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Manage, review, and submit the {totalRequired} mandatory OJT compliance documents required for your internship program.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
          <span
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold border flex items-center gap-1.5 shadow-sm ${
              isAllPassed
                ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                : isSubmittedAwaitingReview
                ? 'bg-blue-50 text-blue-700 border-blue-300'
                : 'bg-amber-50 text-amber-800 border-amber-300'
            }`}
          >
            {isAllPassed ? (
              <>
                <CheckCircle2 size={15} className="text-emerald-600 stroke-[2.5]" />
                {totalRequired}/{totalRequired} Completed (Compliant)
              </>
            ) : isSubmittedAwaitingReview ? (
              <>
                <CheckCircle2 size={15} className="text-blue-600 stroke-[2.5]" />
                {totalRequired}/{totalRequired} Submitted (Under Review)
              </>
            ) : isPendingVerification && missingCount === 0 ? (
              <>
                <Clock size={15} className="text-amber-600 animate-pulse" />
                Action Required (Pending Review)
              </>
            ) : (
              <>
                <Clock size={15} className="text-amber-600 animate-pulse" />
                {missingCount === 1 ? '1 Document Left' : `${missingCount} Documents Left`}
              </>
            )}
          </span>
        </div>
      </div>

      {/* Progress & Compliance Alert Card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className={`p-5 rounded-3xl border transition-all ${
          isAllPassed
            ? 'bg-gradient-to-br from-emerald-500/10 via-emerald-50 to-white border-emerald-200'
            : isSubmittedAwaitingReview
            ? 'bg-gradient-to-br from-blue-500/10 via-blue-50 to-white border-blue-200'
            : 'bg-gradient-to-br from-amber-500/10 via-amber-50 to-white border-amber-200'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              {isAllPassed
                ? '🎉 All OJT Documents Submitted & Verified'
                : isSubmittedAwaitingReview
                ? '✓ All OJT Documents Submitted (Under Review)'
                : isPendingVerification && missingCount === 0
                ? '⚠️ Action Required: OJT Documents Pending Instructor Review'
                : '⚠️ Action Required: Submit Missing OJT Documents'}
            </h3>
            <p className="text-xs text-slate-600 mt-0.5">
              {isAllPassed
                ? `Congratulations! You have fulfilled all ${totalRequired} OJT compliance documents. All documents have been verified and approved by your OJT Instructor.`
                : isSubmittedAwaitingReview
                ? `You have submitted all ${totalRequired} mandatory OJT documents (${progressPercent}%). They are currently queued for OJT Instructor review.`
                : isPendingVerification && missingCount === 0
                ? `All ${totalRequired} OJT documents are uploaded. Your OJT Instructor has requested verification or revisions. Please check document feedback.`
                : `You have submitted ${uploadedCount} of ${totalRequired} documents (${progressPercent}%). Please upload the remaining ${missingCount} document${missingCount > 1 ? 's' : ''} to maintain full compliance.`}
            </p>
          </div>
          <div className="text-right shrink-0">
            <span className="text-xs font-extrabold text-slate-700">{uploadedCount}/{totalRequired} Completed</span>
          </div>
        </div>

        {/* Visual Progress Bar */}
        <div className="h-3 w-full bg-slate-200/80 rounded-full overflow-hidden p-0.5">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className={`h-full rounded-full transition-all ${
              isAllPassed
                ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
                : 'bg-gradient-to-r from-amber-500 to-orange-500'
            }`}
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-slate-500">
          <div className="flex items-center gap-1.5">
            <Info size={13} className="shrink-0 text-blue-500" />
            <span>Accepted formats: <strong>Pictures (JPG, PNG, WEBP)</strong>, <strong>PDF</strong>, and <strong>Word (DOC, DOCX)</strong></span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>File size: <strong>Supports 5–10MB</strong> per file (high-res pictures supported)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            <span>All submitted documents can be downloaded anytime</span>
          </div>
        </div>
      </motion.div>

      {/* Missing or Incomplete Requirements Alert Banner */}
      {missingDocs.length > 0 ? (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-5 rounded-3xl bg-amber-500/10 border-2 border-amber-300/80 shadow-sm"
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-md">
              <Clock size={22} className="animate-pulse" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="text-sm sm:text-base font-extrabold text-amber-950 flex items-center gap-2">
                  Missing or Incomplete OJT Documents ({missingDocs.length} remaining)
                </h3>
                <span className="text-xs font-bold text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full border border-amber-200">
                  Pre-Deployment Requirement
                </span>
              </div>
              <p className="text-xs text-amber-900/80 mt-1 leading-relaxed">
                The following documents are mandatory for Carlos Hilado Memorial State University OJT internship compliance. Please upload all required files with descriptions and notes.
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {missingDocs.map((m) => (
                  <span
                    key={m.key}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white border border-amber-300 text-amber-900 text-xs font-semibold shadow-xs"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    {m.title}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-4 rounded-3xl border flex items-center gap-3 shadow-xs ${
            isAllPassed
              ? 'bg-emerald-500/10 border-emerald-300 text-emerald-950'
              : 'bg-blue-500/10 border-blue-300 text-blue-950'
          }`}
        >
          <div className={`w-9 h-9 rounded-2xl text-white flex items-center justify-center shrink-0 shadow-sm ${
            isAllPassed ? 'bg-emerald-600' : 'bg-blue-600'
          }`}>
            <CheckCircle2 size={20} />
          </div>
          <div>
            <h4 className={`text-xs sm:text-sm font-bold ${
              isAllPassed ? 'text-emerald-900' : 'text-blue-900'
            }`}>
              {isAllPassed ? 'All OJT Documents Complete & Verified' : 'All OJT Documents Uploaded (Pending Coordinator Review)'}
            </h4>
            <p className={`text-[11px] ${
              isAllPassed ? 'text-emerald-800' : 'text-blue-800'
            }`}>
              {isAllPassed
                ? 'You have fulfilled all OJT documentary compliance. Your coordinator has approved your credentials.'
                : `All ${totalRequired} OJT documents are safely in file. Your OJT Instructor will verify and certify your submissions.`}
            </p>
          </div>
        </motion.div>
      )}

      {/* Required Documents Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
        {allDocRequirements.map((item) => {
          const doc = getDocItem(item.key);
          const hasFile = Boolean(doc?.dataUrl || doc?.name);
          const isPassed = doc?.status === 'passed' && hasFile;
          const isPending = (doc?.status === 'pending' || !doc?.status) && hasFile;
          const isUploading = uploadingKey === item.key;
          const Icon = item.icon || FileText;
          const docCategory = doc ? getFileCategory(doc.name || doc.fileType || '') : 'other';

          return (
            <motion.div
              key={item.key}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className={`rounded-3xl bg-white border p-5 transition-all shadow-sm flex flex-col justify-between ${
                isPassed
                  ? 'border-emerald-200/80 hover:border-emerald-300 shadow-emerald-50/50'
                  : 'border-slate-200 hover:border-slate-300 hover:shadow-md'
              }`}
            >
              <div>
                {/* Header Row */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-md bg-gradient-to-br ${item.color || 'from-blue-600 to-indigo-600'}`}
                    >
                      <Icon size={20} />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">DOC #{item.num}</span>
                        {item.custom && (
                          <span className="text-[10px] font-bold bg-purple-100 text-purple-700 px-1.5 py-0.2 rounded border border-purple-200">
                            Custom Requirement
                          </span>
                        )}
                      </div>
                      <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-tight">{item.title}</h3>
                    </div>
                  </div>

                  <span
                    className={`text-[11px] font-extrabold px-2.5 py-1 rounded-full border flex items-center gap-1 shrink-0 ${
                      isPassed
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300 shadow-sm'
                        : isPending
                          ? 'bg-blue-100 text-blue-800 border-blue-300'
                          : 'bg-amber-100 text-amber-800 border-amber-300 animate-pulse'
                    }`}
                  >
                    {isPassed ? (
                      <>
                        <Check size={12} className="stroke-[3]" /> PASSED
                      </>
                    ) : isPending ? (
                      <>
                        <Clock size={11} /> PENDING REVIEW
                      </>
                    ) : (
                      <>
                        <Clock size={11} /> PENDING
                      </>
                    )}
                  </span>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed mb-3">{item.desc}</p>

                {/* Accepted format pills */}
                <div className="flex flex-wrap items-center gap-1.5 mb-4">
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                    Pictures (JPG/PNG)
                  </span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                    PDF
                  </span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                    DOC / DOCX
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-100">
                    5–10MB Max
                  </span>
                </div>

                {/* Uploaded File Info Card with Description & Notes */}
                {hasFile && doc && (
                  <div className="mb-4 p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex items-center gap-2">
                        <div
                          className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                            docCategory === 'picture'
                              ? 'bg-emerald-100 text-emerald-700'
                              : docCategory === 'doc'
                                ? 'bg-indigo-100 text-indigo-700'
                                : 'bg-blue-100 text-blue-700'
                          }`}
                        >
                          {docCategory === 'picture' ? (
                            <ImageIcon size={16} />
                          ) : docCategory === 'doc' ? (
                            <FileText size={16} />
                          ) : (
                            <FileGeneric size={16} />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-800 truncate" title={doc.name}>
                            {doc.name}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString() : 'Uploaded'}
                            {doc.size ? ` • ${formatFileSize(doc.size)}` : ''}
                            <span className="ml-1.5 font-semibold text-slate-500 uppercase">
                              ({docCategory === 'picture' ? 'Picture' : docCategory === 'doc' ? 'Word Doc' : 'PDF'})
                            </span>
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveDoc(item.key);
                        }}
                        className="p-2 sm:p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 active:bg-red-100 transition-colors shrink-0 cursor-pointer min-w-[32px] min-h-[32px] flex items-center justify-center touch-manipulation"
                        title="Remove file"
                        aria-label={`Remove ${item.title}`}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    {/* Description and Notes Details */}
                    {(doc.description || doc.notes) && (
                      <div className="pt-2 border-t border-slate-200/60 text-[11px] space-y-1 bg-white/70 p-2 rounded-xl">
                        {doc.description && (
                          <p className="text-slate-700">
                            <strong className="text-slate-900 font-semibold">Description:</strong> {doc.description}
                          </p>
                        )}
                        {doc.notes && (
                          <p className="text-slate-500 italic">
                            <strong className="text-slate-700 font-semibold not-italic">Notes:</strong> {doc.notes}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2">
                {hasFile ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        const resolvedUrl = resolveDocDataUrl(item.key, doc);
                        setPreviewDoc({
                          key: item.key,
                          title: item.title,
                          subtitle: item.subtitle,
                          fileName: doc?.name || `${item.key}_document.pdf`,
                          dataUrl: resolvedUrl,
                          uploadedAt: doc?.uploadedAt,
                          fileSize: doc?.size,
                          status: doc?.status || 'passed',
                          description: doc?.description,
                          notes: doc?.notes,
                        });
                      }}
                      className="flex-1 py-2 px-3 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer"
                    >
                      <Eye size={14} /> View File
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const resolvedUrl = resolveDocDataUrl(item.key, doc);
                        downloadDocument(resolvedUrl, doc?.name || `${item.key}_document`);
                      }}
                      className="py-2 px-3 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer"
                      title="Download file"
                    >
                      <Download size={13} /> Download
                    </button>

                    <label
                      htmlFor={`replace-doc-${item.key}`}
                      className="py-2 px-3 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                      <RefreshCw size={13} className={isUploading ? 'animate-spin' : ''} />
                      {isUploading ? 'Uploading...' : 'Replace'}
                    </label>
                    <input
                      type="file"
                      id={`replace-doc-${item.key}`}
                      accept=".pdf,.doc,.docx,.docs,.jpg,.jpeg,.jfif,.png,.webp,.heic,image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/octet-stream"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        onSelectFile(item.key, item.title, file);
                        e.target.value = '';
                      }}
                      className="hidden"
                      disabled={isUploading}
                    />
                  </>
                ) : (
                  <label
                    htmlFor={`upload-doc-${item.key}`}
                    className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm ${
                      isUploading
                        ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-700 text-white hover:shadow-blue-200 hover:shadow-lg'
                    }`}
                  >
                    <Upload size={14} className={isUploading ? 'animate-spin' : ''} />
                    {isUploading ? 'Uploading File...' : 'Upload & Submit Document'}
                    <input
                      type="file"
                      id={`upload-doc-${item.key}`}
                      accept=".pdf,.doc,.docx,.docs,.jpg,.jpeg,.jfif,.png,.webp,.heic,image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/octet-stream"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        onSelectFile(item.key, item.title, file);
                        e.target.value = '';
                      }}
                      className="hidden"
                      disabled={isUploading}
                    />
                  </label>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Submit Document with Description & Notes Dialog Modal */}
      <AnimatePresence>
        {submitDialog && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl w-full max-w-lg shadow-2xl p-6 border border-slate-100 flex flex-col gap-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                    <FileCheck size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">Submit OJT Document</h3>
                    <p className="text-xs text-slate-500">{submitDialog.title}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSubmitDialog(null)}
                  className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-3 bg-blue-50/60 rounded-2xl border border-blue-100 flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700 truncate max-w-[260px]">
                  📄 {submitDialog.file.name}
                </span>
                <span className="text-slate-500 font-mono">
                  {formatFileSize(submitDialog.file.size)}
                </span>
              </div>

              {/* Description Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span>Document Description <span className="text-red-500">*</span></span>
                  <span className="text-[10px] text-slate-400 font-normal">e.g. Approved MOA signed by HTE director</span>
                </label>
                <input
                  type="text"
                  placeholder="Provide a brief summary or title of this document..."
                  value={submitDialog.description}
                  onChange={(e) => setSubmitDialog({ ...submitDialog, description: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-hidden"
                />
              </div>

              {/* Notes Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span>Notes / Remarks</span>
                  <span className="text-[10px] text-slate-400 font-normal">Optional coordinator note</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="Add any additional context, expiry date, notary status, or notes for the coordinator..."
                  value={submitDialog.notes}
                  onChange={(e) => setSubmitDialog({ ...submitDialog, notes: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-hidden resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSubmitDialog(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={uploadingKey === submitDialog.docKey}
                  onClick={() => {
                    handleFileUpload(
                      submitDialog.docKey,
                      submitDialog.file,
                      submitDialog.description,
                      submitDialog.notes
                    );
                  }}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-200 inline-flex items-center gap-1.5 transition-all"
                >
                  {uploadingKey === submitDialog.docKey ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" /> Uploading...
                    </>
                  ) : (
                    <>
                      <Check size={14} /> Submit Document
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Document Preview Modal */}
      <AnimatePresence>
        {previewDoc && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 backdrop-blur-sm p-3 sm:p-4 print:p-0 print:bg-white print:static print:z-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-3xl w-full max-w-3xl shadow-2xl max-h-[92vh] flex flex-col overflow-hidden print:max-h-none print:shadow-none print:rounded-none print:overflow-visible print:border-none"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white print:pb-2 print:border-slate-800">
                <div>
                  <h3 className="font-bold text-slate-900 text-base">{previewDoc.title}</h3>
                  <p className="text-xs text-slate-500 truncate max-w-xs sm:max-w-md">{previewDoc.fileName}</p>
                </div>

                <div className="flex items-center gap-2 no-print">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-200 transition-colors cursor-pointer"
                  >
                    <Printer size={13} /> Print
                  </button>

                  {previewDoc.dataUrl && (
                    <button
                      type="button"
                      onClick={() => downloadDocument(previewDoc.dataUrl || '', previewDoc.fileName)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-semibold hover:bg-emerald-700 transition-all shadow-sm cursor-pointer"
                      title="Download file"
                    >
                      <Download size={13} /> Download
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      if (previewDoc?.key) {
                        handleRemoveDoc(previewDoc.key);
                        setPreviewDoc(null);
                      }
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                    title="Remove file"
                  >
                    <Trash2 size={13} /> Remove
                  </button>

                  <button
                    type="button"
                    onClick={() => setPreviewDoc(null)}
                    className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors ml-1 cursor-pointer"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Document Meta Ribbon */}
              <div className="px-6 py-2.5 bg-slate-50 border-b border-slate-100 text-xs flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 text-slate-600">
                  <span><strong>Student:</strong> {employee?.name || currentUser?.name || 'Trainee'}</span>
                  <span><strong>ID:</strong> {employee?.employeeId || currentUser?.employeeId || 'N/A'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">
                    {previewDoc.uploadedAt ? `Uploaded ${new Date(previewDoc.uploadedAt).toLocaleDateString()}` : ''}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    ✓ PASSED
                  </span>
                </div>
              </div>

              {/* Description & Notes in Preview Modal */}
              {(previewDoc.description || previewDoc.notes) && (
                <div className="px-6 py-2 bg-blue-50/50 border-b border-blue-100/60 text-xs flex flex-col gap-1">
                  {previewDoc.description && (
                    <div className="text-slate-700">
                      <span className="font-bold text-slate-800">Description: </span>
                      {previewDoc.description}
                    </div>
                  )}
                  {previewDoc.notes && (
                    <div className="text-slate-500 italic">
                      <span className="font-semibold text-slate-700 not-italic">Notes: </span>
                      {previewDoc.notes}
                    </div>
                  )}
                </div>
              )}

              {/* Preview Content */}
              <div className="flex-1 overflow-y-auto p-4 bg-slate-100 flex items-center justify-center min-h-[350px]">
                {previewDoc.dataUrl ? (
                  (() => {
                    const cat = getFileCategory(previewDoc.fileName || previewDoc.dataUrl);
                    const isImg =
                      cat === 'picture' ||
                      previewDoc.dataUrl.startsWith('data:image/') ||
                      previewDoc.dataUrl.match(/\.(jpeg|jpg|jfif|gif|png|webp|bmp|heic)($|\?)/i) ||
                      previewDoc.fileName?.match(/\.(jpeg|jpg|jfif|gif|png|webp|bmp|heic)$/i);
                    const isWord =
                      cat === 'doc' ||
                      previewDoc.dataUrl.startsWith('data:application/msword') ||
                      previewDoc.dataUrl.startsWith('data:application/vnd') ||
                      previewDoc.dataUrl.startsWith('data:application/x-zip-compressed') ||
                      previewDoc.fileName?.match(/\.(doc|docx|docs)$/i);

                    if (isImg) {
                      return (
                        <div className="flex flex-col items-center justify-center gap-3 max-w-full">
                          <img
                            src={previewDoc.dataUrl}
                            alt={previewDoc.title}
                            className="max-h-[520px] max-w-full object-contain rounded-2xl shadow-lg border border-slate-200 bg-white"
                          />
                          <button
                            type="button"
                            onClick={() => downloadDocument(previewDoc.dataUrl || '', previewDoc.fileName)}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-2 shadow-sm transition-all cursor-pointer"
                          >
                            <Download size={14} /> Download Picture
                          </button>
                        </div>
                      );
                    }

                    if (isWord) {
                      return (
                        <div className="w-full max-w-md bg-white rounded-3xl p-6 border border-blue-200 shadow-lg text-center">
                          <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3 border border-blue-100 shadow-inner">
                            <FileText size={36} className="stroke-[2.2]" />
                          </div>
                          <span className="px-3 py-1 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-800 border border-blue-200 uppercase tracking-wider inline-block mb-2">
                            Microsoft Word Document
                          </span>
                          <h4 className="text-base font-bold text-slate-900 mb-1">{previewDoc.title}</h4>
                          <p className="text-xs text-slate-500 font-mono mb-4 break-all">{previewDoc.fileName}</p>

                          <div className="bg-slate-50 rounded-2xl p-4 text-xs text-left space-y-2 border border-slate-100 mb-5 text-slate-600">
                            <div className="flex justify-between">
                              <span className="font-semibold text-slate-500">Document Type:</span>
                              <span className="font-bold text-slate-800">Word (.doc / .docx)</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="font-semibold text-slate-500">File Size:</span>
                              <span className="font-bold text-slate-800">
                                {previewDoc.fileSize ? formatFileSize(previewDoc.fileSize) : 'Available for Download'}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="font-semibold text-slate-500">Status:</span>
                              <span className="font-bold text-emerald-600">✓ PASSED / RECORDED</span>
                            </div>
                          </div>

                          <p className="text-[11px] text-slate-500 mb-4 leading-relaxed">
                            Word files download directly to open with Microsoft Word, Google Docs, or Office apps.
                          </p>

                          <button
                            type="button"
                            onClick={() => downloadDocument(previewDoc.dataUrl || '', previewDoc.fileName)}
                            className="w-full py-3 px-5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-extrabold inline-flex items-center justify-center gap-2 shadow-lg shadow-blue-200 transition-all cursor-pointer"
                          >
                            <Download size={15} /> Download Word Document
                          </button>
                        </div>
                      );
                    }

                    return (
                      <iframe
                        src={previewDoc.dataUrl}
                        className="w-full h-[520px] rounded-2xl border border-slate-200 bg-white shadow"
                        title="Document Preview"
                      />
                    );
                  })()
                ) : (
                  <div className="w-full max-w-md bg-white rounded-3xl p-6 border border-slate-200 shadow-sm text-center">
                    <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3 border border-blue-100 shadow-inner">
                      <FileCheck size={32} />
                    </div>
                    <div className="flex items-center justify-center gap-1.5 mb-2">
                      <span className="px-3 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                        ✓ VERIFIED & RECORDED ({previewDoc.status?.toUpperCase() || 'PASSED'})
                      </span>
                    </div>
                    <h4 className="text-base font-bold text-slate-900 mb-1">{previewDoc.title}</h4>
                    <p className="text-xs text-slate-500 font-mono mb-4 break-all">Recorded File: {previewDoc.fileName}</p>

                    <div className="bg-slate-50 rounded-2xl p-4 text-xs text-left space-y-2 border border-slate-100 mb-5 text-slate-600">
                      <div className="flex justify-between">
                        <span className="font-semibold text-slate-500">Student Name:</span>
                        <span className="font-bold text-slate-800">{employee?.name || currentUser?.name || 'Trainee'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-semibold text-slate-500">Student ID:</span>
                        <span className="font-mono text-slate-800">{employee?.employeeId || currentUser?.employeeId || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-semibold text-slate-500">Institution:</span>
                        <span className="text-slate-800">Carlos Hilado Memorial State University</span>
                      </div>
                      {previewDoc.uploadedAt && (
                        <div className="flex justify-between">
                          <span className="font-semibold text-slate-500">Filing Date:</span>
                          <span className="text-slate-800">{new Date(previewDoc.uploadedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                        </div>
                      )}
                    </div>

                    <p className="text-[11px] text-slate-500 mb-4 leading-relaxed">
                      Attach a fresh copy (Pictures, PDF, or Word Docs up to 10MB) below:
                    </p>

                    <label className="cursor-pointer px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 w-full">
                      <Upload size={14} /> Attach File for Live Preview
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx,.docs,.jpg,.jpeg,.jfif,.png,.webp,.heic,image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/octet-stream"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file && previewDoc.key) {
                            handleFileUpload(previewDoc.key as any, file);
                            const reader = new FileReader();
                            reader.onload = (ev) => {
                              const newUrl = ev.target?.result as string;
                              setPreviewDoc((prev) => (prev ? { ...prev, dataUrl: newUrl } : null));
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </label>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-white border-t border-slate-100 flex items-center justify-between">
                <p className="text-[11px] text-slate-400">Carlos Hilado Memorial State University • OJT Management</p>
                <button
                  type="button"
                  onClick={() => setPreviewDoc(null)}
                  className="px-4 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 transition-colors"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
