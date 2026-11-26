import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://wooighmdckuoebsuegzz.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indvb2lnaG1kY2t1b2Vic3VlZ3p6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjY5MTgwNywiZXhwIjoyMDg4MjY3ODA3fQ.isLQcKDpXplyE9YDjgub4UOhnfBorngVvVRALuQ8aJA';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const isUuid = (val) =>
  Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(val)));

let _announcementsListCache = { data: null, expiresAt: 0 };

async function offloadDataUriToStorage(dataUri, prefix = 'ann') {
  if (!dataUri || typeof dataUri !== 'string' || !dataUri.startsWith('data:')) return dataUri;
  const match = dataUri.match(/^data:([^;,]+)?(?:;charset=[^;,]+)?;base64,(.+)$/s);
  if (!match) return dataUri;
  try {
    const mime = (match[1] || 'application/octet-stream').trim();
    const buf = Buffer.from(match[2].trim(), 'base64');
    const ext = mime.includes('png')
      ? 'png'
      : mime.includes('pdf')
      ? 'pdf'
      : mime.includes('webp')
      ? 'webp'
      : mime.includes('word') || mime.includes('officedocument')
      ? 'docx'
      : 'jpg';
    const storagePath = `announcements/${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${ext}`;
    const { error } = await supabase.storage.from('face-photos').upload(storagePath, buf, {
      contentType: mime,
      upsert: true,
    });
    if (!error) {
      return supabase.storage.from('face-photos').getPublicUrl(storagePath).data.publicUrl;
    }
  } catch {}
  return dataUri;
}

async function scrubAnnouncementBlobs(val, prefix = 'ann') {
  if (!val) return val;
  if (typeof val === 'string') {
    if (val.startsWith('data:') && val.length > 512) {
      return await offloadDataUriToStorage(val, prefix);
    }
    if ((val.startsWith('{') || val.startsWith('[')) && val.includes('data:')) {
      try {
        return JSON.stringify(await scrubAnnouncementBlobs(JSON.parse(val), prefix));
      } catch {
        return val;
      }
    }
    return val;
  }
  if (Array.isArray(val)) {
    const out = [];
    for (let i = 0; i < val.length; i++) {
      out.push(await scrubAnnouncementBlobs(val[i], `${prefix}_${i}`));
    }
    return out;
  }
  if (typeof val === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(val)) {
      out[k] = await scrubAnnouncementBlobs(v, `${prefix}_${k}`);
    }
    return out;
  }
  return val;
}

async function readStorageAnnouncements() {
  try {
    const { data: blob, error } = await supabase.storage
      .from('face-photos')
      .download('settings/announcements_store.json');
    if (!error && blob) {
      const text = await blob.text();
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

async function writeStorageAnnouncements(list) {
  try {
    const buffer = Buffer.from(JSON.stringify(list), 'utf8');
    await supabase.storage.from('face-photos').upload('settings/announcements_store.json', buffer, {
      contentType: 'application/json',
      cacheControl: '0',
      upsert: true,
    });
  } catch (err) {
    console.warn('api/announcements storage write notice:', err?.message || err);
  }
}

function formatAnnouncement(ann) {
  if (!ann) return null;
  let files = ann.files || undefined;
  if (ann.photo && typeof ann.photo === 'string' && ann.photo.startsWith('{') && ann.photo.includes('"url"')) {
    try {
      const parsed = JSON.parse(ann.photo);
      if (Array.isArray(parsed.files) && parsed.files.length > 0) {
        files = parsed.files;
      } else if (parsed.url) {
        files = [{
          id: `file-${ann.id}-0`,
          name: parsed.name || 'Attachment',
          fileType: parsed.type === 'image' ? 'image/jpeg' : parsed.type === 'pdf' ? 'application/pdf' : 'application/octet-stream',
          size: parsed.size || '',
          dataUrl: parsed.url,
          fileUrl: parsed.url,
          uploadedAt: ann.created_at,
        }];
      }
    } catch {}
  } else if (ann.photo && typeof ann.photo === 'string' && (ann.photo.startsWith('http') || ann.photo.startsWith('data:image'))) {
    files = [{
      id: `file-${ann.id}-0`,
      name: 'Photo.jpg',
      fileType: 'image/jpeg',
      dataUrl: ann.photo,
      fileUrl: ann.photo,
      uploadedAt: ann.created_at,
    }];
  }

  return {
    id: ann.id,
    title: ann.title,
    content: ann.content,
    type: ann.type,
    targetRole: ann.target_role || 'all',
    isPinned: ann.is_pinned,
    createdAt: ann.created_at,
    expiresAt: ann.expires_at,
    createdBy: ann.created_by,
    createdByRole: ann.created_by_role,
    academicYear: ann.academic_year,
    photo: ann.photo,
    files,
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
    // GET: Fetch announcements or comments
    if (req.method === 'GET') {
      const action = getQueryParam(req, 'action');
      if (action === 'comments') {
        try {
          const { data, error } = await supabase
            .from('announcement_comments')
            .select('*')
            .order('created_at', { ascending: true });

          if (error) {
            // Table doesn't exist yet in Supabase schema cache
            return sendJson(res, 200, []);
          }

          const formatted = (data || []).map((row) => ({
            id: row.id,
            announcementId: row.announcement_id,
            employeeId: row.employee_id,
            authorName: row.author_name,
            authorRole: row.author_role,
            content: row.content,
            createdAt: row.created_at,
          }));
          return sendJson(res, 200, formatted);
        } catch {
          return sendJson(res, 200, []);
        }
      }

      if (_announcementsListCache.data && _announcementsListCache.expiresAt > Date.now()) {
        return sendJson(res, 200, _announcementsListCache.data);
      }

      let dbRecords = [];
      let dbSucceeded = false;
      try {
        const { data, error } = await supabase
          .from('announcements')
          .select('*')
          .order('is_pinned', { ascending: false, nullsFirst: false })
          .order('created_at', { ascending: false })
          .limit(100);

        if (!error && Array.isArray(data)) {
          dbRecords = data;
          dbSucceeded = true;
        }
      } catch (dbErr) {
        console.warn('api/announcements GET DB note:', dbErr);
      }

      const storageRecords = await readStorageAnnouncements();

      const formattedDb = (dbRecords || []).map(formatAnnouncement);
      const combined = [...formattedDb];
      for (const s of storageRecords) {
        // When DB query succeeded, only merge local fallback non-UUID announcements from storage
        // so announcements deleted from the SQL table never resurrect from stale storage snapshots
        if (dbSucceeded && isUuid(s?.id)) continue;
        if (!combined.some((c) => c.id === s.id)) {
          combined.push(s);
        }
      }

      const formatted = combined.sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        const tA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        const diff = (isNaN(tB) ? 0 : tB) - (isNaN(tA) ? 0 : tA);
        if (diff !== 0) return diff;
        return String(b.id || '').localeCompare(String(a.id || ''), undefined, { numeric: true });
      });
      _announcementsListCache = { data: formatted, expiresAt: Date.now() + 4000 };
      return sendJson(res, 200, formatted);
    }

    // POST: Create new announcement or comment
    if (req.method === 'POST') {
      _announcementsListCache = { data: null, expiresAt: 0 };
      const body = await parseBody(req);
      const action = getQueryParam(req, 'action') || body.action;

      if (action === 'comment' || (body.announcement_id && body.content && !body.title)) {
        const announcementId = body.announcement_id || body.announcementId;
        const rawEmpId = body.employee_id || body.employeeId || null;
        const isUUID = typeof rawEmpId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(rawEmpId);
        const employeeId = isUUID ? rawEmpId : null;
        const authorName = body.author_name || body.authorName || 'User';
        const authorRole = body.author_role || body.authorRole || 'employee';
        const content = body.content || '';
        const createdAt = body.created_at || body.createdAt || new Date().toISOString();

        const localFallback = {
          id: `comm-${Date.now()}`,
          announcementId,
          employeeId: rawEmpId,
          authorName,
          authorRole,
          content,
          createdAt,
        };

        try {
          const payload = {
            announcement_id: announcementId,
            employee_id: employeeId,
            author_id: rawEmpId || employeeId,
            author_name: authorName,
            author_role: authorRole,
            content,
            created_at: createdAt,
          };

          const { data, error } = await supabase
            .from('announcement_comments')
            .insert([payload])
            .select()
            .maybeSingle();

          if (error) {
            // Table doesn't exist yet in Supabase schema cache (PGRST205) -> return 200 with local fallback
            return sendJson(res, 200, { success: true, localOnly: true, comment: localFallback });
          }

          return sendJson(res, 200, {
            success: true,
            comment: {
              id: data?.id || localFallback.id,
              announcementId: data?.announcement_id || announcementId,
              employeeId: data?.employee_id || rawEmpId,
              authorName: data?.author_name || authorName,
              authorRole: data?.author_role || authorRole,
              content: data?.content || content,
              createdAt: data?.created_at || createdAt,
            },
          });
        } catch {
          return sendJson(res, 200, { success: true, localOnly: true, comment: localFallback });
        }
      }

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
        createdAt,
        created_at,
        files,
      } = body;

      let finalPhoto = await scrubAnnouncementBlobs(photo ?? null, 'post_photo');
      const rawAttachedFiles = (files && Array.isArray(files) && files.length > 0)
        ? files
        : (body.files && Array.isArray(body.files) && body.files.length > 0)
        ? body.files
        : null;
      const attachedFiles = rawAttachedFiles ? await scrubAnnouncementBlobs(rawAttachedFiles, 'post_file') : null;

      if (attachedFiles && attachedFiles.length > 0) {
        const first = attachedFiles[0];
        const url = first.fileUrl || first.dataUrl || (typeof finalPhoto === 'string' ? finalPhoto : '');
        finalPhoto = JSON.stringify({
          url,
          name: first.name || 'Attachment',
          type: (first.fileType || '').startsWith('image/')
            ? 'image'
            : (first.fileType || '').includes('pdf') || (first.name || '').toLowerCase().endsWith('.pdf')
            ? 'pdf'
            : 'doc',
          size: first.size || '',
          files: attachedFiles,
        });
      }

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
        photo: finalPhoto,
        reminder: reminder ?? null,
        deadline_at: deadlineAt ?? deadline_at ?? null,
        comments: comments ?? null,
        requires_submission: requiresSubmission ?? requires_submission ?? false,
        created_at: createdAt ?? created_at ?? new Date().toISOString(),
      };

      let savedData = null;
      try {
        const { data, error } = await supabase
          .from('announcements')
          .insert([payload])
          .select()
          .single();

        if (!error && data) {
          savedData = data;
        } else if (error) {
          console.warn('api/announcements POST DB error, falling back to storage:', error.message);
        }
      } catch (insertErr) {
        console.warn('api/announcements POST DB exception:', insertErr);
      }

      if (!savedData) {
        savedData = {
          id: `ann-${Date.now()}`,
          ...payload,
        };
      }

      const formatted = formatAnnouncement(savedData);

      // Mirror to cloud storage announcements_store.json
      const existingList = await readStorageAnnouncements();
      await writeStorageAnnouncements([formatted, ...existingList.filter((a) => a.id !== formatted.id)]);

      return sendJson(res, 200, formatted);
    }

    // PUT / PATCH: Update announcement
    if (req.method === 'PUT' || req.method === 'PATCH') {
      _announcementsListCache = { data: null, expiresAt: 0 };
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
      if (body.photo !== undefined) updates.photo = await scrubAnnouncementBlobs(body.photo, `put_${id}`);
      if (body.files !== undefined && Array.isArray(body.files) && body.files.length > 0) {
        const cleanFiles = await scrubAnnouncementBlobs(body.files, `putf_${id}`);
        const first = cleanFiles[0];
        const url = first.fileUrl || first.dataUrl || (typeof updates.photo === 'string' ? updates.photo : '');
        updates.photo = JSON.stringify({
          url,
          name: first.name || 'Attachment',
          type: (first.fileType || '').startsWith('image/')
            ? 'image'
            : (first.fileType || '').includes('pdf') || (first.name || '').toLowerCase().endsWith('.pdf')
            ? 'pdf'
            : 'doc',
          size: first.size || '',
          files: cleanFiles,
        });
      }
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
      if (body.createdAt !== undefined || body.created_at !== undefined) {
        updates.created_at = body.createdAt ?? body.created_at;
      }

      let updatedFormatted = null;
      if (isUuid(id)) {
        const { data, error } = await supabase
          .from('announcements')
          .update(updates)
          .eq('id', id)
          .select()
          .maybeSingle();

        if (error) {
          return sendJson(res, 500, { error: error.message });
        }
        updatedFormatted = formatAnnouncement(data);
      }

      const existingList = await readStorageAnnouncements();
      if (existingList.some((a) => a.id === id) || updatedFormatted) {
        const nextList = existingList.map((a) =>
          a.id === id ? (updatedFormatted || { ...a, ...body, id }) : a
        );
        await writeStorageAnnouncements(nextList);
      }

      return sendJson(res, 200, updatedFormatted || { success: true });
    }

    // DELETE: Delete announcement
    if (req.method === 'DELETE') {
      _announcementsListCache = { data: null, expiresAt: 0 };
      const body = await parseBody(req);
      const id = getQueryParam(req, 'id') || body?.id;
      if (!id) {
        return sendJson(res, 400, { error: 'Missing announcement id' });
      }

      if (isUuid(id)) {
        const { error } = await supabase.from('announcements').delete().eq('id', id);
        if (error) {
          return sendJson(res, 500, { error: error.message });
        }
      }

      // Also purge from storage mirror so deleted announcements never reappear
      const existingList = await readStorageAnnouncements();
      const filtered = existingList.filter((a) => a.id !== id);
      if (filtered.length !== existingList.length) {
        await writeStorageAnnouncements(filtered);
      }

      return sendJson(res, 200, { success: true });
    }

    return sendJson(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    return sendJson(res, 500, { error: err.message || 'Internal server error' });
  }
}
