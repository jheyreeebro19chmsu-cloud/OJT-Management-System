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

async function readSettingsJsonFast(fileName, fallbackValue) {
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
    } catch {}

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

      // Action: Consolidated single-request bootstrap of all 6 zero-DB JSON stores (cuts 6 requests -> 1!)
      if (action === 'get-bootstrap-stores') {
        res.setHeader('Cache-Control', 'public, s-maxage=15, stale-while-revalidate=45');
        const [traineeDocuments, requirements, monitoringReports, evaluations, announcements, dttr] = await Promise.all([
          readSettingsJsonFast('trainee_documents_store.json', {}),
          readSettingsJsonFast('requirements_store.json', []),
          readSettingsJsonFast('monitoring_reports_store.json', []),
          readSettingsJsonFast('evaluations_store.json', []),
          readSettingsJsonFast('announcements_store.json', []),
          readSettingsJsonFast('dttr_store.json', { monthlyDttrs: [], timeRecords: [] }),
        ]);
        return sendJson(res, 200, {
          traineeDocuments: traineeDocuments && typeof traineeDocuments === 'object' && !Array.isArray(traineeDocuments) ? traineeDocuments : {},
          requirements: Array.isArray(requirements) ? requirements : [],
          monitoringReports: Array.isArray(monitoringReports) ? monitoringReports : [],
          evaluations: Array.isArray(evaluations) ? evaluations : [],
          announcements: Array.isArray(announcements) ? announcements : [],
          dttr: dttr && typeof dttr === 'object' ? dttr : { monthlyDttrs: [], timeRecords: [] },
        });
      }

      // Action: Retrieve institutional and departmental required documents
      if (action === 'get-requirements') {
        const parsed = await readSettingsJsonFast('requirements_store.json', []);
        return sendJson(res, 200, Array.isArray(parsed) ? parsed : []);
      }

      // Action: Retrieve all trainee submitted OJT documents (zero-DB public CDN store)
      if (action === 'get-all-trainee-documents') {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
        const parsed = await readSettingsJsonFast('trainee_documents_store.json', {});
        return sendJson(res, 200, parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {});
      }

      // Action: Retrieve Monitoring Reports (Mid-Term, End-Term, Monthly) and Trainee File Submissions
      if (action === 'get-monitoring-reports') {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
        const parsed = await readSettingsJsonFast('monitoring_reports_store.json', []);
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
      const regDocs = { ...(regLoc.documents || {}) };

      // Merge zero-DB trainee_documents_store.json entries so uploads saved during DB contention are always returned
      try {
        const storeMap = await readSettingsJsonFast('trainee_documents_store.json', {});
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
        if (storeEntry?.documents && typeof storeEntry.documents === 'object') {
          for (const [sKey, sVal] of Object.entries(storeEntry.documents)) {
            if (!sVal || typeof sVal !== 'object') continue;
            const prev = regDocs[sKey];
            const sFiles = Array.isArray(sVal.files) ? sVal.files : [];
            const pFiles = Array.isArray(prev?.files) ? prev.files : [];
            if (!prev || sFiles.length >= pFiles.length) {
              regDocs[sKey] = {
                ...(prev || {}),
                ...sVal,
                files: sFiles.length > 0 ? sFiles : pFiles.length > 0 ? pFiles : undefined,
                status: prev?.status === 'passed' || sVal.status === 'passed' ? 'passed' : sVal.status || prev?.status || 'submitted',
              };
            }
          }
        }
      } catch {}

      // Ensure any document recorded in the documents table is present in the documents object
      for (const row of docRows) {
        const matchKey = Object.keys(regDocs).find((k) => regDocs[k]?.name === row.file_name);
        if (!matchKey && row.file_name) {
          const standardKey = [
            'internshipAgreement', 'moa', 'consent', 'trainingPlan', 'pledgeOfConduct',
            'medical', 'application', 'resume', 'enrolmentForm', 'endorsement'
          ].find((k) => row.file_name.toLowerCase().includes(k.toLowerCase()));
          if (standardKey && !regDocs[standardKey]) {
            regDocs[standardKey] = {
              name: row.file_name,
              fileUrl: row.file_path,
              dataUrl: row.file_path,
              fileType: row.file_type || 'application/pdf',
              size: row.file_size || 0,
              uploadedAt: row.created_at,
              status: 'submitted',
            };
          }
        }
      }

      // Recover orphaned or multi-file uploads directly from Supabase Storage folder `documents/${empId}`
      const standardRecoveryKeys = [
        'internshipAgreement', 'moa', 'consent', 'trainingPlan', 'pledgeOfConduct',
        'medical', 'application', 'resume', 'enrolmentForm', 'endorsement'
      ];
      const hasMissingStandardKey = standardRecoveryKeys.some((k) => !regDocs[k]);
      const needsMultiFileRecovery = Object.entries(regDocs).some(([_, d]) => {
        if (!d || typeof d !== 'object') return false;
        const hasMultipleInName = typeof d.name === 'string' && /^\d+\s+Files\b/i.test(d.name);
        return hasMultipleInName && (!Array.isArray(d.files) || d.files.length <= 1);
      });

      if ((hasMissingStandardKey || needsMultiFileRecovery) && empData) {
        try {
          const folderCandidates = Array.from(
            new Set(
              [empData.id, empData.employee_id]
                .filter(Boolean)
                .map((v) => String(v).replace(/[^a-zA-Z0-9_-]/g, '_'))
            )
          );
          const allStorageItems = [];
          for (const folder of folderCandidates) {
            const { data: listed } = await supabase.storage
              .from('face-photos')
              .list(`documents/${folder}`, { limit: 200, sortBy: { column: 'name', order: 'desc' } });
            if (Array.isArray(listed)) {
              for (const obj of listed) {
                if (obj?.name) {
                  allStorageItems.push({ folder, obj });
                }
              }
            }
          }

          // 1. Recover completely orphaned requirement files from Storage when DB metadata missed a write
          let healedOrphans = false;
          for (const stdKey of standardRecoveryKeys) {
            if (regDocs[stdKey]) continue;
            const prefixRe = new RegExp(`^${stdKey}_`, 'i');
            const matches = allStorageItems
              .filter(({ obj }) => prefixRe.test(obj.name))
              .sort((a, b) => new Date(a.obj.created_at || 0).getTime() - new Date(b.obj.created_at || 0).getTime());
            if (matches.length > 0) {
              const recoveredFiles = matches.map(({ folder, obj }, idx) => {
                const { data: pub } = supabase.storage
                  .from('face-photos')
                  .getPublicUrl(`documents/${folder}/${obj.name}`);
                const ext = (obj.name.split('.').pop() || 'pdf').toLowerCase();
                const mime =
                  obj.metadata?.mimetype ||
                  (['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'].includes(ext)
                    ? `image/${ext === 'jpg' ? 'jpeg' : ext}`
                    : ext === 'pdf'
                      ? 'application/pdf'
                      : ext === 'docx'
                        ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                        : 'application/octet-stream');
                return {
                  id: `recovered-${stdKey}-${idx}`,
                  name: `Submitted_${stdKey}_${idx + 1}.${ext}`,
                  size: obj.metadata?.size || 0,
                  fileType: mime,
                  uploadedAt: obj.created_at || new Date().toISOString(),
                  fileUrl: pub?.publicUrl || '',
                  dataUrl: pub?.publicUrl || '',
                };
              });
              const primary = recoveredFiles[0];
              const totalBytes = recoveredFiles.reduce((s, f) => s + (Number(f.size) || 0), 0);
              regDocs[stdKey] = {
                name: recoveredFiles.length > 1 ? `${recoveredFiles.length} Files (${primary.name})` : primary.name,
                size: totalBytes,
                fileType: primary.fileType,
                uploadedAt: recoveredFiles[recoveredFiles.length - 1].uploadedAt,
                status: 'submitted',
                source: 'portal',
                fileUrl: primary.fileUrl,
                dataUrl: primary.dataUrl,
                files: recoveredFiles,
              };
              healedOrphans = true;
            }
          }
          if (healedOrphans) {
            void mirrorTraineeDocsToStore(empData, regDocs, Boolean(regLoc.documentsPassed), regLoc.documentsStatus || 'submitted');
          }

          for (const [docKey, docVal] of Object.entries(regDocs)) {
            if (!docVal || typeof docVal !== 'object') continue;
            const m = typeof docVal.name === 'string' ? docVal.name.match(/^(\d+)\s+Files\s*\((.+)\)$/i) : null;
            if (!m || (Array.isArray(docVal.files) && docVal.files.length > 1)) continue;
            const expectedCount = parseInt(m[1], 10) || 0;
            const firstOriginalName = m[2] || '';
            if (expectedCount <= 1) continue;

            // Match files named `${docKey}_${idx}_${ts1}_${ts2}.${ext}`
            const escapedKey = docKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const idxRe = new RegExp(`^${escapedKey}_(\\d+)_(\\d+)`, 'i');
            const byIndex = new Map();
            for (const { folder, obj } of allStorageItems) {
              const hit = obj.name.match(idxRe);
              if (!hit) continue;
              const idx = parseInt(hit[1], 10);
              const ts = parseInt(hit[2], 10) || 0;
              const prev = byIndex.get(idx);
              if (!prev || ts > prev.ts) {
                const { data: pub } = supabase.storage
                  .from('face-photos')
                  .getPublicUrl(`documents/${folder}/${obj.name}`);
                byIndex.set(idx, {
                  idx,
                  ts,
                  storageName: obj.name,
                  size: obj.metadata?.size || 0,
                  mimetype: obj.metadata?.mimetype || '',
                  publicUrl: pub?.publicUrl || '',
                });
              }
            }

            if (byIndex.size > 1) {
              const sorted = Array.from(byIndex.values())
                .sort((a, b) => a.idx - b.idx)
                .slice(0, expectedCount);
              regDocs[docKey] = {
                ...docVal,
                files: sorted.map((entry, i) => {
                  const ext = (entry.storageName.split('.').pop() || 'pdf').toLowerCase();
                  const inferredMime =
                    entry.mimetype ||
                    (['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'].includes(ext)
                      ? `image/${ext === 'jpg' ? 'jpeg' : ext}`
                      : ext === 'pdf'
                        ? 'application/pdf'
                        : ext === 'docx'
                          ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                          : 'application/octet-stream');
                  const displayFileName =
                    i === 0 && firstOriginalName
                      ? firstOriginalName
                      : `Attachment_${i + 1}.${ext}`;
                  return {
                    id: `recovered-${docKey}-${i}`,
                    name: displayFileName,
                    size: entry.size || Math.round((Number(docVal.size) || 0) / sorted.length),
                    fileType: inferredMime,
                    uploadedAt: docVal.uploadedAt || new Date().toISOString(),
                    fileUrl: entry.publicUrl,
                    dataUrl: entry.publicUrl,
                  };
                }),
              };
            }
          }
        } catch (recErr) {
          console.warn('Multi-file storage recovery notice:', recErr);
        }
      }

      return sendJson(res, 200, {
        success: true,
        employee: empData,
        documents: regDocs,
        documentsPassed: Boolean(regLoc.documentsPassed),
        documentsStatus: regLoc.documentsStatus || 'pending',
        storedDocuments: docRows,
      });
    }

    // POST / PUT: Save document upload, update document pass status
    if (req.method === 'POST' || req.method === 'PUT') {
      const body = await parseBody(req);

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

      // Support server-side save of Monitoring Reports & Trainee File Submissions
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
          const rawReports = Array.isArray(body.reports) ? body.reports : [];
          const reports = rawReports.map((r) => ({
            ...r,
            instructorFiles: Array.isArray(r.instructorFiles) ? r.instructorFiles.map(slimFile) : r.instructorFiles,
            traineeFiles: Array.isArray(r.traineeFiles) ? r.traineeFiles.map(slimFile) : r.traineeFiles,
            submissions: Array.isArray(r.submissions)
              ? r.submissions.map((s) => ({
                ...s,
                files: Array.isArray(s.files) ? s.files.map(slimFile) : s.files,
              }))
              : r.submissions,
          }));
          setSettingsCache('monitoring_reports_store.json', reports, 60000);
          const jsonStr = JSON.stringify(reports);
          const buffer = Buffer.from(jsonStr, 'utf8');
          const { error: upErr } = await supabase.storage.from('face-photos').upload('settings/monitoring_reports_store.json', buffer, {
            contentType: 'application/json',
            cacheControl: '60',
            upsert: true,
          });
          if (upErr) {
            return sendJson(res, 500, { error: upErr.message });
          }
          return sendJson(res, 200, { success: true, count: reports.length });
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

      // 2. Merge single document, full document list, or explicit removal
      const docKey = body.docKey;
      const documentItem = body.documentItem;
      if (body.removeDocKey) {
        delete currentDocs[body.removeDocKey];
        if (body.removeDocKey === 'consent') delete currentDocs.parent_consent;
        if (body.removeDocKey === 'moa') delete currentDocs.memorandum;
        if (body.removeDocKey === 'medical') delete currentDocs.clearance;
      }
      if (body.submittedDocuments && typeof body.submittedDocuments === 'object') {
        if (body.removeDocKey) {
          // Replace removed keys cleanly while merging remaining keys
          for (const k of Object.keys(currentDocs)) {
            if (!(k in body.submittedDocuments) && k === body.removeDocKey) {
              delete currentDocs[k];
            }
          }
        }
        Object.assign(currentDocs, body.submittedDocuments);
      }
      if (docKey && documentItem && typeof documentItem === 'object') {
        currentDocs[docKey] = {
          ...(currentDocs[docKey] || {}),
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
      };

      // Always mirror to zero-DB trainee_documents_store.json so Instructor immediately sees uploaded files even under DB contention
      await mirrorTraineeDocsToStore(emp, sanitizedDocs, allPassed, finalStatus);

      // 4. Update employee registration_location in database
      const { error: updateErr } = await supabase
        .from('employees')
        .update({ registration_location: updatedRegLoc })
        .eq('id', emp.id);

      if (updateErr) {
        console.warn('Notice updating employee registration_location (mirrored to store):', updateErr.message);
      }

      // 5. Store / sync ONLY changed document(s) into dedicated documents table in parallel (instead of 20 sequential queries)
      const syncItems = [];
      if (docKey && documentItem) {
        syncItems.push({ key: docKey, item: documentItem });
      } else if (body.submittedDocuments) {
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
