import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://wooighmdckuoebsuegzz.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indvb2lnaG1kY2t1b2Vic3VlZ3p6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjY5MTgwNywiZXhwIjoyMDg4MjY3ODA3fQ.isLQcKDpXplyE9YDjgub4UOhnfBorngVvVRALuQ8aJA';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const isUuid = (val) => Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));

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

    // GET: Query documents & document pass status for an employee
    if (req.method === 'GET') {
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
      return sendJson(res, 200, {
        success: true,
        employee: empData,
        documents: regLoc.documents || {},
        documentsPassed: Boolean(regLoc.documentsPassed),
        documentsStatus: regLoc.documentsStatus || 'pending',
        storedDocuments: docRows,
      });
    }

    // POST / PUT: Save document upload, update document pass status
    if (req.method === 'POST' || req.method === 'PUT') {
      const body = await parseBody(req);
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
        documents: currentDocs,
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
        const filePath = item.fileUrl || item.dataUrl || '';
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
