import { Bell, Camera, CheckCircle, Clock, MessageSquare, XCircle } from 'lucide-react';
import React, { useMemo, useState } from 'react';

import { useApp } from '../store/AppContext';
import { authAPI } from '../services/authApi';
import type { Announcement } from '../types';

export function Announcements() {
  const {
    currentUser,
    getCurrentEmployee,
    getActiveAnnouncements,
    getAnnouncementSubmission,
    getAnnouncementSubmissionStatus,
    submitAnnouncementResponse,
    addAnnouncement,
  } = useApp();
  const employee = getCurrentEmployee();
  const [messageDrafts, setMessageDrafts] = useState<Record<string, string>>({});
  const [photoDrafts, setPhotoDrafts] = useState<Record<string, string | undefined>>({});
  
  const [isPosting, setIsPosting] = useState(false);
  const [newPost, setNewPost] = useState({ title: '', content: '', photo: '' });

  const announcements = useMemo(() => getActiveAnnouncements('employee'), [getActiveAnnouncements]);

  const onPickPhoto = async (announcementId: string, file?: File) => {
    if (!file) return;
    const b64 = await readAsDataUrl(file);
    setPhotoDrafts((prev) => ({ ...prev, [announcementId]: b64 }));
  };

  const submit = (announcement: Announcement) => {
    if (!employee) return;
    const message = (messageDrafts[announcement.id] || '').trim();
    const photo = photoDrafts[announcement.id];
    if (!message && !photo) return;
    // If backend is configured, POST to server; else use local context
    const API_BASE = (import.meta as ImportMeta).env.VITE_DJANGO_API_URL as string | undefined;
    if (API_BASE) {
      const formData = new FormData();
      formData.append('announcement_id', announcement.id);
      formData.append('user_id', String(employee.id));
      formData.append('message', message);
      if (photo && photo.startsWith('data:')) {
        // convert data URL to blob
        fetch(photo)
          .then((r) => r.blob())
          .then((blob) => {
            formData.append('image', blob, `submission_${Date.now()}.jpg`);
            authAPI
              .submitAnnouncementResponse(announcement.id, Number(employee.id), formData)
              .then(() => {
                // update local mirror
                submitAnnouncementResponse(announcement.id, employee.id, message, photo);
              })
              .catch(() => {
                // fallback local
                submitAnnouncementResponse(announcement.id, employee.id, message, photo);
              });
          })
          .catch(() => submitAnnouncementResponse(announcement.id, employee.id, message, photo));
      } else {
        authAPI
          .submitAnnouncementResponse(announcement.id, Number(employee.id), formData)
          .then(() => {
            submitAnnouncementResponse(announcement.id, employee.id, message, photo);
          })
          .catch(() => submitAnnouncementResponse(announcement.id, employee.id, message, photo));
      }
    } else {
      submitAnnouncementResponse(announcement.id, employee.id, message, photo);
    }
    setMessageDrafts((prev) => ({ ...prev, [announcement.id]: '' }));
    setPhotoDrafts((prev) => ({ ...prev, [announcement.id]: undefined }));
  };
  const handleCreatePost = () => {
    if (!newPost.title.trim() || !newPost.content.trim()) return;
    addAnnouncement({
      title: newPost.title,
      content: newPost.content,
      photo: newPost.photo,
      type: 'info',
      targetRole: 'employee',
      isPinned: false,
      createdAt: new Date().toISOString(),
      createdBy: currentUser?.name || employee.name,
      createdByRole: 'employee',
    });
    setNewPost({ title: '', content: '', photo: '' });
    setIsPosting(false);
  };

  if (!employee) {
    return <div className="text-sm text-gray-500">Employee profile not found.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Task Board</h2>
          <p className="text-sm text-gray-500">Manage your submissions and updates.</p>
        </div>
        
        <div className="flex gap-2">
          <div className="bg-white px-4 py-2 rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center min-w-[80px]">
            <p className="text-xs text-gray-400 font-medium">Missing</p>
            <p className="text-lg font-bold text-red-600">
              {announcements.filter(a => getAnnouncementSubmissionStatus(a, employee.id) === 'missed').length}
            </p>
          </div>
          <div className="bg-white px-4 py-2 rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center min-w-[80px]">
            <p className="text-xs text-gray-400 font-medium">Turned In</p>
            <p className="text-lg font-bold text-green-600">
              {announcements.filter(a => getAnnouncementSubmissionStatus(a, employee.id) === 'passed').length}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-3">
        {!isPosting ? (
          <button
            onClick={() => setIsPosting(true)}
            className="w-full text-left px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-xl text-gray-500 text-sm font-medium transition-colors border border-gray-200"
          >
            Share an update or photo with the team...
          </button>
        ) : (
          <div className="space-y-3">
            <input
              value={newPost.title}
              onChange={(e) => setNewPost(p => ({ ...p, title: e.target.value }))}
              placeholder="Update Title"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold"
            />
            <textarea
              value={newPost.content}
              onChange={(e) => setNewPost(p => ({ ...p, content: e.target.value }))}
              placeholder="What's on your mind?"
              rows={3}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
            <div className="flex items-center gap-2">
              <label className="text-xs flex items-center gap-1 px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors">
                <Camera size={14} />
                Attach Photo
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      const b64 = await readAsDataUrl(f);
                      setNewPost(p => ({ ...p, photo: b64 }));
                    }
                  }}
                />
              </label>
              {newPost.photo && <span className="text-[10px] text-green-600 font-bold flex items-center gap-1"><CheckCircle size={10} /> Photo added</span>}
              
              <div className="ml-auto flex gap-2">
                <button
                  onClick={() => setIsPosting(false)}
                  className="px-4 py-2 text-xs font-bold text-gray-500 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreatePost}
                  disabled={!newPost.title.trim() || !newPost.content.trim()}
                  className="px-4 py-2 text-xs font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-all shadow-md shadow-blue-100"
                >
                  Post Update
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {announcements.length === 0 ? (
        <div className="rounded-2xl bg-white border border-gray-100 p-6 text-center text-sm text-gray-500">
          No announcements yet.
        </div>
      ) : (
        announcements.map((announcement) => {
          const submission = getAnnouncementSubmission(announcement.id, employee.id);
          const status = getAnnouncementSubmissionStatus(announcement, employee.id);
          return (
            <div key={announcement.id} className="rounded-2xl bg-white border border-gray-100 p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="font-bold text-gray-800">{announcement.title}</p>
                    {announcement.createdBy && (
                      <span className="text-[10px] text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded-md border border-gray-100">
                        By {announcement.createdBy}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{announcement.content}</p>
                </div>
                <StatusBadge status={status} />
              </div>
              {announcement.photo && (
                <img
                  src={announcement.photo}
                  alt=""
                  className="w-full rounded-xl border border-gray-200 max-h-56 object-cover"
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

              {announcement.requiresSubmission && (
                <div className="rounded-xl border border-gray-200 p-3 space-y-2">
                  <p className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                    <MessageSquare size={12} /> Your response
                  </p>
                  {submission && (
                    <div className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg p-2">
                      Submitted at {new Date(submission.submittedAt).toLocaleString()}
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

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
