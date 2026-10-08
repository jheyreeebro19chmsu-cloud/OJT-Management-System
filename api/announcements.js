import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://wooighmdckuoebsuegzz.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indvb2lnaG1kY2t1b2Vic3VlZ3p6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjY5MTgwNywiZXhwIjoyMDg4MjY3ODA3fQ.isLQcKDpXplyE9YDjgub4UOhnfBorngVvVRALuQ8aJA';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function formatAnnouncement(ann) {
  if (!ann) return null;
  return {
    id: ann.id,
    title: ann.title,
    content: ann.content,
    type: ann.type,
    targetRole: ann.target_role,
    isPinned: ann.is_pinned,
    createdAt: ann.created_at,
    expiresAt: ann.expires_at,
    createdBy: ann.created_by,
    createdByRole: ann.created_by_role,
    academicYear: ann.academic_year,
    photo: ann.photo,
    reminder: ann.reminder,
    deadlineAt: ann.deadline_at,
    comments: ann.comments,
    requiresSubmission: ann.requires_submission,
  };
}

function sendJson(res, statusCode, data) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  if (typeof res.status === 'function' && typeof res.json === 'function') {
    return res.status(statusCode).json(data);
  }
  return res.end(JSON.stringify(data));
}

async function parseBody(req) {
  if (req.body !== undefined && req.body !== null) {
    return typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  }
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
}

function getQueryParam(req, param) {
  if (req.query && req.query[param]) return req.query[param];
  try {
    const url = new URL(req.url, 'http://localhost');
    return url.searchParams.get(param);
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    return res.end();
  }

  try {
    // GET: Fetch announcements
    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        return sendJson(res, 500, { error: error.message });
      }

      const formatted = (data || []).map(formatAnnouncement);
      return sendJson(res, 200, formatted);
    }

    // POST: Create new announcement
    if (req.method === 'POST') {
      const body = await parseBody(req);
      const {
        title,
        content,
        type,
        targetRole,
        target_role,
        isPinned,
        is_pinned,
        expiresAt,
        expires_at,
        createdBy,
        created_by,
        createdByRole,
        created_by_role,
        academicYear,
        academic_year,
        photo,
        reminder,
        deadlineAt,
        deadline_at,
        comments,
        requiresSubmission,
        requires_submission,
      } = body;

      const payload = {
        title: title || 'Untitled Announcement',
        content: content || '',
        type: type || 'info',
        target_role: targetRole ?? target_role ?? 'all',
        is_pinned: isPinned ?? is_pinned ?? false,
        expires_at: expiresAt ?? expires_at ?? null,
        created_by: createdBy ?? created_by ?? 'Instructor',
        created_by_role: createdByRole ?? created_by_role ?? 'admin',
        academic_year: academicYear ?? academic_year ?? null,
        photo: photo ?? null,
        reminder: reminder ?? null,
        deadline_at: deadlineAt ?? deadline_at ?? null,
        comments: comments ?? null,
        requires_submission: requiresSubmission ?? requires_submission ?? false,
      };

      const { data, error } = await supabase
        .from('announcements')
        .insert([payload])
        .select()
        .single();

      if (error) {
        return sendJson(res, 500, { error: error.message });
      }

      return sendJson(res, 200, formatAnnouncement(data));
    }

    // PUT / PATCH: Update announcement
    if (req.method === 'PUT' || req.method === 'PATCH') {
      const body = await parseBody(req);
      const id = getQueryParam(req, 'id') || body.id;

      if (!id) {
        return sendJson(res, 400, { error: 'Missing announcement id' });
      }

      const updates = {};
      if (body.title !== undefined) updates.title = body.title;
      if (body.content !== undefined) updates.content = body.content;
      if (body.type !== undefined) updates.type = body.type;
      if (body.targetRole !== undefined || body.target_role !== undefined) {
        updates.target_role = body.targetRole ?? body.target_role;
      }
      if (body.isPinned !== undefined || body.is_pinned !== undefined) {
        updates.is_pinned = body.isPinned ?? body.is_pinned;
      }
      if (body.expiresAt !== undefined || body.expires_at !== undefined) {
        updates.expires_at = body.expiresAt ?? body.expires_at;
      }
      if (body.academicYear !== undefined || body.academic_year !== undefined) {
        updates.academic_year = body.academicYear ?? body.academic_year;
      }
      if (body.photo !== undefined) updates.photo = body.photo;
      if (body.reminder !== undefined) updates.reminder = body.reminder;
      if (body.deadlineAt !== undefined || body.deadline_at !== undefined) {
        updates.deadline_at = body.deadlineAt ?? body.deadline_at;
      }
      if (body.comments !== undefined) updates.comments = body.comments;
      if (body.requiresSubmission !== undefined || body.requires_submission !== undefined) {
        updates.requires_submission = body.requiresSubmission ?? body.requires_submission;
      }
      if (body.createdByRole !== undefined || body.created_by_role !== undefined) {
        updates.created_by_role = body.createdByRole ?? body.created_by_role;
      }

      const { data, error } = await supabase
        .from('announcements')
        .update(updates)
        .eq('id', id)
        .select()
        .maybeSingle();

      if (error) {
        return sendJson(res, 500, { error: error.message });
      }

      return sendJson(res, 200, formatAnnouncement(data) || { success: true });
    }

    // DELETE: Delete announcement
    if (req.method === 'DELETE') {
      const body = await parseBody(req);
      const id = getQueryParam(req, 'id') || body?.id;
      if (!id) {
        return sendJson(res, 400, { error: 'Missing announcement id' });
      }

      const { error } = await supabase.from('announcements').delete().eq('id', id);
      if (error) {
        return sendJson(res, 500, { error: error.message });
      }

      return sendJson(res, 200, { success: true });
    }

    return sendJson(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    return sendJson(res, 500, { error: err.message || 'Internal server error' });
  }
}
