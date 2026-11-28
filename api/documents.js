import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://wooighmdckuoebsuegzz.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indvb2lnaG1kY2t1b2Vic3VlZ3p6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjY5MTgwNywiZXhwIjoyMDg4MjY3ODA3fQ.isLQcKDpXplyE9YDjgub4UOhnfBorngVvVRALuQ8aJA';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const isUuid = (val) => Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));

function sanitizeDocuments(docs) {
  if (!docs || typeof docs !== 'object') return {};
  const clean = {};
  for (const [key, val] of Object.entries(docs)) {
    if (val && typeof val === 'object') {
      const dataUrl = typeof val.dataUrl === 'string' ? val.dataUrl : '';
      const fileUrl = typeof val.fileUrl === 'string' ? val.fileUrl : '';

      const isBadUrl = (u) =>
        !u ||
        typeof u !== 'string' ||
        u.includes('NoSuchKey') ||
        u.includes('NoSuchBucket') ||
        u.includes('Bucket not found') ||
        u.includes('statusCode') ||
        u.includes('documents/unassigned/moa_');

      const validDataUrl = isBadUrl(dataUrl) ? '' : dataUrl;
      const validFileUrl = isBadUrl(fileUrl) ? '' : fileUrl;

      const httpUrl =
        (validFileUrl.startsWith('http://') || validFileUrl.startsWith('https://') ? validFileUrl : '') ||
        (validDataUrl.startsWith('http://') || validDataUrl.startsWith('https://') ? validDataUrl : '');

      let resolvedUrl = httpUrl;
      if (!resolvedUrl) {
        if (validDataUrl.startsWith('data:') && validDataUrl.length < 50000) {
          resolvedUrl = validDataUrl;
        } else if (validFileUrl.startsWith('data:') && validFileUrl.length < 50000) {
          resolvedUrl = validFileUrl;
        }
      }

      let sanitizedFiles = undefined;
      if (Array.isArray(val.files) && val.files.length > 0) {
        sanitizedFiles = val.files.map((f, idx) => {
          const fData = typeof f?.dataUrl === 'string' && !isBadUrl(f.dataUrl) ? f.dataUrl : '';
          const fUrl = typeof f?.fileUrl === 'string' && !isBadUrl(f.fileUrl) ? f.fileUrl : '';
          const fHttp =
            (fUrl.startsWith('http://') || fUrl.startsWith('https://') ? fUrl : '') ||
            (fData.startsWith('http://') || fData.startsWith('https://') ? fData : '');
          let fResolved = fHttp;
          if (!fResolved) {
            if (fData.startsWith('data:') && fData.length < 50000) fResolved = fData;
            else if (fUrl.startsWith('data:') && fUrl.length < 50000) fResolved = fUrl;
          }
          return {
            id: f?.id || `file-${idx}`,
            name: f?.name || `file_${idx + 1}`,
            size: f?.size || 0,
            fileType: f?.fileType || 'application/octet-stream',
            uploadedAt: f?.uploadedAt || val.uploadedAt || new Date().toISOString(),
            fileUrl: fHttp || fResolved,
            dataUrl: fResolved,
          };
        });
      }

      clean[key] = {
        name: val.name || 'document',
        ...(val.title ? { title: val.title } : {}),
        size: val.size,
        fileType: val.fileType || 'application/pdf',
        uploadedAt: val.uploadedAt || new Date().toISOString(),
        status: val.status || 'pending',
        dataUrl: resolvedUrl,
        fileUrl: httpUrl || resolvedUrl,
        description: val.description || '',
        notes: val.notes || val.feedback || '',
        feedback: val.feedback || '',
        reviewedBy: val.reviewedBy || '',
        reviewedAt: val.reviewedAt || '',
        source: val.source || 'portal',
        ...(sanitizedFiles ? { files: sanitizedFiles } : {}),
      };
    } else {
      clean[key] = val;
    }
  }
  return clean;
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
    req.on('data', (chunk) => { body += chunk; });
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

function parseQuery(req) {
  if (req.query && typeof req.query === 'object') return req.query;
  try {
    const url = new URL(req.url, 'http://localhost');
    return Object.fromEntries(url.searchParams.entries());
  } catch {
    return {};
  }
}

const _settingsStoreCache = new Map(); // storeFile -> { data, expiresAt }

function setSettingsCache(fileName, data, ttlMs = 45000) {
  _settingsStoreCache.set(fileName, { data, expiresAt: Date.now() + ttlMs });
}

async function readSettingsJsonFast(fileName, fallbackValue, forceFresh = false) {
  if (forceFresh) {
    try {
      const { data, error } = await supabase.storage.from('face-photos').download(`settings/${fileName}`);
      if (!error && data) {
        const parsed = JSON.parse(await data.text());
        setSettingsCache(fileName, parsed, 45000);
        return parsed;
      }
    } catch { }
  }

  const cached = _settingsStoreCache.get(fileName);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }
  const base = SUPABASE_URL.replace(/\/$/, '');
  // 1. Public Storage CDN URL WITHOUT cache-busting query string so Cloudflare Edge serves from RAM (0 Postgres storage.objects IOPS!)
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    const pubRes = await fetch(
      `${base}/storage/v1/object/public/face-photos/settings/${fileName}`,
      { signal: controller.signal }
    );
    clearTimeout(timer);
    if (pubRes.ok) {
      const parsed = await pubRes.json();
      if (parsed !== null && parsed !== undefined) {
        setSettingsCache(fileName, parsed, 45000);
        return parsed;
      }
    }
  } catch { }

  // 2. Stale cache fallback before hitting Storage API if CDN timed out
  if (cached?.data !== undefined) {
    return cached.data;
  }

  // 3. Fallback to service-role download only if public CDN missed completely
  try {
    const { data, error } = await supabase.storage.from('face-photos').download(`settings/${fileName}`);
    if (!error && data) {
      const parsed = JSON.parse(await data.text());
      setSettingsCache(fileName, parsed, 45000);
      return parsed;
    }
  } catch { }

  return fallbackValue;
}

/**
 * Purges deleted or replaced Storage blobs (`face-photos/documents/<folder>/<docKey>_*`)
 * and orphaned `documents` SQL table rows so removed/edited files never reappear.
 */
async function cleanupDocKeyArtifacts(emp, docKeyToClean, keepUrls = []) {
  if (!emp || !docKeyToClean) return;
  const keepSet = new Set(
    (Array.isArray(keepUrls) ? keepUrls : [])
      .filter((u) => typeof u === 'string' && u.startsWith('http'))
      .map((u) => u.split('?')[0].trim())
  );

  // 1. Clean Supabase Storage folder(s) for this employee + docKey
  try {
    const folders = Array.from(
      new Set(
        [emp.id, emp.employee_id]
          .filter(Boolean)
          .map((v) => String(v).replace(/[^a-zA-Z0-9_-]/g, '_'))
      )
    );
    const escapedKey = String(docKeyToClean).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const prefixRe = new RegExp(`^${escapedKey}_`, 'i');

    for (const folder of folders) {
      const { data: listed } = await supabase.storage
        .from('face-photos')
        .list(`documents/${folder}`, { limit: 200 });
      if (!Array.isArray(listed) || listed.length === 0) continue;

      const pathsToRemove = [];
      for (const obj of listed) {
        if (!obj?.name || !prefixRe.test(obj.name)) continue;
        const { data: pub } = supabase.storage
          .from('face-photos')
          .getPublicUrl(`documents/${folder}/${obj.name}`);
        const pubClean = (pub?.publicUrl || '').split('?')[0].trim();
        if (!pubClean || !keepSet.has(pubClean)) {
          pathsToRemove.push(`documents/${folder}/${obj.name}`);
        }
      }
      if (pathsToRemove.length > 0) {
        await supabase.storage.from('face-photos').remove(pathsToRemove);
      }
    }
  } catch (storageCleanErr) {
    console.warn('cleanupDocKeyArtifacts storage notice:', storageCleanErr?.message || storageCleanErr);
  }

  // 2. Clean orphaned rows in the `documents` SQL table for this employee + docKey
  if (emp.id) {
    try {
      const { data: rows } = await supabase
        .from('documents')
        .select('id, file_name, file_path')
        .eq('employee_id', emp.id);
      if (Array.isArray(rows) && rows.length > 0) {
        const keyLower = String(docKeyToClean).toLowerCase();
        const idsToDelete = rows
          .filter((r) => {
            const fp = String(r.file_path || '').split('?')[0].trim();
            const fn = String(r.file_name || '').toLowerCase();
            const matchesKey =
              fp.toLowerCase().includes(`/${keyLower}_`) ||
              fn === keyLower ||
              fn === `${keyLower}.pdf` ||
              fn.includes(`submitted_${keyLower}_`);
            if (!matchesKey) return false;
            return !fp || !keepSet.has(fp);
          })
          .map((r) => r.id)
          .filter(Boolean);
        if (idsToDelete.length > 0) {
          await supabase.from('documents').delete().in('id', idsToDelete);
        }
      }
    } catch (sqlCleanErr) {
      console.warn('cleanupDocKeyArtifacts SQL notice:', sqlCleanErr?.message || sqlCleanErr);
    }
  }
}

async function mirrorTraineeDocsToStore(emp, docs, documentsPassed, documentsStatus) {
  if (!emp || (!emp.id && !emp.employee_id)) return;
  try {
    let existingMap = {};
    try {
      const { data: dlBlob, error: dlErr } = await supabase.storage
        .from('face-photos')
        .download('settings/trainee_documents_store.json');
      if (!dlErr && dlBlob) {
        const parsed = JSON.parse(await dlBlob.text());
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          existingMap = parsed;
        }
      }
    } catch { }

    const key = String(emp.id || emp.employee_id);
    const cleanDocs = sanitizeDocuments(docs || {});
    existingMap[key] = {
      id: emp.id || key,
      employeeId: emp.employee_id || emp.employeeId || '',
      email: emp.email || '',
      name: emp.name || '',
      documents: cleanDocs,
      documentsPassed: Boolean(documentsPassed),
      documentsStatus: documentsStatus || 'pending',
      updatedAt: new Date().toISOString(),
    };

    setSettingsCache('trainee_documents_store.json', existingMap, 60000);
    const buf = Buffer.from(JSON.stringify(existingMap), 'utf8');
    await supabase.storage.from('face-photos').upload('settings/trainee_documents_store.json', buf, {
      contentType: 'application/json',
      cacheControl: '60',
      upsert: true,
    });
  } catch (e) {
    console.warn('mirrorTraineeDocsToStore notice:', e?.message || e);
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    return res.end();
  }

  try {
    const query = parseQuery(req);

    // GET: Query documents & document pass status OR generate signed upload URL
    if (req.method === 'GET') {
      const action = query.action;

      // Action: Consolidated single-request bootstrap of all zero-DB JSON stores
      if (action === 'get-bootstrap-stores') {
        res.setHeader('Cache-Control', 'public, s-maxage=15, stale-while-revalidate=45');
        const [traineeDocuments, requirements, monitoringReports, evaluations, announcements, dttr, academicSettings] = await Promise.all([
          readSettingsJsonFast('trainee_documents_store.json', {}),
          readSettingsJsonFast('requirements_store.json', []),
          readSettingsJsonFast('monitoring_reports_store.json', []),
          readSettingsJsonFast('evaluations_store.json', []),
          readSettingsJsonFast('announcements_store.json', []),
          readSettingsJsonFast('dttr_store.json', { monthlyDttrs: [], timeRecords: [] }),
          readSettingsJsonFast('academic_settings_store.json', null),
        ]);
        return sendJson(res, 200, {
          traineeDocuments: traineeDocuments && typeof traineeDocuments === 'object' && !Array.isArray(traineeDocuments) ? traineeDocuments : {},
          requirements: Array.isArray(requirements) ? requirements : [],
          monitoringReports: Array.isArray(monitoringReports) ? monitoringReports : [],
          evaluations: Array.isArray(evaluations) ? evaluations : [],
          announcements: Array.isArray(announcements) ? announcements : [],
          dttr: dttr && typeof dttr === 'object' ? dttr : { monthlyDttrs: [], timeRecords: [] },
          academicSettings: academicSettings && typeof academicSettings === 'object' && !Array.isArray(academicSettings) ? academicSettings : null,
        });
      }

      // Action: Retrieve Academic Year configuration & per-AY Required OJT Hours (zero-DB CDN store; supports ?fresh=1)
      if (action === 'get-academic-settings') {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
        const parsed = await readSettingsJsonFast('academic_settings_store.json', null, query.fresh === '1');
        return sendJson(res, 200, parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {});
      }

      // Action: Retrieve institutional and departmental required documents
      if (action === 'get-requirements') {
        const parsed = await readSettingsJsonFast('requirements_store.json', []);
        return sendJson(res, 200, Array.isArray(parsed) ? parsed : []);
      }

      // Action: Retrieve all trainee submitted OJT documents (zero-DB public CDN store; supports ?fresh=1 post-mutation)
      if (action === 'get-all-trainee-documents') {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
        const parsed = await readSettingsJsonFast('trainee_documents_store.json', {}, query.fresh === '1');
        return sendJson(res, 200, parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {});
      }

      // Action: Retrieve Monitoring Reports (Mid-Term, End-Term, Monthly) and Trainee File Submissions (supports ?fresh=1)
      if (action === 'get-monitoring-reports') {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
        const parsed = await readSettingsJsonFast('monitoring_reports_store.json', [], query.fresh === '1');
        return sendJson(res, 200, Array.isArray(parsed) ? parsed : []);
      }

      // Action: Retrieve OJT Evaluations & Trainee Questionnaires
      if (action === 'get-evaluations') {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
        const parsed = await readSettingsJsonFast('evaluations_store.json', []);
        return sendJson(res, 200, Array.isArray(parsed) ? parsed : []);
      }

      // Action: Retrieve DTTR (Monthly DTTR Tasks + Attendance Time Records)
      if (action === 'get-dttr') {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
        const parsed = await readSettingsJsonFast('dttr_store.json', { monthlyDttrs: [], timeRecords: [] });
        return sendJson(
          res,
          200,
          parsed && typeof parsed === 'object' ? parsed : { monthlyDttrs: [], timeRecords: [] }
        );
      }

      // Action: Retrieve Announcements Store
      if (action === 'get-announcements') {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
        const parsed = await readSettingsJsonFast('announcements_store.json', []);
        return sendJson(res, 200, Array.isArray(parsed) ? parsed : []);
      }

      if (action === 'get-upload-url') {
        const storagePath = query.path;
        if (!storagePath) {
          return sendJson(res, 400, { error: 'Missing path parameter' });
        }
        const bucket = query.bucket || 'face-photos';
        const { data: signData, error: signErr } = await supabase.storage.from(bucket).createSignedUploadUrl(storagePath);
        if (signErr) {
          return sendJson(res, 500, { error: signErr.message });
        }
        const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(storagePath);
        return sendJson(res, 200, {
          success: true,
          signedUrl: signData.signedUrl,
          token: signData.token,
          path: signData.path,
          publicUrl: urlData?.publicUrl,
        });
      }

      // Action: Stream / proxy file content for viewing & downloading
      if (action === 'view') {
        let storagePath = query.path;
        let bucket = query.bucket || 'face-photos';
        const rawUrl = query.url;
        if (rawUrl) {
          try {
            const decoded = decodeURIComponent(rawUrl);
            const match = decoded.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+?)(?:\?|$)/);
            if (match) {
              bucket = match[1];
              storagePath = match[2];
            } else {
              storagePath = decoded;
            }
          } catch {
            storagePath = rawUrl;
          }
        }
        if (!storagePath) {
          return sendJson(res, 400, { error: 'Missing path or url parameter' });
        }

        storagePath = storagePath.replace(/^\/+/, '');

        const bucketsToTry = [bucket, bucket === 'face-photos' ? 'documents' : 'face-photos', 'submission-photos', 'task-submissions'];
        let fileBlob = null;
        for (const b of bucketsToTry) {
          try {
            const { data, error } = await supabase.storage.from(b).download(storagePath);
            if (!error && data) {
              fileBlob = data;
              break;
            }
          } catch { }
        }

        if (!fileBlob) {
          try {
            const { data: signData } = await supabase.storage.from(bucket).createSignedUrl(storagePath, 3600);
            if (signData?.signedUrl) {
              res.statusCode = 302;
              res.setHeader('Location', signData.signedUrl);
              return res.end();
            }
          } catch { }
          return sendJson(res, 404, { error: 'Document file not found in storage' });
        }

        const arrayBuffer = await fileBlob.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Guard against corrupted error responses saved as files
        if (buffer.length < 150 && buffer.toString('utf8').includes('statusCode') && buffer.toString('utf8').includes('Bucket not found')) {
          return sendJson(res, 404, { error: 'Stored document was a server error record' });
        }

        let contentType = fileBlob.type || 'application/octet-stream';
        const ext = storagePath.split('.').pop()?.toLowerCase();
        if (ext === 'png') contentType = 'image/png';
        else if (ext === 'jpg' || ext === 'jpeg') contentType = 'image/jpeg';
        else if (ext === 'webp') contentType = 'image/webp';
        else if (ext === 'pdf') contentType = 'application/pdf';
        else if (ext === 'docx') contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        else if (ext === 'doc') contentType = 'application/msword';

        res.statusCode = 200;
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Length', buffer.length);
        res.setHeader('Cache-Control', 'public, max-age=86400');
        res.setHeader('Content-Disposition', 'inline');
        return res.end(buffer);
      }

      // Action: Generate signed download URL
      if (action === 'get-download-url') {
        let storagePath = query.path;
        let bucket = query.bucket || 'face-photos';
        if (query.url) {
          try {
            const decoded = decodeURIComponent(query.url);
            const match = decoded.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+?)(?:\?|$)/);
            if (match) {
              bucket = match[1];
              storagePath = match[2];
            } else {
              storagePath = decoded;
            }
          } catch { }
        }
        if (!storagePath) {
          return sendJson(res, 400, { error: 'Missing path or url parameter' });
        }
        storagePath = storagePath.replace(/^\/+/, '');
        const { data: signData, error: signErr } = await supabase.storage.from(bucket).createSignedUrl(storagePath, 3600 * 24);
        if (signErr) {
          return sendJson(res, 500, { error: signErr.message });
        }
        return sendJson(res, 200, { success: true, signedUrl: signData.signedUrl });
      }

      const empId = query.employeeId || query.id || query.employee_id;
      if (!empId) {
        return sendJson(res, 400, { error: 'Missing employeeId query parameter' });
      }

      let empQuery = supabase.from('employees').select('id, employee_id, name, registration_location').limit(1);
      if (isUuid(empId)) {
        empQuery = empQuery.eq('id', empId);
      } else {
        empQuery = empQuery.eq('employee_id', String(empId).trim());
      }
      const { data: empData, error: empErr } = await empQuery.maybeSingle();
      if (empErr) {
        return sendJson(res, 500, { error: empErr.message });
      }

      let docRows = [];
      if (empData?.id) {
        const { data: rows } = await supabase.from('documents').select('*').eq('employee_id', empData.id);
        docRows = rows || [];
      }

      const regLoc = empData?.registration_location || {};
      let regDocs = { ...(regLoc.documents || {}) };
      let resolvedPassed = Boolean(regLoc.documentsPassed);
      let resolvedStatus = regLoc.documentsStatus || 'pending';

      // Authoritative sync with trainee_documents_store.json (respects deletions & edits without resurrecting old files!)
      try {
        const storeMap = await readSettingsJsonFast('trainee_documents_store.json', {}, query.fresh === '1');
        const storeEntry =
          (empData?.id && storeMap[empData.id]) ||
          (empData?.employee_id && storeMap[empData.employee_id]) ||
          storeMap[String(empId)] ||
          Object.values(storeMap).find(
            (e) =>
              e &&
              typeof e === 'object' &&
              (e.id === empData?.id ||
                (empData?.employee_id && String(e.employeeId || '').toLowerCase() === String(empData.employee_id).toLowerCase()))
          );
        if (storeEntry && typeof storeEntry.documents === 'object') {
          const storeTs = storeEntry.updatedAt ? new Date(storeEntry.updatedAt).getTime() : 0;
          const regTs = regLoc.documentsUpdatedAt ? new Date(regLoc.documentsUpdatedAt).getTime() : 0;
          if (!regTs || storeTs >= regTs) {
            regDocs = { ...(storeEntry.documents || {}) };
            if (storeEntry.documentsPassed !== undefined) resolvedPassed = Boolean(storeEntry.documentsPassed);
            if (storeEntry.documentsStatus) resolvedStatus = storeEntry.documentsStatus;
          }
        }
      } catch { }

      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
      return sendJson(res, 200, {
        success: true,
        employee: empData,
        documents: regDocs,
        documentsPassed: resolvedPassed,
        documentsStatus: resolvedStatus,
        storedDocuments: docRows,
      });
    }

    // POST / PUT: Save document upload, update document pass status
    if (req.method === 'POST' || req.method === 'PUT') {
      const body = await parseBody(req);

      // Support server-side save of Academic Years, Active Academic Year, and per-AY Required OJT Hours
      if (body.action === 'save-academic-settings') {
        try {
          const existing = (await readSettingsJsonFast('academic_settings_store.json', {}, true)) || {};
          const mergedYears = Array.from(
            new Set([
              ...(Array.isArray(existing.academicYears) ? existing.academicYears : []),
              ...(Array.isArray(body.academicYears) ? body.academicYears : []),
              '2025-2026',
              '2026-2027',
            ].filter((y) => typeof y === 'string' && /^\d{4}-\d{4}$/.test(y.trim())).map((y) => y.trim()))
          );

          const cleanHours = {};
          const sourceHours = {
            ...(existing.academicYearHours && typeof existing.academicYearHours === 'object' ? existing.academicYearHours : {}),
            ...(body.academicYearHours && typeof body.academicYearHours === 'object' ? body.academicYearHours : {}),
          };
          for (const [yr, hrs] of Object.entries(sourceHours)) {
            const num = Math.round(Number(hrs));
            if (/^\d{4}-\d{4}$/.test(yr) && Number.isFinite(num) && num > 0) {
              cleanHours[yr] = num;
            }
          }
          for (const yr of mergedYears) {
            if (!cleanHours[yr]) cleanHours[yr] = 600;
          }

          const payload = {
            academicYears: mergedYears,
            activeAcademicYear: body.activeAcademicYear || existing.activeAcademicYear || '2026-2027',
            academicYearHours: cleanHours,
            updatedAt: new Date().toISOString(),
          };

          setSettingsCache('academic_settings_store.json', payload, 60000);
          const buffer = Buffer.from(JSON.stringify(payload), 'utf8');
          const { error: upErr } = await supabase.storage
            .from('face-photos')
            .upload('settings/academic_settings_store.json', buffer, {
              contentType: 'application/json',
              cacheControl: '60',
              upsert: true,
            });

          // If Instructor edited hours for a specific Academic Year, sync ONLY trainees in that Academic Year in 1 SQL query
          const syncYear = typeof body.syncAcademicYear === 'string' ? body.syncAcademicYear.trim() : '';
          const syncHours = Math.round(Number(body.syncHours));
          if (/^\d{4}-\d{4}$/.test(syncYear) && Number.isFinite(syncHours) && syncHours > 0) {
            try {
              await supabase
                .from('employees')
                .update({ required_hours: syncHours })
                .eq('academic_year', syncYear)
                .not('position', 'in', '("OJT Instructor","Administrator","HTE Representative","Training Supervisor")');
            } catch (empSyncErr) {
              console.warn('save-academic-settings employee hours sync notice:', empSyncErr?.message || empSyncErr);
            }
          }

          if (upErr) {
            return sendJson(res, 500, { error: upErr.message });
          }
          return sendJson(res, 200, { success: true, settings: payload });
        } catch (err) {
          return sendJson(res, 500, { error: err.message || 'Failed to save academic settings' });
        }
      }

      // Support server-side save of institutional/departmental requirements
      if (body.action === 'save-requirements') {
        try {
          const docs = body.docs || [];
          setSettingsCache('requirements_store.json', docs, 60000);
          const jsonStr = JSON.stringify(docs);
          const buffer = Buffer.from(jsonStr, 'utf8');
          const { error: upErr } = await supabase.storage.from('face-photos').upload('settings/requirements_store.json', buffer, {
            contentType: 'application/json',
            cacheControl: '60',
            upsert: true,
          });
          if (upErr) {
            return sendJson(res, 500, { error: upErr.message });
          }
          return sendJson(res, 200, { success: true, count: docs.length });
        } catch (err) {
          return sendJson(res, 500, { error: err.message || 'Failed to save requirements' });
        }
      }

      // Support server-side save of Monitoring Reports & Trainee File Submissions with strict per-trainee ownership isolation
      if (body.action === 'save-monitoring-reports') {
        try {
          const slimFile = (f) => {
            if (!f || typeof f !== 'object') return f;
            const fileUrl = typeof f.fileUrl === 'string' ? f.fileUrl : '';
            const dataUrl = typeof f.dataUrl === 'string' ? f.dataUrl : '';
            const httpUrl = fileUrl.startsWith('http') ? fileUrl : dataUrl.startsWith('http') ? dataUrl : '';
            return {
              ...f,
              fileUrl: httpUrl || fileUrl || dataUrl,
              dataUrl: httpUrl || dataUrl,
            };
          };

          const hasValidSubmissionContent = (s) =>
            Boolean(
              s &&
              typeof s === 'object' &&
              ((Array.isArray(s.files) && s.files.length > 0) || (typeof s.notes === 'string' && s.notes.trim().length > 0))
            );

          const slimReport = (r) => ({
            ...r,
            instructorFiles: Array.isArray(r.instructorFiles) ? r.instructorFiles.map(slimFile) : r.instructorFiles,
            traineeFiles: Array.isArray(r.traineeFiles) ? r.traineeFiles.map(slimFile) : r.traineeFiles,
            submissions: Array.isArray(r.submissions)
              ? r.submissions
                  .filter(hasValidSubmissionContent)
                  .map((s) => ({
                    ...s,
                    files: Array.isArray(s.files) ? s.files.map(slimFile) : [],
                  }))
              : r.submissions,
          });

          const extractStoragePathFromUrl = (url) => {
            if (typeof url !== 'string' || !url.startsWith('http')) return null;
            const match = url.match(/\/storage\/v1\/object\/(?:public|sign)\/face-photos\/(.+?)(?:\?|$)/);
            return match && match[1] ? decodeURIComponent(match[1]) : null;
          };

          const purgeRemovedStorageUrls = async (removedUrls, stillReferencedUrls = new Set()) => {
            const paths = Array.from(
              new Set(
                (Array.isArray(removedUrls) ? removedUrls : [])
                  .filter((u) => typeof u === 'string' && !stillReferencedUrls.has(u.split('?')[0]))
                  .map(extractStoragePathFromUrl)
                  .filter(Boolean)
              )
            );
            if (paths.length > 0) {
              try {
                await supabase.storage.from('face-photos').remove(paths);
              } catch (rmErr) {
                console.warn('save-monitoring-reports blob cleanup notice:', rmErr?.message || rmErr);
              }
            }
          };

          const existingRaw = await readSettingsJsonFast('monitoring_reports_store.json', [], true);
          const existingReports = Array.isArray(existingRaw) ? existingRaw.map(slimReport) : [];
          const nowIso = new Date().toISOString();

          const actorRole = body.actorRole;
          const reportId = body.reportId;
          let finalReports = existingReports;
          const urlsToPurge = Array.isArray(body.removedFileUrls) ? [...body.removedFileUrls] : [];

          if (actorRole === 'trainee' && reportId) {
            // STRICT PER-TRAINEE ISOLATION: A trainee can ONLY add/edit/delete their OWN submission(s) on reportId.
            // Other trainees' submissions on the same report are 100% preserved and can NEVER be deleted or overwritten by another trainee.
            const actorId = String(body.actorTraineeId || '').trim().toLowerCase();
            const actorStudentId = String(body.actorStudentId || '').trim().toLowerCase();
            if (!actorId && !actorStudentId) {
              return sendJson(res, 400, { error: 'Missing trainee identity for monitoring report submission' });
            }

            const isOwnedByActor = (s) => {
              if (!s || typeof s !== 'object') return false;
              const sTrainee = String(s.traineeId || '').trim().toLowerCase();
              const sStudent = String(s.studentId || '').trim().toLowerCase();
              if (actorId && (sTrainee === actorId || sStudent === actorId)) return true;
              if (actorStudentId && actorStudentId !== 'all' && actorStudentId !== 'trainee' && (sTrainee === actorStudentId || sStudent === actorStudentId)) {
                return true;
              }
              return false;
            };

            const incomingReports = Array.isArray(body.reports) ? body.reports : [];
            const incomingTarget = incomingReports.find((r) => r && r.id === reportId);
            const rawActorSubs = Array.isArray(body.traineeSubmissions)
              ? body.traineeSubmissions
              : Array.isArray(incomingTarget?.submissions)
                ? incomingTarget.submissions.filter(isOwnedByActor)
                : [];

            const sanitizedActorSubs = rawActorSubs
              .filter(isOwnedByActor)
              .filter(hasValidSubmissionContent)
              .map((s) => ({
                ...s,
                files: Array.isArray(s.files) ? s.files.map(slimFile) : [],
                updatedAt: nowIso,
              }));

            const keptActorUrls = new Set(
              sanitizedActorSubs.flatMap((s) => (s.files || []).flatMap((f) => [f?.fileUrl, f?.dataUrl])).filter(Boolean).map((u) => String(u).split('?')[0])
            );

            finalReports = existingReports.map((r) => {
              if (r.id !== reportId) return r;
              const prevSubs = Array.isArray(r.submissions) ? r.submissions : [];
              const otherTraineesSubs = prevSubs.filter((s) => !isOwnedByActor(s));
              const prevActorSubs = prevSubs.filter(isOwnedByActor);
              for (const ps of prevActorSubs) {
                for (const pf of ps.files || []) {
                  const u = (pf?.fileUrl || pf?.dataUrl || '').split('?')[0];
                  if (u && !keptActorUrls.has(u)) urlsToPurge.push(u);
                }
              }
              return slimReport({
                ...r,
                submissions: [...sanitizedActorSubs, ...otherTraineesSubs],
                updatedAt: nowIso,
              });
            });
          } else if (body.deleteReportId) {
            const delId = String(body.deleteReportId);
            const targetToDelete = existingReports.find((r) => r.id === delId);
            if (targetToDelete) {
              for (const f of targetToDelete.instructorFiles || []) {
                if (f?.fileUrl) urlsToPurge.push(f.fileUrl);
              }
              for (const s of targetToDelete.submissions || []) {
                for (const f of s.files || []) {
                  if (f?.fileUrl) urlsToPurge.push(f.fileUrl);
                }
              }
            }
            finalReports = existingReports.filter((r) => r.id !== delId);
          } else if (actorRole === 'instructor' && reportId) {
            // Atomic Instructor update on a single report (reviewing a submission or adding/removing instructorFiles)
            // Merges onto fresh cloud state so Instructor actions NEVER resurrect a submission deleted by a Trainee.
            const incomingReports = Array.isArray(body.reports) ? body.reports : [];
            const incomingTarget = incomingReports.find((r) => r && r.id === reportId);
            finalReports = existingReports.map((r) => {
              if (r.id !== reportId) return r;
              let nextSubs = Array.isArray(r.submissions) ? [...r.submissions] : [];
              if (body.reviewSubmission && body.reviewSubmission.submissionId) {
                const rev = body.reviewSubmission;
                nextSubs = nextSubs.map((s) =>
                  s.id === rev.submissionId
                    ? {
                        ...s,
                        status: rev.status || 'reviewed',
                        instructorRemarks: rev.instructorRemarks !== undefined ? rev.instructorRemarks : s.instructorRemarks,
                        reviewedAt: rev.reviewedAt || nowIso,
                        updatedAt: nowIso,
                      }
                    : s
                );
              }
              let nextInstFiles = r.instructorFiles;
              if (Array.isArray(body.instructorFiles)) {
                const keptInst = new Set(body.instructorFiles.map((f) => String(f?.fileUrl || f?.dataUrl || '').split('?')[0]).filter(Boolean));
                for (const oldF of r.instructorFiles || []) {
                  const u = String(oldF?.fileUrl || oldF?.dataUrl || '').split('?')[0];
                  if (u && !keptInst.has(u)) urlsToPurge.push(u);
                }
                nextInstFiles = body.instructorFiles.map(slimFile);
              } else if (incomingTarget && Array.isArray(incomingTarget.instructorFiles)) {
                nextInstFiles = incomingTarget.instructorFiles.map(slimFile);
              }
              return slimReport({
                ...r,
                ...(incomingTarget
                  ? {
                      title: incomingTarget.title ?? r.title,
                      description: incomingTarget.description ?? r.description,
                      status: body.reviewSubmission ? 'reviewed' : (incomingTarget.status ?? r.status),
                      instructorRemarks: incomingTarget.instructorRemarks ?? r.instructorRemarks,
                    }
                  : {}),
                instructorFiles: nextInstFiles,
                submissions: nextSubs,
                updatedAt: nowIso,
              });
            });
          } else if (body.newReport && body.newReport.id) {
            const cleanNew = slimReport({ ...body.newReport, updatedAt: nowIso });
            finalReports = [cleanNew, ...existingReports.filter((r) => r.id !== cleanNew.id)];
          } else {
            // Fallback full-array save: preserve fresh server submissions for reports whose server updatedAt is newer
            const rawReports = Array.isArray(body.reports) ? body.reports.map(slimReport) : [];
            const existingMap = new Map(existingReports.map((r) => [r.id, r]));
            finalReports = rawReports.map((inc) => {
              const ex = existingMap.get(inc.id);
              if (!ex) return inc;
              const incTime = new Date(inc.updatedAt || inc.createdAt || 0).getTime();
              const exTime = new Date(ex.updatedAt || ex.createdAt || 0).getTime();
              return exTime > incTime ? ex : inc;
            });
          }

          const allActiveUrls = new Set(
            finalReports
              .flatMap((r) => [
                ...(r.instructorFiles || []).map((f) => f?.fileUrl || f?.dataUrl),
                ...(r.submissions || []).flatMap((s) => (s.files || []).map((f) => f?.fileUrl || f?.dataUrl)),
              ])
              .filter(Boolean)
              .map((u) => String(u).split('?')[0])
          );
          if (urlsToPurge.length > 0) {
            await purgeRemovedStorageUrls(urlsToPurge, allActiveUrls);
          }

          setSettingsCache('monitoring_reports_store.json', finalReports, 60000);
          const jsonStr = JSON.stringify(finalReports);
          const buffer = Buffer.from(jsonStr, 'utf8');
          const { error: upErr } = await supabase.storage.from('face-photos').upload('settings/monitoring_reports_store.json', buffer, {
            contentType: 'application/json',
            cacheControl: '0',
            upsert: true,
          });
          if (upErr) {
            return sendJson(res, 500, { error: upErr.message });
          }
          return sendJson(res, 200, { success: true, count: finalReports.length, reports: finalReports });
        } catch (err) {
          return sendJson(res, 500, { error: err.message || 'Failed to save monitoring reports' });
        }
      }

      // Support server-side save of OJT Evaluations & Trainee Questionnaires
      if (body.action === 'save-evaluations') {
        try {
          const evaluations = Array.isArray(body.evaluations) ? body.evaluations : [];
          setSettingsCache('evaluations_store.json', evaluations, 60000);
          const jsonStr = JSON.stringify(evaluations);
          const buffer = Buffer.from(jsonStr, 'utf8');
          const { error: upErr } = await supabase.storage.from('face-photos').upload('settings/evaluations_store.json', buffer, {
            contentType: 'application/json',
            cacheControl: '60',
            upsert: true,
          });
          if (upErr) {
            return sendJson(res, 500, { error: upErr.message });
          }
          return sendJson(res, 200, { success: true, count: evaluations.length });
        } catch (err) {
          return sendJson(res, 500, { error: err.message || 'Failed to save evaluations' });
        }
      }

      // Support server-side save of DTTR (Monthly DTTR Tasks + Attendance Time Records) with fast atomic delta merge
      if (body.action === 'save-dttr') {
        try {
          let existingStore = { monthlyDttrs: [], timeRecords: [] };
          try {
            const { data: dlBlob, error: dlErr } = await supabase.storage
              .from('face-photos')
              .download('settings/dttr_store.json');
            if (!dlErr && dlBlob) {
              const parsed = JSON.parse(await dlBlob.text());
              if (parsed && typeof parsed === 'object') existingStore = parsed;
            }
          } catch { }

          // Merge monthlyDttrs by canonical employeeId_year_month key so single-record task sends never clobber other trainees
          const dttrMap = new Map();
          const putDttr = (rec) => {
            if (!rec || !rec.employeeId) return;
            const key = `${String(rec.employeeId).toLowerCase()}_${Number(rec.year)}_${Number(rec.month)}`;
            const prev = dttrMap.get(key);
            if (!prev) {
              dttrMap.set(key, rec);
              return;
            }
            const rTime = new Date(rec.updatedAt || 0).getTime();
            const pTime = new Date(prev.updatedAt || 0).getTime();
            const newer = rTime >= pTime ? rec : prev;
            const older = rTime >= pTime ? prev : rec;
            const olderEntries = older.customEntries || {};
            const newerEntries = newer.customEntries || {};
            const mergedEntries = { ...olderEntries };
            for (const dayKey of Object.keys(newerEntries)) {
              const nDay = newerEntries[dayKey];
              const oDay = olderEntries[dayKey];
              if (!oDay) {
                mergedEntries[dayKey] = nDay;
              } else {
                const pickSlot = (nv, ov, bridge) => {
                  if (ov && ov !== bridge && (!nv || nv === bridge)) return ov;
                  return nv || ov || '';
                };
                mergedEntries[dayKey] = {
                  ...oDay,
                  ...nDay,
                  amArrival: pickSlot(nDay?.amArrival, oDay?.amArrival),
                  amDeparture: pickSlot(nDay?.amDeparture, oDay?.amDeparture, '12:00 PM'),
                  pmArrival: pickSlot(nDay?.pmArrival, oDay?.pmArrival, '1:00 PM'),
                  pmDeparture: pickSlot(nDay?.pmDeparture, oDay?.pmDeparture),
                  hours: Math.max(Number(nDay?.hours) || 0, Number(oDay?.hours) || 0),
                  tasks: (nDay?.tasks && String(nDay.tasks).trim()) || (oDay?.tasks && String(oDay.tasks).trim()) || '',
                };
              }
            }
            dttrMap.set(key, {
              ...older,
              ...newer,
              customEntries: mergedEntries,
            });
          };

          for (const r of Array.isArray(existingStore.monthlyDttrs) ? existingStore.monthlyDttrs : []) putDttr(r);
          for (const r of Array.isArray(body.monthlyDttrs) ? body.monthlyDttrs : []) putDttr(r);
          const monthlyDttrs = Array.from(dttrMap.values());

          // Merge timeRecords by employeeId_date key so single-day task sends merge cleanly in 1 roundtrip
          const recMap = new Map();
          const putRec = (r) => {
            if (!r || typeof r !== 'object') return;
            const empId = r.employeeId || r.employee_id;
            if (!empId || !r.date) return;
            const dateKey = String(r.date).split('T')[0].trim();
            const key = `${String(empId).toLowerCase()}_${dateKey}`;
            const prev = recMap.get(key);
            const pickSlot = (nv, ov, bridge) => {
              if (ov && ov !== bridge && (!nv || nv === bridge)) return ov;
              return nv || ov;
            };
            const rSafeOut = r.timeOut && r.timeOut !== (prev?.timeIn || r.timeIn) ? r.timeOut : undefined;
            const prevSafeOut = prev?.timeOut && prev.timeOut !== prev.timeIn ? prev.timeOut : undefined;
            recMap.set(
              key,
              prev
                ? {
                  ...prev,
                  ...r,
                  employeeId: empId,
                  timeIn: prev.timeIn || r.timeIn,
                  timeOut: rSafeOut || prevSafeOut,
                  amArrival: pickSlot(r.amArrival, prev.amArrival),
                  amDeparture: pickSlot(r.amDeparture, prev.amDeparture, '12:00:00'),
                  pmArrival: pickSlot(r.pmArrival, prev.pmArrival, '13:00:00'),
                  pmDeparture: pickSlot(r.pmDeparture, prev.pmDeparture),
                  totalHours: Math.max(Number(r.totalHours) || 0, Number(prev.totalHours) || 0),
                  notes: r.notes !== undefined ? r.notes : prev.notes,
                }
                : { ...r, employeeId: empId, timeOut: rSafeOut }
            );
          };

          for (const r of Array.isArray(existingStore.timeRecords) ? existingStore.timeRecords : []) putRec(r);
          for (const r of Array.isArray(body.timeRecords) ? body.timeRecords : []) putRec(r);

          // Sort newest-first before capping so recent attendance records are never sliced off
          const sortedTimeRecords = Array.from(recMap.values()).sort((a, b) =>
            String(b.date || '').localeCompare(String(a.date || ''))
          );

          // Strip inline base64 photos & cap to 400 recent non-dummy records so dttr_store.json stays < 60KB (prevents Storage 544 timeouts)
          const slimTimeRecords = sortedTimeRecords
            .filter((r) => !String(r?.id || '').startsWith('demo-') && !String(r?.employeeId || '').startsWith('demo-'))
            .slice(0, 400)
            .map((r) => {
              if (!r || typeof r !== 'object') return r;
              const copy = { ...r };
              if (typeof copy.timeInPhoto === 'string' && copy.timeInPhoto.startsWith('data:')) {
                delete copy.timeInPhoto;
              }
              if (typeof copy.timeOutPhoto === 'string' && copy.timeOutPhoto.startsWith('data:')) {
                delete copy.timeOutPhoto;
              }
              if (Number(copy.totalHours) > 16) {
                copy.totalHours = 8;
              }
              return copy;
            });

          const payload = {
            monthlyDttrs,
            timeRecords: slimTimeRecords,
            updatedAt: new Date().toISOString(),
          };
          setSettingsCache('dttr_store.json', payload, 60000);
          const jsonStr = JSON.stringify(payload);
          const buffer = Buffer.from(jsonStr, 'utf8');
          let { error: upErr } = await supabase.storage.from('face-photos').upload('settings/dttr_store.json', buffer, {
            contentType: 'application/json',
            cacheControl: '60',
            upsert: true,
          });
          if (upErr) {
            await new Promise((r) => setTimeout(r, 600));
            const retry = await supabase.storage.from('face-photos').upload('settings/dttr_store.json', buffer, {
              contentType: 'application/json',
              cacheControl: '60',
              upsert: true,
            });
            upErr = retry.error;
          }
          if (upErr) {
            console.warn('api/documents save-dttr storage transient notice:', upErr.message);
            return sendJson(res, 200, {
              success: true,
              deferred: true,
              warning: upErr.message,
              monthlyDttrsCount: monthlyDttrs.length,
              timeRecordsCount: slimTimeRecords.length,
            });
          }
          return sendJson(res, 200, {
            success: true,
            monthlyDttrsCount: monthlyDttrs.length,
            timeRecordsCount: slimTimeRecords.length,
          });
        } catch (err) {
          console.warn('api/documents save-dttr exception:', err?.message || err);
          return sendJson(res, 200, { success: true, deferred: true, warning: err?.message || 'Deferred DTTR sync' });
        }
      }

      // Support server-side save of Announcements Store
      if (body.action === 'save-announcements') {
        try {
          let existingList = [];
          try {
            const { data: signed } = await supabase.storage.from('face-photos').createSignedUrl('settings/announcements_store.json', 60);
            if (signed?.signedUrl) {
              const r = await fetch(`${signed.signedUrl}&t=${Date.now()}`, { cache: 'no-store' });
              if (r.ok) {
                const parsed = await r.json();
                if (Array.isArray(parsed)) existingList = parsed;
              }
            }
          } catch { }

          const incoming = Array.isArray(body.announcements) ? body.announcements : (body.announcement ? [body.announcement] : []);
          const merged = [...incoming];
          for (const item of existingList) {
            if (!merged.some((m) => m.id === item.id)) {
              merged.push(item);
            }
          }

          setSettingsCache('announcements_store.json', merged, 60000);
          const jsonStr = JSON.stringify(merged);
          const buffer = Buffer.from(jsonStr, 'utf8');
          const { error: upErr } = await supabase.storage.from('face-photos').upload('settings/announcements_store.json', buffer, {
            contentType: 'application/json',
            cacheControl: '60',
            upsert: true,
          });
          if (upErr) {
            return sendJson(res, 500, { error: upErr.message });
          }
          return sendJson(res, 200, {
            success: true,
            announcementsCount: merged.length,
          });
        } catch (err) {
          return sendJson(res, 500, { error: err.message || 'Failed to save announcements store' });
        }
      }

      // Support server-side direct storage upload via service role
      if (body.action === 'upload') {
        const { path, dataUrl, base64, contentType } = body;
        if (!path || (!dataUrl && !base64)) {
          return sendJson(res, 400, { error: 'Missing path or data' });
        }
        let rawBase64 = base64 || '';
        let mime = contentType || 'application/pdf';
        if (dataUrl && typeof dataUrl === 'string') {
          const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
          if (match) {
            mime = match[1];
            rawBase64 = match[2];
          } else {
            rawBase64 = dataUrl;
          }
        }
        const buffer = Buffer.from(rawBase64, 'base64');
        const bucket = body.bucket || 'face-photos';
        const { data: upData, error: upErr } = await supabase.storage.from(bucket).upload(path, buffer, {
          contentType: mime,
          upsert: true,
        });
        if (upErr) {
          return sendJson(res, 500, { error: upErr.message });
        }
        const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);
        return sendJson(res, 200, {
          success: true,
          publicUrl: urlData?.publicUrl,
          path: upData?.path,
        });
      }

      const empIdentifier = body.employeeId || body.id || body.employee_id || body.email;

      if (!empIdentifier) {
        return sendJson(res, 400, { error: 'Missing employeeId (UUID, student ID, or email)' });
      }

      // 1. Locate employee row
      let empQuery = supabase.from('employees').select('id, employee_id, email, name, registration_location').limit(1);
      if (isUuid(empIdentifier)) {
        empQuery = empQuery.eq('id', empIdentifier);
      } else if (String(empIdentifier).includes('@')) {
        empQuery = empQuery.eq('email', String(empIdentifier).trim().toLowerCase());
      } else {
        empQuery = empQuery.eq('employee_id', String(empIdentifier).trim());
      }

      const { data: emp, error: findErr } = await empQuery.maybeSingle();
      if (findErr) {
        return sendJson(res, 500, { error: findErr.message });
      }
      if (!emp) {
        return sendJson(res, 404, { error: `Employee not found for identifier: ${empIdentifier}` });
      }

      const curRegLoc = typeof emp.registration_location === 'object' && emp.registration_location !== null
        ? { ...emp.registration_location }
        : {};
      const currentDocs = { ...(curRegLoc.documents || {}) };

      // 2. Merge single document, full document list, or explicit removal / edit replacement
      const docKey = body.docKey;
      const documentItem = body.documentItem;
      const prevRemovedName = body.removeDocKey ? currentDocs[body.removeDocKey]?.name : null;

      const deleteKeyAndAliases = (targetObj, keyToRemove) => {
        if (!targetObj || !keyToRemove) return;
        delete targetObj[keyToRemove];
        if (keyToRemove === 'consent') delete targetObj.parent_consent;
        if (keyToRemove === 'moa') {
          delete targetObj.memorandum;
          delete targetObj.endorsement;
        }
        if (keyToRemove === 'medical') delete targetObj.clearance;
        const lower = String(keyToRemove).toLowerCase();
        for (const k of Object.keys(targetObj)) {
          if (k.toLowerCase() === lower) {
            delete targetObj[k];
          }
        }
      };

      if (body.submittedDocuments && typeof body.submittedDocuments === 'object') {
        if (body.replaceSubmittedDocuments || body.removeDocKey || body.isEdit) {
          // Authoritative replacement so deleted documents and removed sub-files are cleanly removed
          for (const k of Object.keys(currentDocs)) {
            delete currentDocs[k];
          }
          Object.assign(currentDocs, body.submittedDocuments);
        } else {
          Object.assign(currentDocs, body.submittedDocuments);
        }
      }

      if (body.removeDocKey) {
        deleteKeyAndAliases(currentDocs, body.removeDocKey);
      }

      if (docKey && documentItem && typeof documentItem === 'object') {
        currentDocs[docKey] = {
          ...(body.isEdit ? {} : (currentDocs[docKey] || {})),
          ...documentItem,
        };
      }

      // 3. Determine pass status
      const docKeys = [
        'internshipAgreement', 'moa', 'consent', 'trainingPlan', 'pledgeOfConduct',
        'medical', 'application', 'resume', 'enrolmentForm', 'endorsement'
      ];
      const allPassed = body.allPassed !== undefined
        ? Boolean(body.allPassed)
        : (docKeys.length > 0 && docKeys.every((k) => currentDocs[k]?.status === 'passed'));

      const hasAnyUploaded = Object.values(currentDocs).some(
        (d) => d && typeof d === 'object' && (d.fileUrl || d.dataUrl || d.name)
      );
      const finalStatus = body.documentsStatus !== undefined
        ? body.documentsStatus
        : allPassed
          ? 'passed'
          : docKeys.some((k) => currentDocs[k]?.status === 'passed')
            ? 'partial'
            : hasAnyUploaded
              ? 'submitted'
              : 'pending';

      const sanitizedDocs = sanitizeDocuments(currentDocs);
      const updatedRegLoc = {
        ...curRegLoc,
        documents: sanitizedDocs,
        documentsPassed: allPassed,
        documentsStatus: finalStatus,
        documentsUpdatedAt: new Date().toISOString(),
      };

      // Always mirror to zero-DB trainee_documents_store.json so Instructor immediately sees uploaded/edited/deleted files
      await mirrorTraineeDocsToStore(emp, sanitizedDocs, allPassed, finalStatus);

      // 4. Update employee registration_location in database
      const { error: updateErr } = await supabase
        .from('employees')
        .update({ registration_location: updatedRegLoc })
        .eq('id', emp.id);

      if (updateErr) {
        console.warn('Notice updating employee registration_location (mirrored to store):', updateErr.message);
      }

      // 5. Purge deleted or replaced Storage blobs + orphaned `documents` SQL rows so removed files never reappear
      if (body.removeDocKey) {
        await cleanupDocKeyArtifacts(emp, body.removeDocKey, []);
        if (prevRemovedName && emp.id) {
          try {
            await supabase.from('documents').delete().eq('employee_id', emp.id).eq('file_name', prevRemovedName);
          } catch {}
        }
      } else if (docKey && sanitizedDocs[docKey]) {
        const activeDoc = sanitizedDocs[docKey];
        const keptUrls = [
          activeDoc.fileUrl,
          activeDoc.dataUrl,
          ...(Array.isArray(activeDoc.files) ? activeDoc.files.flatMap((f) => [f?.fileUrl, f?.dataUrl]) : []),
        ].filter((u) => typeof u === 'string' && u.startsWith('http'));
        if (body.isEdit || body.replaceSubmittedDocuments) {
          await cleanupDocKeyArtifacts(emp, docKey, keptUrls);
        }
      }

      const syncItems = [];
      if (!body.removeDocKey && docKey && documentItem) {
        syncItems.push({ key: docKey, item: documentItem });
      } else if (!body.removeDocKey && body.submittedDocuments) {
        for (const [k, v] of Object.entries(body.submittedDocuments)) {
          if (v && typeof v === 'object') syncItems.push({ key: k, item: v });
        }
      }

      if (syncItems.length > 0 && emp.id) {
        await Promise.allSettled(
          syncItems.map(async ({ key, item }) => {
            const rawPath = item.fileUrl || item.dataUrl || '';
            const filePath =
              typeof rawPath === 'string' && (rawPath.startsWith('http://') || rawPath.startsWith('https://'))
                ? rawPath
                : '';
            const fileName = item.name || `${key}.pdf`;
            if (!filePath) return;
            await supabase.from('documents').delete().eq('employee_id', emp.id).eq('file_name', fileName);
            await supabase.from('documents').insert({
              employee_id: emp.id,
              file_name: fileName,
              file_path: filePath,
              file_type: item.fileType || 'application/pdf',
              file_size: item.size || 0,
              created_at: item.uploadedAt || new Date().toISOString(),
            });
          })
        );
      }

      return sendJson(res, 200, {
        success: true,
        employeeId: emp.employee_id,
        documentsPassed: allPassed,
        documentsStatus: finalStatus,
        documents: currentDocs,
      });
    }

    return sendJson(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    console.error('api/documents handler exception:', err);
    return sendJson(res, 500, { error: err.message || 'Internal server error' });
  }
}
