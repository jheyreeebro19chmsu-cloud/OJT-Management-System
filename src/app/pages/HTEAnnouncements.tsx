import {
  Megaphone,
  Calendar,
  Pin,
  Clock,
  User,
  Search,
} from 'lucide-react';
import React, { useState, useMemo } from 'react';

import { useApp } from '../store/AppContext';

export function HTEAnnouncements() {
  const { announcements, currentUser } = useApp();
  const [searchTerm, setSearchTerm] = useState('');

  // Filter announcements for HTE/All
  const hteAnnouncements = useMemo(() => {
    return announcements
      .filter((a) => a.targetRole === 'all' || (a as any).targetRole === 'hte' || (a as any).targetRole === 'host')
      .sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [announcements]);

  const filtered = useMemo(() => {
    return hteAnnouncements.filter((a) =>
      a.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.content.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [hteAnnouncements, searchTerm]);

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm">
        <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
          <Megaphone className="text-blue-600" size={26} />
          <span>Campus & OJT Announcements</span>
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Official advisories, academic schedules, and notices from the university and OJT coordinators
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search announcements..."
          className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs"
        />
      </div>

      {/* Announcements List */}
      <div className="space-y-4">
        {filtered.map((ann) => (
          <div
            key={ann.id}
            className={`bg-white rounded-3xl p-6 border transition-all ${
              ann.isPinned
                ? 'border-blue-300 bg-blue-50/20 shadow-md ring-1 ring-blue-100'
                : 'border-slate-200/80 shadow-sm hover:shadow-md'
            }`}
          >
            <div className="flex items-start justify-between gap-4 mb-3">
              <div className="flex items-center gap-2">
                {ann.isPinned && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
                    <Pin size={12} className="fill-blue-600 text-blue-600" />
                    Pinned
                  </span>
                )}
                <h2 className="text-lg font-black text-slate-900 leading-snug">{ann.title}</h2>
              </div>
              <span className="text-xs text-slate-400 font-mono shrink-0">
                {new Date(ann.createdAt).toLocaleDateString()}
              </span>
            </div>

            <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed mb-4">
              {ann.content}
            </p>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs text-slate-500 font-medium">
              <div className="flex items-center gap-1.5">
                <User size={14} className="text-slate-400" />
                <span>Posted by {ann.createdBy || 'OJT Coordinator'}</span>
              </div>
              {ann.expiresAt && (
                <div className="flex items-center gap-1 text-slate-400 font-mono">
                  <Clock size={14} />
                  <span>Valid until {new Date(ann.expiresAt).toLocaleDateString()}</span>
                </div>
              )}
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="py-16 text-center bg-white rounded-3xl border border-slate-200">
            <Megaphone size={36} className="mx-auto text-slate-300 mb-2" />
            <h3 className="font-bold text-slate-700">No announcements found</h3>
            <p className="text-xs text-slate-400 mt-1">There are no active notices for partner establishments</p>
          </div>
        )}
      </div>
    </div>
  );
}
