import {
  Bell,
  Camera,
  CheckCircle,
  Clock,
  MessageSquare,
  XCircle,
  Plus,
  Trash2,
  Pin,
  Info,
  AlertTriangle,
  Megaphone,
  User,
  GraduationCap,
  Sparkles,
  X,
  Loader2,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';

import { useApp } from '../store/AppContext';
import { authAPI } from '../services/authApi';
import { API_BASE } from '../services/config';
import type { Announcement } from '../types';
import { AnnouncementAttachmentView } from '../components/AnnouncementAttachmentView';

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
    getCurrentEmployee,
    getActiveAnnouncements,
    getAnnouncementSubmission,
    getAnnouncementSubmissionStatus,
    submitAnnouncementResponse,
    addAnnouncement,
    deleteAnnouncement,
    getAnnouncementComments,
    addAnnouncementComment,
    deleteAnnouncementComment,
    settings,
  } = useApp();

  const employee = getCurrentEmployee();
  const activeUser = employee || currentUser;

  const isInstructor = Boolean(
    currentUser?.role === 'admin' ||
    currentUser?.role === 'instructor' ||
    (currentUser?.position && currentUser.position.toLowerCase().includes('instructor')) ||
    (employee?.position && employee.position.toLowerCase().includes('instructor')) ||
    (employee as any)?.role === 'instructor'
  );

  const authorRole: 'admin' | 'employee' = isInstructor ? 'admin' : 'employee';
  const authorName = currentUser?.name || employee?.name || (isInstructor ? 'OJT Instructor' : 'Trainee');

  const [messageDrafts, setMessageDrafts] = useState<Record<string, string>>({});
  const [photoDrafts, setPhotoDrafts] = useState<Record<string, string | undefined>>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [submittingComments, setSubmittingComments] = useState<Record<string, boolean>>({});

  const [isPosting, setIsPosting] = useState(false);
  const [isSubmittingPost, setIsSubmittingPost] = useState(false);
  const [newPost, setNewPost] = useState<{
    title: string;
    content: string;
    photo: string;
    type: Announcement['type'];
    targetRole: Announcement['targetRole'];
  }>({
    title: '',
    content: '',
    photo: '',
    type: 'info',
    targetRole: 'all',
  });

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
    return getActiveAnnouncements(isInstructor ? 'admin' : 'employee');
  }, [getActiveAnnouncements, isInstructor]);

  const onPickPhoto = async (announcementId: string, file?: File) => {
    if (!file) return;
    const b64 = await readAsDataUrl(file);
    setPhotoDrafts((prev) => ({ ...prev, [announcementId]: b64 }));
  };

  const submit = (announcement: Announcement) => {
    if (!activeUser) return;
    const message = (messageDrafts[announcement.id] || '').trim();
    const photo = photoDrafts[announcement.id];
    if (!message && !photo) return;

    if (API_BASE) {
      const formData = new FormData();
      formData.append('announcement_id', announcement.id);
      formData.append('user_id', String(activeUser.id));
      formData.append('message', message);
      if (photo && photo.startsWith('data:')) {
        fetch(photo)
          .then((r) => r.blob())
          .then((blob) => {
            formData.append('image', blob, `submission_${Date.now()}.jpg`);
            authAPI
              .submitAnnouncementResponse(announcement.id, Number(activeUser.id), formData)
              .then(() => {
                submitAnnouncementResponse(announcement.id, activeUser.id, message, photo);
                toast.success('Response submitted!');
              })
              .catch(() => {
                submitAnnouncementResponse(announcement.id, activeUser.id, message, photo);
                toast.success('Response submitted!');
              });
          })
          .catch(() => {
            submitAnnouncementResponse(announcement.id, activeUser.id, message, photo);
            toast.success('Response submitted!');
          });
      } else {
        authAPI
          .submitAnnouncementResponse(announcement.id, Number(activeUser.id), formData)
          .then(() => {
            submitAnnouncementResponse(announcement.id, activeUser.id, message, photo);
            toast.success('Response submitted!');
          })
          .catch(() => {
            submitAnnouncementResponse(announcement.id, activeUser.id, message, photo);
            toast.success('Response submitted!');
          });
      }
    } else {
      submitAnnouncementResponse(announcement.id, activeUser.id, message, photo);
      toast.success('Response submitted!');
    }
    setMessageDrafts((prev) => ({ ...prev, [announcement.id]: '' }));
    setPhotoDrafts((prev) => ({ ...prev, [announcement.id]: undefined }));
  };

  const handleCreatePost = async () => {
    if (!newPost.title.trim() || !newPost.content.trim()) {
      toast.error('Please provide both a title and details.');
      return;
    }
    setIsSubmittingPost(true);
    try {
      addAnnouncement({
        title: newPost.title.trim(),
        content: newPost.content.trim(),
        photo: newPost.photo || undefined,
        type: newPost.type,
        targetRole: newPost.targetRole,
        isPinned: false,
        createdAt: new Date().toISOString(),
        createdBy: authorName,
        createdByRole: authorRole,
        academicYear: settings?.activeAcademicYear,
      });

      toast.success(isInstructor ? 'Instructor announcement posted!' : 'Trainee announcement posted!');
      setNewPost({ title: '', content: '', photo: '', type: 'info', targetRole: 'all' });
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
            Official announcements, updates, notices, and reminders for OJT Trainees & Instructors.
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

      {/* Post Box (Available for both Trainees and Instructors) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-3">
        {!isPosting ? (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700 font-bold shrink-0">
              {isInstructor ? <GraduationCap size={18} /> : <User size={18} />}
            </div>
            <button
              type="button"
              onClick={() => setIsPosting(true)}
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
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

            {/* Photo Attachment Preview */}
            {newPost.photo && (
              <div className="relative inline-block border border-slate-200 rounded-xl overflow-hidden group">
                <img src={newPost.photo} alt="Preview" className="h-24 w-auto object-cover" />
                <button
                  type="button"
                  onClick={() => setNewPost((p) => ({ ...p, photo: '' }))}
                  className="absolute top-1 right-1 p-1 bg-black/60 hover:bg-black/80 text-white rounded-full transition-colors cursor-pointer"
                >
                  <X size={12} />
                </button>
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
              <label className="text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors text-slate-700 font-medium">
                <Camera size={14} className="text-blue-600" />
                <span>Attach Photo / Image</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      const b64 = await readAsDataUrl(f);
                      const testImg = new Image();
                      testImg.onload = () => {
                        setNewPost((p) => ({ ...p, photo: b64 }));
                        toast.success(`Attached ${f.name}`);
                      };
                      testImg.onerror = () => {
                        toast.error(`"${f.name}" is not a valid or readable image. Please select a valid photo.`);
                      };
                      testImg.src = b64;
                    }
                  }}
                />
              </label>

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

      {announcements.length === 0 ? (
        <div className="rounded-2xl bg-white border border-slate-200/80 p-8 text-center text-sm text-slate-500 shadow-xs">
          <Megaphone size={36} className="mx-auto text-slate-300 mb-2" />
          No announcements yet. Be the first to post an update!
        </div>
      ) : (
        announcements.map((announcement) => {
          const submission = activeUser ? getAnnouncementSubmission(announcement.id, activeUser.id) : null;
          const status = activeUser ? getAnnouncementSubmissionStatus(announcement, activeUser.id) : 'pending';
          const typeConf = TYPE_CONFIG[announcement.type || 'info'] || TYPE_CONFIG.info;

          const canDelete = Boolean(
            isInstructor ||
            announcement.createdBy === authorName ||
            announcement.createdBy === activeUser?.name ||
            (announcement.createdByRole === 'employee' && !isInstructor && announcement.createdBy === activeUser?.name)
          );

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
                    {announcement.createdByRole === 'admin' ? (
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

                    <span className="text-[10px] text-slate-400 font-mono">
                      {new Date(announcement.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                  </div>

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
              {announcement.photo && (
                <AnnouncementAttachmentView photo={announcement.photo} allowDownload={true} />
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

              {announcement.requiresSubmission && (
                <div className="rounded-xl border border-gray-200 p-3 space-y-2">
                  <p className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                    <MessageSquare size={12} /> Your response
                  </p>
                  {submission && (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Submission History</p>
                        <p className="text-[10px] text-slate-400 font-medium">
                          Sent: {new Date(submission.submittedAt).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="flex-1">
                          <p className="text-xs text-slate-700 bg-white p-2 rounded-lg border border-slate-100 italic">
                            "{submission.message || 'No message provided'}"
                          </p>
                        </div>
                        {submission.photo && (
                          <div className="shrink-0 relative group">
                            <img
                              src={submission.photo}
                              alt="Your submission"
                              className="w-16 h-16 rounded-lg object-cover border border-slate-200 shadow-sm"
                            />
                            <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg" />
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  <textarea
                    value={messageDrafts[announcement.id] || ''}
                    onChange={(e) => setMessageDrafts((prev) => ({ ...prev, [announcement.id]: e.target.value }))}
                    rows={3}
                    placeholder="Type your response..."
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="flex items-center gap-2">
                    <label className="text-xs flex items-center gap-1 px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 cursor-pointer">
                      <Camera size={12} />
                      Upload Photo
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => onPickPhoto(announcement.id, e.target.files?.[0])}
                      />
                    </label>
                    {photoDrafts[announcement.id] && <span className="text-[11px] text-green-700">Photo selected</span>}
                    <button
                      type="button"
                      onClick={() => submit(announcement)}
                      className="ml-auto px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 flex items-center gap-2"
                    >
                      <CheckCircle size={16} />
                      Turn In
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
                          <button
                            type="button"
                            title="Delete comment across all accounts"
                            onClick={async () => {
                              if (window.confirm('Delete this comment across all accounts?')) {
                                await deleteAnnouncementComment(announcement.id, c.id);
                                toast.success('Comment deleted!');
                              }
                            }}
                            className="text-gray-300 hover:text-red-500 transition-colors p-0.5 rounded cursor-pointer"
                          >
                            <Trash2 size={11} />
                          </button>
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
