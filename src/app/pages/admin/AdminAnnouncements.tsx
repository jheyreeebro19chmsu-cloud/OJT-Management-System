import {
  Megaphone,
  Plus,
  Edit2,
  Trash2,
  X,
  Save,
  Pin,
  Bell,
  Info,
  AlertTriangle,
  CheckCircle,
  Clock,
  Calendar,
  Filter,
  Search,
  RotateCcw,
  ArrowUpDown,
  GraduationCap,
  Eye,
  Download,
  Printer,
  Camera,
  Loader2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';

import { authAPI } from '../../services/authApi';
import { useApp } from '../../store/AppContext';
import { API_BASE } from '../../services/config';
import { Announcement, TraineeDocumentFile } from '../../types';
import { AnnouncementAttachmentView } from '../../components/AnnouncementAttachmentView';
import { formatFileSize } from '../../utils/attachmentHelper';

function toLocalDateStr(isoStr?: string): string {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function toLocalTimeStr(isoStr?: string): string {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return '';
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${min}`;
}

function isInstructorPost(ann: Announcement): boolean {
  const role = (ann.createdByRole || '').toLowerCase();
  const by = (ann.createdBy || '').toLowerCase();
  if (role === 'admin') return true;
  if (role === 'host' || role === 'hte' || role === 'employee') return false;
  return by.includes('instructor') || by.includes('admin') || by.includes('coordinator') || by.includes('prof');
}


const TYPE_CONFIG: Record<
  Announcement['type'],
  { label: string; color: string; bg: string; border: string; icon: React.ReactNode }
> = {
  info: {
    label: 'Information',
    color: 'text-blue-700',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    icon: <Info size={14} />,
  },
  warning: {
    label: 'Warning',
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    icon: <AlertTriangle size={14} />,
  },
  success: {
    label: 'Good News',
    color: 'text-green-700',
    bg: 'bg-green-50',
    border: 'border-green-200',
    icon: <CheckCircle size={14} />,
  },
  urgent: {
    label: 'Urgent',
    color: 'text-red-700',
    bg: 'bg-red-50',
    border: 'border-red-300',
    icon: <Bell size={14} />,
  },
};

const ROLE_LABELS: Record<Announcement['targetRole'], string> = {
  all: 'All Users',
  employee: 'Employees Only',
  admin: 'Admins Only',
  hte: 'HTE Only',
  host: 'Host Supervisors Only',
};

const BLANK_FORM = {
  title: '',
  content: '',
  photo: '',
  files: [] as TraineeDocumentFile[],
  reminder: '',
  deadlineAt: '',
  comments: '',
  requiresSubmission: false,
  type: 'info' as Announcement['type'],
  targetRole: 'all' as Announcement['targetRole'],
  isPinned: false,
  expiresAt: '',
  customDate: '',
  customTime: '',
};

export function AdminAnnouncements() {
  const {
    currentUser,
    employees,
    announcements,
    addAnnouncement,
    updateAnnouncement,
    deleteAnnouncement,
    getAnnouncementSubmission,
    getAnnouncementSubmissionStatus,
    getAnnouncementComments,
    addAnnouncementComment,
    deleteAnnouncementComment,
    addRequiredDocument,
    settings,
    refreshData,
  } = useApp();

  // Active polling to synchronize announcements live across accounts
  useEffect(() => {
    refreshData?.({ force: true }).catch(() => {});
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        refreshData?.({ force: true }).catch(() => {});
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [refreshData]);
  const [selectedAcademicYear, setSelectedAcademicYear] = useState<string>(settings?.activeAcademicYear || 'all');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(BLANK_FORM);
  const [showSubmissionsId, setShowSubmissionsId] = useState<string | null>(null);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [submittingComments, setSubmittingComments] = useState<Record<string, boolean>>({});

  // Date & Time Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'instructor' | 'hte'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | Announcement['type']>('all');
  const [datePreset, setDatePreset] = useState<'all' | 'sept_oct' | 'september' | 'october' | 'today' | 'week' | 'month'>('all');
  const [filterDate, setFilterDate] = useState('');
  const [timePeriod, setTimePeriod] = useState<'all' | 'morning' | 'afternoon' | 'evening'>('all');
  const [filterTime, setFilterTime] = useState('');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');

  // Inline Date & Time adjustment state
  const [editingDateTimeId, setEditingDateTimeId] = useState<string | null>(null);
  const [editDateVal, setEditDateVal] = useState('');
  const [editTimeVal, setEditTimeVal] = useState('');

  const hasActiveFilters = Boolean(
    searchQuery.trim() ||
      sourceFilter !== 'all' ||
      typeFilter !== 'all' ||
      datePreset !== 'all' ||
      filterDate ||
      timePeriod !== 'all' ||
      filterTime ||
      sortOrder !== 'newest'
  );

  const resetFilters = () => {
    setSearchQuery('');
    setSourceFilter('all');
    setTypeFilter('all');
    setDatePreset('all');
    setFilterDate('');
    setTimePeriod('all');
    setFilterTime('');
    setSortOrder('newest');
  };

  const handlePostComment = async (announcementId: string) => {
    if (submittingComments[announcementId]) return;
    const text = (commentDrafts[announcementId] || '').trim();
    if (!text) return;

    setSubmittingComments((prev) => ({ ...prev, [announcementId]: true }));
    try {
      await addAnnouncementComment({
        announcementId,
        employeeId: currentUser?.id,
        authorName: currentUser?.name || 'OJT Instructor',
        authorRole: 'admin',
        content: text,
        createdAt: new Date().toISOString(),
      });

      setCommentDrafts((prev) => ({ ...prev, [announcementId]: '' }));
      toast.success('Comment posted!');
    } catch {
      toast.error('Failed to post comment');
    } finally {
      setSubmittingComments((prev) => ({ ...prev, [announcementId]: false }));
    }
  };

  const upd = (key: string, val: string | boolean) => setForm((p) => ({ ...p, [key]: val }));

  const openAdd = () => {
    const now = new Date();
    setForm({
      ...BLANK_FORM,
      customDate: toLocalDateStr(now.toISOString()),
      customTime: toLocalTimeStr(now.toISOString()),
    });
    setEditId(null);
    setShowForm(true);
  };

  const openEdit = (ann: Announcement) => {
    const isDiscussionJson = typeof ann.comments === 'string' && ann.comments.trim().startsWith('[');
    setForm({
      title: ann.title,
      content: ann.content,
      type: ann.type,
      targetRole: ann.targetRole,
      isPinned: ann.isPinned,
      photo: ann.photo || '',
      files: ann.files || [],
      reminder: ann.reminder || '',
      deadlineAt: ann.deadlineAt ? ann.deadlineAt.slice(0, 16) : '',
      comments: isDiscussionJson ? '' : (ann.comments || ''),
      requiresSubmission: Boolean(ann.requiresSubmission),
      expiresAt: ann.expiresAt ? ann.expiresAt.slice(0, 16) : '',
      customDate: toLocalDateStr(ann.createdAt),
      customTime: toLocalTimeStr(ann.createdAt),
    });
    setEditId(ann.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.content.trim()) {
      toast.error('Title and content are required.');
      return;
    }

    let postCreatedAt = new Date().toISOString();
    if (form.customDate) {
      const timePart = form.customTime || toLocalTimeStr(new Date().toISOString()) || '08:00';
      const parsed = new Date(`${form.customDate}T${timePart}`);
      if (!isNaN(parsed.getTime())) {
        postCreatedAt = parsed.toISOString();
      }
    }

    const { customDate: _cd, customTime: _ct, ...restForm } = form;
    const hasFiles = (form.files && form.files.length > 0) || Boolean(form.photo);

    const data = {
      ...restForm,
      files: form.files && form.files.length > 0 ? form.files : undefined,
      requiresSubmission: form.requiresSubmission || hasFiles,
      academicYear: selectedAcademicYear === 'all' ? settings.activeAcademicYear : selectedAcademicYear,
      expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : undefined,
      deadlineAt: form.deadlineAt ? new Date(form.deadlineAt).toISOString() : undefined,
      createdAt: postCreatedAt,
      createdBy: currentUser?.name || 'OJT Instructor',
      createdByRole: (currentUser?.role === 'host' ? 'host' : 'admin') as 'admin' | 'host',
    };

    if (editId) {
      const existing = announcements.find((a) => a.id === editId);
      if (existing?.comments && existing.comments.trim().startsWith('[')) {
        (data as any).comments = existing.comments;
      }
      updateAnnouncement(editId, data);
      toast.success('Announcement updated!');
    } else {
      addAnnouncement(data);
      if (form.files && form.files.length > 0) {
        const primaryFile = form.files[0];
        addRequiredDocument('', {
          title: form.title.trim(),
          description: form.content.trim(),
          submittedBy: currentUser?.name || 'OJT Instructor',
          submittedByRole: 'admin',
          fileName: primaryFile.name,
          fileType: primaryFile.fileType,
          fileSize: primaryFile.size,
          dataUrl: primaryFile.dataUrl,
          fileUrl: primaryFile.fileUrl || primaryFile.dataUrl,
          files: form.files,
          notes: `Synced from Instructor Announcement (${form.files.length} file${form.files.length > 1 ? 's' : ''})`,
        });
      }
      toast.success(
        form.files && form.files.length > 0
          ? `Announcement & ${form.files.length} file(s) synced to Trainees' accounts!`
          : 'Announcement posted successfully!'
      );
    }

    setShowForm(false);

    // Optional background sync with Django backend
    if (API_BASE && !editId) {
      try {
        const formData = new FormData();
        formData.append('user_id', String(currentUser?.id || ''));
        formData.append('title', form.title);
        formData.append('content', form.content);
        if (form.photo && form.photo.startsWith('data:')) {
          const res = await fetch(form.photo);
          const blob = await res.blob();
          formData.append('image', blob, `announcement_${Date.now()}.jpg`);
        }
        authAPI.postAnnouncement(Number(currentUser?.id || 0), formData).catch(() => {});
      } catch {
        // ignore background sync errors
      }
    }
  };

  const handleDelete = (id: string) => {
    if (confirm('Delete this announcement?')) {
      deleteAnnouncement(id);
      toast.success('Announcement deleted.');
    }
  };

  const handleTogglePin = (ann: Announcement) => {
    updateAnnouncement(ann.id, { isPinned: !ann.isPinned });
    toast.success(ann.isPinned ? 'Unpinned.' : 'Pinned to top!');
  };

  const handleOpenEditDateTime = (ann: Announcement) => {
    setEditingDateTimeId(ann.id);
    setEditDateVal(toLocalDateStr(ann.createdAt) || '2026-09-15');
    setEditTimeVal(toLocalTimeStr(ann.createdAt) || '09:00');
  };

  const handleSaveDateTime = (ann: Announcement) => {
    if (!editDateVal) {
      toast.error('Please select a valid date.');
      return;
    }
    const timePart = editTimeVal || '08:30';
    const parsed = new Date(`${editDateVal}T${timePart}`);
    if (isNaN(parsed.getTime())) {
      toast.error('Invalid date or time format.');
      return;
    }
    updateAnnouncement(ann.id, { createdAt: parsed.toISOString() });
    setEditingDateTimeId(null);
    toast.success(
      `Announcement date & time adjusted to ${parsed.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })} at ${parsed.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })}!`
    );
  };

  const ayFilteredAnnouncements = announcements.filter((ann) => {
    if (selectedAcademicYear === 'all') return true;
    if (!ann.academicYear) return true;
    return ann.academicYear === selectedAcademicYear;
  });

  const instructorAnnouncementsCount = ayFilteredAnnouncements.filter((a) => isInstructorPost(a)).length;

  const filteredAnnouncements = ayFilteredAnnouncements.filter((ann) => {
    // 1. Source / Instructor filter
    if (sourceFilter === 'instructor' && !isInstructorPost(ann)) return false;
    if (sourceFilter === 'hte' && isInstructorPost(ann)) return false;

    // 2. Type filter
    if (typeFilter !== 'all' && ann.type !== typeFilter) return false;

    // 3. Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchTitle = (ann.title || '').toLowerCase().includes(q);
      const matchContent = (ann.content || '').toLowerCase().includes(q);
      const matchAuthor = (ann.createdBy || '').toLowerCase().includes(q);
      if (!matchTitle && !matchContent && !matchAuthor) return false;
    }

    const now = new Date();
    const todayStr = toLocalDateStr(now.toISOString());
    const createdDate = new Date(ann.createdAt);
    const annDateStr = toLocalDateStr(ann.createdAt);
    const annTimeStr = toLocalTimeStr(ann.createdAt);

    // 4. Date filter
    if (filterDate) {
      if (annDateStr !== filterDate) return false;
    } else if (datePreset !== 'all') {
      const m = createdDate.getMonth(); // 8 = Sept, 9 = Oct
      if (datePreset === 'sept_oct') {
        if (m !== 8 && m !== 9) return false;
      } else if (datePreset === 'september') {
        if (m !== 8) return false;
      } else if (datePreset === 'october') {
        if (m !== 9) return false;
      } else if (datePreset === 'today') {
        if (annDateStr !== todayStr) return false;
      } else if (datePreset === 'week') {
        const diffDays = (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24);
        if (diffDays < 0 || diffDays > 7) return false;
      } else if (datePreset === 'month') {
        if (
          createdDate.getFullYear() !== now.getFullYear() ||
          createdDate.getMonth() !== now.getMonth()
        ) {
          return false;
        }
      }
    }

    // 5. Time of Day filter
    if (timePeriod !== 'all' && !isNaN(createdDate.getTime())) {
      const hr = createdDate.getHours();
      if (timePeriod === 'morning' && !(hr >= 0 && hr < 12)) return false;
      if (timePeriod === 'afternoon' && !(hr >= 12 && hr < 17)) return false;
      if (timePeriod === 'evening' && !(hr >= 17 && hr <= 23)) return false;
    }

    // 6. Specific Time filter (HH:mm)
    if (filterTime) {
      const [fHour, fMin] = filterTime.split(':');
      const [aHour] = annTimeStr.split(':');
      if (fMin === '00') {
        if (aHour !== fHour) return false;
      } else {
        if (annTimeStr !== filterTime) return false;
      }
    }

    return true;
  });

  const sorted = [...filteredAnnouncements].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    const tA = new Date(a.createdAt).getTime();
    const tB = new Date(b.createdAt).getTime();
    return sortOrder === 'newest' ? tB - tA : tA - tB;
  });

  const isExpired = (ann: Announcement) => {
    if (!ann.expiresAt) return false;
    return new Date(ann.expiresAt) < new Date();
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Announcements & Notices</h2>
          <p className="text-sm text-gray-500">
            {filteredAnnouncements.length} total • {filteredAnnouncements.filter((a) => !isExpired(a)).length} active notices and updates
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap no-print">
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-1.5 shadow-sm">
            <span className="text-xs font-semibold text-gray-500">AY:</span>
            <select
              value={selectedAcademicYear}
              onChange={(e) => setSelectedAcademicYear(e.target.value)}
              className="text-xs font-bold text-blue-700 bg-transparent focus:outline-none cursor-pointer"
            >
              <option value="all">All Academic Years</option>
              {settings.academicYears.map((ay) => (
                <option key={ay} value={ay}>
                  A.Y. {ay} {ay === settings.activeAcademicYear ? '(Active)' : ''}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-xl text-sm font-medium hover:bg-gray-900 transition-colors shadow-sm"
          >
            <Printer size={15} />
            Print Board
          </button>
          <button
            onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2 bg-blue-700 text-white rounded-xl text-sm font-medium hover:bg-blue-800 transition-colors shadow-sm"
          >
            <Plus size={15} />
            Post Notice
          </button>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-4 gap-3 no-print">
        {(['info', 'warning', 'success', 'urgent'] as Announcement['type'][]).map((type) => {
          const c = TYPE_CONFIG[type];
          const count = ayFilteredAnnouncements.filter((a) => a.type === type).length;
          return (
            <button
              key={type}
              type="button"
              onClick={() => setTypeFilter((prev) => (prev === type ? 'all' : type))}
              className={`rounded-2xl p-3 text-center ${c.bg} border ${c.border} transition-all cursor-pointer ${
                typeFilter === type ? 'ring-2 ring-blue-500 scale-[1.01]' : 'hover:opacity-90'
              }`}
            >
              <div className={`flex justify-center mb-1 ${c.color}`}>{c.icon}</div>
              <p className={`text-xl font-bold ${c.color}`}>{count}</p>
              <p className="text-xs text-gray-500">{c.label}</p>
            </button>
          );
        })}
      </div>

      {/* Date & Time Filter Bar */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-xs space-y-3 no-print">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-gray-100">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-gray-800">
              <Filter size={14} className="text-blue-600" />
              Filter Announcements (Date & Time)
            </span>
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => setSourceFilter('all')}
                className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                  sourceFilter === 'all'
                    ? 'bg-gray-900 text-white shadow-2xs'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                All ({ayFilteredAnnouncements.length})
              </button>
              <button
                type="button"
                onClick={() => setSourceFilter('instructor')}
                className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all inline-flex items-center gap-1 cursor-pointer ${
                  sourceFilter === 'instructor'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100'
                }`}
              >
                <GraduationCap size={12} />
                Instructor Announcements ({instructorAnnouncementsCount})
              </button>
              {ayFilteredAnnouncements.length > instructorAnnouncementsCount && (
                <button
                  type="button"
                  onClick={() => setSourceFilter('hte')}
                  className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                    sourceFilter === 'hte'
                      ? 'bg-purple-600 text-white shadow-2xs'
                      : 'bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100'
                  }`}
                >
                  HTE / Other ({ayFilteredAnnouncements.length - instructorAnnouncementsCount})
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-gray-500">
              Showing <strong className="text-gray-800">{sorted.length}</strong> of {ayFilteredAnnouncements.length}
            </span>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors cursor-pointer"
              >
                <RotateCcw size={11} />
                Reset Filter
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
          {/* Search Input */}
          <div className="relative sm:col-span-2 lg:col-span-1">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
              Search
            </label>
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Title, keyword, instructor..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Specific Date Filter */}
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1 mb-1">
              <Calendar size={11} className="text-blue-600" /> Filter by Date
            </label>
            <div className="flex items-center gap-1">
              <input
                type="date"
                value={filterDate}
                onChange={(e) => {
                  setFilterDate(e.target.value);
                  if (e.target.value) setDatePreset('all');
                }}
                className="w-full px-2.5 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-gray-700"
              />
              {filterDate && (
                <button
                  type="button"
                  onClick={() => setFilterDate('')}
                  title="Clear date"
                  className="p-1.5 text-gray-400 hover:text-gray-600 bg-gray-100 rounded-lg cursor-pointer shrink-0"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          {/* Date Period Preset */}
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1 mb-1">
              <Calendar size={11} className="text-emerald-600" /> Date Period
            </label>
            <select
              value={filterDate ? 'custom' : datePreset}
              onChange={(e) => {
                const val = e.target.value;
                if (val === 'custom') return;
                setFilterDate('');
                setDatePreset(val as any);
              }}
              className="w-full px-2.5 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-gray-700"
            >
              <option value="all">All Dates</option>
              <option value="sept_oct">Sept – Oct (OJT Period)</option>
              <option value="september">September</option>
              <option value="october">October</option>
              <option value="today">Today</option>
              <option value="week">Last 7 Days</option>
              <option value="month">This Month</option>
              {filterDate && <option value="custom">Selected: {filterDate}</option>}
            </select>
          </div>

          {/* Specific Time Filter */}
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1 mb-1">
              <Clock size={11} className="text-indigo-600" /> Filter by Time
            </label>
            <div className="flex items-center gap-1">
              <input
                type="time"
                value={filterTime}
                onChange={(e) => setFilterTime(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-gray-700"
              />
              {filterTime && (
                <button
                  type="button"
                  onClick={() => setFilterTime('')}
                  title="Clear time"
                  className="p-1.5 text-gray-400 hover:text-gray-600 bg-gray-100 rounded-lg cursor-pointer shrink-0"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          {/* Time of Day & Sort */}
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1 mb-1">
              <ArrowUpDown size={11} className="text-amber-600" /> Time of Day & Sort
            </label>
            <div className="flex items-center gap-1">
              <select
                value={timePeriod}
                onChange={(e) => setTimePeriod(e.target.value as any)}
                className="w-1/2 px-2 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-gray-700"
              >
                <option value="all">All Times</option>
                <option value="morning">Morning (AM)</option>
                <option value="afternoon">Afternoon (12–5 PM)</option>
                <option value="evening">Evening (5 PM+)</option>
              </select>
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as any)}
                className="w-1/2 px-2 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-gray-700"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* List */}
      {sorted.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 shadow-sm border border-gray-100 text-center space-y-2">
          <Megaphone size={40} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">
            {hasActiveFilters ? 'No announcements match your Date & Time filter' : 'No announcements yet'}
          </p>
          <p className="text-gray-400 text-sm mt-1">
            {hasActiveFilters
              ? 'Try clearing or adjusting your date and time filters above.'
              : 'Post your first announcement to notify employees'}
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 transition-colors cursor-pointer mt-2"
            >
              <RotateCcw size={12} />
              Reset Filters
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map((ann, idx) => {
            const c = TYPE_CONFIG[ann.type];
            const expired = isExpired(ann);
            return (
              <motion.div
                key={ann.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
                className={`bg-white rounded-2xl shadow-sm border overflow-hidden ${expired ? 'opacity-60' : ''}`}
              >
                <div
                  className={`h-1 ${ann.type === 'info' ? 'bg-blue-500' : ann.type === 'warning' ? 'bg-amber-500' : ann.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}
                />
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${c.bg}`}>
                      <span className={c.color}>{c.icon}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {ann.isPinned && <span className="text-sm">📌</span>}
                        <h3 className="font-bold text-gray-800 text-sm">{ann.title}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${c.bg} ${c.color}`}>{c.label}</span>
                        {expired && (
                          <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Expired</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mt-1.5 leading-relaxed">{ann.content}</p>
                      {(ann.photo || (ann.files && ann.files.length > 0)) && (
                        <AnnouncementAttachmentView photo={ann.photo} files={ann.files} allowDownload={true} />
                      )}
                      {ann.reminder && (
                        <p className="text-xs mt-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1">
                          Reminder: {ann.reminder}
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-gray-500">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 border border-gray-200 font-mono text-[11px] text-gray-700">
                          <Calendar size={11} className="text-blue-600" />{' '}
                          {new Date(ann.createdAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 border border-gray-200 font-mono text-[11px] text-gray-700">
                          <Clock size={11} className="text-indigo-600" />{' '}
                          {new Date(ann.createdAt).toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true,
                          })}
                        </span>
                        {editingDateTimeId !== ann.id && (
                          <button
                            type="button"
                            onClick={() => handleOpenEditDateTime(ann)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 hover:bg-blue-100 border border-blue-200 text-[10px] font-bold text-blue-700 transition-colors cursor-pointer no-print"
                            title="Adjust announcement date & time"
                          >
                            <Edit2 size={9} />
                            Adjust Date & Time
                          </button>
                        )}
                        <span className="flex items-center gap-1">
                          👤 {ROLE_LABELS[ann.targetRole]}
                        </span>
                        {ann.createdBy && (
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1 border ${
                              isInstructorPost(ann)
                                ? 'bg-blue-50 text-blue-800 border-blue-200'
                                : ann.createdByRole === 'employee'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : 'bg-purple-50 text-purple-800 border-purple-200'
                            }`}
                          >
                            {isInstructorPost(ann) ? '🎓 Instructor:' : ann.createdByRole === 'employee' ? '👤 Trainee:' : '🏢 HTE:'} {ann.createdBy}
                          </span>
                        )}
                        {ann.expiresAt && (
                          <span>
                            📅 Expires{' '}
                            {new Date(ann.expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                        )}
                        {ann.deadlineAt && <span>⏳ Deadline {new Date(ann.deadlineAt).toLocaleString()}</span>}
                        {ann.requiresSubmission && <span className="text-purple-600">Requires employee response</span>}
                      </div>

                      {editingDateTimeId === ann.id && (
                        <div className="flex flex-wrap items-center gap-2 p-2.5 rounded-xl bg-blue-50/80 border border-blue-200 mt-2 no-print">
                          <span className="text-[11px] font-bold text-blue-900 flex items-center gap-1">
                            <Calendar size={12} className="text-blue-600" /> Adjust Date & Time:
                          </span>
                          <input
                            type="date"
                            value={editDateVal}
                            onChange={(e) => setEditDateVal(e.target.value)}
                            className="px-2.5 py-1 text-xs bg-white border border-blue-200 rounded-lg font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <input
                            type="time"
                            value={editTimeVal}
                            onChange={(e) => setEditTimeVal(e.target.value)}
                            className="px-2.5 py-1 text-xs bg-white border border-blue-200 rounded-lg font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveDateTime(ann)}
                            className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold inline-flex items-center gap-1 shadow-2xs cursor-pointer"
                          >
                            <Save size={11} /> Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingDateTimeId(null)}
                            className="px-2 py-1 rounded-lg bg-white hover:bg-gray-100 text-gray-600 border border-gray-200 text-[11px] font-semibold cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                      {ann.requiresSubmission && (
                        <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                          {(['passed', 'missed', 'pending'] as const).map((st) => {
                            const list = employees
                              .filter((e) => e.active && e.position !== 'OJT Instructor')
                              .filter((e) => {
                                const status = getAnnouncementSubmissionStatus(ann, e.id);
                                return status === st;
                              });
                            const label = st === 'passed' ? 'Turned In' : st === 'missed' ? 'Missing' : 'Pending';
                            const color = st === 'passed' ? 'text-green-700 bg-green-50' : st === 'missed' ? 'text-red-700 bg-red-50' : 'text-amber-700 bg-amber-50';
                            return (
                              <div key={st} className={`rounded-lg border border-gray-100 p-2 ${color}`}>
                                <p className="font-bold capitalize">{label}</p>
                                <p className="opacity-80">{list.length} employee(s)</p>
                              </div>
                            );
                          })}
                          <button
                            onClick={() => setShowSubmissionsId(ann.id)}
                            className="col-span-3 mt-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-purple-50 text-purple-700 text-xs font-bold border border-purple-100 hover:bg-purple-100 transition-colors no-print"
                          >
                            <Eye size={14} />
                            View Submissions
                          </button>
                        </div>
                      )}

                      {/* Discussion Comments Thread */}
                      <div className="mt-3 pt-3 border-t border-gray-100 no-print">
                        <p className="text-[11px] font-bold text-gray-700 mb-2 flex items-center gap-1">
                          💬 Discussion Comments ({getAnnouncementComments(ann.id).length})
                        </p>
                        <div className="space-y-1.5 max-h-40 overflow-y-auto mb-2">
                          {getAnnouncementComments(ann.id).map((c) => (
                            <div key={c.id} className="bg-gray-50 border border-gray-100 rounded-lg p-2 text-xs">
                              <div className="flex items-center justify-between mb-0.5">
                                <span className="font-bold text-gray-800 text-[11px]">{c.authorName}</span>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[9px] text-gray-400">
                                    {new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                  <button
                                    type="button"
                                    title="Delete comment across all accounts"
                                    onClick={async () => {
                                      if (window.confirm('Delete this comment across all accounts?')) {
                                        await deleteAnnouncementComment(ann.id, c.id);
                                        toast.success('Comment deleted!');
                                      }
                                    }}
                                    className="text-gray-300 hover:text-red-500 transition-colors p-0.5 rounded cursor-pointer"
                                  >
                                    <Trash2 size={11} />
                                  </button>
                                </div>
                              </div>
                              <p className="text-gray-600 text-[11px]">{c.content}</p>
                            </div>
                          ))}
                          {getAnnouncementComments(ann.id).length === 0 && (
                            <p className="text-[10px] text-gray-400 italic">No comments yet.</p>
                          )}
                        </div>

                        {/* Reply / Comment input */}
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            placeholder="Write an instructor reply..."
                            value={commentDrafts[ann.id] || ''}
                            disabled={Boolean(submittingComments[ann.id])}
                            onChange={(e) => setCommentDrafts((prev) => ({ ...prev, [ann.id]: e.target.value }))}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                if (!submittingComments[ann.id]) {
                                  handlePostComment(ann.id);
                                }
                              }
                            }}
                            className="flex-1 px-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white disabled:opacity-60"
                          />
                          <button
                            type="button"
                            onClick={() => handlePostComment(ann.id)}
                            disabled={!(commentDrafts[ann.id] || '').trim() || Boolean(submittingComments[ann.id])}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-40 flex items-center gap-1.5 shrink-0"
                          >
                            {submittingComments[ann.id] ? (
                              <>
                                <Loader2 size={12} className="animate-spin" />
                                <span>Sending...</span>
                              </>
                            ) : (
                              <span>Reply</span>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 no-print">
                      <button
                        onClick={() => handleTogglePin(ann)}
                        title={ann.isPinned ? 'Unpin' : 'Pin to top'}
                        className={`p-1.5 rounded-lg transition-all ${ann.isPinned ? 'text-blue-600 bg-blue-50 hover:bg-blue-100' : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'}`}
                      >
                        <Pin size={14} />
                      </button>
                      <button
                        onClick={() => openEdit(ann)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(ann.id)}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={(e) => e.target === e.currentTarget && setShowForm(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between p-5 border-b border-gray-100">
                <h3 className="font-bold text-gray-800">{editId ? 'Edit Announcement' : 'New Announcement'}</h3>
                <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={20} />
                </button>
              </div>

              <div className="p-5 space-y-4">
                {/* Title */}
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1.5">Title *</label>
                  <input
                    value={form.title}
                    onChange={(e) => upd('title', e.target.value)}
                    placeholder="Announcement title..."
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                  />
                </div>

                {/* Content */}
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1.5">Content *</label>
                  <textarea
                    value={form.content}
                    onChange={(e) => upd('content', e.target.value)}
                    placeholder="Write your announcement here..."
                    rows={4}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 resize-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1.5">
                    Attachment(s) (Single or Multiple Files — Automatically synced to Trainees' accounts)
                  </label>
                  <div className="space-y-2">
                    <label className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border-2 border-dashed border-gray-200 rounded-2xl cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all text-gray-500 hover:text-blue-600">
                      <Camera size={18} />
                      <span className="text-sm font-medium">Choose 1 or multiple files from device</span>
                      <input
                        type="file"
                        multiple
                        accept="image/*,.pdf,.doc,.docx,.txt,.csv,.xlsx,.xls"
                        onChange={async (e) => {
                          const selected = Array.from(e.target.files || []);
                          if (selected.length === 0) return;
                          toast.loading(`Processing ${selected.length} file(s)...`, { id: 'attach-upload' });
                          const processed: TraineeDocumentFile[] = [];
                          for (const f of selected) {
                            const dataUrl = await new Promise<string>((resolve) => {
                              const reader = new FileReader();
                              reader.onload = () => resolve(String(reader.result || ''));
                              reader.onerror = () => resolve('');
                              reader.readAsDataURL(f);
                            });
                            if (!dataUrl) continue;
                            let finalUrl = dataUrl;
                            try {
                              const remoteUrl = await supabaseService.uploadDocumentToStorage(
                                currentUser?.id || 'admin',
                                `ann_${Date.now()}_${processed.length}`,
                                f,
                                f.name
                              );
                              if (remoteUrl && remoteUrl.startsWith('http')) {
                                finalUrl = remoteUrl;
                              }
                            } catch {}

                            processed.push({
                              id: `file-${Date.now()}-${processed.length}`,
                              name: f.name,
                              fileType: f.type || 'application/octet-stream',
                              size: f.size,
                              uploadedAt: new Date().toISOString(),
                              dataUrl: finalUrl,
                              fileUrl: finalUrl,
                            });
                          }
                          toast.dismiss('attach-upload');
                          if (processed.length > 0) {
                            setForm((p) => {
                              const combined = [...(p.files || []), ...processed];
                              const first = combined[0];
                              let serialized = '';
                              if (first) {
                                if (combined.length === 1 && first.fileType.startsWith('image/')) {
                                  serialized = first.dataUrl || first.fileUrl || '';
                                } else {
                                  let type: 'pdf' | 'doc' | 'file' = 'file';
                                  if (first.fileType === 'application/pdf' || first.name.toLowerCase().endsWith('.pdf')) type = 'pdf';
                                  else if (first.name.match(/\.(doc|docx|txt|rtf|csv|xlsx|xls)$/i)) type = 'doc';
                                  else if (first.fileType.startsWith('image/')) type = 'image' as any;
                                  serialized = JSON.stringify({
                                    url: first.dataUrl || first.fileUrl,
                                    name: first.name,
                                    type,
                                    size: formatFileSize(Number(first.size)),
                                    files: combined,
                                  });
                                }
                              }
                              return {
                                ...p,
                                title: p.title.trim() ? p.title : first ? first.name.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ') : p.title,
                                files: combined,
                                photo: serialized,
                                requiresSubmission: true,
                              };
                            });
                            toast.success(`Attached ${processed.length} file${processed.length > 1 ? 's' : ''}`);
                          }
                          e.target.value = '';
                        }}
                        className="hidden"
                      />
                    </label>
                    {(form.files && form.files.length > 0) && (
                      <div className="flex flex-wrap gap-1.5">
                        {form.files.map((f, idx) => (
                          <div
                            key={`${f.name}-${idx}`}
                            className="inline-flex items-center gap-2 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs"
                          >
                            <span className="font-bold text-blue-700">{idx + 1}.</span>
                            <span className="font-semibold text-slate-700 max-w-[160px] truncate" title={f.name}>
                              {f.name}
                            </span>
                            <span className="text-[10px] text-slate-400">({formatFileSize(Number(f.size))})</span>
                            <button
                              type="button"
                              onClick={() =>
                                setForm((p) => {
                                  const next = (p.files || []).filter((_, i) => i !== idx);
                                  const first = next[0];
                                  let nextPhoto = '';
                                  if (first) {
                                    if (next.length === 1 && first.fileType.startsWith('image/')) {
                                      nextPhoto = first.dataUrl || first.fileUrl || '';
                                    } else {
                                      nextPhoto = JSON.stringify({
                                        url: first.dataUrl || first.fileUrl,
                                        name: first.name,
                                        type: first.name.toLowerCase().endsWith('.pdf') ? 'pdf' : first.fileType.startsWith('image/') ? 'image' : 'doc',
                                        size: formatFileSize(Number(first.size)),
                                        files: next,
                                      });
                                    }
                                  }
                                  return { ...p, files: next, photo: nextPhoto };
                                })
                              }
                              className="bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600 transition-colors cursor-pointer"
                            >
                              <X size={10} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1.5">Reminder (optional)</label>
                  <input
                    value={form.reminder}
                    onChange={(e) => upd('reminder', e.target.value)}
                    placeholder="Bring your report and photo proof..."
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1.5">
                    Comments before publish (optional)
                  </label>
                  <textarea
                    value={form.comments}
                    onChange={(e) => upd('comments', e.target.value)}
                    rows={2}
                    placeholder="Internal notes/comments..."
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 resize-none"
                  />
                </div>

                {/* Type */}
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1.5">Announcement Type</label>
                  <select
                    value={form.type}
                    onChange={(e) => upd('type', e.target.value as Announcement['type'])}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                  >
                    {(['info', 'warning', 'success', 'urgent'] as Announcement['type'][]).map((type) => (
                      <option key={type} value={type}>
                        {TYPE_CONFIG[type].label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Target Role */}
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1.5">Target Audience</label>
                  <select
                    value={form.targetRole}
                    onChange={(e) => upd('targetRole', e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                  >
                    {Object.entries(ROLE_LABELS).map(([val, lbl]) => (
                      <option key={val} value={val}>
                        {lbl}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Announcement Date & Time */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-600 flex items-center gap-1 mb-1.5">
                      <Calendar size={12} className="text-blue-600" /> Announcement Date
                    </label>
                    <input
                      type="date"
                      value={form.customDate}
                      onChange={(e) => upd('customDate', e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 flex items-center gap-1 mb-1.5">
                      <Clock size={12} className="text-indigo-600" /> Announcement Time
                    </label>
                    <input
                      type="time"
                      value={form.customTime}
                      onChange={(e) => upd('customTime', e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                    />
                  </div>
                </div>

                {/* Expiry */}
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1.5">Expiry Date & Time (optional)</label>
                  <input
                    type="datetime-local"
                    value={form.expiresAt}
                    onChange={(e) => upd('expiresAt', e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1.5">
                    Submission Deadline (optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={form.deadlineAt}
                    onChange={(e) => upd('deadlineAt', e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                  />
                </div>

                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Require Employee Response</p>
                    <p className="text-xs text-gray-500">Employees can send text and photo back to host/admin.</p>
                  </div>
                  <button
                    onClick={() => upd('requiresSubmission', !form.requiresSubmission)}
                    className={`relative w-12 h-6 rounded-full transition-all ${form.requiresSubmission ? 'bg-purple-600' : 'bg-gray-300'}`}
                  >
                    <div
                      className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.requiresSubmission ? 'translate-x-6' : ''}`}
                    />
                  </button>
                </div>

                {/* Pin */}
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Pin Announcement</p>
                    <p className="text-xs text-gray-500">Show at the top of the announcements list</p>
                  </div>
                  <button
                    onClick={() => upd('isPinned', !form.isPinned)}
                    className={`relative w-12 h-6 rounded-full transition-all ${form.isPinned ? 'bg-blue-600' : 'bg-gray-300'}`}
                  >
                    <div
                      className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.isPinned ? 'translate-x-6' : ''}`}
                    />
                  </button>
                </div>

                {/* Submit */}
                <button
                  onClick={handleSave}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-blue-700 text-white rounded-xl font-semibold text-sm hover:bg-blue-800 transition-colors"
                >
                  <Save size={15} />
                  {editId ? 'Update Announcement' : 'Post Announcement'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Submissions Modal */}
      <AnimatePresence>
        {showSubmissionsId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setShowSubmissionsId(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-5 border-b border-gray-100">
                <div>
                  <h3 className="font-bold text-gray-800">Task Submissions</h3>
                  <p className="text-xs text-gray-500">
                    {announcements.find((a) => a.id === showSubmissionsId)?.title}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => window.print()} 
                    className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors no-print"
                    title="Print Submissions"
                  >
                    <Printer size={20} />
                  </button>
                  <button onClick={() => setShowSubmissionsId(null)} className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-xl no-print">
                    <X size={20} />
                  </button>
                </div>
              </div>

              <div className="p-5 overflow-y-auto flex-1 space-y-4">
                {employees
                  .filter((e) => e.active && e.position !== 'OJT Instructor')
                  .map((emp) => {
                    const sub = getAnnouncementSubmission(showSubmissionsId, emp.id);
                    if (!sub) return null;
                    return (
                      <div key={emp.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <p className="font-bold text-gray-800 text-sm">{emp.name}</p>
                            <p className="text-xs text-gray-400 mb-2">{new Date(sub.submittedAt).toLocaleString()}</p>
                            <p className="text-sm text-gray-700 bg-white p-3 rounded-xl border border-slate-200">
                              {sub.message}
                            </p>
                          </div>
                        </div>
                        {(sub.photo || (sub.files && sub.files.length > 0)) && (
                          <AnnouncementAttachmentView
                            photo={sub.photo}
                            files={sub.files}
                            allowDownload={true}
                          />
                        )}
                      </div>
                    );
                  })}
                {employees
                  .filter((e) => e.active && e.position !== 'OJT Instructor')
                  .every((emp) => !getAnnouncementSubmission(showSubmissionsId, emp.id)) && (
                  <div className="text-center py-10 text-gray-400">
                    <Clock size={40} className="mx-auto mb-2 opacity-20" />
                    <p>No submissions found for this task yet.</p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

