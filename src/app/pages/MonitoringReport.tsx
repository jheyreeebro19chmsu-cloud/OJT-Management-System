import React, { useState, useMemo } from 'react';
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
};

function getReportCategory(r: MonitoringReportType): MonitoringReportCategory {
  if (r.category === 'midterm' || r.category === 'endterm' || r.category === 'monthly') {
    return r.category;
  }
  if (r.reportType === 'endterm' || r.term === 'endterm') return 'endterm';
  if (r.reportType === 'monthly' || r.frequency === 'monthly') return 'monthly';
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
    addMonitoringReport,
    updateMonitoringReport,
  } = useApp();

  const employee = getCurrentEmployee();
  const traineeId = employee?.id || currentUser?.id || '';
  const studentId = employee?.employeeId || currentUser?.employeeId || '';
  const traineeName = employee?.name || currentUser?.name || 'Trainee';

  const [selectedCategory, setSelectedCategory] = useState<'all' | MonitoringReportCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Submit / Attach File Modal state
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [targetReportForSubmit, setTargetReportForSubmit] = useState<MonitoringReportType | null>(null);
  const [submitCategory, setSubmitCategory] = useState<MonitoringReportCategory>('midterm');
  const [submitTitle, setSubmitTitle] = useState('Mid-Term Monitoring Report');
  const [submitNotes, setSubmitNotes] = useState('');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Quick inline attach state per card
  const [attachingReportId, setAttachingReportId] = useState<string | null>(null);

  // Preview Modal state
  const [previewState, setPreviewState] = useState<{
    file: TraineeDocumentFile;
    ownerLabel: string;
    categoryLabel: string;
  } | null>(null);

  // Reports visible to this trainee:
  // 1) Any report posted by Instructor for 'all' trainees or specifically this trainee
  // 2) Any report created/submitted by this trainee
  const visibleReports = useMemo(() => {
    const cleanId = traineeId.toLowerCase();
    const cleanStudentId = studentId.toLowerCase();
    return monitoringReports.filter((r) => {
      if (r.targetTraineeId === 'all' || r.traineeId === 'all' || r.createdByRole === 'instructor') {
        if (!r.targetTraineeId || r.targetTraineeId === 'all') return true;
        const target = r.targetTraineeId.toLowerCase();
        if (target === cleanId || (cleanStudentId && target === cleanStudentId)) return true;
      }
      const rTrainee = (r.traineeId || '').toLowerCase();
      const rStudent = (r.studentId || '').toLowerCase();
      if (cleanId && (rTrainee === cleanId || rStudent === cleanId)) return true;
      if (cleanStudentId && (rTrainee === cleanStudentId || rStudent === cleanStudentId)) return true;
      return false;
    });
  }, [monitoringReports, traineeId, studentId]);

  const getMySubmissionForReport = (report: MonitoringReportType): MonitoringReportSubmission | null => {
    const cleanId = traineeId.toLowerCase();
    const cleanStudentId = studentId.toLowerCase();

    const matchedSub = (report.submissions || []).find((s) => {
      const sTrainee = (s.traineeId || '').toLowerCase();
      const sStudent = (s.studentId || '').toLowerCase();
      return (
        (cleanId && (sTrainee === cleanId || sStudent === cleanId)) ||
        (cleanStudentId && (sTrainee === cleanStudentId || sStudent === cleanStudentId)) ||
        s.traineeName.toLowerCase() === traineeName.toLowerCase()
      );
    });

    if (matchedSub) return matchedSub;

    if (
      report.createdByRole === 'trainee' &&
      Array.isArray(report.traineeFiles) &&
      report.traineeFiles.length > 0
    ) {
      return {
        id: `sub-${report.id}`,
        reportId: report.id,
        traineeId: report.traineeId,
        traineeName: report.traineeName,
        studentId: report.studentId,
        course: report.course,
        hteCompanyName: report.hteCompanyName,
        category: getReportCategory(report),
        files: report.traineeFiles,
        notes: report.description || report.tasksAccomplished,
        submittedAt: report.createdAt,
        status: report.status === 'reviewed' ? 'reviewed' : 'submitted',
        instructorRemarks: report.instructorRemarks,
      };
    }

    return null;
  };

  const counts = useMemo(() => {
    let midterm = 0;
    let endterm = 0;
    let monthly = 0;
    let mySubmittedCount = 0;

    visibleReports.forEach((r) => {
      const cat = getReportCategory(r);
      if (cat === 'midterm') midterm++;
      else if (cat === 'endterm') endterm++;
      else if (cat === 'monthly') monthly++;

      const mySub = getMySubmissionForReport(r);
      if (mySub && mySub.files.length > 0) {
        mySubmittedCount++;
      }
    });

    return {
      all: visibleReports.length,
      midterm,
      endterm,
      monthly,
      mySubmittedCount,
    };
  }, [visibleReports, traineeId, studentId]);

  const filteredReports = useMemo(() => {
    return visibleReports.filter((r) => {
      const cat = getReportCategory(r);
      if (selectedCategory !== 'all' && cat !== selectedCategory) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = (r.title || r.periodCovered || '').toLowerCase().includes(q);
        const matchDesc = (r.description || r.tasksAccomplished || '').toLowerCase().includes(q);
        const matchInstFiles = (r.instructorFiles || []).some((f) => f.name.toLowerCase().includes(q));
        const mySub = getMySubmissionForReport(r);
        const matchMyFiles = (mySub?.files || []).some((f) => f.name.toLowerCase().includes(q));
        return matchTitle || matchDesc || matchInstFiles || matchMyFiles;
      }

      return true;
    });
  }, [visibleReports, selectedCategory, searchQuery]);

  const openSubmitModal = (report?: MonitoringReportType, defaultCat?: MonitoringReportCategory) => {
    if (report) {
      const cat = getReportCategory(report);
      const existingSub = getMySubmissionForReport(report);
      setTargetReportForSubmit(report);
      setSubmitCategory(cat);
      setSubmitTitle(report.title || report.periodCovered || CATEGORY_META[cat].defaultTitle);
      setSubmitNotes(existingSub?.notes || '');
      setPendingFiles([]);
      setShowSubmitModal(true);
    } else {
      const cat = defaultCat || (selectedCategory !== 'all' ? selectedCategory : 'midterm');
      setTargetReportForSubmit(null);
      setSubmitCategory(cat);
      setSubmitTitle(CATEGORY_META[cat].defaultTitle);
      setSubmitNotes('');
      setPendingFiles([]);
      setShowSubmitModal(true);
    }
  };

  const handleCategoryChangeInModal = (cat: MonitoringReportCategory) => {
    const prevDefault = CATEGORY_META[submitCategory].defaultTitle;
    setSubmitCategory(cat);
    if (!submitTitle.trim() || submitTitle === prevDefault) {
      setSubmitTitle(CATEGORY_META[cat].defaultTitle);
    }
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
    notes?: string
  ) => {
    const cat = getReportCategory(report);
    const existingSub = getMySubmissionForReport(report);
    const currentSubs = report.submissions || [];

    let updatedSubs: MonitoringReportSubmission[];
    if (existingSub && currentSubs.some((s) => s.id === existingSub.id)) {
      updatedSubs = currentSubs.map((s) =>
        s.id === existingSub.id
          ? {
              ...s,
              files: [...(s.files || []), ...newFiles],
              notes: notes !== undefined && notes.trim() ? notes.trim() : s.notes,
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
        files: [...(existingSub?.files || []), ...newFiles],
        notes: notes?.trim() || undefined,
        submittedAt: new Date().toISOString(),
        status: 'submitted',
      };
      updatedSubs = [newSub, ...currentSubs];
    }

    await updateMonitoringReport(report.id, {
      submissions: updatedSubs,
      ...(report.createdByRole === 'trainee'
        ? { traineeFiles: [...(report.traineeFiles || []), ...newFiles] }
        : {}),
    });
  };

  const handleSubmitModalForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pendingFiles.length === 0) {
      toast.error('Please select at least one file to submit/attach.');
      return;
    }

    setIsSubmitting(true);
    try {
      const uploadedFiles = await uploadFilesList(pendingFiles, `trainee_mr_${submitCategory}_${Date.now()}`);

      if (targetReportForSubmit) {
        await attachFilesToReport(targetReportForSubmit, uploadedFiles, submitNotes);
      } else {
        // Create a new Monitoring Report entry with the trainee's submission
        const subId = `sub-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const title = submitTitle.trim() || CATEGORY_META[submitCategory].defaultTitle;
        await addMonitoringReport({
          reportType: submitCategory,
          category: submitCategory,
          term: submitCategory === 'endterm' ? 'endterm' : 'midterm',
          frequency: submitCategory === 'monthly' ? 'monthly' : 'evaluation',
          createdByRole: 'trainee',
          targetTraineeId: traineeId || studentId || 'all',
          traineeId: traineeId || studentId || 'trainee',
          traineeName,
          studentId: studentId || undefined,
          course: employee?.course || 'BSIT',
          department: employee?.department || 'College of Computer Studies',
          academicYear: '2026-2027',
          hteCompanyName: employee?.companyName || 'Host Training Establishment',
          title,
          description: submitNotes.trim(),
          periodCovered: title,
          dateSubmitted: new Date().toISOString().split('T')[0],
          hoursRenderedThisPeriod: 0,
          tasksAccomplished: submitNotes.trim() || `${CATEGORY_META[submitCategory].label} Trainee Submission`,
          questionnaire: {
            q1_dutiesBriefly: '',
            q2_strongestPerformanceArea: '',
            q3_areasImprovedMost: '',
            q4_areasNeedImprovement: '',
            q5_situationChallengedMost: '',
            q6_howOvercameChallenge: '',
            q7_whatLearnedFromExperience: '',
            q8_isQualifiedLinkage: '',
            q9_ojtSuggestionsRecommendations: '',
          },
          traineeFiles: uploadedFiles,
          submissions: [
            {
              id: subId,
              reportId: '',
              traineeId: traineeId || studentId || 'trainee',
              traineeName,
              studentId: studentId || undefined,
              course: employee?.course || 'BSIT',
              hteCompanyName: employee?.companyName || 'Host Training Establishment',
              category: submitCategory,
              files: uploadedFiles,
              notes: submitNotes.trim() || undefined,
              submittedAt: new Date().toISOString(),
              status: 'submitted',
            },
          ],
          status: 'submitted',
        });
      }

      toast.success(
        `Your ${CATEGORY_META[submitCategory].label} file${
          uploadedFiles.length > 1 ? 's have' : ' has'
        } been submitted and synced to the Instructor account!`
      );
      setShowSubmitModal(false);
      setPendingFiles([]);
    } catch (err) {
      console.error('Error submitting monitoring report file:', err);
      toast.error('Failed to submit file. Please try again.');
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
    fileName?: string
  ) => {
    const mySub = getMySubmissionForReport(report);
    if (!mySub) return;

    const remainingFiles = (mySub.files || []).filter((f) =>
      fileId ? f.id !== fileId : f.name !== fileName
    );

    const updatedSubs = (report.submissions || [])
      .map((s) => (s.id === mySub.id ? { ...s, files: remainingFiles } : s))
      .filter((s) => s.files.length > 0);

    await updateMonitoringReport(report.id, {
      submissions: updatedSubs,
      ...(report.createdByRole === 'trainee' ? { traineeFiles: remainingFiles } : {}),
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
      {/* Page Header */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 mb-2">
              <FileText className="w-3.5 h-3.5" />
              OJT Trainee Monitoring Report Portal
            </span>
            <h1 className="text-2xl font-bold text-gray-900">Monitoring Report</h1>
            <p className="text-sm text-gray-600 mt-1">
              View and preview <span className="font-semibold text-gray-800">Mid-Term</span>,{' '}
              <span className="font-semibold text-gray-800">End-Term</span>, and{' '}
              <span className="font-semibold text-gray-800">Monthly</span> Monitoring Report files from your
              Instructor, and submit or attach your completed file(s).
            </p>
          </div>
          <button
            type="button"
            onClick={() => openSubmitModal()}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm shadow-sm transition-colors shrink-0"
          >
            <Upload className="w-4 h-4" />
            Submit / Attach File
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
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
        </div>
      </div>

      {/* Category Filter Tabs & Search */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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

      {/* Monitoring Report Cards */}
      {filteredReports.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4">
            <FolderOpen className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold text-gray-900">
            {selectedCategory === 'all'
              ? 'No Monitoring Report Files Yet'
              : `No ${CATEGORY_META[selectedCategory].label} Monitoring Report Files Yet`}
          </h3>
          <p className="text-sm text-gray-500 max-w-md mx-auto mt-1 mb-6">
            When your Instructor adds a Monitoring Report file, it will appear here automatically. You can also
            directly submit or attach your <span className="font-semibold text-gray-700">Mid-Term</span>,{' '}
            <span className="font-semibold text-gray-700">End-Term</span>, or{' '}
            <span className="font-semibold text-gray-700">Monthly</span> file below.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => openSubmitModal(undefined, 'midterm')}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm"
            >
              <Upload className="w-4 h-4" />
              Submit Mid-Term File
            </button>
            <button
              type="button"
              onClick={() => openSubmitModal(undefined, 'endterm')}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm"
            >
              <Upload className="w-4 h-4" />
              Submit End-Term File
            </button>
            <button
              type="button"
              onClick={() => openSubmitModal(undefined, 'monthly')}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold shadow-sm"
            >
              <Upload className="w-4 h-4" />
              Submit Monthly File
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {filteredReports.map((report) => {
            const cat = getReportCategory(report);
            const meta = CATEGORY_META[cat];
            const instructorFiles = report.instructorFiles || [];
            const mySubmission = getMySubmissionForReport(report);
            const myFiles = mySubmission?.files || [];

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
                      {myFiles.length > 0 ? (
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            mySubmission?.status === 'reviewed'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {mySubmission?.status === 'reviewed'
                            ? 'Reviewed by Instructor'
                            : 'File Submitted'}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                          <Clock className="w-3.5 h-3.5" />
                          Pending Your File Attachment
                        </span>
                      )}
                      <span className="text-xs text-gray-400">
                        Posted{' '}
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

                  {/* Action button to attach/submit file directly onto this Monitoring Report */}
                  <div className="flex items-center gap-2 shrink-0">
                    <label className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer shadow-sm transition-colors">
                      <Upload className="w-3.5 h-3.5" />
                      {attachingReportId === report.id
                        ? 'Uploading...'
                        : myFiles.length > 0
                        ? 'Attach More Files'
                        : 'Submit / Attach File'}
                      <input
                        type="file"
                        multiple
                        accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp"
                        onChange={(e) => handleQuickAttachOnCard(report, e)}
                        className="hidden"
                        disabled={attachingReportId === report.id}
                      />
                    </label>
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
                        Your Submitted / Attached File(s) ({myFiles.length})
                      </h4>
                      <button
                        type="button"
                        onClick={() => openSubmitModal(report)}
                        className="text-xs font-semibold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add with Notes
                      </button>
                    </div>

                    {myFiles.length === 0 ? (
                      <label className="flex flex-col items-center justify-center p-5 rounded-xl border-2 border-dashed border-blue-200 bg-blue-50/30 hover:bg-blue-50/60 cursor-pointer transition-colors text-center">
                        <Upload className="w-5 h-5 text-blue-600 mb-1" />
                        <span className="text-xs font-semibold text-blue-900">
                          Click here to attach or submit your {meta.label} file(s)
                        </span>
                        <span className="text-[11px] text-gray-500 mt-0.5">
                          PDF, Word (.doc, .docx), or Image (seen in both accounts)
                        </span>
                        <input
                          type="file"
                          multiple
                          accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp"
                          onChange={(e) => handleQuickAttachOnCard(report, e)}
                          className="hidden"
                        />
                      </label>
                    ) : (
                      <div className="space-y-2">
                        {myFiles.map((file, idx) => (
                          <div
                            key={file.id || `${file.name}-${idx}`}
                            className="flex items-center justify-between gap-3 p-3 rounded-xl border border-blue-200 bg-blue-50/40 hover:bg-blue-50/70 transition-colors"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                                {isImageFile(file) ? (
                                  <FileImage className="w-4 h-4" />
                                ) : (
                                  <FileText className="w-4 h-4" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-gray-900 truncate">{file.name}</p>
                                <p className="text-[11px] text-gray-500">
                                  {formatFileSize(file.size)} • Your Attached File
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() =>
                                  setPreviewState({
                                    file,
                                    ownerLabel: `Your Submitted File (${traineeName})`,
                                    categoryLabel: meta.label,
                                  })
                                }
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                Preview
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDownloadFile(file)}
                                className="p-1.5 rounded-lg bg-white border border-gray-200 hover:bg-gray-100 text-gray-700"
                                title="Download Your File"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveMySubmittedFile(report, file.id, file.name)}
                                className="p-1.5 rounded-lg bg-white border border-gray-200 hover:bg-red-50 text-red-500"
                                title="Remove File"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}

                        {mySubmission?.notes && (
                          <p className="text-xs text-gray-600 italic px-1">
                            Your note: &ldquo;{mySubmission.notes}&rdquo;
                          </p>
                        )}

                        {mySubmission?.instructorRemarks && (
                          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900">
                            <span className="font-bold">Instructor Remarks:</span> {mySubmission.instructorRemarks}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Submit / Attach File */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-gray-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Upload className="w-5 h-5 text-emerald-400" />
                <h2 className="text-base font-bold">
                  {targetReportForSubmit
                    ? `Attach File to ${targetReportForSubmit.title || targetReportForSubmit.periodCovered}`
                    : 'Submit / Attach Monitoring Report File'}
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
              {/* Period / Category Selector */}
              {!targetReportForSubmit && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-2">
                    Select Monitoring Period *
                  </label>
                  <div className="grid grid-cols-3 gap-2.5">
                    {(['midterm', 'endterm', 'monthly'] as MonitoringReportCategory[]).map((cat) => {
                      const active = submitCategory === cat;
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => handleCategoryChangeInModal(cat)}
                          className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all ${
                            active
                              ? CATEGORY_META[cat].activeTabClass
                              : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                          }`}
                        >
                          {CATEGORY_META[cat].label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {!targetReportForSubmit && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                    Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={submitTitle}
                    onChange={(e) => setSubmitTitle(e.target.value)}
                    placeholder="e.g., Mid-Term Monitoring Report"
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
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

              {/* File Picker */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                  Attach File(s) *
                </label>
                <label className="flex flex-col items-center justify-center p-5 border-2 border-dashed border-emerald-300 rounded-xl bg-emerald-50/40 hover:bg-emerald-50 cursor-pointer transition-colors">
                  <Upload className="w-6 h-6 text-emerald-600 mb-1.5" />
                  <span className="text-sm font-semibold text-emerald-900">
                    Click to select file(s) to upload
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
