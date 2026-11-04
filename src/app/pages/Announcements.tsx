import {
  Bell,
  Calendar,
  Camera,
  CheckCircle,
  Clock,
  Filter,
  MessageSquare,
  RotateCcw,
  Search,
  XCircle,
  Plus,
  Trash2,
  Edit2,
  Save,
  Pin,
  Info,
  AlertTriangle,
  Megaphone,
  User,
  GraduationCap,
  Sparkles,
  X,
  Loader2,
  ArrowUpDown,
  Upload,
  FileText,
  Eye,
} from 'lucide-react';
import React, { useMemo, useState, useEffect } from 'react';
import { toast } from 'sonner';

import { useApp } from '../store/AppContext';
import { authAPI } from '../services/authApi';
import { API_BASE } from '../services/config';
import type { Announcement, TraineeDocumentFile } from '../types';
import { AnnouncementAttachmentView } from '../components/AnnouncementAttachmentView';
import { formatFileSize } from '../utils/attachmentHelper';

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
    icon: <Info size={13} />,
  },
  warning: {
    label: 'Notice & Reminder',
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    icon: <AlertTriangle size={13} />,
  },
  success: {
    label: 'Good News / Update',
    color: 'text-emerald-700',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    icon: <CheckCircle size={13} />,
  },
  urgent: {
    label: 'Urgent Alert',
    color: 'text-rose-700',
    bg: 'bg-rose-50',
    border: 'border-rose-300',
    icon: <Bell size={13} />,
  },
};

export function Announcements() {
  const {
    currentUser,
    employees,
    getCurrentEmployee,
    getActiveAnnouncements,
    getAnnouncementSubmission,
    getAnnouncementSubmissionStatus,
    submitAnnouncementResponse,
    addAnnouncement,
    updateAnnouncement,
    deleteAnnouncement,
    getAnnouncementComments,
    addAnnouncementComment,
    deleteAnnouncementComment,
    addRequiredDocument,
    settings,
    refreshData,
  } = useApp();

  // Active polling to immediately display announcements posted by Instructor or HTE
  useEffect(() => {
    refreshData?.({ force: true }).catch(() => {});
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        refreshData?.({ force: true }).catch(() => {});
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [refreshData]);

  const employee = getCurrentEmployee();
  const activeUser = employee || currentUser;

  const isInstructor = Boolean(
    currentUser?.role === 'admin' ||
    (currentUser as any)?.role === 'instructor' ||
    ((currentUser as any)?.position && String((currentUser as any).position).toLowerCase().includes('instructor')) ||
    (employee?.position && employee.position.toLowerCase().includes('instructor')) ||
    (employee as any)?.role === 'instructor'
  );

  const isHte = Boolean(
    currentUser?.role === 'hte' ||
    currentUser?.role === 'host' ||
    ((currentUser as any)?.position && String((currentUser as any).position).toLowerCase().includes('hte')) ||
    ((currentUser as any)?.position && String((currentUser as any).position).toLowerCase().includes('supervisor')) ||
    (employee?.position && employee.position.toLowerCase().includes('hte')) ||
    (employee as any)?.role === 'hte' ||
    (employee as any)?.role === 'host'
  );

  const canPost = isInstructor || isHte;
  const authorRole: 'admin' | 'host' | 'employee' = isInstructor ? 'admin' : isHte ? 'host' : 'employee';
  const companyName =
    currentUser?.companyName ||
    employee?.companyName ||
    (currentUser as any)?.company ||
    localStorage.getItem('ojt_hte_company') ||
    'Host Training Establishment';

  const authorName = isHte
    ? `${currentUser?.name || employee?.name || 'HTE Supervisor'} (${companyName})`
    : (currentUser?.name || employee?.name || (isInstructor ? 'OJT Instructor' : 'Trainee'));

  const [messageDrafts, setMessageDrafts] = useState<Record<string, string>>({});
  const [photoDrafts, setPhotoDrafts] = useState<Record<string, string | undefined>>({});
  const [filesDrafts, setFilesDrafts] = useState<Record<string, TraineeDocumentFile[]>>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [submittingComments, setSubmittingComments] = useState<Record<string, boolean>>({});

  const [isPosting, setIsPosting] = useState(false);
  const [isSubmittingPost, setIsSubmittingPost] = useState(false);
  const [newPost, setNewPost] = useState<{
    title: string;
    content: string;
    photo: string;
    files: TraineeDocumentFile[];
    requiresSubmission: boolean;
    type: Announcement['type'];
    targetRole: Announcement['targetRole'];
    customDate: string;
    customTime: string;
  }>(() => {
    const now = new Date();
    return {
      title: '',
      content: '',
      photo: '',
      files: [],
      requiresSubmission: false,
      type: 'info',
      targetRole: 'all',
      customDate: toLocalDateStr(now.toISOString()),
      customTime: toLocalTimeStr(now.toISOString()),
    };
  });

  // Filter State (Instructor, Date & Time)
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'instructor' | 'hte'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | Announcement['type']>('all');
  const [datePreset, setDatePreset] = useState<'all' | 'sept_oct' | 'september' | 'october' | 'today' | 'week' | 'month'>('all');
  const [filterDate, setFilterDate] = useState('');
  const [timePeriod, setTimePeriod] = useState<'all' | 'morning' | 'afternoon' | 'evening'>('all');
  const [filterTime, setFilterTime] = useState('');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');

  // Inline Date & Time adjustment state for Instructors
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
    if (!text || !activeUser) return;

    setSubmittingComments((prev) => ({ ...prev, [announcementId]: true }));
    try {
      await addAnnouncementComment({
        announcementId,
        employeeId: activeUser.id,
        authorName,
        authorRole: isInstructor ? 'admin' : 'trainee',
        content: text,
        createdAt: new Date().toISOString(),
      });

      setCommentDrafts((prev) => ({ ...prev, [announcementId]: '' }));
      toast.success('Comment posted!');
    } catch {
      toast.error('Failed to post comment. Please try again.');
    } finally {
      setSubmittingComments((prev) => ({ ...prev, [announcementId]: false }));
    }
  };

  const announcements = useMemo(() => {
    return getActiveAnnouncements(isInstructor ? 'admin' : isHte ? 'hte' : 'employee');
  }, [getActiveAnnouncements, isInstructor, isHte]);

  const instructorAnnouncementsCount = useMemo(
    () => announcements.filter((a) => isInstructorPost(a)).length,
    [announcements]
  );

  const filteredAnnouncements = useMemo(() => {
    const now = new Date();
    const todayStr = toLocalDateStr(now.toISOString());

    const filtered = announcements.filter((ann) => {
      // 1. Source / Instructor filter
      if (sourceFilter === 'instructor' && !isInstructorPost(ann)) return false;
      if (sourceFilter === 'hte' && isInstructorPost(ann)) return false;

      // 2. Announcement Type filter
      if (typeFilter !== 'all' && ann.type !== typeFilter) return false;

      // 3. Search query (title, content, author)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchTitle = (ann.title || '').toLowerCase().includes(q);
        const matchContent = (ann.content || '').toLowerCase().includes(q);
        const matchAuthor = (ann.createdBy || '').toLowerCase().includes(q);
        if (!matchTitle && !matchContent && !matchAuthor) return false;
      }

      const createdDate = new Date(ann.createdAt);
      const annDateStr = toLocalDateStr(ann.createdAt);
      const annTimeStr = toLocalTimeStr(ann.createdAt);

      // 4. Specific Date filter (YYYY-MM-DD) or Period Preset
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

    return [...filtered].sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      const tA = new Date(a.createdAt).getTime();
      const tB = new Date(b.createdAt).getTime();
      return sortOrder === 'newest' ? tB - tA : tA - tB;
    });
  }, [
    announcements,
    sourceFilter,
    typeFilter,
    searchQuery,
    filterDate,
    datePreset,
    timePeriod,
    filterTime,
    sortOrder,
  ]);

  const onPickFiles = async (announcementId: string, fileList?: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const selected = Array.from(fileList);
    const processed: TraineeDocumentFile[] = [];
    for (const f of selected) {
      const b64 = await readAsDataUrl(f);
      processed.push({
        id: `file-${Date.now()}-${processed.length}`,
        name: f.name,
        fileType: f.type || 'application/octet-stream',
        size: f.size,
        uploadedAt: new Date().toISOString(),
        dataUrl: b64,
        fileUrl: b64,
      });
    }
    setFilesDrafts((prev) => {
      const next = [...(prev[announcementId] || []), ...processed];
      const first = next[0];
      if (first) {
        const serialized = first.fileType.startsWith('image/')
          ? first.dataUrl
          : JSON.stringify({
              url: first.dataUrl || first.fileUrl,
              name: first.name,
              type: first.fileType.includes('pdf') || first.name.toLowerCase().endsWith('.pdf') ? 'pdf' : 'doc',
              size: formatFileSize(Number(first.size)),
            });
        setPhotoDrafts((p) => ({ ...p, [announcementId]: serialized }));
      }
      return { ...prev, [announcementId]: next };
    });
    toast.success(`${processed.length} file${processed.length > 1 ? 's' : ''} attached`);
  };

  const submit = (announcement: Announcement) => {
    if (!activeUser) return;
    const message = (messageDrafts[announcement.id] || '').trim();
    const attachedFiles = filesDrafts[announcement.id] || [];
    const photo = photoDrafts[announcement.id];
    if (!message && !photo && attachedFiles.length === 0) {
      toast.error('Please enter a response or attach at least one file.');
      return;
    }

    const effectiveMessage =
      message ||
      (attachedFiles.length > 0
        ? `Submitted ${attachedFiles.length} file${attachedFiles.length > 1 ? 's' : ''}: ${attachedFiles.map((f) => f.name).join(', ')}`
        : 'Submitted');

    if (API_BASE) {
      const formData = new FormData();
      formData.append('announcement_id', announcement.id);
      formData.append('user_id', String(activeUser.id));
      formData.append('message', effectiveMessage);
      if (photo && photo.startsWith('data:')) {
        fetch(photo)
          .then((r) => r.blob())
          .then((blob) => {
            formData.append('image', blob, `submission_${Date.now()}.jpg`);
            authAPI
              .submitAnnouncementResponse(announcement.id, Number(activeUser.id), formData)
              .then(() => {
                submitAnnouncementResponse(announcement.id, activeUser.id, effectiveMessage, photo, attachedFiles);
                toast.success('File(s) & response submitted!');
              })
              .catch(() => {
                submitAnnouncementResponse(announcement.id, activeUser.id, effectiveMessage, photo, attachedFiles);
                toast.success('File(s) & response submitted!');
              });
          })
          .catch(() => {
            submitAnnouncementResponse(announcement.id, activeUser.id, effectiveMessage, photo, attachedFiles);
            toast.success('File(s) & response submitted!');
          });
      } else {
        authAPI
          .submitAnnouncementResponse(announcement.id, Number(activeUser.id), formData)
          .then(() => {
            submitAnnouncementResponse(announcement.id, activeUser.id, effectiveMessage, photo, attachedFiles);
            toast.success('File(s) & response submitted!');
          })
          .catch(() => {
            submitAnnouncementResponse(announcement.id, activeUser.id, effectiveMessage, photo, attachedFiles);
            toast.success('File(s) & response submitted!');
          });
      }
    } else {
      submitAnnouncementResponse(announcement.id, activeUser.id, effectiveMessage, photo, attachedFiles);
      toast.success('File(s) & response submitted!');
    }
    setMessageDrafts((prev) => ({ ...prev, [announcement.id]: '' }));
    setPhotoDrafts((prev) => ({ ...prev, [announcement.id]: undefined }));
    setFilesDrafts((prev) => ({ ...prev, [announcement.id]: [] }));
  };

  const handleCreatePost = async () => {
    if (!canPost) {
      toast.error('Trainees cannot post announcements. You can comment on announcements below.');
      return;
    }
    if (!newPost.title.trim() || !newPost.content.trim()) {
      toast.error('Please provide both a title and details.');
      return;
    }
    setIsSubmittingPost(true);
    try {
      let postCreatedAt = new Date().toISOString();
      if (newPost.customDate) {
        const timePart = newPost.customTime || toLocalTimeStr(new Date().toISOString()) || '08:00';
        const parsed = new Date(`${newPost.customDate}T${timePart}`);
        if (!isNaN(parsed.getTime())) {
          postCreatedAt = parsed.toISOString();
        }
      }

      const hasFiles = newPost.files.length > 0 || Boolean(newPost.photo);

      addAnnouncement({
        title: newPost.title.trim(),
        content: newPost.content.trim(),
        photo: newPost.photo || undefined,
        files: newPost.files.length > 0 ? newPost.files : undefined,
        requiresSubmission: newPost.requiresSubmission || hasFiles,
        type: newPost.type,
        targetRole: newPost.targetRole,
        isPinned: false,
        createdAt: postCreatedAt,
        createdBy: authorName,
        createdByRole: authorRole,
        academicYear: settings?.activeAcademicYear,
      });

      // Automatically sync attached file(s) to Trainees' Documents requirements so it appears in their Documents account too
      if (newPost.files.length > 0) {
        const primaryFile = newPost.files[0];
        addRequiredDocument('', {
          title: newPost.title.trim(),
          description: newPost.content.trim(),
          submittedBy: authorName,
          submittedByRole: isInstructor ? 'admin' : 'host',
          fileName: primaryFile.name,
          fileType: primaryFile.fileType,
          fileSize: primaryFile.size,
          dataUrl: primaryFile.dataUrl,
          fileUrl: primaryFile.fileUrl || primaryFile.dataUrl,
          files: newPost.files,
          notes: `Synced from ${isHte ? 'HTE' : 'Instructor'} Announcement (${newPost.files.length} file${newPost.files.length > 1 ? 's' : ''})`,
        });
      }

      toast.success(
        isHte
          ? (newPost.files.length > 0 ? `HTE announcement & ${newPost.files.length} file(s) posted!` : 'HTE announcement posted successfully!')
          : (newPost.files.length > 0 ? `Instructor announcement & ${newPost.files.length} file(s) synced to Trainee accounts!` : 'Instructor announcement posted!')
      );
      const now = new Date();
      setNewPost({
        title: '',
        content: '',
        photo: '',
        files: [],
        requiresSubmission: false,
        type: 'info',
        targetRole: 'all',
        customDate: toLocalDateStr(now.toISOString()),
        customTime: toLocalTimeStr(now.toISOString()),
      });
      setIsPosting(false);
    } catch (err: any) {
      toast.error('Failed to post announcement: ' + (err?.message || 'Error'));
    } finally {
      setIsSubmittingPost(false);
    }
  };

  const handleDeleteAnnouncement = (id: string) => {
    if (window.confirm('Are you sure you want to delete this announcement?')) {
      deleteAnnouncement(id);
      toast.success('Announcement removed.');
    }
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

  if (!activeUser) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-sm text-gray-500 shadow-xs">
        <Megaphone size={36} className="mx-auto text-blue-500 mb-2 opacity-50" />
        Please log in to view and post announcements.
      </div>
    );
  }

  // Count strictly required submission tasks
  const requiredSubmissionAnnouncements = announcements.filter((a) => a.requiresSubmission);
  const missedCount = requiredSubmissionAnnouncements.filter((a) => getAnnouncementSubmissionStatus(a, activeUser.id) === 'missed').length;
  const passedCount = requiredSubmissionAnnouncements.filter((a) => getAnnouncementSubmissionStatus(a, activeUser.id) === 'passed').length;

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 rounded-3xl p-6 text-white shadow-md">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
              <Megaphone size={18} className="text-blue-200" />
            </span>
            <h2 className="text-xl font-black tracking-tight">Announcements & Feed</h2>
          </div>
          <p className="text-xs text-blue-200">
            {isInstructor
              ? 'Official announcements, updates, notices, and reminders for OJT Trainees & Instructors.'
              : 'Official announcements, updates, and reminders from OJT Instructors. Join the discussion in the comments.'}
          </p>
        </div>

        {requiredSubmissionAnnouncements.length > 0 && (
          <div className="flex gap-2">
            <div className="bg-white/10 backdrop-blur-xs px-3.5 py-1.5 rounded-2xl border border-white/20 flex flex-col items-center min-w-[75px]">
              <p className="text-[10px] text-blue-200 font-medium">Missing</p>
              <p className="text-base font-extrabold text-rose-300">{missedCount}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-xs px-3.5 py-1.5 rounded-2xl border border-white/20 flex flex-col items-center min-w-[75px]">
              <p className="text-[10px] text-blue-200 font-medium">Turned In</p>
              <p className="text-base font-extrabold text-emerald-300">{passedCount}</p>
            </div>
          </div>
        )}
      </div>

      {/* Post Box (Only accessible by Instructors / Admins - Trainees can only comment) */}
      {isInstructor && (
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-3">
        {!isPosting ? (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700 font-bold shrink-0">
              {isInstructor ? <GraduationCap size={18} /> : <User size={18} />}
            </div>
            <button
              type="button"
              onClick={() => {
                const now = new Date();
                setNewPost((p) => ({
                  ...p,
                  customDate: toLocalDateStr(now.toISOString()),
                  customTime: toLocalTimeStr(now.toISOString()),
                }));
                setIsPosting(true);
              }}
              className="flex-1 text-left px-4 py-2.5 bg-slate-50 hover:bg-slate-100/80 rounded-xl text-slate-500 text-xs sm:text-sm font-medium transition-colors border border-slate-200 flex items-center justify-between cursor-pointer"
            >
              <span>
                {isInstructor
                  ? 'Post an official instructor announcement or reminder...'
                  : 'Post an announcement, update, or notice for the group...'}
              </span>
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-100">
                <Plus size={12} /> Create Post
              </span>
            </button>
          </div>
        ) : (
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                    isInstructor
                      ? 'bg-blue-100 text-blue-800 border border-blue-200'
                      : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                  }`}
                >
                  {isInstructor ? '🎓 Posting as Instructor' : '👤 Posting as Trainee'}
                </span>
                <span className="text-xs font-semibold text-slate-700">{authorName}</span>
              </div>
              <button
                type="button"
                onClick={() => setIsPosting(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">Announcement Type</label>
                <select
                  value={newPost.type}
                  onChange={(e) => setNewPost((p) => ({ ...p, type: e.target.value as any }))}
                  className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 bg-slate-50 font-medium"
                >
                  <option value="info">ℹ️ General Information</option>
                  <option value="warning">⚠️ Notice / Reminder</option>
                  <option value="success">🎉 Good News / Update</option>
                  <option value="urgent">🚨 Urgent Notice</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">Target Audience</label>
                <select
                  value={newPost.targetRole}
                  onChange={(e) => setNewPost((p) => ({ ...p, targetRole: e.target.value as any }))}
                  className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 bg-slate-50 font-medium"
                >
                  <option value="all">🌐 Everyone (Trainees & Instructors)</option>
                  <option value="employee">👥 Trainees Only</option>
                  <option value="admin">🎓 Instructors / Staff Only</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 flex items-center gap-1 mb-1">
                  <Calendar size={11} className="text-blue-600" /> Announcement Date
                </label>
                <input
                  type="date"
                  value={newPost.customDate}
                  onChange={(e) => setNewPost((p) => ({ ...p, customDate: e.target.value }))}
                  className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 bg-slate-50 font-medium"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 flex items-center gap-1 mb-1">
                  <Clock size={11} className="text-indigo-600" /> Announcement Time
                </label>
                <input
                  type="time"
                  value={newPost.customTime}
                  onChange={(e) => setNewPost((p) => ({ ...p, customTime: e.target.value }))}
                  className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 bg-slate-50 font-medium"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-600 block mb-1">Announcement Title</label>
              <input
                type="text"
                value={newPost.title}
                onChange={(e) => setNewPost((p) => ({ ...p, title: e.target.value }))}
                placeholder="e.g. OJT Weekly Journal Deadline / Office Schedule Reminder"
                className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-600 block mb-1">Message Content</label>
              <textarea
                value={newPost.content}
                onChange={(e) => setNewPost((p) => ({ ...p, content: e.target.value }))}
                placeholder="Provide details, instructions, schedules, or reminders..."
                rows={3}
                className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            {/* Attached File(s) Preview */}
            {newPost.files.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-blue-700">
                    📎 {newPost.files.length} File{newPost.files.length > 1 ? 's' : ''} Attached (Automatically synced to Trainees' accounts)
                  </span>
                  <button
                    type="button"
                    onClick={() => setNewPost((p) => ({ ...p, photo: '', files: [] }))}
                    className="text-[10px] font-bold text-rose-600 hover:underline cursor-pointer"
                  >
                    Clear All
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {newPost.files.map((f, idx) => (
                    <div
                      key={`${f.name}-${idx}`}
                      className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900"
                    >
                      <FileText size={13} className="text-blue-600 shrink-0" />
                      <span className="font-semibold truncate max-w-[180px]">{f.name}</span>
                      <span className="text-[10px] text-blue-600">({formatFileSize(Number(f.size))})</span>
                      <button
                        type="button"
                        onClick={() =>
                          setNewPost((p) => {
                            const next = p.files.filter((_, i) => i !== idx);
                            const first = next[0];
                            const nextPhoto = first
                              ? first.fileType.startsWith('image/')
                                ? first.dataUrl || ''
                                : JSON.stringify({
                                    url: first.dataUrl || first.fileUrl,
                                    name: first.name,
                                    type: first.fileType.includes('pdf') || first.name.toLowerCase().endsWith('.pdf') ? 'pdf' : 'doc',
                                    size: formatFileSize(Number(first.size)),
                                  })
                              : '';
                            return { ...p, files: next, photo: nextPhoto };
                          })
                        }
                        className="text-rose-500 hover:text-rose-700 cursor-pointer"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-1 flex-wrap gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <label className="text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors text-slate-700 font-medium">
                  <Upload size={14} className="text-blue-600" />
                  <span>Attach File(s) / Template(s)</span>
                  <input
                    type="file"
                    multiple
                    accept="image/*,.pdf,.doc,.docx,.txt,.csv,.xlsx,.xls"
                    className="hidden"
                    onChange={async (e) => {
                      const selected = Array.from(e.target.files || []);
                      if (selected.length === 0) return;
                      const processed: TraineeDocumentFile[] = [];
                      for (const f of selected) {
                        const b64 = await readAsDataUrl(f);
                        processed.push({
                          id: `file-${Date.now()}-${processed.length}`,
                          name: f.name,
                          fileType: f.type || 'application/octet-stream',
                          size: f.size,
                          uploadedAt: new Date().toISOString(),
                          dataUrl: b64,
                          fileUrl: b64,
                        });
                      }
                      setNewPost((p) => {
                        const combined = [...p.files, ...processed];
                        const first = combined[0];
                        const primarySerialized = first
                          ? first.fileType.startsWith('image/')
                            ? first.dataUrl || ''
                            : JSON.stringify({
                                url: first.dataUrl || first.fileUrl,
                                name: first.name,
                                type: first.fileType.includes('pdf') || first.name.toLowerCase().endsWith('.pdf') ? 'pdf' : 'doc',
                                size: formatFileSize(Number(first.size)),
                              })
                          : '';
                        return {
                          ...p,
                          title: p.title.trim() ? p.title : first ? first.name.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ') : p.title,
                          files: combined,
                          photo: primarySerialized,
                          requiresSubmission: true,
                        };
                      });
                      toast.success(`Attached ${processed.length} file${processed.length > 1 ? 's' : ''}`);
                      e.target.value = '';
                    }}
                  />
                </label>

                <label className="inline-flex items-center gap-1.5 text-xs text-slate-700 font-medium cursor-pointer select-none px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200">
                  <input
                    type="checkbox"
                    checked={newPost.requiresSubmission}
                    onChange={(e) => setNewPost((p) => ({ ...p, requiresSubmission: e.target.checked }))}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span>Allow Trainees to Upload File(s)</span>
                </label>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsPosting(false)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreatePost}
                  disabled={isSubmittingPost || !newPost.title.trim() || !newPost.content.trim()}
                  className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl disabled:opacity-50 transition-all shadow-sm cursor-pointer flex items-center gap-1.5"
                >
                  <Megaphone size={13} />
                  <span>{isSubmittingPost ? 'Posting...' : 'Post Announcement'}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      )}

      {/* Instructor Announcement Date & Time Filter Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-slate-800">
              <Filter size={14} className="text-blue-600" />
              Filter Announcements (Date & Time)
            </span>
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => setSourceFilter('all')}
                className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                  sourceFilter === 'all'
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All ({announcements.length})
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
              {announcements.length > instructorAnnouncementsCount && (
                <button
                  type="button"
                  onClick={() => setSourceFilter('hte')}
                  className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                    sourceFilter === 'hte'
                      ? 'bg-purple-600 text-white shadow-2xs'
                      : 'bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100'
                  }`}
                >
                  HTE / Other ({announcements.length - instructorAnnouncementsCount})
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-slate-500">
              Showing <strong className="text-slate-800">{filteredAnnouncements.length}</strong> of {announcements.length}
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
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
              Search
            </label>
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Title, keyword, instructor..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Date Filter (Preset + Specific Date Picker) */}
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1 mb-1">
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
                className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-700"
              />
              {filterDate && (
                <button
                  type="button"
                  onClick={() => setFilterDate('')}
                  title="Clear date"
                  className="p-1.5 text-slate-400 hover:text-slate-600 bg-slate-100 rounded-lg cursor-pointer shrink-0"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          {/* Quick Date Range */}
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1 mb-1">
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
              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-700"
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

          {/* Time Filter (Specific Time + Time of Day) */}
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1 mb-1">
              <Clock size={11} className="text-indigo-600" /> Filter by Time
            </label>
            <div className="flex items-center gap-1">
              <input
                type="time"
                value={filterTime}
                onChange={(e) => setFilterTime(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-700"
              />
              {filterTime && (
                <button
                  type="button"
                  onClick={() => setFilterTime('')}
                  title="Clear time"
                  className="p-1.5 text-slate-400 hover:text-slate-600 bg-slate-100 rounded-lg cursor-pointer shrink-0"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          {/* Time of Day & Sort Order */}
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1 mb-1">
              <ArrowUpDown size={11} className="text-amber-600" /> Time of Day & Sort
            </label>
            <div className="flex items-center gap-1">
              <select
                value={timePeriod}
                onChange={(e) => setTimePeriod(e.target.value as any)}
                className="w-1/2 px-2 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-700"
              >
                <option value="all">All Times</option>
                <option value="morning">Morning (AM)</option>
                <option value="afternoon">Afternoon (12–5 PM)</option>
                <option value="evening">Evening (5 PM+)</option>
              </select>
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as any)}
                className="w-1/2 px-2 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-700"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {filteredAnnouncements.length === 0 ? (
        <div className="rounded-2xl bg-white border border-slate-200/80 p-8 text-center text-sm text-slate-500 shadow-xs space-y-2">
          <Megaphone size={36} className="mx-auto text-slate-300 mb-2" />
          <p className="font-semibold text-slate-700">
            {hasActiveFilters
              ? 'No announcements match your selected Date & Time filter.'
              : isInstructor
              ? 'No announcements yet. Be the first to post an update!'
              : 'No announcements posted yet. Check back later for updates from your instructors.'}
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 transition-colors cursor-pointer"
            >
              <RotateCcw size={12} />
              Show All Announcements
            </button>
          )}
        </div>
      ) : (
        filteredAnnouncements.map((announcement) => {
          const submission = activeUser ? getAnnouncementSubmission(announcement.id, activeUser.id) : null;
          const status = activeUser ? getAnnouncementSubmissionStatus(announcement, activeUser.id) : 'pending';
          const typeConf = TYPE_CONFIG[announcement.type || 'info'] || TYPE_CONFIG.info;

          const canDelete = Boolean(isInstructor);

          return (
            <div key={announcement.id} className="rounded-2xl bg-white border border-slate-200/80 p-5 space-y-3.5 shadow-xs transition-shadow hover:shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1 border ${typeConf.bg} ${typeConf.color} ${typeConf.border}`}>
                      {typeConf.icon}
                      {typeConf.label}
                    </span>

                    {/* Author Role Badge */}
                    {isInstructorPost(announcement) ? (
                      <span className="text-[10px] font-bold text-blue-800 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                        <GraduationCap size={11} className="text-blue-600" />
                        Instructor: {announcement.createdBy}
                      </span>
                    ) : announcement.createdByRole === 'employee' ? (
                      <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                        <User size={11} className="text-emerald-600" />
                        Trainee: {announcement.createdBy}
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-purple-800 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                        🏢 {announcement.createdBy || 'HTE Partner'}
                      </span>
                    )}

                    {announcement.isPinned && (
                      <span className="text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                        <Pin size={10} /> Pinned
                      </span>
                    )}

                    {/* Date Badge */}
                    <span className="text-[10px] text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full font-mono inline-flex items-center gap-1">
                      <Calendar size={10} className="text-blue-600" />
                      {new Date(announcement.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>

                    {/* Time Badge */}
                    <span className="text-[10px] text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full font-mono inline-flex items-center gap-1">
                      <Clock size={10} className="text-indigo-600" />
                      {new Date(announcement.createdAt).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true,
                      })}
                    </span>

                    {/* Instructor Quick Adjust Date & Time Trigger */}
                    {isInstructor && editingDateTimeId !== announcement.id && (
                      <button
                        type="button"
                        onClick={() => handleOpenEditDateTime(announcement)}
                        className="text-[10px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2 py-0.5 rounded-full inline-flex items-center gap-1 transition-colors cursor-pointer"
                        title="Adjust announcement date & time"
                      >
                        <Edit2 size={9} />
                        Adjust Date & Time
                      </button>
                    )}
                  </div>

                  {/* Inline Date & Time Editor for Instructors */}
                  {isInstructor && editingDateTimeId === announcement.id && (
                    <div className="flex flex-wrap items-center gap-2 p-2.5 rounded-xl bg-blue-50/80 border border-blue-200 mt-1">
                      <span className="text-[11px] font-bold text-blue-900 flex items-center gap-1">
                        <Calendar size={12} className="text-blue-600" /> Adjust Date & Time:
                      </span>
                      <input
                        type="date"
                        value={editDateVal}
                        onChange={(e) => setEditDateVal(e.target.value)}
                        className="px-2.5 py-1 text-xs bg-white border border-blue-200 rounded-lg font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <input
                        type="time"
                        value={editTimeVal}
                        onChange={(e) => setEditTimeVal(e.target.value)}
                        className="px-2.5 py-1 text-xs bg-white border border-blue-200 rounded-lg font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveDateTime(announcement)}
                        className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold inline-flex items-center gap-1 shadow-2xs cursor-pointer"
                      >
                        <Save size={11} /> Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingDateTimeId(null)}
                        className="px-2 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 text-[11px] font-semibold cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  )}

                  <h3 className="font-bold text-slate-900 text-base">{announcement.title}</h3>
                  <p className="text-xs sm:text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{announcement.content}</p>
                </div>

                <div className="flex flex-col items-end gap-2 shrink-0">
                  {announcement.requiresSubmission && <StatusBadge status={status} />}
                  <div className="flex items-center gap-1.5">
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => handleDeleteAnnouncement(announcement.id)}
                        title="Delete announcement"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        const html = `
                          <html>
                            <head>
                              <title>${announcement.title}</title>
                              <style>body{font-family:sans-serif;padding:24px;} .title{font-size:22px;font-weight:bold;margin-bottom:6px;} .meta{color:#64748b;font-size:12px;margin-bottom:14px;} .content{font-size:14px;line-height:1.6;color:#1e293b;} img{max-width:100%;height:auto;margin-top:16px;border:1px solid #cbd5e1;border-radius:8px;}</style>
                            </head>
                            <body>
                              <div class="title">${announcement.title}</div>
                              <div class="meta">Posted by ${announcement.createdBy || 'OJT System'} • ${new Date(announcement.createdAt).toLocaleString()}</div>
                              <div class="content">${announcement.content.replace(/\n/g, '<br/>')}</div>
                              ${announcement.photo ? `<img src="${announcement.photo}" alt="attachment"/>` : ''}
                            </body>
                          </html>`;
                        const w = window.open('', '_blank', 'noopener');
                        if (!w) return;
                        w.document.open();
                        w.document.write(html);
                        w.document.close();
                        w.focus();
                        setTimeout(() => w.print(), 300);
                      }}
                      className="text-xs px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100 font-medium cursor-pointer"
                    >
                      Print
                    </button>
                  </div>
                </div>
              </div>
              {(announcement.photo || (announcement.files && announcement.files.length > 0)) && (
                <AnnouncementAttachmentView
                  photo={announcement.photo}
                  files={announcement.files}
                  allowDownload={true}
                />
              )}
              {announcement.reminder && (
                <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-2">
                  Reminder: {announcement.reminder}
                </div>
              )}
              {announcement.deadlineAt && (
                <div className="text-xs text-gray-500 flex items-center gap-1">
                  <Clock size={12} />
                  Deadline: {new Date(announcement.deadlineAt).toLocaleString()}
                </div>
              )}

              {(announcement.requiresSubmission || Boolean(announcement.photo || (announcement.files && announcement.files.length > 0))) && (
                <div className="rounded-xl border border-gray-200 p-3.5 space-y-3 bg-slate-50/40">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <p className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                      <Upload size={13} className="text-blue-600" />
                      {isInstructor ? 'Trainee File & Response Submissions' : 'Upload Your File(s) & Response'}
                    </p>
                    {submission && (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                        ✓ Submitted {submission.files && submission.files.length > 1 ? `(${submission.files.length} files)` : ''}
                      </span>
                    )}
                  </div>

                  {/* Trainee's own submission review */}
                  {submission && (
                    <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2 shadow-2xs">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] font-bold text-blue-700 uppercase tracking-wider">
                          Your Submitted Record (Reviewable by You & Instructor)
                        </p>
                        <p className="text-[10px] text-slate-400 font-medium">
                          Sent: {new Date(submission.submittedAt).toLocaleString()}
                        </p>
                      </div>
                      {submission.message && (
                        <p className="text-xs text-slate-700 bg-slate-50 p-2 rounded-lg border border-slate-100 italic">
                          "{submission.message}"
                        </p>
                      )}
                      {(submission.photo || (submission.files && submission.files.length > 0)) && (
                        <AnnouncementAttachmentView
                          photo={submission.photo}
                          files={submission.files}
                          allowDownload={true}
                        />
                      )}
                    </div>
                  )}

                  {/* Instructor view of all Trainee Submissions on this announcement */}
                  {isInstructor && (
                    <div className="space-y-2 pt-1">
                      {employees
                        .filter((e) => e.active && e.position !== 'OJT Instructor')
                        .map((emp) => {
                          const empSub = getAnnouncementSubmission(announcement.id, emp.id);
                          if (!empSub) return null;
                          return (
                            <div key={emp.id} className="bg-white border border-blue-200/80 rounded-xl p-3 space-y-2 shadow-2xs">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-slate-900">
                                  👤 {emp.name} <span className="text-[10px] font-normal text-slate-500">({emp.employeeId})</span>
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  {new Date(empSub.submittedAt).toLocaleString()}
                                </span>
                              </div>
                              {empSub.message && (
                                <p className="text-xs text-slate-700 bg-slate-50 p-2 rounded-lg border border-slate-100">
                                  {empSub.message}
                                </p>
                              )}
                              {(empSub.photo || (empSub.files && empSub.files.length > 0)) && (
                                <AnnouncementAttachmentView
                                  photo={empSub.photo}
                                  files={empSub.files}
                                  allowDownload={true}
                                />
                              )}
                            </div>
                          );
                        })}
                    </div>
                  )}

                  {/* Upload single or multiple files + message */}
                  <textarea
                    value={messageDrafts[announcement.id] || ''}
                    onChange={(e) => setMessageDrafts((prev) => ({ ...prev, [announcement.id]: e.target.value }))}
                    rows={2}
                    placeholder="Type a note or response (optional if attaching files)..."
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />

                  {(filesDrafts[announcement.id] || []).length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {(filesDrafts[announcement.id] || []).map((f, idx) => (
                        <div
                          key={`${f.name}-${idx}`}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-900"
                        >
                          <FileText size={12} className="text-blue-600 shrink-0" />
                          <span className="font-semibold truncate max-w-[160px]">{idx + 1}. {f.name}</span>
                          <button
                            type="button"
                            onClick={() =>
                              setFilesDrafts((prev) => ({
                                ...prev,
                                [announcement.id]: (prev[announcement.id] || []).filter((_, i) => i !== idx),
                              }))
                            }
                            className="text-rose-500 hover:text-rose-700 cursor-pointer"
                          >
                            <X size={11} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-2 flex-wrap">
                    <label className="text-xs font-semibold flex items-center gap-1.5 px-3 py-2 rounded-xl border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 cursor-pointer transition-colors">
                      <Upload size={13} />
                      <span>{(filesDrafts[announcement.id] || []).length > 0 ? '+ Add More Files' : 'Upload File(s) (Single or Multiple)'}</span>
                      <input
                        type="file"
                        multiple
                        accept="image/*,.pdf,.doc,.docx,.txt,.csv,.xlsx,.xls"
                        className="hidden"
                        onChange={(e) => {
                          onPickFiles(announcement.id, e.target.files);
                          e.target.value = '';
                        }}
                      />
                    </label>
                    {(filesDrafts[announcement.id] || []).length > 0 && (
                      <span className="text-[11px] font-bold text-emerald-700">
                        {(filesDrafts[announcement.id] || []).length} file(s) ready
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => submit(announcement)}
                      className="ml-auto px-4 py-2 rounded-xl bg-blue-600 text-white text-xs sm:text-sm font-bold hover:bg-blue-700 transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                    >
                      <CheckCircle size={15} />
                      <span>{submission ? 'Update Submission' : 'Turn In File(s)'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Discussion Comments Thread */}
              <div className="pt-3 border-t border-gray-100">
                <div className="flex items-center gap-1.5 mb-2.5">
                  <MessageSquare size={13} className="text-gray-400" />
                  <p className="text-xs font-bold text-gray-700">Discussion Comments</p>
                  <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.2 rounded-full font-semibold">
                    {getAnnouncementComments(announcement.id).length}
                  </span>
                </div>

                {/* Existing Comments */}
                <div className="space-y-2 mb-3">
                  {getAnnouncementComments(announcement.id).map((c) => (
                    <div key={c.id} className="bg-gray-50 border border-gray-100 rounded-xl p-2.5 text-xs">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-gray-800">{c.authorName}</span>
                          <span
                            className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold uppercase ${
                              c.authorRole === 'admin'
                                ? 'bg-amber-100 text-amber-800'
                                : c.authorRole === 'host'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {c.authorRole === 'admin' ? 'Instructor' : c.authorRole === 'host' ? 'HTE' : 'Trainee'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-gray-400">
                            {new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {(isInstructor || c.employeeId === activeUser.id || c.authorName === authorName) && (
                            <button
                              type="button"
                              title="Delete comment"
                              onClick={async () => {
                                if (window.confirm('Delete this comment?')) {
                                  await deleteAnnouncementComment(announcement.id, c.id);
                                  toast.success('Comment deleted!');
                                }
                              }}
                              className="text-gray-300 hover:text-red-500 transition-colors p-0.5 rounded cursor-pointer"
                            >
                              <Trash2 size={11} />
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="text-gray-700 leading-relaxed">{c.content}</p>
                    </div>
                  ))}
                  {getAnnouncementComments(announcement.id).length === 0 && (
                    <p className="text-[11px] text-gray-400 italic">No comments yet. Be the first to start the discussion!</p>
                  )}
                </div>

                {/* Post Comment Input */}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder={submittingComments[announcement.id] ? 'Sending comment...' : 'Write a comment...'}
                    value={commentDrafts[announcement.id] || ''}
                    disabled={Boolean(submittingComments[announcement.id])}
                    onChange={(e) => setCommentDrafts((prev) => ({ ...prev, [announcement.id]: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (!submittingComments[announcement.id]) {
                          handlePostComment(announcement.id);
                        }
                      }
                    }}
                    className="flex-1 px-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white disabled:opacity-60"
                  />
                  <button
                    type="button"
                    onClick={() => handlePostComment(announcement.id)}
                    disabled={!(commentDrafts[announcement.id] || '').trim() || Boolean(submittingComments[announcement.id])}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-40 flex items-center gap-1.5 shrink-0"
                  >
                    {submittingComments[announcement.id] ? (
                      <>
                        <Loader2 size={12} className="animate-spin" />
                        <span>Sending...</span>
                      </>
                    ) : (
                      <span>Send</span>
                    )}
                  </button>
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: 'passed' | 'missed' | 'pending' }) {
  if (status === 'passed') {
    return (
      <span className="text-xs px-2.5 py-1 rounded-full bg-green-100 text-green-700 font-bold inline-flex items-center gap-1">
        <CheckCircle size={12} /> Turned In
      </span>
    );
  }
  if (status === 'missed') {
    return (
      <span className="text-xs px-2.5 py-1 rounded-full bg-red-100 text-red-700 font-bold inline-flex items-center gap-1">
        <XCircle size={12} /> Missing
      </span>
    );
  }
  return (
    <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-700 inline-flex items-center gap-1">
      <Bell size={12} /> Pending
    </span>
  );
}

export function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
