import React, { useState, useMemo, useEffect } from 'react';
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
  Paperclip,
  Search,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'sonner';

import { useApp } from '../store/AppContext';
import { TraineeDocuments, TraineeDocumentItem } from '../types';
import { uploadDocumentToStorage, saveDocumentPassStatus, fetchEmployeeDocuments } from '../services/supabaseService';
import { REQUIRED_TRAINEE_DOCUMENTS, REQUIRED_TRAINEE_DOC_KEYS } from '../data/documentRequirements';
import { downloadDocument, getFileCategory, resolveSafeDocumentViewUrl } from '../utils/attachmentHelper';

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
  instructorDocName?: string;
  markAsPassed?: boolean;
}

export function Documents() {
  const navigate = useNavigate();
  const { currentUser, getCurrentEmployee, updateEmployee, getEmployeeRequiredDocuments, submitRequiredDocument } = useApp();
  const employee = getCurrentEmployee();

  const [previewDoc, setPreviewDoc] = useState<PreviewModalState | null>(null);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [submitDialog, setSubmitDialog] = useState<SubmitDialogState | null>(null);
  const [databaseDocs, setDatabaseDocs] = useState<TraineeDocuments | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'attached' | 'missing'>('all');
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);

  // Sync documents from database on mount or user change to prevent disappearance on refresh
  useEffect(() => {
    const empId = employee?.id || employee?.employeeId || currentUser?.employeeId || currentUser?.id;
    if (!empId) return;

    fetchEmployeeDocuments(empId)
      .then((res) => {
        if (res && res.documents && Object.keys(res.documents).length > 0) {
          setDatabaseDocs((prev) => ({ ...(res.documents || {}), ...(prev || {}) }));
          if (employee) {
            updateEmployee(employee.id, {
              submittedDocuments: {
                ...(res.documents || {}),
                ...(employee.submittedDocuments || {}),
              },
              documentsPassed: res.documentsPassed ?? employee.documentsPassed,
              documentsStatus: res.documentsStatus ?? employee.documentsStatus,
            });
          }
        }
      })
      .catch((err) => console.warn('Failed to fetch documents from database on load:', err));
  }, [employee?.id, currentUser?.employeeId, currentUser?.id]);

  const submittedDocs: TraineeDocuments = useMemo(() => {
    return {
      ...(employee?.submittedDocuments || {}),
      ...(databaseDocs || {}),
    };
  }, [employee?.submittedDocuments, databaseDocs]);

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
    // 1. Process standard 10 documents and enrich with any instructor-uploaded template
    const list: any[] = STANDARD_REQUIRED_DOCS.map((std) => {
      // Find matching instructor template from customRequiredDocs
      const customMatch = customRequiredDocs.find((c) =>
        c.targetRequirementKey === std.key ||
        c.id === std.id ||
        c.id === `req-${std.key}-${employee?.id}` ||
        c.title.toLowerCase().trim() === std.title.toLowerCase().trim()
      );

      // Check localStorage for template cached by instructor
      let cachedTemplateUrl = '';
      let cachedTemplateName = '';
      let cachedTemplateSize: number | string = 0;
      let cachedTemplateNotes = '';
      try {
        const storedStr = localStorage.getItem(`ojt_template_${std.key}`);
        if (storedStr) {
          const stored = JSON.parse(storedStr);
          cachedTemplateUrl = stored.url || stored.fileUrl || stored.dataUrl || '';
          cachedTemplateName = stored.name || stored.fileName || '';
          cachedTemplateSize = stored.size || 0;
          cachedTemplateNotes = stored.notes || '';
        }
      } catch {}

      const fileUrl = customMatch?.fileUrl || customMatch?.dataUrl || customMatch?.templateUrl || cachedTemplateUrl;
      const fileName = customMatch?.fileName || customMatch?.templateName || cachedTemplateName;
      const fileSize = customMatch?.fileSize || cachedTemplateSize;
      const notes = customMatch?.notes || customMatch?.description || cachedTemplateNotes;

      return {
        ...std,
        custom: false,
        maxFileSize: customMatch?.maxFileSize,
        allowedFileTypes: customMatch?.allowedFileTypes,
        instructorDoc: fileUrl
          ? {
              fileName: fileName || `${std.title}_Template.pdf`,
              fileUrl,
              dataUrl: customMatch?.dataUrl,
              fileSize,
              notes,
              uploadedAt: customMatch?.createdAt,
            }
          : undefined,
      };
    });

    // 2. Add custom requirements added by the instructor
    for (const custom of customRequiredDocs) {
      const isAlreadyCovered = list.some((d) => {
        return (
          d.key === custom.id ||
          d.id === custom.id ||
          custom.targetRequirementKey === d.key ||
          d.title.toLowerCase().trim() === custom.title.toLowerCase().trim()
        );
      });

      if (!isAlreadyCovered) {
        list.push({
          key: custom.id as any,
          id: custom.id,
          num: String(list.length + 1),
          title: custom.title,
          subtitle: custom.notes || 'Instructor Required Document',
          desc: custom.description || 'Departmental required credential for OJT compliance.',
          icon: FileText,
          color: 'from-violet-600 to-indigo-700',
          badgeColor: 'bg-violet-100 text-violet-800 border-violet-200',
          custom: true,
          dueDate: custom.dueDate,
          maxFileSize: custom.maxFileSize,
          allowedFileTypes: custom.allowedFileTypes,
          targetCourse: custom.targetCourse,
          instructorDoc:
            custom.fileUrl || custom.dataUrl || custom.templateUrl
              ? {
                  fileName: custom.fileName || custom.templateName || `${custom.title}.pdf`,
                  fileUrl: (custom.fileUrl || custom.dataUrl || custom.templateUrl)!,
                  dataUrl: custom.dataUrl,
                  fileSize: custom.fileSize,
                  notes: custom.notes,
                  uploadedAt: custom.createdAt,
                }
              : undefined,
        });
      }
    }

    return list;
  }, [customRequiredDocs, employee?.id]);

  const totalRequired = allDocRequirements.length;
  const uploadedCount = allDocRequirements.filter((k) => {
    const doc = getDocItem(k.key);
    return Boolean(doc?.dataUrl || doc?.name || doc?.fileUrl);
  }).length;
  const passedCount = allDocRequirements.filter((k) => {
    const doc = getDocItem(k.key);
    return doc?.status === 'passed' && Boolean(doc?.dataUrl || doc?.name || doc?.fileUrl);
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
      return !doc?.dataUrl && !doc?.name && !doc?.fileUrl;
    });
  }, [allDocRequirements, submittedDocs]);
  const missingCount = missingDocs.length;
  const progressPercent = totalRequired > 0 ? Math.round((uploadedCount / totalRequired) * 100) : 100;

  const filteredDocRequirements = useMemo(() => {
    return allDocRequirements.filter((item) => {
      const doc = getDocItem(item.key);
      const hasFile = Boolean(doc?.dataUrl || doc?.name || doc?.fileUrl);

      // Status filter
      if (statusFilter === 'attached' && !hasFile) return false;
      if (statusFilter === 'missing' && hasFile) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchTitle = item.title?.toLowerCase().includes(q);
        const matchDesc = item.desc?.toLowerCase().includes(q);
        const matchNum = String(item.num || '').includes(q);
        const matchFile = doc?.name?.toLowerCase().includes(q);
        const matchInstructor = (item as any).instructorDoc?.fileName?.toLowerCase().includes(q);
        return Boolean(matchTitle || matchDesc || matchNum || matchFile || matchInstructor);
      }

      return true;
    });
  }, [allDocRequirements, submittedDocs, statusFilter, searchQuery]);

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
    if ((docItem as any)?.fileUrl && !isBadUrl((docItem as any).fileUrl)) return (docItem as any).fileUrl;
    if (docItem?.dataUrl && !isBadUrl(docItem.dataUrl)) return docItem.dataUrl;

    // 4. Check dedicated URL cache in localStorage
    try {
      const storedUrl =
        localStorage.getItem(`ojt_doc_url_${empId}_${docKey}`) ||
        localStorage.getItem(`ojt_doc_url_${docKey}`);
      if (storedUrl && !isBadUrl(storedUrl)) return storedUrl;
    } catch {}

    // 5. Check general localStorage cache
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

  const onSelectFile = (docKey: string, title: string, file: File | null, instructorDocName?: string) => {
    if (!file) return;

    const targetReq = allDocRequirements.find((d) => d.key === docKey || d.id === docKey);
    const maxBytes = targetReq?.maxFileSize || 10 * 1024 * 1024;
    const maxMB = Math.round(maxBytes / (1024 * 1024)) || 10;

    if (targetReq?.allowedFileTypes && targetReq.allowedFileTypes.length > 0) {
      const ext = '.' + (file.name.split('.').pop() || '').toLowerCase();
      const isAllowed = targetReq.allowedFileTypes.some((t: string) => {
        const norm = (t.startsWith('.') ? t : `.${t}`).toLowerCase();
        return norm === ext || file.type.toLowerCase().includes(norm.replace('.', ''));
      });
      if (!isAllowed) {
        toast.error(
          `Unsupported format: "${file.name.split('.').pop()?.toUpperCase()}". The instructor requires this document to be: ${targetReq.allowedFileTypes.join(', ').toUpperCase()}`
        );
        return;
      }
    } else {
      if (!ALLOWED_MIME.includes(file.type) && !ALLOWED_EXT.test(file.name)) {
        toast.error(
          `Unsupported file type: "${file.name.split('.').pop()?.toUpperCase() || 'Unknown'}". Accepted formats: Pictures (JPG, PNG, WEBP), PDF, and Word documents (DOC, DOCX).`
        );
        return;
      }
    }

    if (file.size < 200) {
      toast.error('The selected file is empty or corrupted (under 200 bytes). Please upload a valid document or picture.');
      return;
    }

    if (file.size > maxBytes) {
      toast.error(`File size (${(file.size / (1024 * 1024)).toFixed(1)}MB) exceeds the ${maxMB}MB limit for "${title}". Please upload a file up to ${maxMB}MB.`);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      setSubmitDialog({
        docKey,
        title,
        file,
        previewUrl: e.target?.result as string,
        description: submittedDocs[docKey]?.description || (instructorDocName ? `Submitted compliance for ${title} based on instructor requirement.` : ''),
        notes: submittedDocs[docKey]?.notes || '',
        instructorDocName,
        markAsPassed: true,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent, key: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverKey(key);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverKey(null);
  };

  const handleDrop = (e: React.DragEvent, item: any) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverKey(null);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      onSelectFile(item.key, item.title, file, item.instructorDoc?.fileName);
    }
  };

  const handleFileUpload = (
    docKey: string,
    file: File | null,
    customDescription?: string,
    customNotes?: string,
    markAsPassed: boolean = true
  ) => {
    if (!file) return;

    const targetReq = allDocRequirements.find((d) => d.key === docKey || d.id === docKey);
    const maxBytes = targetReq?.maxFileSize || 10 * 1024 * 1024;
    const maxMB = Math.round(maxBytes / (1024 * 1024)) || 10;

    if (targetReq?.allowedFileTypes && targetReq.allowedFileTypes.length > 0) {
      const ext = '.' + (file.name.split('.').pop() || '').toLowerCase();
      const isAllowed = targetReq.allowedFileTypes.some((t: string) => {
        const norm = (t.startsWith('.') ? t : `.${t}`).toLowerCase();
        return norm === ext || file.type.toLowerCase().includes(norm.replace('.', ''));
      });
      if (!isAllowed) {
        toast.error(
          `Unsupported format: "${file.name.split('.').pop()?.toUpperCase()}". The instructor requires this document to be: ${targetReq.allowedFileTypes.join(', ').toUpperCase()}`
        );
        return;
      }
    } else {
      if (!ALLOWED_MIME.includes(file.type) && !ALLOWED_EXT.test(file.name)) {
        toast.error(
          `Unsupported file type: "${file.name.split('.').pop()?.toUpperCase() || 'Unknown'}". Accepted formats: Pictures (JPG, PNG, WEBP), PDF, and Word documents (DOC, DOCX).`
        );
        return;
      }
    }

    if (file.size < 200) {
      toast.error('The selected file is empty or corrupted (under 200 bytes). Please upload a valid document or picture.');
      return;
    }

    if (file.size > maxBytes) {
      toast.error(`File size (${(file.size / (1024 * 1024)).toFixed(1)}MB) exceeds the ${maxMB}MB limit. Please upload a file up to ${maxMB}MB.`);
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

      const passStatus: 'passed' | 'pending' = markAsPassed ? 'passed' : 'pending';
      const newDocItem: TraineeDocumentItem = {
        name: file.name,
        size: file.size,
        dataUrl: dataUrl, // Preserve working base64 so preview/download never breaks
        fileUrl: remoteUrl || dataUrl, // Public URL when available for instructor/coordinator review
        fileType: file.type || 'application/octet-stream',
        uploadedAt: new Date().toISOString(),
        status: passStatus,
        description: (customDescription ?? submittedDocs[docKey]?.description ?? '').trim(),
        notes: (customNotes ?? submittedDocs[docKey]?.notes ?? '').trim(),
      };

      const updatedDocs: TraineeDocuments = {
        ...submittedDocs,
        [docKey]: newDocItem,
      };

      const targetEmpId = employee?.id || employee?.employeeId || currentUser?.employeeId || currentUser?.id || '';

      const newUploadedCount = allDocRequirements.filter((k) => {
        const item = k.key === docKey ? newDocItem : updatedDocs[k.key];
        return Boolean(item?.dataUrl || item?.name || item?.fileUrl);
      }).length;
      const allDocsPassed =
        newUploadedCount === totalRequired &&
        allDocRequirements.every((k) => (k.key === docKey ? newDocItem : updatedDocs[k.key])?.status === 'passed');
      const finalDocStatus = allDocsPassed ? 'passed' : newUploadedCount > 0 ? (allDocsPassed ? 'passed' : 'partial') : 'pending';

      setDatabaseDocs((prev) => ({ ...(prev || {}), [docKey]: newDocItem }));

      if (employee) {
        updateEmployee(employee.id, {
          submittedDocuments: updatedDocs,
          documentsPassed: allDocsPassed,
          documentsStatus: finalDocStatus,
        });
      }

      if (targetEmpId) {
        // Direct persistent database save for document pass / upload status
        saveDocumentPassStatus(targetEmpId, {
          docKey,
          status: passStatus,
          allPassed: allDocsPassed,
          documentsStatus: finalDocStatus,
          submittedDocuments: updatedDocs,
          documentItem: newDocItem,
        }).catch(console.warn);

        submitRequiredDocument(meta?.id || docKey, targetEmpId, {
          fileName: file.name,
          fileUrl: remoteUrl || dataUrl,
          fileDataUrl: dataUrl,
          fileSize: file.size,
          fileType: file.type,
          note: (customNotes ?? '').trim(),
          notes: (customDescription ?? '').trim(),
        });
      }

      setUploadingKey(null);
      setSubmitDialog(null);
      const meta = allDocRequirements.find((d) => d.key === docKey);
      toast.success(
        markAsPassed
          ? `${meta?.title || 'Document'} passed & recorded according to requirement!`
          : `${meta?.title || 'Document'} submitted! Pending coordinator review.`
      );
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

    setDatabaseDocs((prev) => {
      if (!prev) return null;
      const n = { ...prev };
      delete (n as any)[docKey];
      if (docKey === 'consent') delete (n as any).parent_consent;
      if (docKey === 'moa') delete (n as any).endorsement;
      if (docKey === 'medical') delete (n as any).clearance;
      return n;
    });

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
      return Boolean(doc?.dataUrl || doc?.name || doc?.fileUrl);
    }).length;

    const targetEmpId = employee?.id || employee?.employeeId || currentUser?.employeeId || currentUser?.id || '';
    if (employee) {
      const removalStatus = remainingCount > 0 ? 'partial' : 'incomplete';
      updateEmployee(employee.id, {
        submittedDocuments: updatedDocs,
        documentsPassed: false,
        documentsStatus: removalStatus,
      });
      if (targetEmpId) {
        saveDocumentPassStatus(targetEmpId, {
          allPassed: false,
          documentsStatus: remainingCount > 0 ? 'partial' : 'pending',
          submittedDocuments: updatedDocs,
        }).catch(console.warn);
      }
    } else if (targetEmpId) {
      saveDocumentPassStatus(targetEmpId, {
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

      {/* Document Attachments Manager (File Checklist & Attach Interface) */}
      <div className="space-y-4">
        {/* Attachment Filter & Search Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-blue-600 text-white shadow-xs shadow-blue-200'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All Requirements ({totalRequired})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('attached')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                statusFilter === 'attached'
                  ? 'bg-emerald-600 text-white shadow-xs shadow-emerald-200'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Paperclip size={13} />
              Attached ({uploadedCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('missing')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                statusFilter === 'missing'
                  ? 'bg-amber-600 text-white shadow-xs shadow-amber-200'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Clock size={13} />
              Action Needed ({missingCount})
            </button>
          </div>

          <div className="relative w-full sm:w-72">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search document or file name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-slate-50/50"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Attachment Rows List */}
        {filteredDocRequirements.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-2xl border border-dashed border-slate-200">
            <FileGeneric size={32} className="mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-semibold text-slate-700">No documents found matching your filter</p>
            <p className="text-xs text-slate-400 mt-1">Try clearing your search query or selecting "All Requirements".</p>
            <button
              type="button"
              onClick={() => {
                setStatusFilter('all');
                setSearchQuery('');
              }}
              className="mt-3 px-3 py-1.5 rounded-lg text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs divide-y divide-slate-100 overflow-hidden">
            {filteredDocRequirements.map((item) => {
              const doc = getDocItem(item.key);
              const hasFile = Boolean(doc?.dataUrl || doc?.name || doc?.fileUrl);
              const isPassed = doc?.status === 'passed' && hasFile;
              const isPending = (doc?.status === 'pending' || !doc?.status) && hasFile;
              const isUploading = uploadingKey === item.key;
              const Icon = item.icon || FileText;
              const docCategory = doc ? getFileCategory(doc.name || doc.fileType || '') : 'other';
              const isDragTarget = dragOverKey === item.key;

              return (
                <div
                  key={item.key}
                  onDragOver={(e) => handleDragOver(e, item.key)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, item)}
                  className={`p-4 sm:p-5 transition-colors ${
                    isDragTarget
                      ? 'bg-blue-50/70 border-2 border-dashed border-blue-400'
                      : isPassed
                      ? 'hover:bg-emerald-50/20'
                      : hasFile
                      ? 'hover:bg-blue-50/20'
                      : 'hover:bg-slate-50/60'
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Left Column: Requirement Information */}
                    <div className="flex items-start gap-3 min-w-0 lg:max-w-[36%]">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs bg-gradient-to-br ${
                          item.color || 'from-blue-600 to-indigo-600'
                        }`}
                      >
                        <Icon size={18} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                            DOC #{item.num}
                          </span>
                          {item.custom && (
                            <span className="text-[9px] font-bold bg-purple-100 text-purple-700 px-1.5 py-0.2 rounded border border-purple-200">
                              Custom
                            </span>
                          )}
                          <span className="text-[10px] text-slate-400 font-medium">
                            • {item.allowedFileTypes?.length
                                ? item.allowedFileTypes.map((t: string) => t.replace('.', '').toUpperCase()).join(', ')
                                : 'PDF, DOCX, Pictures'} (Max {item.maxFileSize ? Math.round(item.maxFileSize / (1024 * 1024)) : 10}MB)
                          </span>
                        </div>
                        <h3 className="text-sm font-bold text-slate-900 leading-snug">{item.title}</h3>
                        <p className="text-xs text-slate-500 leading-relaxed mt-0.5 line-clamp-2" title={item.desc}>
                          {item.desc}
                        </p>

                        {/* Instructor Template Chip if provided */}
                        {(item as any).instructorDoc && (
                          <div className="mt-2 inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-violet-50 border border-violet-200/80 text-violet-900 text-[11px]">
                            <FileText size={13} className="text-violet-600 shrink-0" />
                            <span className="font-semibold truncate max-w-[170px]" title={(item as any).instructorDoc.fileName}>
                              Template: {(item as any).instructorDoc.fileName}
                            </span>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  const docInfo = (item as any).instructorDoc;
                                  const url = resolveSafeDocumentViewUrl(docInfo.fileUrl || docInfo.dataUrl || '');
                                  setPreviewDoc({
                                    key: item.key,
                                    title: `Instructor Document: ${item.title}`,
                                    subtitle: docInfo.fileName,
                                    fileName: docInfo.fileName || `${item.key}_template.pdf`,
                                    dataUrl: url,
                                    fileSize: docInfo.fileSize,
                                    status: 'passed',
                                    description: item.desc,
                                    notes: docInfo.notes,
                                  });
                                }}
                                className="text-violet-700 hover:text-violet-900 font-bold hover:underline"
                              >
                                View
                              </button>
                              <span>•</span>
                              <button
                                type="button"
                                onClick={() => {
                                  const docInfo = (item as any).instructorDoc;
                                  const url = resolveSafeDocumentViewUrl(docInfo.fileUrl || docInfo.dataUrl || '');
                                  downloadDocument(url, docInfo.fileName || `${item.key}_instructor_doc`);
                                }}
                                className="text-violet-700 hover:text-violet-900 font-bold hover:underline"
                              >
                                Download
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Middle Column: Attachment Slot ("Attach a File" / Attached File Preview) */}
                    <div className="flex-1 min-w-0">
                      {hasFile && doc ? (
                        /* Attached File Chip */
                        <div className="p-2.5 sm:p-3 rounded-xl bg-slate-50/90 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div
                              className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                docCategory === 'picture'
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : docCategory === 'doc'
                                  ? 'bg-indigo-100 text-indigo-700'
                                  : 'bg-blue-100 text-blue-700'
                              }`}
                            >
                              {docCategory === 'picture' ? (
                                <ImageIcon size={15} />
                              ) : docCategory === 'doc' ? (
                                <FileText size={15} />
                              ) : (
                                <FileGeneric size={15} />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-800 truncate" title={doc.name}>
                                {doc.name}
                              </p>
                              <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                                <span>{doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString() : 'Attached'}</span>
                                {doc.size ? <span>• {formatFileSize(doc.size)}</span> : null}
                                <span className="uppercase font-semibold text-slate-500">
                                  ({docCategory === 'picture' ? 'Picture' : docCategory === 'doc' ? 'Word Doc' : 'PDF'})
                                </span>
                              </div>
                              {(doc.description || doc.notes) && (
                                <p className="text-[11px] text-slate-600 truncate mt-0.5" title={`${doc.description ? `Desc: ${doc.description}` : ''} ${doc.notes ? `| Note: ${doc.notes}` : ''}`}>
                                  {doc.description ? <span className="font-semibold text-slate-700">{doc.description}</span> : null}
                                  {doc.description && doc.notes ? ' — ' : ''}
                                  {doc.notes ? <span className="italic text-slate-500">{doc.notes}</span> : null}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Quick File Action Buttons (View, Download, Remove) */}
                          <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                const resolvedUrl = resolveSafeDocumentViewUrl(resolveDocDataUrl(item.key, doc));
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
                              className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-blue-700 border border-slate-200 text-xs font-semibold inline-flex items-center gap-1 shadow-2xs transition-colors cursor-pointer"
                              title="Preview attached file"
                            >
                              <Eye size={13} /> View
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                const resolvedUrl = resolveSafeDocumentViewUrl(resolveDocDataUrl(item.key, doc));
                                downloadDocument(resolvedUrl, doc?.name || `${item.key}_document`);
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-emerald-700 border border-slate-200 text-xs font-semibold inline-flex items-center gap-1 shadow-2xs transition-colors cursor-pointer"
                              title="Download attached file"
                            >
                              <Download size={13} /> Download
                            </button>

                            <button
                              type="button"
                              onClick={() => handleRemoveDoc(item.key)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                              title="Remove file"
                              aria-label={`Remove ${item.title}`}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* Empty Attachment Slot - "Attach a File" dropzone */
                        <label
                          htmlFor={`attach-file-slot-${item.key}`}
                          className={`w-full py-3 px-4 rounded-xl border border-dashed border-slate-300 hover:border-blue-400 bg-slate-50/60 hover:bg-blue-50/30 transition-all flex items-center justify-between gap-3 cursor-pointer group ${
                            isUploading ? 'opacity-50 cursor-not-allowed' : ''
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-slate-500 group-hover:text-blue-600 group-hover:border-blue-200 flex items-center justify-center shrink-0 transition-colors shadow-2xs">
                              <Paperclip size={14} />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-slate-700 group-hover:text-blue-700 transition-colors">
                                {isUploading ? 'Uploading attachment...' : 'Attach document file (Click or drag & drop)'}
                              </p>
                              <p className="text-[10px] text-slate-400">
                                Accepted: {item.allowedFileTypes?.length
                                  ? item.allowedFileTypes.map((t: string) => t.replace('.', '').toUpperCase()).join(', ')
                                  : 'PDF, Word (DOC/DOCX), or Pictures'} up to {item.maxFileSize ? Math.round(item.maxFileSize / (1024 * 1024)) : 10}MB
                              </p>
                            </div>
                          </div>
                          <span className="text-xs font-bold text-blue-600 group-hover:text-blue-700 whitespace-nowrap hidden sm:inline-flex items-center gap-1">
                            Browse <Upload size={12} />
                          </span>
                          <input
                            type="file"
                            id={`attach-file-slot-${item.key}`}
                            accept={
                              item.allowedFileTypes?.length
                                ? item.allowedFileTypes.map((t: string) => (t.startsWith('.') ? t : `.${t}`)).join(',')
                                : '.pdf,.doc,.docx,.docs,.jpg,.jpeg,.jfif,.png,.webp,.heic,image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/octet-stream'
                            }
                            onChange={(e) => {
                              const file = e.target.files?.[0] || null;
                              onSelectFile(item.key, item.title, file, (item as any).instructorDoc?.fileName);
                              e.target.value = '';
                            }}
                            className="hidden"
                            disabled={isUploading}
                          />
                        </label>
                      )}
                    </div>

                    {/* Right Column: Status Badge & Main Action */}
                    <div className="flex items-center justify-between lg:justify-end gap-3 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                      <span
                        className={`text-[11px] font-extrabold px-2.5 py-1 rounded-full border flex items-center gap-1.5 shrink-0 ${
                          isPassed
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                            : isPending
                            ? 'bg-blue-100 text-blue-800 border-blue-300'
                            : 'bg-amber-100 text-amber-800 border-amber-300'
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
                            <AlertTriangle size={11} /> NOT ATTACHED
                          </>
                        )}
                      </span>

                      {/* Primary Action Button */}
                      {hasFile ? (
                        <>
                          <label
                            htmlFor={`replace-doc-${item.key}`}
                            className="py-1.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-200 shadow-2xs"
                          >
                            <RefreshCw size={12} className={isUploading ? 'animate-spin' : ''} />
                            {isUploading ? 'Uploading...' : 'Replace'}
                          </label>
                          <input
                            type="file"
                            id={`replace-doc-${item.key}`}
                            accept=".pdf,.doc,.docx,.docs,.jpg,.jpeg,.jfif,.png,.webp,.heic,image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/octet-stream"
                            onChange={(e) => {
                              const file = e.target.files?.[0] || null;
                              onSelectFile(item.key, item.title, file, (item as any).instructorDoc?.fileName);
                              e.target.value = '';
                            }}
                            className="hidden"
                            disabled={isUploading}
                          />
                        </>
                      ) : (
                        <label
                          htmlFor={`attach-doc-btn-${item.key}`}
                          className={`py-1.5 px-3.5 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer shadow-xs ${
                            isUploading
                              ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                              : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200'
                          }`}
                        >
                          <Paperclip size={13} className={isUploading ? 'animate-spin' : ''} />
                          {isUploading ? 'Uploading...' : 'Attach File'}
                          <input
                            type="file"
                            id={`attach-doc-btn-${item.key}`}
                            accept=".pdf,.doc,.docx,.docs,.jpg,.jpeg,.jfif,.png,.webp,.heic,image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/octet-stream"
                            onChange={(e) => {
                              const file = e.target.files?.[0] || null;
                              onSelectFile(item.key, item.title, file, (item as any).instructorDoc?.fileName);
                              e.target.value = '';
                            }}
                            className="hidden"
                            disabled={isUploading}
                          />
                        </label>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
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

              {submitDialog.instructorDocName && (
                <div className="p-3 bg-violet-50/90 rounded-2xl border border-violet-200 flex items-center justify-between text-xs text-violet-950">
                  <div className="flex items-center gap-2 truncate">
                    <span className="w-2 h-2 rounded-full bg-violet-600 animate-pulse" />
                    <span className="truncate">
                      Complying with: <strong>{submitDialog.instructorDocName}</strong>
                    </span>
                  </div>
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-violet-200 text-violet-900 border border-violet-300 shrink-0">
                    Instructor Template
                  </span>
                </div>
              )}

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
                      submitDialog.notes,
                      true
                    );
                  }}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md shadow-blue-200 inline-flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  {uploadingKey === submitDialog.docKey ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" /> Uploading & Passing...
                    </>
                  ) : (
                    <>
                      <Check size={14} /> Pass & Submit Document
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
                            onError={(e) => {
                              (e.currentTarget as HTMLElement).style.display = 'none';
                              const el = document.getElementById('preview-doc-img-err');
                              if (el) el.style.display = 'flex';
                            }}
                          />
                          <div id="preview-doc-img-err" style={{ display: 'none' }} className="flex-col items-center justify-center p-4 bg-amber-50 rounded-2xl border border-amber-200 text-amber-800 text-center max-w-sm">
                            <p className="text-xs font-bold">Image preview unavailable in browser</p>
                            <p className="text-[11px] text-amber-700 mt-0.5">Click Download Picture below to view the original file.</p>
                          </div>
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
