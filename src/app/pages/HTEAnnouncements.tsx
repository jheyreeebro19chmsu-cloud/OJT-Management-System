import {
  Megaphone,
  Calendar,
  Pin,
  Clock,
  User,
  Search,
  Plus,
  Edit2,
  Trash2,
  X,
  Save,
  Paperclip,
  Image as ImageIcon,
  FileText,
  AlertTriangle,
  Info,
  CheckCircle,
  Bell,
  MessageSquare,
  Building,
  Upload,
} from 'lucide-react';
import React, { useState, useMemo, useRef } from 'react';
import { toast } from 'sonner';

import { useApp } from '../store/AppContext';
import { Announcement } from '../types';
import { AnnouncementAttachmentView } from '../components/AnnouncementAttachmentView';
import { formatFileSize, parseAnnouncementAttachment } from '../utils/attachmentHelper';

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
    color: 'text-emerald-700',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    icon: <CheckCircle size={14} />,
  },
  urgent: {
    label: 'Urgent',
    color: 'text-rose-700',
    bg: 'bg-rose-50',
    border: 'border-rose-300',
    icon: <Bell size={14} />,
  },
};

const AUDIENCE_OPTIONS: { val: Announcement['targetRole']; label: string; desc: string }[] = [
  { val: 'employee', label: 'Trainees / Interns', desc: 'Visible to assigned student trainees' },
  { val: 'all', label: 'All Users (University & Interns)', desc: 'Visible to trainees, coordinators & HTE' },
  { val: 'hte', label: 'HTE & Supervisors Only', desc: 'Internal notices for company supervisors' },
];

interface AttachmentDraft {
  url: string;
  name: string;
  type: 'image' | 'pdf' | 'doc' | 'file';
  size: string;
}

export function HTEAnnouncements() {
  const {
    announcements,
    currentUser,
    getCurrentEmployee,
    addAnnouncement,
    updateAnnouncement,
    deleteAnnouncement,
    getAnnouncementComments,
    addAnnouncementComment,
    settings,
  } = useApp();

  const employee = getCurrentEmployee();

  const hteUser = useMemo(() => {
    try {
      const stored = localStorage.getItem('ojt_hte_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }, []);

  const companyName =
    employee?.companyName ||
    hteUser?.companyName ||
    localStorage.getItem('ojt_hte_company') ||
    'Host Training Establishment';

  const authorName =
    currentUser?.name ||
    employee?.name ||
    hteUser?.name ||
    companyName ||
    'HTE Supervisor';

  // Filters & State
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'my_posts' | 'university' | 'attachments'>('all');
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [type, setType] = useState<Announcement['type']>('info');
  const [targetRole, setTargetRole] = useState<Announcement['targetRole']>('employee');
  const [isPinned, setIsPinned] = useState(false);
  const [attachment, setAttachment] = useState<AttachmentDraft | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Comments State
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});

  // Filter announcements visible to this HTE
  const hteAnnouncements = useMemo(() => {
    return announcements
      .filter((a) => {
        // Universal notices or HTE audience
        const isTargeted = a.targetRole === 'all' || a.targetRole === 'hte' || (a as any).targetRole === 'host';
        // Announcements posted by this HTE supervisor/company
        const isAuthor =
          a.createdBy === authorName ||
          a.createdBy === companyName ||
          (a as any).createdByRole === 'host' ||
          (a as any).createdByRole === 'hte';
        return isTargeted || isAuthor;
      })
      .sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [announcements, authorName, companyName]);

  const filtered = useMemo(() => {
    return hteAnnouncements.filter((a) => {
      const matchesSearch =
        a.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (a.createdBy && a.createdBy.toLowerCase().includes(searchTerm.toLowerCase()));

      if (!matchesSearch) return false;

      if (activeFilter === 'my_posts') {
        return (
          a.createdBy === authorName ||
          a.createdBy === companyName ||
          (a as any).createdByRole === 'host' ||
          (a as any).createdByRole === 'hte'
        );
      }
      if (activeFilter === 'university') {
        return (a as any).createdByRole === 'admin' || (!a.createdByRole && a.createdBy !== authorName);
      }
      if (activeFilter === 'attachments') {
        return Boolean(a.photo);
      }

      return true;
    });
  }, [hteAnnouncements, searchTerm, activeFilter, authorName, companyName]);

  // Open Add Modal
  const handleOpenAdd = () => {
    setEditId(null);
    setTitle('');
    setContent('');
    setType('info');
    setTargetRole('employee');
    setIsPinned(false);
    setAttachment(null);
    setShowModal(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (ann: Announcement) => {
    setEditId(ann.id);
    setTitle(ann.title);
    setContent(ann.content);
    setType(ann.type || 'info');
    setTargetRole(ann.targetRole || 'employee');
    setIsPinned(Boolean(ann.isPinned));

    if (ann.photo) {
      const parsed = parseAnnouncementAttachment(ann.photo);
      if (parsed) {
        setAttachment({
          url: parsed.url,
          name: parsed.name,
          type: parsed.type,
          size: parsed.size || '',
        });
      } else {
        setAttachment(null);
      }
    } else {
      setAttachment(null);
    }

    setShowModal(true);
  };

  // File Picker Handler (Pictures, PDF, Documents)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      toast.error('File exceeds maximum size of 15MB.');
      return;
    }

    let fileType: AttachmentDraft['type'] = 'file';
    if (file.type.startsWith('image/')) {
      fileType = 'image';
    } else if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      fileType = 'pdf';
    } else if (
      file.type.includes('word') ||
      file.type.includes('document') ||
      file.name.match(/\.(doc|docx|txt|rtf|csv|xlsx|xls)$/i)
    ) {
      fileType = 'doc';
    }

    const reader = new FileReader();
    reader.onload = () => {
      setAttachment({
        url: reader.result as string,
        name: file.name,
        type: fileType,
        size: formatFileSize(file.size),
      });
      toast.success(`Attached ${file.name}`);
    };
    reader.onerror = () => {
      toast.error('Failed to read file from your device.');
    };
    reader.readAsDataURL(file);
  };

  // Save / Post Announcement
  const handleSaveAnnouncement = async () => {
    if (!title.trim()) {
      toast.error('Please enter an announcement title.');
      return;
    }
    if (!content.trim()) {
      toast.error('Please provide announcement details / content.');
      return;
    }

    setIsSubmitting(true);
    try {
      // Serialize attachment:
      // If pure image, dataUrl can be stored directly for backward-compatibility;
      // If PDF or Doc, store JSON metadata so name, type, and size are preserved.
      let photoPayload = '';
      if (attachment) {
        if (attachment.type === 'image') {
          photoPayload = attachment.url;
        } else {
          photoPayload = JSON.stringify({
            url: attachment.url,
            name: attachment.name,
            type: attachment.type,
            size: attachment.size,
          });
        }
      }

      if (editId) {
        updateAnnouncement(editId, {
          title: title.trim(),
          content: content.trim(),
          type,
          targetRole,
          isPinned,
          photo: photoPayload || undefined,
        });
        toast.success('Announcement updated successfully!');
      } else {
        addAnnouncement({
          title: title.trim(),
          content: content.trim(),
          type,
          targetRole,
          isPinned,
          photo: photoPayload || undefined,
          createdAt: new Date().toISOString(),
          createdBy: `${authorName} (${companyName})`,
          createdByRole: 'host',
          academicYear: settings.activeAcademicYear,
        });
        toast.success('Announcement posted successfully!');
      }

      setShowModal(false);
    } catch (err) {
      console.error(err);
      toast.error('Failed to save announcement. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Announcement
  const handleDelete = (ann: Announcement) => {
    if (confirm(`Are you sure you want to delete "${ann.title}"?`)) {
      deleteAnnouncement(ann.id);
      toast.success('Announcement deleted.');
    }
  };

  // Toggle Pin
  const handleTogglePin = (ann: Announcement) => {
    updateAnnouncement(ann.id, { isPinned: !ann.isPinned });
    toast.success(ann.isPinned ? 'Unpinned announcement.' : 'Pinned announcement to top!');
  };

  // Comment Thread
  const handlePostComment = async (annId: string) => {
    const text = (commentDrafts[annId] || '').trim();
    if (!text) return;

    await addAnnouncementComment({
      announcementId: annId,
      employeeId: currentUser?.id || employee?.id,
      authorName: `${authorName} (${companyName})`,
      authorRole: 'host',
      content: text,
      createdAt: new Date().toISOString(),
    });

    setCommentDrafts((prev) => ({ ...prev, [annId]: '' }));
    toast.success('Comment posted!');
  };

  const isAuthor = (ann: Announcement) => {
    return (
      ann.createdBy === authorName ||
      ann.createdBy.includes(companyName) ||
      (ann as any).createdByRole === 'host' ||
      (ann as any).createdByRole === 'hte'
    );
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Header Banner */}
      <div className="bg-white p-6 sm:p-7 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 rounded-full text-xs font-bold text-blue-700 border border-blue-100">
            <Building size={13} />
            <span>{companyName}</span>
            <span>•</span>
            <span>HTE Portal</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <Megaphone className="text-blue-600 shrink-0" size={28} />
            <span>Announcements & Advisories</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 max-w-xl">
            Post company instructions, guidelines, internship notices, schedules, or attachments (PDFs, docs, pictures)
            for trainees and university coordinators.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-sm rounded-2xl shadow-lg shadow-blue-500/20 transition-all hover:scale-[1.02] shrink-0 self-start sm:self-auto"
        >
          <Plus size={18} />
          <span>Post Announcement</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search announcements by title, content, or author..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Quick Filter Pills */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setActiveFilter('all')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                activeFilter === 'all'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All Notices ({hteAnnouncements.length})
            </button>
            <button
              onClick={() => setActiveFilter('my_posts')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                activeFilter === 'my_posts'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-700'
              }`}
            >
              Posted by HTE
            </button>
            <button
              onClick={() => setActiveFilter('university')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                activeFilter === 'university'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-indigo-50 hover:text-indigo-700'
              }`}
            >
              University Advisories
            </button>
            <button
              onClick={() => setActiveFilter('attachments')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeFilter === 'attachments'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700'
              }`}
            >
              <Paperclip size={13} />
              <span>With Files / Photos</span>
            </button>
          </div>
        </div>
      </div>

      {/* Announcements List */}
      <div className="space-y-4">
        {filtered.map((ann) => {
          const typeMeta = TYPE_CONFIG[ann.type || 'info'];
          const userIsAuthor = isAuthor(ann);
          const comments = getAnnouncementComments(ann.id);
          const isCommentsOpen = Boolean(expandedComments[ann.id]);

          return (
            <div
              key={ann.id}
              className={`bg-white rounded-3xl p-6 border transition-all ${
                ann.isPinned
                  ? 'border-blue-300 bg-blue-50/20 shadow-md ring-1 ring-blue-100'
                  : 'border-slate-200/80 shadow-sm hover:shadow-md'
              }`}
            >
              {/* Card Header */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-3">
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Priority Type Badge */}
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-extrabold border ${typeMeta.bg} ${typeMeta.color} ${typeMeta.border}`}
                    >
                      {typeMeta.icon}
                      <span>{typeMeta.label}</span>
                    </span>

                    {/* Target Audience Badge */}
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                      {ann.targetRole === 'employee'
                        ? 'For Trainees'
                        : ann.targetRole === 'hte'
                        ? 'HTE Only'
                        : 'University-wide'}
                    </span>

                    {/* Pinned Badge */}
                    {ann.isPinned && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-blue-100 text-blue-800 border border-blue-200">
                        <Pin size={12} className="fill-blue-600 text-blue-600" />
                        Pinned to Top
                      </span>
                    )}

                    {/* Posted by me badge */}
                    {userIsAuthor && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        Your Post
                      </span>
                    )}
                  </div>

                  <h2 className="text-lg sm:text-xl font-black text-slate-900 leading-snug">
                    {ann.title}
                  </h2>
                </div>

                {/* Actions (Edit / Delete / Pin) */}
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                  <span className="text-xs text-slate-400 font-mono">
                    {new Date(ann.createdAt).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>

                  {userIsAuthor && (
                    <div className="flex items-center gap-1 pl-2 border-l border-slate-200">
                      <button
                        onClick={() => handleTogglePin(ann)}
                        title={ann.isPinned ? 'Unpin' : 'Pin to top'}
                        className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-500 hover:text-blue-600 transition-colors"
                      >
                        <Pin size={15} className={ann.isPinned ? 'fill-blue-600 text-blue-600' : ''} />
                      </button>
                      <button
                        onClick={() => handleOpenEdit(ann)}
                        title="Edit Announcement"
                        className="p-1.5 hover:bg-blue-50 rounded-xl text-slate-500 hover:text-blue-600 transition-colors"
                      >
                        <Edit2 size={15} />
                      </button>
                      <button
                        onClick={() => handleDelete(ann)}
                        title="Delete Announcement"
                        className="p-1.5 hover:bg-red-50 rounded-xl text-slate-500 hover:text-red-600 transition-colors"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Main Content */}
              <div className="text-sm text-slate-700 whitespace-pre-line leading-relaxed mb-4">
                {ann.content}
              </div>

              {/* Attachment Display (Pictures, PDF, Docs) */}
              {ann.photo && (
                <div className="mb-4">
                  <AnnouncementAttachmentView photo={ann.photo} allowDownload={true} />
                </div>
              )}

              {/* Footer Meta */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs text-slate-500 font-medium">
                <div className="flex items-center gap-2">
                  <User size={14} className="text-slate-400" />
                  <span>
                    Posted by <strong className="text-slate-700">{ann.createdBy || 'Coordinator'}</strong>
                  </span>
                </div>

                <div className="flex items-center gap-4">
                  {ann.expiresAt && (
                    <div className="flex items-center gap-1 text-slate-400 font-mono">
                      <Clock size={13} />
                      <span>Valid until {new Date(ann.expiresAt).toLocaleDateString()}</span>
                    </div>
                  )}

                  {/* Comments Toggle Button */}
                  <button
                    onClick={() =>
                      setExpandedComments((p) => ({ ...p, [ann.id]: !p[ann.id] }))
                    }
                    className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-bold transition-colors"
                  >
                    <MessageSquare size={14} />
                    <span>{comments.length} Comments</span>
                  </button>
                </div>
              </div>

              {/* Discussion Thread (Collapsible) */}
              {isCommentsOpen && (
                <div className="mt-4 pt-4 border-t border-slate-100 space-y-3 bg-slate-50/60 p-4 rounded-2xl">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                    <MessageSquare size={14} className="text-blue-600" />
                    <span>Discussion & Questions</span>
                  </div>

                  {/* List of existing comments */}
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {comments.map((c) => (
                      <div key={c.id} className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900">{c.authorName}</span>
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-blue-50 text-blue-700 uppercase">
                              {c.authorRole}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400">
                            {new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-slate-700 leading-relaxed">{c.content}</p>
                      </div>
                    ))}

                    {comments.length === 0 && (
                      <p className="text-xs text-slate-400 italic py-2">
                        No comments yet. Post a question or note below.
                      </p>
                    )}
                  </div>

                  {/* Post Comment Input */}
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="text"
                      placeholder="Write a comment or reply as HTE..."
                      value={commentDrafts[ann.id] || ''}
                      onChange={(e) => setCommentDrafts((p) => ({ ...p, [ann.id]: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handlePostComment(ann.id);
                        }
                      }}
                      className="flex-1 px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => handlePostComment(ann.id)}
                      disabled={!(commentDrafts[ann.id] || '').trim()}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-40 shrink-0"
                    >
                      Reply
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Empty State */}
        {filtered.length === 0 && (
          <div className="py-20 text-center bg-white rounded-3xl border border-slate-200 space-y-3 p-6">
            <div className="w-16 h-16 rounded-3xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto shadow-inner">
              <Megaphone size={30} />
            </div>
            <h3 className="text-lg font-black text-slate-800">No announcements found</h3>
            <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto">
              There are no announcements matching your filter. Post an announcement or document for your trainees anytime.
            </p>
            <button
              onClick={handleOpenAdd}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-2xl shadow-sm transition-all mt-2"
            >
              <Plus size={15} />
              <span>Create Announcement</span>
            </button>
          </div>
        )}
      </div>

      {/* CREATE / EDIT MODAL */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-xl w-full p-6 sm:p-7 space-y-5 my-8"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <Megaphone size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">
                    {editId ? 'Edit Announcement' : 'Post New Announcement'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Share advisories, internship guidelines, or upload documents
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Form Fields */}
            <div className="space-y-4">
              {/* Title */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Schedule of Orientation & Document Submission"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
                />
              </div>

              {/* Content */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Content / Details <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={4}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Write the details of your notice, instructions, or meeting links..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none leading-relaxed"
                />
              </div>

              {/* Audience and Type */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Target Audience */}
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Target Audience</label>
                  <select
                    value={targetRole}
                    onChange={(e) => setTargetRole(e.target.value as Announcement['targetRole'])}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {AUDIENCE_OPTIONS.map((opt) => (
                      <option key={opt.val} value={opt.val}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Announcement Type */}
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Priority / Category</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as Announcement['type'])}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="info">Information (Blue)</option>
                    <option value="warning">Warning / Reminder (Amber)</option>
                    <option value="success">Good News / Commendation (Green)</option>
                    <option value="urgent">Urgent Notice (Rose)</option>
                  </select>
                </div>
              </div>

              {/* Attachment Picker (Pictures, PDF, Docs) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Paperclip size={14} className="text-blue-600" />
                    <span>Attach Pictures, PDFs, or Documents</span>
                  </label>
                  <span className="text-[11px] text-slate-400 font-medium">Max 15MB</span>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.pdf,.doc,.docx,.txt,.csv,.xlsx,.xls"
                  onChange={handleFileChange}
                  className="hidden"
                />

                {!attachment ? (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-200 hover:border-blue-400 bg-slate-50 hover:bg-blue-50/40 rounded-2xl p-4 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-1.5 group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-white shadow-xs border border-slate-200 flex items-center justify-center text-slate-500 group-hover:text-blue-600 transition-colors">
                      <Upload size={18} />
                    </div>
                    <p className="text-xs font-bold text-slate-700">
                      Click to browse from device
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Supports Pictures (PNG, JPG), PDFs, Word Documents, Excel/CSV
                    </p>
                  </div>
                ) : (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {attachment.type === 'image' ? (
                        <img
                          src={attachment.url}
                          alt="Preview"
                          className="w-11 h-11 rounded-xl object-cover border border-slate-200 shrink-0"
                        />
                      ) : attachment.type === 'pdf' ? (
                        <div className="w-11 h-11 rounded-xl bg-red-500 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                          PDF
                        </div>
                      ) : (
                        <div className="w-11 h-11 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                          <FileText size={20} />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 truncate">{attachment.name}</p>
                        <p className="text-[11px] text-slate-400 font-mono">
                          {attachment.type.toUpperCase()} • {attachment.size || 'Ready'}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setAttachment(null)}
                      className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-xl transition-colors"
                      title="Remove attachment"
                    >
                      <X size={16} />
                    </button>
                  </div>
                )}
              </div>

              {/* Pin Toggle */}
              <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
                <div>
                  <p className="text-xs font-bold text-slate-800">Pin Announcement</p>
                  <p className="text-[11px] text-slate-400">Display this at the top of the announcement board</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPinned(!isPinned)}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    isPinned ? 'bg-blue-600' : 'bg-slate-300'
                  }`}
                >
                  <div
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                      isPinned ? 'translate-x-6' : ''
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-2xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveAnnouncement}
                disabled={isSubmitting}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold rounded-2xl shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50"
              >
                <Save size={15} />
                <span>{isSubmitting ? 'Posting...' : editId ? 'Update Notice' : 'Post Announcement'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
