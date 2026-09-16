import React, { useState } from 'react';
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
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'sonner';

import { useApp } from '../store/AppContext';
import { TraineeDocuments, TraineeDocumentItem } from '../types';
import { uploadDocumentToStorage } from '../services/supabaseService';
import { REQUIRED_TRAINEE_DOCUMENTS, REQUIRED_TRAINEE_DOC_KEYS } from '../data/documentRequirements';

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
}

export function Documents() {
  const navigate = useNavigate();
  const { currentUser, getCurrentEmployee, updateEmployee } = useApp();
  const employee = getCurrentEmployee();

  const [previewDoc, setPreviewDoc] = useState<PreviewModalState | null>(null);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);

  const submittedDocs: TraineeDocuments = employee?.submittedDocuments || {};

  const docKeys = REQUIRED_TRAINEE_DOC_KEYS;
  const totalRequired = docKeys.length;
  const uploadedCount = docKeys.filter((k) => Boolean(submittedDocs[k]?.dataUrl || submittedDocs[k]?.name)).length;
  const passedCount = docKeys.filter((k) => submittedDocs[k]?.status === 'passed').length;
  const isAllPassed = uploadedCount === totalRequired && passedCount === totalRequired;
  const missingCount = totalRequired - uploadedCount;
  const progressPercent = Math.round((uploadedCount / totalRequired) * 100);

  const resolveDocDataUrl = (docKey: string, docItem?: TraineeDocumentItem): string => {
    if (docItem?.dataUrl) return docItem.dataUrl;
    if ((docItem as any)?.fileUrl) return (docItem as any).fileUrl;
    const empId = employee?.id || employee?.employeeId || currentUser?.employeeId || '';
    try {
      const cached =
        localStorage.getItem(`ojt_doc_${empId}_${docKey}`) ||
        localStorage.getItem(`ojt_doc_${docKey}`) ||
        localStorage.getItem(`ojt_doc_current_${docKey}`);
      if (cached) return cached;
    } catch {}
    return '';
  };

  const handleFileUpload = (docKey: keyof TraineeDocuments, file: File | null) => {
    if (!file) return;

    // Validate file type — only PDF, JPG, PNG accepted
    const ALLOWED_MIME = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    const ALLOWED_EXT = /\.(pdf|jpg|jpeg|png)$/i;
    if (!ALLOWED_MIME.includes(file.type) && !ALLOWED_EXT.test(file.name)) {
      toast.error(
        `Unsupported file type: "${file.name.split('.').pop()?.toUpperCase() || 'Unknown'}". Only PDF, JPG, and PNG files are accepted.`
      );
      return;
    }

    // Check size limit: max 10MB
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size exceeds 10MB limit. Please choose a smaller file.');
      return;
    }

    setUploadingKey(docKey);
    const reader = new FileReader();

    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      const empId = employee?.id || employee?.employeeId || currentUser?.employeeId || '';

      // Cache locally immediately so user can always view even before network sync
      try {
        localStorage.setItem(`ojt_doc_${empId}_${docKey}`, dataUrl);
        localStorage.setItem(`ojt_doc_${docKey}`, dataUrl);
      } catch {}

      // Attempt cloud storage upload for permanent URL
      let finalUrl = dataUrl;
      try {
        const storedUrl = await uploadDocumentToStorage(empId, docKey, file, file.name);
        if (storedUrl && storedUrl.startsWith('http')) {
          finalUrl = storedUrl;
          try {
            localStorage.setItem(`ojt_doc_${empId}_${docKey}`, storedUrl);
          } catch {}
        }
      } catch {}

      const newDocItem: TraineeDocumentItem = {
        name: file.name,
        size: file.size,
        dataUrl: finalUrl,
        fileType: file.type || 'application/octet-stream',
        uploadedAt: new Date().toISOString(),
        // Initial status is pending until OJT Coordinator reviews and approves
        status: 'pending',
      };

      const updatedDocs: TraineeDocuments = {
        ...submittedDocs,
        [docKey]: newDocItem,
      };

      const newUploadedCount = docKeys.filter((k) => Boolean(updatedDocs[k]?.dataUrl || updatedDocs[k]?.name)).length;
      const allPreviouslyPassed = docKeys.every((k) =>
        k === docKey ? true : updatedDocs[k]?.status === 'passed'
      );
      const newIsAllPassed = newUploadedCount === totalRequired && allPreviouslyPassed;

      if (employee) {
        updateEmployee(employee.id, {
          submittedDocuments: updatedDocs,
          documentsPassed: newIsAllPassed,
          documentsStatus: newUploadedCount === totalRequired ? 'submitted' : 'partial',
        });
      }

      setUploadingKey(null);
      const meta = STANDARD_REQUIRED_DOCS.find((d) => d.key === docKey);
      toast.success(`${meta?.title || 'Document'} submitted! Pending coordinator review.`);
    };

    reader.onerror = () => {
      setUploadingKey(null);
      toast.error('Failed to read file. Please try again.');
    };

    reader.readAsDataURL(file);
  };

  const handleRemoveDoc = (docKey: keyof TraineeDocuments) => {
    const updatedDocs: TraineeDocuments = { ...submittedDocs };
    delete updatedDocs[docKey];

    const newUploadedCount = docKeys.filter((k) => Boolean(updatedDocs[k]?.dataUrl || updatedDocs[k]?.name)).length;

    if (employee) {
      updateEmployee(employee.id, {
        submittedDocuments: updatedDocs,
        documentsPassed: false,
        documentsStatus: newUploadedCount > 0 ? 'partial' : 'incomplete',
      });
    }

    const meta = STANDARD_REQUIRED_DOCS.find((d) => d.key === docKey);
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
            <FileCheck className="text-blue-600" size={26} /> Required OJT Documents
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Manage, review, and submit the {totalRequired} mandatory compliance documents required for your OJT internship program.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
          <span
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold border flex items-center gap-1.5 shadow-sm ${
              isAllPassed
                ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                : 'bg-amber-50 text-amber-800 border-amber-300'
            }`}
          >
            {isAllPassed ? (
              <>
                <CheckCircle2 size={15} className="text-emerald-600 stroke-[2.5]" />
                {totalRequired}/{totalRequired} Completed (Compliant)
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
            : 'bg-gradient-to-br from-amber-500/10 via-amber-50 to-white border-amber-200'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              {isAllPassed ? '🎉 All Required Documents Submitted & Verified' : '⚠️ Action Required: Submit Missing Documents'}
            </h3>
            <p className="text-xs text-slate-600 mt-0.5">
              {isAllPassed
                ? `Congratulations! You have fulfilled all ${totalRequired} registration document requirements. Your OJT Instructor can review them anytime.`
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

        <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-500">
          <Info size={13} className="shrink-0 text-slate-400" />
          <span>Accepted document formats: <strong>PDF, JPG, PNG</strong> (max 10MB per file). Files are securely stored.</span>
        </div>
      </motion.div>

      {/* 4 Standard Documents Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
        {STANDARD_REQUIRED_DOCS.map((item) => {
          const doc = submittedDocs[item.key];
          const hasFile = Boolean(doc?.dataUrl || doc?.name);
          const isPassed = doc?.status === 'passed' && hasFile;
          const isPending = (doc?.status === 'pending' || !doc?.status) && hasFile;
          const isUploading = uploadingKey === item.key;
          const Icon = item.icon;

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
                      className={`w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-md bg-gradient-to-br ${item.color}`}
                    >
                      <Icon size={20} />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">DOC #{item.num}</span>
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

                <p className="text-xs text-slate-600 leading-relaxed mb-4">{item.desc}</p>

                {/* Uploaded File Info Card */}
                {hasFile && doc && (
                  <div className="mb-4 p-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between gap-2">
                    <div className="min-w-0 flex items-center gap-2">
                      <div className="w-7 h-7 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                        <FileText size={15} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-800 truncate" title={doc.name}>
                          {doc.name}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          {doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString() : 'Uploaded'}
                          {doc.size ? ` • ${formatFileSize(doc.size)}` : ''}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveDoc(item.key)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors shrink-0"
                      title="Remove file"
                    >
                      <Trash2 size={15} />
                    </button>
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
                        });
                      }}
                      className="flex-1 py-2 px-3 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-all shadow-sm"
                    >
                      <Eye size={14} /> View File
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
                      accept=".pdf,.png,.jpg,.jpeg"
                      onChange={(e) => handleFileUpload(item.key, e.target.files?.[0] || null)}
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
                      accept=".pdf,.png,.jpg,.jpeg"
                      onChange={(e) => handleFileUpload(item.key, e.target.files?.[0] || null)}
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

      {/* Document Preview Modal */}
      <AnimatePresence>
        {previewDoc && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 backdrop-blur-sm p-3 sm:p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-3xl w-full max-w-3xl shadow-2xl max-h-[92vh] flex flex-col overflow-hidden"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white">
                <div>
                  <h3 className="font-bold text-slate-900 text-base">{previewDoc.title}</h3>
                  <p className="text-xs text-slate-500 truncate max-w-xs sm:max-w-md">{previewDoc.fileName}</p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-200 transition-colors cursor-pointer"
                  >
                    <Printer size={13} /> Print
                  </button>

                  {previewDoc.dataUrl && (
                    <a
                      href={previewDoc.dataUrl}
                      download={previewDoc.fileName || 'ojt-document'}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-semibold hover:bg-emerald-700 transition-all shadow-sm cursor-pointer"
                    >
                      <Download size={13} /> Download
                    </a>
                  )}

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

              {/* Preview Content */}
              <div className="flex-1 overflow-y-auto p-4 bg-slate-100 flex items-center justify-center min-h-[350px]">
                {previewDoc.dataUrl ? (
                  previewDoc.dataUrl.startsWith('data:image/') || previewDoc.dataUrl.match(/\.(jpeg|jpg|gif|png|webp)($|\?)/i) ? (
                    <img
                      src={previewDoc.dataUrl}
                      alt={previewDoc.title}
                      className="max-h-[520px] max-w-full object-contain rounded-2xl shadow-lg border border-slate-200 bg-white"
                    />
                  ) : (
                    <iframe
                      src={previewDoc.dataUrl}
                      className="w-full h-[520px] rounded-2xl border border-slate-200 bg-white shadow"
                      title="Document Preview"
                    />
                  )
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
                      This document has been verified in the system. To view the live image/PDF rendering or attach a fresh copy, choose your file below:
                    </p>

                    <label className="cursor-pointer px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 w-full">
                      <Upload size={14} /> Attach File for Live Preview
                      <input
                        type="file"
                        accept=".pdf,.png,.jpg,.jpeg"
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
