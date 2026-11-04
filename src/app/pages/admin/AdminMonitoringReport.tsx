import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../store/AppContext';
import {
  MonitoringReport,
  MonitoringReportCategory,
  MonitoringReportSubmission,
  TraineeDocumentFile,
} from '../../types';
import { isTraineeRole } from '../../utils/hteLocation';
import {
  uploadDocumentToStorage,
  resolveDocumentPreviewUrl,
  formatFileSize,
} from '../../utils/documentStorage';
import {
  FileText,
  Plus,
  Upload,
  Eye,
  Download,
  Trash2,
  CheckCircle2,
  Clock,
  Calendar,
  X,
  FileImage,
  FileCheck,
  Users,
  Search,
  ExternalLink,
  Paperclip,
  FolderOpen,
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

function getReportCategory(r: MonitoringReport): MonitoringReportCategory {
  if (r.category === 'midterm' || r.category === 'endterm' || r.category === 'monthly' || r.category === 'weekly') {
    return r.category;
  }
  if (r.reportType === 'weekly' || r.frequency === 'weekly' || (r.title || '').toLowerCase().includes('weekly')) {
    return 'weekly';
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

export function AdminMonitoringReport() {
  const {
    employees,
    currentUser,
    monitoringReports,
    addMonitoringReport,
    updateMonitoringReport,
    deleteMonitoringReport,
    refreshData,
  } = useApp();

  // Live auto-sync when Instructor opens or focuses Monitoring Report page
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

  const trainees = useMemo(() => employees.filter((e) => isTraineeRole(e)), [employees]);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState<'all' | MonitoringReportCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const currentMonthName = REPORT_MONTHS[new Date().getMonth()];
  const currentYear = new Date().getFullYear();
  const [selectedWeeklyMonth, setSelectedWeeklyMonth] = useState<string>('all');
  const [selectedWeeklyWeek, setSelectedWeeklyWeek] = useState<string>('all');

  // Add Monitoring Report File Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [formCategory, setFormCategory] = useState<MonitoringReportCategory>('midterm');
  const [formMonth, setFormMonth] = useState<string>(`${currentMonthName} ${currentYear}`);
  const [formWeek, setFormWeek] = useState<string>('Week 1');
  const [formTitle, setFormTitle] = useState('Mid-Term Monitoring Report');
  const [formDescription, setFormDescription] = useState('');
  const [formTargetTrainee, setFormTargetTrainee] = useState<string>('all');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // Add More Files to Existing Report state
  const [addingFilesToReportId, setAddingFilesToReportId] = useState<string | null>(null);

  // File Preview Modal state
  const [previewState, setPreviewState] = useState<{
    file: TraineeDocumentFile;
    ownerLabel: string;
    categoryLabel: string;
  } | null>(null);

  // Review Remarks state
  const [reviewingSubmissionKey, setReviewingSubmissionKey] = useState<string | null>(null);
  const [remarksInput, setRemarksInput] = useState('');

  // Counts
  const counts = useMemo(() => {
    let midterm = 0;
    let endterm = 0;
    let monthly = 0;
    let weekly = 0;
    let totalTraineeSubmissions = 0;

    monitoringReports.forEach((r) => {
      const cat = getReportCategory(r);
      if (cat === 'midterm') midterm++;
      else if (cat === 'endterm') endterm++;
      else if (cat === 'monthly') monthly++;
      else if (cat === 'weekly') weekly++;

      if (Array.isArray(r.submissions)) {
        totalTraineeSubmissions += r.submissions.length;
      } else if (r.createdByRole === 'trainee' && Array.isArray(r.traineeFiles) && r.traineeFiles.length > 0) {
        totalTraineeSubmissions += 1;
      }
    });

    return {
      all: monitoringReports.length,
      midterm,
      endterm,
      monthly,
      weekly,
      totalTraineeSubmissions,
    };
  }, [monitoringReports]);

  const filteredReports = useMemo(() => {
    return monitoringReports.filter((r) => {
      const cat = getReportCategory(r);
      if (selectedCategory !== 'all' && cat !== selectedCategory) return false;

      if (selectedCategory === 'weekly') {
        if (selectedWeeklyMonth !== 'all') {
          const rMonth = (r.month || r.title || r.periodCovered || '').toLowerCase();
          if (!rMonth.includes(selectedWeeklyMonth.toLowerCase())) return false;
        }
        if (selectedWeeklyWeek !== 'all') {
          const rWeek = (r.week || r.title || r.periodCovered || '').toLowerCase();
          if (!rWeek.includes(selectedWeeklyWeek.toLowerCase())) return false;
        }
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = (r.title || r.periodCovered || '').toLowerCase().includes(q);
        const matchDesc = (r.description || r.tasksAccomplished || '').toLowerCase().includes(q);
        const matchTrainee = (r.traineeName || '').toLowerCase().includes(q);
        const matchInstructorFiles = (r.instructorFiles || []).some((f) => f.name.toLowerCase().includes(q));
        const matchSub = (r.submissions || []).some(
          (s) =>
            s.traineeName.toLowerCase().includes(q) ||
            (s.studentId || '').toLowerCase().includes(q) ||
            (s.week || '').toLowerCase().includes(q) ||
            (s.month || '').toLowerCase().includes(q) ||
            s.files.some((f) => f.name.toLowerCase().includes(q))
        );
        return matchTitle || matchDesc || matchTrainee || matchInstructorFiles || matchSub;
      }

      return true;
    });
  }, [monitoringReports, selectedCategory, searchQuery, selectedWeeklyMonth, selectedWeeklyWeek]);

  const handleOpenAddModal = (defaultCat?: MonitoringReportCategory) => {
    const cat = defaultCat || (selectedCategory !== 'all' ? selectedCategory : 'midterm');
    setFormCategory(cat);
    if (cat === 'weekly') {
      setFormTitle(`Weekly Monitoring Report - ${formMonth} (${formWeek})`);
    } else if (cat === 'monthly') {
      setFormTitle(`Monthly Monitoring Report - ${formMonth}`);
    } else {
      setFormTitle(CATEGORY_META[cat].defaultTitle);
    }
    setFormDescription('');
    setFormTargetTrainee('all');
    setPendingFiles([]);
    setShowAddModal(true);
  };

  const handleCategorySelectInModal = (cat: MonitoringReportCategory) => {
    setFormCategory(cat);
    if (cat === 'weekly') {
      setFormTitle(`Weekly Monitoring Report - ${formMonth} (${formWeek})`);
    } else if (cat === 'monthly') {
      setFormTitle(`Monthly Monitoring Report - ${formMonth}`);
    } else {
      setFormTitle(CATEGORY_META[cat].defaultTitle);
    }
  };

  const handleFormMonthChange = (monthVal: string) => {
    setFormMonth(monthVal);
    if (formCategory === 'weekly') {
      setFormTitle(`Weekly Monitoring Report - ${monthVal} (${formWeek})`);
    } else if (formCategory === 'monthly') {
      setFormTitle(`Monthly Monitoring Report - ${monthVal}`);
    }
  };

  const handleFormWeekChange = (weekVal: string) => {
    setFormWeek(weekVal);
    if (formCategory === 'weekly') {
      setFormTitle(`Weekly Monitoring Report - ${formMonth} (${weekVal})`);
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

  const processFilesUpload = async (files: File[], prefixId: string): Promise<TraineeDocumentFile[]> => {
    const uploaded: TraineeDocumentFile[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const res = await uploadDocumentToStorage(file, 'instructor-monitoring', `${prefixId}_${i}`);
      uploaded.push({
        id: `mrf-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
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

  const handleCreateMonitoringReportFile = async (e: React.FormEvent) => {
    e.preventDefault();

    setIsUploading(true);
    try {
      const uploadedFiles =
        pendingFiles.length > 0
          ? await processFilesUpload(pendingFiles, `mr_${formCategory}_${Date.now()}`)
          : [];
      const targetTraineeObj =
        formTargetTrainee === 'all'
          ? null
          : trainees.find((t) => t.id === formTargetTrainee || t.employeeId === formTargetTrainee);

      const title = formTitle.trim() || CATEGORY_META[formCategory].defaultTitle;

      await addMonitoringReport({
        reportType: formCategory,
        category: formCategory,
        term: formCategory === 'endterm' ? 'endterm' : 'midterm',
        frequency: formCategory === 'monthly' ? 'monthly' : formCategory === 'weekly' ? 'weekly' : 'evaluation',
        createdByRole: 'instructor',
        targetTraineeId: formTargetTrainee,
        traineeId: targetTraineeObj ? targetTraineeObj.id : 'all',
        traineeName: targetTraineeObj ? targetTraineeObj.name : 'All Trainees',
        studentId: targetTraineeObj?.employeeId || 'ALL',
        course: targetTraineeObj?.course || 'All Courses',
        department: targetTraineeObj?.department || 'College of Computer Studies',
        academicYear: '2026-2027',
        hteCompanyName: targetTraineeObj?.companyName || 'All Host Training Establishments',
        instructorName: currentUser?.name || 'OJT Instructor',
        title,
        description: formDescription.trim(),
        periodCovered: formCategory === 'weekly' ? `${formMonth} (${formWeek})` : formCategory === 'monthly' ? formMonth : title,
        month: formCategory === 'weekly' || formCategory === 'monthly' ? formMonth : undefined,
        week: formCategory === 'weekly' ? formWeek : undefined,
        dateSubmitted: new Date().toISOString().split('T')[0],
        hoursRenderedThisPeriod: 0,
        tasksAccomplished: formDescription.trim() || `${CATEGORY_META[formCategory].label} Monitoring Report`,
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
        instructorFiles: uploadedFiles,
        submissions: [],
        status: 'submitted',
      });

      toast.success(
        `${CATEGORY_META[formCategory].label} Monitoring Report posted and synced to Trainee account${formTargetTrainee === 'all' ? 's' : ''
        }!`
      );
      setShowAddModal(false);
      setPendingFiles([]);
    } catch (err) {
      console.error('Error creating monitoring report:', err);
      toast.error('Failed to save Monitoring Report. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleAddMoreInstructorFiles = async (
    report: MonitoringReport,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    e.target.value = '';

    setAddingFilesToReportId(report.id);
    try {
      const newlyUploaded = await processFilesUpload(files, `mr_more_${report.id}`);
      const updatedFiles = [...(report.instructorFiles || []), ...newlyUploaded];
      await updateMonitoringReport(report.id, {
        instructorFiles: updatedFiles,
      });
      toast.success(`Added ${newlyUploaded.length} file${newlyUploaded.length > 1 ? 's' : ''} to ${report.title || report.periodCovered}.`);
    } catch {
      toast.error('Failed to attach additional file(s).');
    } finally {
      setAddingFilesToReportId(null);
    }
  };

  const handleRemoveInstructorFile = async (report: MonitoringReport, fileId?: string, fileName?: string) => {
    const remaining = (report.instructorFiles || []).filter((f) =>
      fileId ? f.id !== fileId : f.name !== fileName
    );
    await updateMonitoringReport(report.id, {
      instructorFiles: remaining,
    });
    toast.success('File removed.');
  };

  const handleDeleteReport = async (report: MonitoringReport) => {
    if (!window.confirm(`Delete "${report.title || report.periodCovered}" and its files?`)) return;
    await deleteMonitoringReport(report.id);
    toast.success('Monitoring Report removed.');
  };

  const handleApproveSubmission = async (
    report: MonitoringReport,
    submission: MonitoringReportSubmission,
    remarks?: string
  ) => {
    const updatedSubs = (report.submissions || []).map((s) =>
      s.id === submission.id
        ? {
          ...s,
          status: 'reviewed' as const,
          instructorRemarks: remarks !== undefined ? remarks : s.instructorRemarks,
          reviewedAt: new Date().toISOString(),
        }
        : s
    );
    await updateMonitoringReport(report.id, {
      submissions: updatedSubs,
      status: 'reviewed',
    });
    setReviewingSubmissionKey(null);
    setRemarksInput('');
    toast.success(`Reviewed ${submission.traineeName}'s submission!`);
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
              CHMSU OJT Monitoring Report Files
            </span>
            <h1 className="text-2xl font-bold text-gray-900">Monitoring Reports</h1>
            <p className="text-sm text-gray-600 mt-1">
              Add Monitoring Report files for <span className="font-semibold text-gray-800">Mid-Term</span>,{' '}
              <span className="font-semibold text-gray-800">End-Term</span>,{' '}
              <span className="font-semibold text-gray-800">Monthly</span>, and{' '}
              <span className="font-semibold text-gray-800">Weekly</span> periods. Trainees can choose what week in that specific month to pass their files, and both accounts can view &amp; preview submissions.
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleOpenAddModal()}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm shadow-sm transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
            Add Monitoring Report File
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-6">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`text-left p-4 rounded-xl border transition-all ${selectedCategory === 'all'
                ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                : 'bg-gray-50 hover:bg-gray-100 text-gray-900 border-gray-200'
              }`}
          >
            <div className="text-xs font-medium opacity-80">All Reports</div>
            <div className="text-2xl font-bold mt-1">{counts.all}</div>
            <div className="text-[11px] opacity-75 mt-0.5">
              {counts.totalTraineeSubmissions} trainee submission{counts.totalTraineeSubmissions === 1 ? '' : 's'}
            </div>
          </button>

          <button
            type="button"
            onClick={() => setSelectedCategory('midterm')}
            className={`text-left p-4 rounded-xl border transition-all ${selectedCategory === 'midterm'
                ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                : 'bg-blue-50/60 hover:bg-blue-50 text-blue-900 border-blue-200'
              }`}
          >
            <div className="text-xs font-semibold uppercase tracking-wider opacity-85">Mid-Term</div>
            <div className="text-2xl font-bold mt-1">{counts.midterm}</div>
            <div className="text-[11px] opacity-80 mt-0.5">Mid-Term Report Files</div>
          </button>

          <button
            type="button"
            onClick={() => setSelectedCategory('endterm')}
            className={`text-left p-4 rounded-xl border transition-all ${selectedCategory === 'endterm'
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                : 'bg-emerald-50/60 hover:bg-emerald-50 text-emerald-900 border-emerald-200'
              }`}
          >
            <div className="text-xs font-semibold uppercase tracking-wider opacity-85">End-Term</div>
            <div className="text-2xl font-bold mt-1">{counts.endterm}</div>
            <div className="text-[11px] opacity-80 mt-0.5">End-Term Report Files</div>
          </button>

          <button
            type="button"
            onClick={() => setSelectedCategory('monthly')}
            className={`text-left p-4 rounded-xl border transition-all ${selectedCategory === 'monthly'
                ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                : 'bg-purple-50/60 hover:bg-purple-50 text-purple-900 border-purple-200'
              }`}
          >
            <div className="text-xs font-semibold uppercase tracking-wider opacity-85">Monthly</div>
            <div className="text-2xl font-bold mt-1">{counts.monthly}</div>
            <div className="text-[11px] opacity-80 mt-0.5">Monthly Report Files</div>
          </button>

          <button
            type="button"
            onClick={() => setSelectedCategory('weekly')}
            className={`text-left p-4 rounded-xl border transition-all ${selectedCategory === 'weekly'
                ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                : 'bg-amber-50/60 hover:bg-amber-50 text-amber-900 border-amber-200'
              }`}
          >
            <div className="text-xs font-semibold uppercase tracking-wider opacity-85">Weekly</div>
            <div className="text-2xl font-bold mt-1">{counts.weekly}</div>
            <div className="text-[11px] opacity-80 mt-0.5">Weekly Report Files</div>
          </button>
        </div>
      </div>

      {/* Category Filter Tabs & Search Bar */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${selectedCategory === 'all'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
            >
              All ({counts.all})
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategory('midterm')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${selectedCategory === 'midterm'
                  ? CATEGORY_META.midterm.activeTabClass
                  : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                }`}
            >
              Mid-Term ({counts.midterm})
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategory('endterm')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${selectedCategory === 'endterm'
                  ? CATEGORY_META.endterm.activeTabClass
                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                }`}
            >
              End-Term ({counts.endterm})
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategory('monthly')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${selectedCategory === 'monthly'
                  ? CATEGORY_META.monthly.activeTabClass
                  : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
                }`}
            >
              Monthly ({counts.monthly})
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategory('weekly')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${selectedCategory === 'weekly'
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
              placeholder="Search file, title, or trainee..."
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

      {/* Monitoring Reports List */}
      {filteredReports.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4">
            <FolderOpen className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold text-gray-900">
            {selectedCategory === 'all'
              ? 'No Monitoring Report Files Added Yet'
              : `No ${CATEGORY_META[selectedCategory].label} Monitoring Report Files Yet`}
          </h3>
          <p className="text-sm text-gray-500 max-w-md mx-auto mt-1 mb-6">
            Click the button below to upload a Monitoring Report file under{' '}
            <span className="font-semibold text-gray-700">Mid-Term</span>,{' '}
            <span className="font-semibold text-gray-700">End-Term</span>,{' '}
            <span className="font-semibold text-gray-700">Monthly</span>, or{' '}
            <span className="font-semibold text-gray-700">Weekly</span>. It will automatically appear in the
            Trainees&apos; accounts for them to view, preview, and attach their submission.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => handleOpenAddModal('midterm')}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Add Mid-Term File
            </button>
            <button
              type="button"
              onClick={() => handleOpenAddModal('endterm')}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Add End-Term File
            </button>
            <button
              type="button"
              onClick={() => handleOpenAddModal('monthly')}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Add Monthly File
            </button>
            <button
              type="button"
              onClick={() => handleOpenAddModal('weekly')}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Add Weekly File
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {filteredReports.map((report) => {
            const cat = getReportCategory(report);
            const meta = CATEGORY_META[cat];
            const instructorFiles = report.instructorFiles || [];
            const directTraineeFiles = report.traineeFiles || [];
            const submissions: MonitoringReportSubmission[] = [
              ...(report.submissions || []),
              ...(report.createdByRole === 'trainee' && directTraineeFiles.length > 0 && !(report.submissions || []).length
                ? [
                  {
                    id: `sub-${report.id}`,
                    reportId: report.id,
                    traineeId: report.traineeId,
                    traineeName: report.traineeName,
                    studentId: report.studentId,
                    course: report.course,
                    hteCompanyName: report.hteCompanyName,
                    category: cat,
                    files: directTraineeFiles,
                    notes: report.description || report.tasksAccomplished,
                    submittedAt: report.createdAt,
                    status: report.status === 'reviewed' ? ('reviewed' as const) : ('submitted' as const),
                    instructorRemarks: report.instructorRemarks,
                  },
                ]
                : []),
            ];

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
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                        <Users className="w-3 h-3" />
                        {report.targetTraineeId === 'all' || report.traineeId === 'all'
                          ? 'Visible to All Trainees'
                          : `Trainee: ${report.traineeName}`}
                      </span>
                      <span className="text-xs text-gray-400">
                        Added {new Date(report.createdAt).toLocaleDateString('en-US', {
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

                  <div className="flex items-center gap-2 shrink-0">
                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-semibold cursor-pointer shadow-sm">
                      <Plus className="w-3.5 h-3.5 text-emerald-600" />
                      {addingFilesToReportId === report.id ? 'Uploading...' : 'Add More Files'}
                      <input
                        type="file"
                        multiple
                        accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp"
                        onChange={(e) => handleAddMoreInstructorFiles(report, e)}
                        className="hidden"
                        disabled={addingFilesToReportId === report.id}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => handleDeleteReport(report)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold transition-colors"
                      title="Delete Monitoring Report"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete
                    </button>
                  </div>
                </div>

                <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Left Column: Instructor Uploaded File(s) */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                        <Paperclip className="w-3.5 h-3.5 text-emerald-600" />
                        Instructor Attached File(s) ({instructorFiles.length})
                      </h4>
                    </div>

                    {instructorFiles.length === 0 ? (
                      <div className="p-4 rounded-xl bg-gray-50 border border-dashed border-gray-200 text-xs text-gray-500">
                        No instructor template file attached.
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
                                title="Download File"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveInstructorFile(report, file.id, file.name)}
                                className="p-1.5 rounded-lg bg-white border border-gray-200 hover:bg-red-50 text-red-500"
                                title="Remove File"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Right Column: Trainee Submitted / Attached File(s) */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                        <FileCheck className="w-3.5 h-3.5 text-blue-600" />
                        Trainee Submitted / Attached File(s) ({submissions.length})
                      </h4>
                    </div>

                    {submissions.length === 0 ? (
                      <div className="p-4 rounded-xl bg-blue-50/40 border border-dashed border-blue-200 text-xs text-blue-700">
                        Waiting for Trainees to submit or attach their {meta.label} file(s).
                      </div>
                    ) : (
                      <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                        {submissions.map((sub) => {
                          const reviewKey = `${report.id}_${sub.id}`;
                          const isReviewing = reviewingSubmissionKey === reviewKey;

                          return (
                            <div
                              key={sub.id}
                              className="p-3.5 rounded-xl border border-blue-100 bg-blue-50/30 space-y-2.5"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-sm font-bold text-gray-900">{sub.traineeName}</span>
                                    {sub.studentId && (
                                      <span className="text-xs px-2 py-0.5 rounded bg-white border border-gray-200 text-gray-600 font-mono">
                                        {sub.studentId}
                                      </span>
                                    )}
                                    {(sub.month || sub.week) && (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-900 border border-amber-300">
                                        <Calendar className="w-3 h-3 text-amber-700" />
                                        {sub.month ? sub.month : ''}
                                        {sub.month && sub.week ? ' • ' : ''}
                                        {sub.week ? sub.week : ''}
                                      </span>
                                    )}
                                    <span
                                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${sub.status === 'reviewed'
                                          ? 'bg-emerald-100 text-emerald-800'
                                          : 'bg-amber-100 text-amber-800'
                                        }`}
                                    >
                                      {sub.status === 'reviewed' ? (
                                        <>
                                          <CheckCircle2 className="w-3 h-3" />
                                          Reviewed
                                        </>
                                      ) : (
                                        <>
                                          <Clock className="w-3 h-3" />
                                          Submitted
                                        </>
                                      )}
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-gray-500 mt-0.5">
                                    Submitted{' '}
                                    {new Date(sub.submittedAt).toLocaleString('en-US', {
                                      month: 'short',
                                      day: 'numeric',
                                      year: 'numeric',
                                      hour: 'numeric',
                                      minute: '2-digit',
                                    })}
                                  </p>
                                  {sub.notes && (
                                    <p className="text-xs text-gray-700 mt-1 italic">&ldquo;{sub.notes}&rdquo;</p>
                                  )}
                                </div>

                                {sub.status !== 'reviewed' ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setReviewingSubmissionKey(isReviewing ? null : reviewKey);
                                      setRemarksInput(sub.instructorRemarks || '');
                                    }}
                                    className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shrink-0"
                                  >
                                    Review / Approve
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setReviewingSubmissionKey(isReviewing ? null : reviewKey);
                                      setRemarksInput(sub.instructorRemarks || '');
                                    }}
                                    className="px-2.5 py-1 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-medium shrink-0"
                                  >
                                    Edit Remarks
                                  </button>
                                )}
                              </div>

                              {/* Trainee's Files */}
                              <div className="space-y-1.5">
                                {(sub.files || []).map((tFile, tIdx) => (
                                  <div
                                    key={tFile.id || `${tFile.name}-${tIdx}`}
                                    className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-white border border-gray-200"
                                  >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                      <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                                        {isImageFile(tFile) ? (
                                          <FileImage className="w-4 h-4" />
                                        ) : (
                                          <FileText className="w-4 h-4" />
                                        )}
                                      </div>
                                      <div className="min-w-0">
                                        <p className="text-xs font-semibold text-gray-900 truncate">{tFile.name}</p>
                                        <p className="text-[10px] text-gray-500">
                                          {formatFileSize(tFile.size)} • Attached by {sub.traineeName}
                                        </p>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-1.5 shrink-0">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setPreviewState({
                                            file: tFile,
                                            ownerLabel: `Submitted by ${sub.traineeName}`,
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
                                        onClick={() => handleDownloadFile(tFile)}
                                        className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700"
                                        title="Download Trainee File"
                                      >
                                        <Download className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>

                              {sub.instructorRemarks && !isReviewing && (
                                <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900">
                                  <span className="font-semibold">Instructor Remarks:</span> {sub.instructorRemarks}
                                </div>
                              )}

                              {isReviewing && (
                                <div className="pt-2 border-t border-blue-200 space-y-2">
                                  <input
                                    type="text"
                                    value={remarksInput}
                                    onChange={(e) => setRemarksInput(e.target.value)}
                                    placeholder="Optional instructor remarks / feedback..."
                                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                  />
                                  <div className="flex items-center justify-end gap-2">
                                    <button
                                      type="button"
                                      onClick={() => setReviewingSubmissionKey(null)}
                                      className="px-2.5 py-1 rounded-lg text-xs text-gray-600 hover:bg-gray-100"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleApproveSubmission(report, sub, remarksInput.trim())}
                                      className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
                                    >
                                      <CheckCircle2 className="w-3.5 h-3.5" />
                                      Save &amp; Mark Reviewed
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Add Monitoring Report File */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-gray-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Upload className="w-5 h-5 text-emerald-400" />
                <h2 className="text-base font-bold">Add Monitoring Report File</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateMonitoringReportFile} className="p-6 space-y-4">
              {/* Period / Category Selector: Mid-Term, End-Term, Monthly, Weekly */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-2">
                  Select Monitoring Period *
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(['midterm', 'endterm', 'monthly', 'weekly'] as MonitoringReportCategory[]).map((cat) => {
                    const active = formCategory === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => handleCategorySelectInModal(cat)}
                        className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition-all text-center ${active
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

              {/* If Weekly or Monthly: Select Month & Week */}
              {(formCategory === 'weekly' || formCategory === 'monthly') && (
                <div className={`grid ${formCategory === 'weekly' ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'} gap-3 p-3.5 bg-amber-50/60 border border-amber-200 rounded-xl`}>
                  <div>
                    <label className="block text-xs font-bold text-amber-900 mb-1">
                      Select Month *
                    </label>
                    <select
                      value={formMonth}
                      onChange={(e) => handleFormMonthChange(e.target.value)}
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

                  {formCategory === 'weekly' && (
                    <div>
                      <label className="block text-xs font-bold text-amber-900 mb-1">
                        Select Week *
                      </label>
                      <select
                        value={formWeek}
                        onChange={(e) => handleFormWeekChange(e.target.value)}
                        className="w-full px-3 py-2 text-xs font-semibold rounded-lg border border-amber-300 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      >
                        {REPORT_WEEKS.map((w) => (
                          <option key={w.value} value={w.value}>
                            {w.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}

              {/* Title */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                  Report Title *
                </label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g., Mid-Term Monitoring Report"
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Target Trainee Account(s) */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                  Visible To *
                </label>
                <select
                  value={formTargetTrainee}
                  onChange={(e) => setFormTargetTrainee(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="all">All Trainee Accounts ({trainees.length} Trainees)</option>
                  {trainees.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.employeeId || t.course || 'Trainee'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Optional Instructions */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                  Instructions / Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Optional instructions for trainees when submitting/attaching their file..."
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* File Upload Picker (Optional) */}
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
                    Supports PDF, Word (.doc, .docx), or Image files — or leave empty to post without a file
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
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploading}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold shadow-sm"
                >
                  <Upload className="w-4 h-4" />
                  {isUploading ? 'Uploading & Syncing...' : `Add ${CATEGORY_META[formCategory].label} File`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: File Preview (Supports Instructor & Trainee Files) */}
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
export default AdminMonitoringReport;
