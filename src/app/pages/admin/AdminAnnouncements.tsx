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
  Eye,
  Download,
  Printer,
  Camera,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import React, { useState } from 'react';
import { toast } from 'sonner';

import { authAPI } from '../../services/authApi';
import { useApp } from '../../store/AppContext';
import { Announcement } from '../../types';


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
};

const BLANK_FORM = {
  title: '',
  content: '',
  photo: '',
  reminder: '',
  deadlineAt: '',
  comments: '',
  requiresSubmission: false,
  type: 'info' as Announcement['type'],
  targetRole: 'all' as Announcement['targetRole'],
  isPinned: false,
  expiresAt: '',
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
  } = useApp();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(BLANK_FORM);
  const [showSubmissionsId, setShowSubmissionsId] = useState<string | null>(null);

  const upd = (key: string, val: string | boolean) => setForm((p) => ({ ...p, [key]: val }));

  const openAdd = () => {
    setForm(BLANK_FORM);
    setEditId(null);
    setShowForm(true);
  };

  const openEdit = (ann: Announcement) => {
    setForm({
      title: ann.title,
      content: ann.content,
      type: ann.type,
      targetRole: ann.targetRole,
      isPinned: ann.isPinned,
      photo: ann.photo || '',
      reminder: ann.reminder || '',
      deadlineAt: ann.deadlineAt ? ann.deadlineAt.slice(0, 16) : '',
      comments: ann.comments || '',
      requiresSubmission: Boolean(ann.requiresSubmission),
      expiresAt: ann.expiresAt ? ann.expiresAt.split('T')[0] : '',
    });
    setEditId(ann.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.content.trim()) {
      toast.error('Title and content are required.');
      return;
    }

    const data = {
      ...form,
      expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : undefined,
      deadlineAt: form.deadlineAt ? new Date(form.deadlineAt).toISOString() : undefined,
      createdAt: new Date().toISOString(),
      createdBy: currentUser?.name || 'OJT Instructor',
      createdByRole: (currentUser?.role === 'host' ? 'host' : 'admin') as 'admin' | 'host',
    };

    const API_BASE = (import.meta as ImportMeta).env.VITE_DJANGO_API_URL as string | undefined;

    if (API_BASE) {
      // Upload to Django backend via multipart/form-data using authAPI
      try {
        const formData = new FormData();
        formData.append('user_id', String(currentUser?.id || ''));
        formData.append('title', form.title);
        formData.append('content', form.content);

        // If photo is a data URL, convert to Blob
        if (form.photo && form.photo.startsWith('data:')) {
          const res = await fetch(form.photo);
          const blob = await res.blob();
          formData.append('image', blob, `announcement_${Date.now()}.jpg`);
        }

        const resp = await authAPI.postAnnouncement(Number(currentUser?.id || 0), formData);
        const respData = resp.data;
        if (respData && respData.success) {
          const created = {
            id: `ann-${respData.announcement_id}`,
            title: form.title,
            content: form.content,
            photo: respData.image_url || form.photo,
            type: form.type,
            targetRole: form.targetRole,
            isPinned: form.isPinned,
            reminder: form.reminder,
            deadlineAt: form.deadlineAt ? new Date(form.deadlineAt).toISOString() : undefined,
            comments: form.comments,
            requiresSubmission: form.requiresSubmission,
            createdAt: new Date().toISOString(),
            createdBy: currentUser?.name || 'OJT Instructor',
            createdByRole: (currentUser?.role === 'host' ? 'host' : 'admin') as 'admin' | 'host',
          } as Announcement;
          // Add to local state
          addAnnouncement(created as any);
          toast.success('Announcement posted!');
        } else {
          toast.error('Failed to post announcement to server.');
        }
      } catch (err) {
        console.error(err);
        toast.error('Failed to post announcement to server.');
      }
    } else {
      if (editId) {
        updateAnnouncement(editId, data);
        toast.success('Announcement updated!');
      } else {
        addAnnouncement(data);
        toast.success('Announcement posted!');
      }
    }

    setShowForm(false);
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

  const sorted = [...announcements].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const isExpired = (ann: Announcement) => {
    if (!ann.expiresAt) return false;
    return new Date(ann.expiresAt) < new Date();
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Announcements</h2>
          <p className="text-sm text-gray-500">
            {announcements.length} total • {announcements.filter((a) => !isExpired(a)).length} active
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-xl text-sm font-medium hover:bg-gray-900 transition-colors shadow-sm no-print"
          >
            <Printer size={15} />
            Print Board
          </button>
          <button
            onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2 bg-blue-700 text-white rounded-xl text-sm font-medium hover:bg-blue-800 transition-colors shadow-sm no-print"
          >
            <Plus size={15} />
            Post Announcement
          </button>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-4 gap-3 no-print">
        {(['info', 'warning', 'success', 'urgent'] as Announcement['type'][]).map((type) => {
          const c = TYPE_CONFIG[type];
          const count = announcements.filter((a) => a.type === type).length;
          return (
            <div key={type} className={`rounded-2xl p-3 text-center ${c.bg} border ${c.border}`}>
              <div className={`flex justify-center mb-1 ${c.color}`}>{c.icon}</div>
              <p className={`text-xl font-bold ${c.color}`}>{count}</p>
              <p className="text-xs text-gray-500">{c.label}</p>
            </div>
          );
        })}
      </div>

      {/* List */}
      {sorted.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 shadow-sm border border-gray-100 text-center">
          <Megaphone size={40} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No announcements yet</p>
          <p className="text-gray-400 text-sm mt-1">Post your first announcement to notify employees</p>
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
                      {ann.photo && (
                        <img
                          src={ann.photo}
                          alt=""
                          className="mt-2 rounded-xl border border-gray-200 max-h-48 object-cover"
                        />
                      )}
                      {ann.reminder && (
                        <p className="text-xs mt-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1">
                          Reminder: {ann.reminder}
                        </p>
                      )}
                      {ann.comments && (
                        <p className="text-xs mt-2 text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
                          Comments: {ann.comments}
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-gray-400">
                        <span className="flex items-center gap-1">
                          <Clock size={10} />{' '}
                          {new Date(ann.createdAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </span>
                        <span className="flex items-center gap-1">
                          👤 {ROLE_LABELS[ann.targetRole]}
                        </span>
                        {ann.createdBy && (
                          <span className="bg-gray-100 px-2 py-0.5 rounded text-[10px] font-bold">
                            By {ann.createdBy} ({ann.createdByRole || 'host'})
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
                  <label className="text-xs font-semibold text-gray-600 block mb-1.5">Photo (optional)</label>
                  <div className="flex items-center gap-3">
                    <label className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border-2 border-dashed border-gray-200 rounded-2xl cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all text-gray-500 hover:text-blue-600">
                      <Camera size={18} />
                      <span className="text-sm font-medium">Choose from device</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          const reader = new FileReader();
                          reader.onload = () => {
                            upd('photo', String(reader.result || ''));
                          };
                          reader.readAsDataURL(f);
                        }}
                        className="hidden"
                      />
                    </label>
                    {form.photo && (
                      <div className="relative shrink-0">
                        <img
                          src={form.photo}
                          className="w-12 h-12 rounded-xl object-cover border-2 border-white shadow-md"
                          alt="Preview"
                        />
                        <button
                          onClick={() => upd('photo', '')}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-sm hover:bg-red-600 transition-colors"
                        >
                          <X size={10} />
                        </button>
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
                  <label className="text-xs font-semibold text-gray-600 block mb-1.5">Type</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['info', 'warning', 'success', 'urgent'] as Announcement['type'][]).map((type) => {
                      const c = TYPE_CONFIG[type];
                      return (
                        <button
                          key={type}
                          onClick={() => upd('type', type)}
                          className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                            form.type === type
                              ? `${c.bg} ${c.border} ${c.color} border-2`
                              : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          <span className={form.type === type ? c.color : 'text-gray-400'}>{c.icon}</span>
                          {c.label}
                        </button>
                      );
                    })}
                  </div>
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

                {/* Expiry */}
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1.5">Expiry Date (optional)</label>
                  <input
                    type="date"
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
                      <div key={emp.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <p className="font-bold text-gray-800 text-sm">{emp.name}</p>
                            <p className="text-xs text-gray-400 mb-2">{new Date(sub.submittedAt).toLocaleString()}</p>
                            <p className="text-sm text-gray-700 bg-white p-3 rounded-xl border border-slate-200">
                              {sub.message}
                            </p>
                          </div>
                          {sub.photo && (
                            <div className="shrink-0">
                              <a href={sub.photo} target="_blank" rel="noreferrer" className="block relative group">
                                <img
                                  src={sub.photo}
                                  alt="Submission"
                                  className="w-24 h-24 rounded-xl object-cover border border-slate-200"
                                />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-xl">
                                  <Download size={16} className="text-white" />
                                </div>
                              </a>
                            </div>
                          )}
                        </div>
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
