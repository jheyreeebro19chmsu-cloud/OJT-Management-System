import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../store/AppContext';
import {
  MonitoringReport as MonitoringReportType,
  MonitoringReportCategory,
  MonitoringReportSubmission,
  TraineeDocumentFile,
} from '../types';
import {
  uploadDocumentToStorage,
  resolveDocumentPreviewUrl,
  formatFileSize,
} from '../utils/documentStorage';
import {
  FileText,
  Upload,
  Eye,
  Download,
  CheckCircle2,
  Clock,
  Calendar,
  X,
  FileImage,
  FileCheck,
  Plus,
  Paperclip,
  FolderOpen,
  ExternalLink,
  Search,
} from 'lucide-react';
import { toast } from 'sonner';

export const REPORT_MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export const REPORT_WEEKS = [
  { value: 'Week 1', label: 'Week 1 (Days 1 - 7)' },
  { value: 'Week 2', label: 'Week 2 (Days 8 - 14)' },
  { value: 'Week 3', label: 'Week 3 (Days 15 - 21)' },
  { value: 'Week 4', label: 'Week 4 (Days 22 - 28)' },
  { value: 'Week 5', label: 'Week 5 (Days 29 - End of Month)' },
];

const CATEGORY_META: Record<
  MonitoringReportCategory,
  { label: string; badgeClass: string; activeTabClass: string; defaultTitle: string }
> = {
  midterm: {
    label: 'Mid-Term',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
    activeTabClass: 'bg-blue-600 text-white shadow-sm',
    defaultTitle: 'Mid-Term Monitoring Report',
  },
  endterm: {
    label: 'End-Term',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    activeTabClass: 'bg-emerald-600 text-white shadow-sm',
    defaultTitle: 'End-Term Monitoring Report',
  },
  monthly: {
    label: 'Monthly',
    badgeClass: 'bg-purple-50 text-purple-700 border-purple-200',
    activeTabClass: 'bg-purple-600 text-white shadow-sm',
    defaultTitle: 'Monthly Monitoring Report',
  },
  weekly: {
    label: 'Weekly',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
    activeTabClass: 'bg-amber-600 text-white shadow-sm',
    defaultTitle: 'Weekly Monitoring Report',
  },
};

function getReportCategory(r: MonitoringReportType): MonitoringReportCategory {
  if (r.category === 'midterm' || r.category === 'endterm' || r.category === 'monthly' || r.category === 'weekly') {
    return r.category;
  }
  const typeOrFreq = `${r.reportType || ''} ${r.frequency || ''} ${r.term || ''} ${r.title || ''}`.toLowerCase();
  if (typeOrFreq.includes('week')) return 'weekly';
  if (typeOrFreq.includes('end')) return 'endterm';
  if (typeOrFreq.includes('month')) return 'monthly';
  return 'midterm';
}

function isImageFile(file: TraineeDocumentFile): boolean {
  const type = (file.fileType || '').toLowerCase();
  const name = (file.name || '').toLowerCase();
  const url = (file.dataUrl || file.fileUrl || '').toLowerCase();
  return (
    type.startsWith('image/') ||
    /\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/i.test(name) ||
    /\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/i.test(url) ||
    url.startsWith('data:image/')
  );
}

function isPdfFile(file: TraineeDocumentFile): boolean {
  const type = (file.fileType || '').toLowerCase();
  const name = (file.name || '').toLowerCase();
  const url = (file.dataUrl || file.fileUrl || '').toLowerCase();
  return (
    type.includes('pdf') ||
    name.endsWith('.pdf') ||
    /\.pdf(\?|$)/i.test(url) ||
    url.startsWith('data:application/pdf')
  );
}

function getSafePreviewSrc(file: TraineeDocumentFile): string {
  const raw = file.dataUrl || file.fileUrl || '';
  if (!raw) return '';
  if (raw.startsWith('data:application/pdf;base64,')) {
    try {
      const base64 = raw.split(',')[1];
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: 'application/pdf' });
      return URL.createObjectURL(blob);
    } catch {
      return raw;
    }
  }
  return resolveDocumentPreviewUrl(raw) || raw;
}

export function MonitoringReport() {
  const {
    currentUser,
    getCurrentEmployee,
    monitoringReports,
    updateMonitoringReport,
    refreshData,
  } = useApp();

  // Live auto-sync when Trainee opens or focuses Monitoring Report page
  useEffect(() => {
    refreshData({ force: true }).catch(() => {});
    const onFocus = () => {
      refreshData({ force: true }).catch(() => {});
    };
    window.addEventListener('focus', onFocus);
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      refreshData({ force: true }).catch(() => {});
    }, 25000);
    return () => {
      window.removeEventListener('focus', onFocus);
      clearInterval(interval);
    };
  }, [refreshData]);

  const employee = getCurrentEmployee();
  const traineeId = employee?.id || currentUser?.id || '';
  const studentId = employee?.employeeId || currentUser?.employeeId || '';
  const traineeName = employee?.name || currentUser?.name || 'Trainee';

  const [selectedCategory, setSelectedCategory] = useState<'all' | MonitoringReportCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const currentMonthName = REPORT_MONTHS[new Date().getMonth()];
  const currentYear = new Date().getFullYear();
  const [selectedWeeklyMonth, setSelectedWeeklyMonth] = useState<string>('all');
  const [selectedWeeklyWeek, setSelectedWeeklyWeek] = useState<string>('all');

  // Submit / Attach File Modal state (ONLY for an Instructor-created report)
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [targetReportForSubmit, setTargetReportForSubmit] = useState<MonitoringReportType | null>(null);
  const [submitNotes, setSubmitNotes] = useState('');
  const [submitMonth, setSubmitMonth] = useState<string>(`${currentMonthName} ${currentYear}`);
  const [submitWeek, setSubmitWeek] = useState<string>('Week 1');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Quick inline attach state per Instructor-created card
  const [attachingReportId, setAttachingReportId] = useState<string | null>(null);

  // Preview Modal state
  const [previewState, setPreviewState] = useState<{
    file: TraineeDocumentFile;
    ownerLabel: string;
    categoryLabel: string;
  } | null>(null);

  // Only show Monitoring Reports created by the Instructor for 'all' trainees or specifically this trainee
  const visibleReports = useMemo(() => {
    const cleanId = traineeId.toLowerCase();
    const cleanStudentId = studentId.toLowerCase();
    return monitoringReports.filter((r) => {
      if (r.createdByRole === 'trainee') return false;
      if (!r.targetTraineeId || r.targetTraineeId === 'all' || r.traineeId === 'all') return true;
      const target = r.targetTraineeId.toLowerCase();
      const rTrainee = (r.traineeId || '').toLowerCase();
      const rStudent = (r.studentId || '').toLowerCase();
      if (cleanId && (target === cleanId || rTrainee === cleanId || rStudent === cleanId)) return true;
      if (cleanStudentId && (target === cleanStudentId || rTrainee === cleanStudentId || rStudent === cleanStudentId)) return true;
      return false;
    });
  }, [monitoringReports, traineeId, studentId]);

  const getMySubmissionsForReport = (report: MonitoringReportType): MonitoringReportSubmission[] => {
    const cleanId = traineeId.toLowerCase();
    const cleanStudentId = studentId.toLowerCase();

    return (report.submissions || []).filter((s) => {
      const sTrainee = (s.traineeId || '').toLowerCase();
      const sStudent = (s.studentId || '').toLowerCase();
      return (
        (cleanId && (sTrainee === cleanId || sStudent === cleanId)) ||
        (cleanStudentId && (sTrainee === cleanStudentId || sStudent === cleanStudentId)) ||
        s.traineeName.toLowerCase() === traineeName.toLowerCase()
      );
    });
  };

  const getMySubmissionForReport = (report: MonitoringReportType): MonitoringReportSubmission | null => {
    const subs = getMySubmissionsForReport(report);
    return subs.length > 0 ? subs[0] : null;
  };

  const counts = useMemo(() => {
    let midterm = 0;
    let endterm = 0;
    let monthly = 0;
    let weekly = 0;
    let mySubmittedCount = 0;

    visibleReports.forEach((r) => {
      const cat = getReportCategory(r);
      if (cat === 'midterm') midterm++;
      else if (cat === 'endterm') endterm++;
      else if (cat === 'monthly') monthly++;
      else if (cat === 'weekly') weekly++;

      const mySubs = getMySubmissionsForReport(r);
      if (mySubs.some((s) => s.files.length > 0)) {
        mySubmittedCount++;
      }
    });

    return {
      all: visibleReports.length,
      midterm,
      endterm,
      monthly,
      weekly,
      mySubmittedCount,
    };
  }, [visibleReports, traineeId, studentId]);

  const filteredReports = useMemo(() => {
    return visibleReports.filter((r) => {
      const cat = getReportCategory(r);
      if (selectedCategory !== 'all' && cat !== selectedCategory) return false;

      if (selectedCategory === 'weekly') {
        if (selectedWeeklyMonth !== 'all') {
          const rMonth = (r.month || r.title || r.periodCovered || '').toLowerCase();
          const hasMatchingSub = (r.submissions || []).some((s) =>
            (s.month || '').toLowerCase().includes(selectedWeeklyMonth.toLowerCase())
          );
          if (!rMonth.includes(selectedWeeklyMonth.toLowerCase()) && !hasMatchingSub) return false;
        }
        if (selectedWeeklyWeek !== 'all') {
          const rWeek = (r.week || r.title || r.periodCovered || '').toLowerCase();
          const hasMatchingSub = (r.submissions || []).some((s) =>
            (s.week || '').toLowerCase().includes(selectedWeeklyWeek.toLowerCase())
          );
          if (!rWeek.includes(selectedWeeklyWeek.toLowerCase()) && !hasMatchingSub) return false;
        }
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = (r.title || r.periodCovered || '').toLowerCase().includes(q);
        const matchDesc = (r.description || r.tasksAccomplished || '').toLowerCase().includes(q);
        const matchInstFiles = (r.instructorFiles || []).some((f) => f.name.toLowerCase().includes(q));
        const mySubs = getMySubmissionsForReport(r);
        const matchMyFiles = mySubs.some((s) =>
          (s.files || []).some((f) => f.name.toLowerCase().includes(q)) ||
          (s.week || '').toLowerCase().includes(q) ||
          (s.month || '').toLowerCase().includes(q)
        );
        return matchTitle || matchDesc || matchInstFiles || matchMyFiles;
      }

      return true;
    });
  }, [visibleReports, selectedCategory, searchQuery, selectedWeeklyMonth, selectedWeeklyWeek]);

  const openSubmitModal = (report: MonitoringReportType) => {
    setTargetReportForSubmit(report);
    const defaultMonth = report.month || `${currentMonthName} ${currentYear}`;
    const defaultWeek = report.week || 'Week 1';
    setSubmitMonth(defaultMonth);
    setSubmitWeek(defaultWeek);
    const existingSub = getMySubmissionsForReport(report).find(
      (s) => (!s.week || s.week === defaultWeek) && (!s.month || s.month === defaultMonth)
    );
    setSubmitNotes(existingSub?.notes || '');
    setPendingFiles([]);
    setShowSubmitModal(true);
  };

  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    if (selected.length === 0) return;
    setPendingFiles((prev) => [...prev, ...selected]);
    e.target.value = '';
  };

  const handleRemovePendingFile = (index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadFilesList = async (files: File[], prefix: string): Promise<TraineeDocumentFile[]> => {
    const uploaded: TraineeDocumentFile[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const res = await uploadDocumentToStorage(file, traineeId || 'trainee', `${prefix}_${i}`);
      uploaded.push({
        id: `tmrf-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
        name: file.name,
        fileType: file.type || 'application/octet-stream',
        size: file.size,
        uploadedAt: new Date().toISOString(),
        fileUrl: res.fileUrl,
        dataUrl: res.dataUrl,
        status: 'submitted',
      });
    }
    return uploaded;
  };

  const attachFilesToReport = async (
    report: MonitoringReportType,
    newFiles: TraineeDocumentFile[],
    notes?: string,
    passedMonth?: string,
    passedWeek?: string
  ) => {
    const cat = getReportCategory(report);
    const currentSubs = report.submissions || [];
    const isWeekly = cat === 'weekly' || Boolean(passedWeek);

    // Look for existing submission for this trainee and specific week/month if weekly
    const existingSub = currentSubs.find((s) => {
      const matchTrainee =
        (traineeId && s.traineeId?.toLowerCase() === traineeId.toLowerCase()) ||
        (studentId && s.studentId?.toLowerCase() === studentId.toLowerCase()) ||
        s.traineeName.toLowerCase() === traineeName.toLowerCase();
      if (!matchTrainee) return false;
      if (isWeekly && passedWeek) {
        return s.week === passedWeek && (!passedMonth || s.month === passedMonth);
      }
      return true;
    });

    let updatedSubs: MonitoringReportSubmission[];
    if (existingSub) {
      updatedSubs = currentSubs.map((s) =>
        s.id === existingSub.id
          ? {
              ...s,
              files: [...(s.files || []), ...newFiles],
              notes: notes !== undefined && notes.trim() ? notes.trim() : s.notes,
              month: passedMonth || s.month || report.month,
              week: passedWeek || s.week || report.week,
              submittedAt: new Date().toISOString(),
            }
          : s
      );
    } else {
      const newSub: MonitoringReportSubmission = {
        id: `sub-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        reportId: report.id,
        traineeId: traineeId || studentId || 'trainee',
        traineeName,
        studentId: studentId || undefined,
        course: employee?.course || 'BSIT',
        hteCompanyName: employee?.companyName || 'Host Training Establishment',
        category: cat,
        files: newFiles,
        notes: notes?.trim() || undefined,
        month: passedMonth || report.month,
        week: passedWeek || report.week,
        submittedAt: new Date().toISOString(),
        status: 'submitted',
      };
      updatedSubs = [newSub, ...currentSubs];
    }

    await updateMonitoringReport(report.id, {
      submissions: updatedSubs,
    });
  };

  const handleSubmitModalForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetReportForSubmit) return;

    setIsSubmitting(true);
    try {
      const cat = getReportCategory(targetReportForSubmit);
      const isWeekly = cat === 'weekly';
      const uploadedFiles =
        pendingFiles.length > 0
          ? await uploadFilesList(pendingFiles, `trainee_mr_${cat}_${Date.now()}`)
          : [];
      await attachFilesToReport(
        targetReportForSubmit,
        uploadedFiles,
        submitNotes,
        isWeekly ? submitMonth : targetReportForSubmit.month,
        isWeekly ? submitWeek : targetReportForSubmit.week
      );

      toast.success(
        isWeekly
          ? `Your Weekly submission for ${submitMonth} (${submitWeek}) has been saved and synced to the Instructor!`
          : `Your ${CATEGORY_META[cat].label} submission has been saved and synced to the Instructor account!`
      );
      setShowSubmitModal(false);
      setPendingFiles([]);
    } catch (err) {
      console.error('Error submitting monitoring report:', err);
      toast.error('Failed to submit. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickAttachOnCard = async (
    report: MonitoringReportType,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    e.target.value = '';

    setAttachingReportId(report.id);
    try {
      const uploadedFiles = await uploadFilesList(files, `trainee_quick_${report.id}`);
      await attachFilesToReport(report, uploadedFiles);
      toast.success(
        `Attached ${uploadedFiles.length} file${uploadedFiles.length > 1 ? 's' : ''} and synced to Instructor!`
      );
    } catch {
      toast.error('Failed to attach file(s).');
    } finally {
      setAttachingReportId(null);
    }
  };

  const handleRemoveMySubmittedFile = async (
    report: MonitoringReportType,
    fileId?: string,
    fileName?: string,
    submissionId?: string
  ) => {
    const updatedSubs = (report.submissions || [])
      .map((s) => {
        if (submissionId && s.id !== submissionId) return s;
        const matchTrainee =
          (traineeId && s.traineeId?.toLowerCase() === traineeId.toLowerCase()) ||
          (studentId && s.studentId?.toLowerCase() === studentId.toLowerCase()) ||
          s.traineeName.toLowerCase() === traineeName.toLowerCase();
        if (!matchTrainee) return s;

        const remainingFiles = (s.files || []).filter((f) =>
          fileId ? f.id !== fileId : f.name !== fileName
        );
        return { ...s, files: remainingFiles };
      })
      .filter((s) => s.files.length > 0);

    await updateMonitoringReport(report.id, {
      submissions: updatedSubs,
    });
    toast.success('Removed submitted file.');
  };

  const handleDownloadFile = (file: TraineeDocumentFile) => {
    const url = resolveDocumentPreviewUrl(file.fileUrl || file.dataUrl) || file.dataUrl || file.fileUrl;
    if (!url) {
      toast.error('File URL is not available.');
      return;
    }
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name || 'monitoring-report-file';
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="space-y-6 pb-10">
      {/* Page Header (Trainees wait for Instructor to post; no create button here) */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 mb-2">
              <FileText className="w-3.5 h-3.5" />
              OJT Trainee Monitoring Report Portal
            </span>
            <h1 className="text-2xl font-bold text-gray-900">Monitoring Report</h1>
            <p className="text-sm text-gray-600 mt-1">
              Wait for your Instructor to post <span className="font-semibold text-gray-800">Mid-Term</span>,{' '}
              <span className="font-semibold text-gray-800">End-Term</span>,{' '}
              <span className="font-semibold text-gray-800">Monthly</span>, or{' '}
              <span className="font-semibold text-gray-800">Weekly</span> Monitoring Report files. Once posted by
              the Instructor, you can choose what week in that specific month to pass your completed file, view, preview, and attach your submission.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold shrink-0">
            <Clock className="w-4 h-4 text-amber-600 shrink-0" />
            Instructor-Assigned Only
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-6">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`text-left p-4 rounded-xl border transition-all ${
              selectedCategory === 'all'
                ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                : 'bg-gray-50 hover:bg-gray-100 text-gray-900 border-gray-200'
            }`}
          >
            <div className="text-xs font-medium opacity-80">All Reports</div>
            <div className="text-2xl font-bold mt-1">{counts.all}</div>
            <div className="text-[11px] opacity-75 mt-0.5">
              {counts.mySubmittedCount} submitted by you
            </div>
          </button>

          <button
            type="button"
            onClick={() => setSelectedCategory('midterm')}
            className={`text-left p-4 rounded-xl border transition-all ${
              selectedCategory === 'midterm'
                ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                : 'bg-blue-50/60 hover:bg-blue-50 text-blue-900 border-blue-200'
            }`}
          >
            <div className="text-xs font-semibold uppercase tracking-wider opacity-85">Mid-Term</div>
            <div className="text-2xl font-bold mt-1">{counts.midterm}</div>
            <div className="text-[11px] opacity-80 mt-0.5">Mid-Term Files</div>
          </button>

          <button
            type="button"
            onClick={() => setSelectedCategory('endterm')}
            className={`text-left p-4 rounded-xl border transition-all ${
              selectedCategory === 'endterm'
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                : 'bg-emerald-50/60 hover:bg-emerald-50 text-emerald-900 border-emerald-200'
            }`}
          >
            <div className="text-xs font-semibold uppercase tracking-wider opacity-85">End-Term</div>
            <div className="text-2xl font-bold mt-1">{counts.endterm}</div>
            <div className="text-[11px] opacity-80 mt-0.5">End-Term Files</div>
          </button>

          <button
            type="button"
            onClick={() => setSelectedCategory('monthly')}
            className={`text-left p-4 rounded-xl border transition-all ${
              selectedCategory === 'monthly'
                ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                : 'bg-purple-50/60 hover:bg-purple-50 text-purple-900 border-purple-200'
            }`}
          >
            <div className="text-xs font-semibold uppercase tracking-wider opacity-85">Monthly</div>
            <div className="text-2xl font-bold mt-1">{counts.monthly}</div>
            <div className="text-[11px] opacity-80 mt-0.5">Monthly Files</div>
          </button>

          <button
            type="button"
            onClick={() => setSelectedCategory('weekly')}
            className={`text-left p-4 rounded-xl border transition-all ${
              selectedCategory === 'weekly'
                ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                : 'bg-amber-50/60 hover:bg-amber-50 text-amber-900 border-amber-200'
            }`}
          >
            <div className="text-xs font-semibold uppercase tracking-wider opacity-85">Weekly</div>
            <div className="text-2xl font-bold mt-1">{counts.weekly}</div>
            <div className="text-[11px] opacity-80 mt-0.5">Weekly Files</div>
          </button>
        </div>
      </div>

      {/* Category Filter Tabs & Search */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                selectedCategory === 'all'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All ({counts.all})
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategory('midterm')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                selectedCategory === 'midterm'
                  ? CATEGORY_META.midterm.activeTabClass
                  : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
              }`}
            >
              Mid-Term ({counts.midterm})
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategory('endterm')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                selectedCategory === 'endterm'
                  ? CATEGORY_META.endterm.activeTabClass
                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
              }`}
            >
              End-Term ({counts.endterm})
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategory('monthly')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                selectedCategory === 'monthly'
                  ? CATEGORY_META.monthly.activeTabClass
                  : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
              }`}
            >
              Monthly ({counts.monthly})
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategory('weekly')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                selectedCategory === 'weekly'
                  ? CATEGORY_META.weekly.activeTabClass
                  : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
              }`}
            >
              Weekly ({counts.weekly})
            </button>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search monitoring report files..."
              className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        {/* Weekly Specific Filters: Month and Week selection */}
        {selectedCategory === 'weekly' && (
          <div className="pt-3 border-t border-gray-100 flex flex-wrap items-center gap-3 text-xs">
            <span className="font-semibold text-gray-600 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-amber-600" />
              Filter by Month &amp; Week:
            </span>
            <div className="flex items-center gap-2">
              <label className="text-gray-500">Month:</label>
              <select
                value={selectedWeeklyMonth}
                onChange={(e) => setSelectedWeeklyMonth(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-gray-200 bg-gray-50 text-gray-800 font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
              >
                <option value="all">All Months</option>
                {REPORT_MONTHS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-gray-500">Week:</label>
              <select
                value={selectedWeeklyWeek}
                onChange={(e) => setSelectedWeeklyWeek(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-gray-200 bg-gray-50 text-gray-800 font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
              >
                <option value="all">All Weeks</option>
                {REPORT_WEEKS.map((w) => (
                  <option key={w.value} value={w.value}>
                    {w.label}
                  </option>
                ))}
              </select>
            </div>
            {(selectedWeeklyMonth !== 'all' || selectedWeeklyWeek !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSelectedWeeklyMonth('all');
                  setSelectedWeeklyWeek('all');
                }}
                className="text-amber-700 hover:text-amber-900 underline font-semibold ml-auto"
              >
                Reset Filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Monitoring Report Cards */}
      {filteredReports.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4">
            <FolderOpen className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold text-gray-900">
            {selectedCategory === 'all'
              ? 'Waiting for Instructor Monitoring Report File'
              : `No ${CATEGORY_META[selectedCategory].label} Monitoring Report Posted by Instructor Yet`}
          </h3>
          <p className="text-sm text-gray-500 max-w-md mx-auto mt-1">
            Only your OJT Instructor can create and post Monitoring Report files. Once your Instructor uploads a{' '}
            <span className="font-semibold text-gray-700">Mid-Term</span>,{' '}
            <span className="font-semibold text-gray-700">End-Term</span>, or{' '}
            <span className="font-semibold text-gray-700">Monthly</span> file, it will automatically appear here so
            you can preview it and attach your submission.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {filteredReports.map((report) => {
            const cat = getReportCategory(report);
            const meta = CATEGORY_META[cat];
            const instructorFiles = report.instructorFiles || [];
            const mySubmissions = getMySubmissionsForReport(report);
            const allMyFilesCount = mySubmissions.reduce((acc, s) => acc + (s.files?.length || 0), 0);
            const isWeekly = cat === 'weekly';

            return (
              <div
                key={report.id}
                className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden transition-all"
              >
                {/* Card Top Header */}
                <div className="p-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gray-50/50">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${meta.badgeClass}`}
                      >
                        {meta.label}
                      </span>
                      {(report.month || report.week) && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                          <Calendar className="w-3 h-3 text-amber-600" />
                          {report.month ? report.month : ''}
                          {report.month && report.week ? ' • ' : ''}
                          {report.week ? report.week : ''}
                        </span>
                      )}
                      {mySubmissions.length > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          {isWeekly
                            ? `${mySubmissions.length} Week${mySubmissions.length > 1 ? 's' : ''} Submitted`
                            : 'File Submitted'}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                          <Clock className="w-3.5 h-3.5" />
                          Pending Your File Attachment
                        </span>
                      )}
                      <span className="text-xs text-gray-400">
                        Posted by Instructor on{' '}
                        {new Date(report.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">
                      {report.title || report.periodCovered || meta.defaultTitle}
                    </h3>
                    {report.description && (
                      <p className="text-sm text-gray-600">{report.description}</p>
                    )}
                  </div>

                  {/* Action button to attach/submit file directly onto this Instructor-created Monitoring Report */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => openSubmitModal(report)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition-colors"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      {isWeekly
                        ? 'Pass Weekly Report'
                        : mySubmissions.length > 0
                        ? 'Attach More Files'
                        : 'Submit / Attach File'}
                    </button>
                  </div>
                </div>

                {/* Two-Column Content: Instructor File(s) & Trainee Submitted File(s) */}
                <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Left Column: Instructor File(s) */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                      <Paperclip className="w-3.5 h-3.5 text-emerald-600" />
                      Instructor File(s) ({instructorFiles.length})
                    </h4>

                    {instructorFiles.length === 0 ? (
                      <div className="p-4 rounded-xl bg-gray-50 border border-dashed border-gray-200 text-xs text-gray-500">
                        No template file attached by Instructor.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {instructorFiles.map((file, idx) => (
                          <div
                            key={file.id || `${file.name}-${idx}`}
                            className="flex items-center justify-between gap-3 p-3 rounded-xl border border-gray-200 bg-gray-50/70 hover:bg-gray-50 transition-colors"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                                {isImageFile(file) ? (
                                  <FileImage className="w-4 h-4" />
                                ) : (
                                  <FileText className="w-4 h-4" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-gray-900 truncate">{file.name}</p>
                                <p className="text-[11px] text-gray-500">
                                  {formatFileSize(file.size)} • Instructor File
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() =>
                                  setPreviewState({
                                    file,
                                    ownerLabel: 'Instructor File',
                                    categoryLabel: meta.label,
                                  })
                                }
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                Preview
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDownloadFile(file)}
                                className="p-1.5 rounded-lg bg-white border border-gray-200 hover:bg-gray-100 text-gray-700"
                                title="Download Instructor File"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Right Column: Trainee's Submitted / Attached File(s) */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                        <FileCheck className="w-3.5 h-3.5 text-blue-600" />
                        Your Submitted File(s) ({allMyFilesCount})
                      </h4>
                      <button
                        type="button"
                        onClick={() => openSubmitModal(report)}
                        className="text-xs font-semibold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        {isWeekly ? 'Pass for Another Week' : 'Add with Notes'}
                      </button>
                    </div>

                    {mySubmissions.length === 0 ? (
                      <button
                        type="button"
                        onClick={() => openSubmitModal(report)}
                        className="w-full flex flex-col items-center justify-center p-5 rounded-xl border-2 border-dashed border-blue-200 bg-blue-50/30 hover:bg-blue-50/60 cursor-pointer transition-colors text-center"
                      >
                        <Upload className="w-5 h-5 text-blue-600 mb-1" />
                        <span className="text-xs font-semibold text-blue-900">
                          {isWeekly
                            ? 'Click here to choose week and pass your Weekly report file(s)'
                            : `Click here to attach or submit your ${meta.label} file(s)`}
                        </span>
                        <span className="text-[11px] text-gray-500 mt-0.5">
                          PDF, Word (.doc, .docx), or Image (seen in both accounts)
                        </span>
                      </button>
                    ) : (
                      <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                        {mySubmissions.map((sub) => (
                          <div
                            key={sub.id}
                            className="p-3.5 rounded-xl border border-blue-100 bg-blue-50/30 space-y-2.5"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  {(sub.month || sub.week) && (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                      <Calendar className="w-3 h-3 text-amber-700" />
                                      {sub.month ? `${sub.month}` : ''}
                                      {sub.month && sub.week ? ' • ' : ''}
                                      {sub.week ? sub.week : ''}
                                    </span>
                                  )}
                                  <span
                                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                                      sub.status === 'reviewed' || Boolean(sub.instructorRemarks?.trim())
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : 'bg-blue-100 text-blue-800'
                                    }`}
                                  >
                                    {sub.status === 'reviewed' || Boolean(sub.instructorRemarks?.trim()) ? (
                                      <>
                                        <CheckCircle2 className="w-3 h-3" />
                                        Reviewed by Instructor
                                      </>
                                    ) : (
                                      <>
                                        <Clock className="w-3 h-3" />
                                        Submitted
                                      </>
                                    )}
                                  </span>
                                </div>
                                <p className="text-[11px] text-gray-500 mt-1">
                                  Passed{' '}
                                  {new Date(sub.submittedAt).toLocaleString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric',
                                    hour: 'numeric',
                                    minute: '2-digit',
                                  })}
                                </p>
                                {sub.notes && (
                                  <p className="text-xs text-gray-600 italic mt-0.5">
                                    Note: &ldquo;{sub.notes}&rdquo;
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* Files attached in this submission */}
                            <div className="space-y-1.5">
                              {(sub.files || []).map((file, fIdx) => (
                                <div
                                  key={file.id || `${file.name}-${fIdx}`}
                                  className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-white border border-gray-200"
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                                      {isImageFile(file) ? (
                                        <FileImage className="w-4 h-4" />
                                      ) : (
                                        <FileText className="w-4 h-4" />
                                      )}
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-xs font-semibold text-gray-900 truncate">{file.name}</p>
                                      <p className="text-[10px] text-gray-500">
                                        {formatFileSize(file.size)} • Your File
                                      </p>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setPreviewState({
                                          file,
                                          ownerLabel: `Your File (${sub.week || sub.month || traineeName})`,
                                          categoryLabel: meta.label,
                                        })
                                      }
                                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
                                    >
                                      <Eye className="w-3.5 h-3.5" />
                                      Preview
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDownloadFile(file)}
                                      className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700"
                                      title="Download File"
                                    >
                                      <Download className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveMySubmittedFile(report, file.id, file.name, sub.id)}
                                      className="p-1.5 rounded-lg bg-white border border-gray-200 hover:bg-red-50 text-red-500"
                                      title="Remove File"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>

                            {/* Instructor Remarks for this submission */}
                            {(Boolean(sub.instructorRemarks?.trim()) || sub.status === 'reviewed') && (
                              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-950 space-y-1">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="inline-flex items-center gap-1.5 font-bold text-emerald-800">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                    Instructor Remarks
                                  </span>
                                  {sub.reviewedAt && (
                                    <span className="text-[10px] text-emerald-700 font-medium">
                                      {new Date(sub.reviewedAt).toLocaleDateString('en-US', {
                                        month: 'short',
                                        day: 'numeric',
                                        year: 'numeric',
                                      })}
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs font-medium text-emerald-900 pl-4">
                                  {sub.instructorRemarks?.trim()
                                    ? `“${sub.instructorRemarks}”`
                                    : 'Approved / Reviewed by Instructor'}
                                </p>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Attach File to Instructor-Assigned Monitoring Report */}
      {showSubmitModal && targetReportForSubmit && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-gray-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Upload className="w-5 h-5 text-emerald-400" />
                <h2 className="text-base font-bold">
                  Attach File to {targetReportForSubmit.title || targetReportForSubmit.periodCovered}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowSubmitModal(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitModalForm} className="p-6 space-y-4">
              {/* If Weekly: Select Month and Week to pass */}
              {getReportCategory(targetReportForSubmit) === 'weekly' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-amber-50/70 border border-amber-200 rounded-xl">
                  <div>
                    <label className="block text-xs font-bold text-amber-900 mb-1">
                      Select Month *
                    </label>
                    <select
                      value={submitMonth}
                      onChange={(e) => setSubmitMonth(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-semibold rounded-lg border border-amber-300 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    >
                      {REPORT_MONTHS.map((m) => {
                        const val = `${m} ${currentYear}`;
                        return (
                          <option key={val} value={val}>
                            {val}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-amber-900 mb-1">
                      Choose Week to Pass *
                    </label>
                    <select
                      value={submitWeek}
                      onChange={(e) => setSubmitWeek(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-semibold rounded-lg border border-amber-300 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    >
                      {REPORT_WEEKS.map((w) => (
                        <option key={w.value} value={w.value}>
                          {w.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* If Monthly: Select Month */}
              {getReportCategory(targetReportForSubmit) === 'monthly' && (
                <div className="p-3.5 bg-purple-50/70 border border-purple-200 rounded-xl">
                  <label className="block text-xs font-bold text-purple-900 mb-1">
                    Select Month to Pass *
                  </label>
                  <select
                    value={submitMonth}
                    onChange={(e) => setSubmitMonth(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-semibold rounded-lg border border-purple-300 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    {REPORT_MONTHS.map((m) => {
                      const val = `${m} ${currentYear}`;
                      return (
                        <option key={val} value={val}>
                          {val}
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}

              {/* Optional Note */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                  Notes / Remarks (Optional)
                </label>
                <textarea
                  rows={2}
                  value={submitNotes}
                  onChange={(e) => setSubmitNotes(e.target.value)}
                  placeholder="Add an optional note for your Instructor..."
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* File Picker (Optional) */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                  Attach File(s) (Optional)
                </label>
                <label className="flex flex-col items-center justify-center p-5 border-2 border-dashed border-emerald-300 rounded-xl bg-emerald-50/40 hover:bg-emerald-50 cursor-pointer transition-colors">
                  <Upload className="w-6 h-6 text-emerald-600 mb-1.5" />
                  <span className="text-sm font-semibold text-emerald-900">
                    Click to select file(s) to upload (Optional)
                  </span>
                  <span className="text-xs text-gray-500 mt-0.5">
                    Supports PDF, Word (.doc, .docx), or Image files (multiple allowed)
                  </span>
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp"
                    onChange={handleFilesSelected}
                    className="hidden"
                  />
                </label>

                {pendingFiles.length > 0 && (
                  <div className="mt-3 space-y-1.5 max-h-40 overflow-y-auto">
                    {pendingFiles.map((f, idx) => (
                      <div
                        key={`${f.name}-${idx}`}
                        className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span className="font-medium text-gray-800 truncate">{f.name}</span>
                          <span className="text-gray-400 shrink-0">({formatFileSize(f.size)})</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemovePendingFile(idx)}
                          className="text-red-500 hover:text-red-700 p-1"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowSubmitModal(false)}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold shadow-sm"
                >
                  <Upload className="w-4 h-4" />
                  {isSubmitting ? 'Submitting...' : 'Submit File(s)'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: File Preview (Both Instructor & Trainee Files) */}
      {previewState && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                    {previewState.categoryLabel}
                  </span>
                  <span className="text-xs text-gray-300">{previewState.ownerLabel}</span>
                </div>
                <h3 className="text-base font-bold truncate mt-0.5">{previewState.file.name}</h3>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleDownloadFile(previewState.file)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewState(null)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 bg-gray-100 overflow-auto p-4 flex items-center justify-center min-h-[60vh]">
              {isImageFile(previewState.file) ? (
                <img
                  src={getSafePreviewSrc(previewState.file)}
                  alt={previewState.file.name}
                  className="max-w-full max-h-[75vh] object-contain rounded-lg shadow-md bg-white"
                />
              ) : isPdfFile(previewState.file) ? (
                <iframe
                  src={getSafePreviewSrc(previewState.file)}
                  title={previewState.file.name}
                  className="w-full h-[75vh] rounded-lg border border-gray-300 bg-white"
                />
              ) : (
                <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-sm border border-gray-200 space-y-4">
                  <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
                    <FileText className="w-8 h-8" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-gray-900 break-all">{previewState.file.name}</h4>
                    <p className="text-xs text-gray-500 mt-1">
                      {formatFileSize(previewState.file.size)} • {previewState.ownerLabel}
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => handleDownloadFile(previewState.file)}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
                    >
                      <Download className="w-4 h-4" />
                      Download File
                    </button>
                    {(previewState.file.fileUrl || previewState.file.dataUrl) && (
                      <a
                        href={getSafePreviewSrc(previewState.file)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-semibold"
                      >
                        <ExternalLink className="w-4 h-4" />
                        Open in New Tab
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default MonitoringReport;
