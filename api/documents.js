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

      clean[key] = {
        name: val.name || 'document',
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

      // Action: Retrieve institutional and departmental required documents
      if (action === 'get-requirements') {
        try {
          const { data, error } = await supabase.storage.from('face-photos').download('settings/requirements_store.json');
          if (!error && data) {
            const text = await data.text();
            const parsed = JSON.parse(text);
            if (Array.isArray(parsed)) {
              return sendJson(res, 200, parsed);
            }
          }
        } catch (err) {
          console.warn('API get-requirements notice:', err);
        }
        return sendJson(res, 200, []);
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
          } catch {}
        }

        if (!fileBlob) {
          try {
            const { data: signData } = await supabase.storage.from(bucket).createSignedUrl(storagePath, 3600);
            if (signData?.signedUrl) {
              res.statusCode = 302;
              res.setHeader('Location', signData.signedUrl);
              return res.end();
            }
          } catch {}
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
          } catch {}
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
              status: 'pending',
            };
          }
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
          const jsonStr = JSON.stringify(docs);
          const buffer = Buffer.from(jsonStr, 'utf8');
          const { error: upErr } = await supabase.storage.from('face-photos').upload('settings/requirements_store.json', buffer, {
            contentType: 'application/json',
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

      // 2. Merge single document or full document list
      const docKey = body.docKey;
      const documentItem = body.documentItem;
      if (docKey && documentItem && typeof documentItem === 'object') {
        currentDocs[docKey] = {
          ...(currentDocs[docKey] || {}),
          ...documentItem,
        };
      }

      if (body.submittedDocuments && typeof body.submittedDocuments === 'object') {
        Object.assign(currentDocs, body.submittedDocuments);
      }

      // 3. Determine pass status
      const docKeys = [
        'internshipAgreement', 'moa', 'consent', 'trainingPlan', 'pledgeOfConduct',
        'medical', 'application', 'resume', 'enrolmentForm', 'endorsement'
      ];
      const allPassed = body.allPassed !== undefined
        ? Boolean(body.allPassed)
        : (docKeys.length > 0 && docKeys.every((k) => currentDocs[k]?.status === 'passed'));

      const finalStatus = body.documentsStatus !== undefined
        ? body.documentsStatus
        : allPassed
          ? 'passed'
          : docKeys.some((k) => currentDocs[k]?.status === 'passed')
            ? 'partial'
            : 'pending';

      const updatedRegLoc = {
        ...curRegLoc,
        documents: sanitizeDocuments(currentDocs),
        documentsPassed: allPassed,
        documentsStatus: finalStatus,
      };

      // 4. Update employee registration_location in database
      const { error: updateErr } = await supabase
        .from('employees')
        .update({ registration_location: updatedRegLoc })
        .eq('id', emp.id);

      if (updateErr) {
        console.error('Failed to update employee registration_location:', updateErr);
        return sendJson(res, 500, { error: updateErr.message });
      }

      // 5. Store / sync into dedicated documents table in database
      const syncItems = [];
      if (docKey && documentItem) {
        syncItems.push({ key: docKey, item: documentItem });
      }
      if (body.submittedDocuments) {
        for (const [k, v] of Object.entries(body.submittedDocuments)) {
          if (v && typeof v === 'object') syncItems.push({ key: k, item: v });
        }
      }

      for (const { key, item } of syncItems) {
        const rawPath = item.fileUrl || item.dataUrl || '';
        const filePath = (typeof rawPath === 'string' && (rawPath.startsWith('http://') || rawPath.startsWith('https://')))
          ? rawPath
          : '';
        const fileName = item.name || `${key}.pdf`;
        if (filePath && emp.id) {
          try {
            await supabase.from('documents').delete().eq('employee_id', emp.id).eq('file_name', fileName);
            await supabase.from('documents').insert({
              employee_id: emp.id,
              file_name: fileName,
              file_path: filePath,
              file_type: item.fileType || 'application/pdf',
              file_size: item.size || 0,
              created_at: item.uploadedAt || new Date().toISOString(),
            });
          } catch (dErr) {
            console.warn('Sync document record notice:', dErr);
          }
        }
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
