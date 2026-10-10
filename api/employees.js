import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://wooighmdckuoebsuegzz.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indvb2lnaG1kY2t1b2Vic3VlZ3p6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjY5MTgwNywiZXhwIjoyMDg4MjY3ODA3fQ.isLQcKDpXplyE9YDjgub4UOhnfBorngVvVRALuQ8aJA';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const isUuid = (val) => Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));

// Known HTE mappings for automatic linking
const KNOWN_HTES = {
  'chmsu': {
    id: '95558630-499b-4aac-b869-ba64b0694e8c',
    companyName: 'CHMSU',
    supervisorName: 'Jhey Ree',
  },
  'printing services': {
    id: '95558630-499b-4aac-b869-ba64b0694e8c',
    companyName: 'CHMSU',
    supervisorName: 'Jhey Ree',
  },
  'concentrix': {
    id: '89405c66-015c-407a-937b-71ab37b829d7',
    companyName: 'Concentrix',
    supervisorName: 'Jhey Ree C Ebro',
  },
};

async function mapUpdatesToDbPayload(updates) {
  const dbPayload = {};
  if (updates.name !== undefined) dbPayload.name = updates.name;
  if (updates.employeeId !== undefined || updates.employee_id !== undefined) {
    dbPayload.employee_id = updates.employeeId ?? updates.employee_id;
  }
  if (updates.email !== undefined) {
    dbPayload.email = String(updates.email).trim().toLowerCase();
    dbPayload.email_lower = String(updates.email).trim().toLowerCase();
  }
  if (updates.department !== undefined) dbPayload.department = updates.department;
  if (updates.position !== undefined) dbPayload.position = updates.position;
  if (updates.companyName !== undefined || updates.company_name !== undefined) {
    dbPayload.company_name = updates.companyName ?? updates.company_name;
  }
  if (updates.supervisorName !== undefined || updates.supervisor_name !== undefined) {
    dbPayload.supervisor_name = updates.supervisorName ?? updates.supervisor_name;
  }
  if (updates.schoolName !== undefined || updates.school_name !== undefined) {
    dbPayload.school_name = updates.schoolName ?? updates.school_name;
  }
  if (updates.campus !== undefined) dbPayload.campus = updates.campus;
  if (updates.course !== undefined) dbPayload.course = updates.course;
  if (updates.startDate !== undefined || updates.start_date !== undefined) {
    dbPayload.start_date = updates.startDate ?? updates.start_date;
  }
  if (updates.endDate !== undefined || updates.end_date !== undefined) {
    dbPayload.end_date = updates.endDate ?? updates.end_date;
  }
  if (updates.requiredHours !== undefined || updates.required_hours !== undefined) {
    dbPayload.required_hours = Number(updates.requiredHours ?? updates.required_hours);
  }
  if (updates.photo !== undefined) dbPayload.photo = updates.photo;
  if (updates.faceRegistered !== undefined || updates.face_registered !== undefined) {
    dbPayload.face_registered = updates.faceRegistered ?? updates.face_registered;
  }
  if (updates.active !== undefined) dbPayload.active = updates.active;
  if (updates.academicYear !== undefined || updates.academic_year !== undefined) {
    dbPayload.academic_year = updates.academicYear ?? updates.academic_year;
  }
  if (updates.applicationStatus !== undefined || updates.application_status !== undefined || updates.approvalStatus !== undefined) {
    dbPayload.application_status = updates.applicationStatus ?? updates.application_status ?? updates.approvalStatus;
  }
  if (updates.instructorId !== undefined || updates.instructor_id !== undefined) {
    dbPayload.instructor_id = updates.instructorId ?? updates.instructor_id;
  }
  if (updates.hteId !== undefined || updates.hte_id !== undefined) {
    dbPayload.hte_id = updates.hteId ?? updates.hte_id;
  }
  if (updates.linkedAt !== undefined || updates.linked_at !== undefined) {
    dbPayload.linked_at = updates.linkedAt ?? updates.linked_at;
  }

  // Handle GPS & workplace locations
  let locObj = {};
  if (updates.registrationLocation !== undefined) {
    const loc = updates.registrationLocation;
    if (loc && typeof loc === 'object') {
      dbPayload.registration_lat = loc.lat ?? null;
      dbPayload.registration_lng = loc.lng ?? null;
      locObj = { ...loc };
      if (loc.address) dbPayload.registration_address = loc.address;
    } else if (loc === null) {
      dbPayload.registration_lat = null;
      dbPayload.registration_lng = null;
    }
  }
  if (updates.registration_lat !== undefined) dbPayload.registration_lat = updates.registration_lat;
  if (updates.registration_lng !== undefined) dbPayload.registration_lng = updates.registration_lng;
  if (updates.registrationAddress !== undefined || updates.registration_address !== undefined) {
    dbPayload.registration_address = updates.registrationAddress ?? updates.registration_address;
  }
  const regRadiusVal = updates.registrationRadius ?? updates.registration_radius ?? locObj.radius;
  if (regRadiusVal !== undefined) {
    locObj.radius = Math.max(20, Number(regRadiusVal));
  }
  if (dbPayload.registration_lat != null) locObj.lat = Number(dbPayload.registration_lat);
  if (dbPayload.registration_lng != null) locObj.lng = Number(dbPayload.registration_lng);
  if (dbPayload.registration_address) locObj.address = dbPayload.registration_address;
  // Handle documents & document passes
  if (updates.documentsPassed !== undefined) {
    locObj.documentsPassed = Boolean(updates.documentsPassed);
  }
  if (updates.documentsStatus !== undefined) {
    locObj.documentsStatus = updates.documentsStatus;
  }
  if (updates.submittedDocuments !== undefined || updates.submitted_documents !== undefined || updates.documents !== undefined) {
    const rawDocs = updates.submittedDocuments || updates.submitted_documents || updates.documents;
    if (rawDocs && typeof rawDocs === 'object') {
      locObj.documents = {
        ...(locObj.documents || {}),
        ...rawDocs,
      };
    }
  }

  const hasRegLocUpdates =
    Object.keys(locObj).length > 0 ||
    updates.registrationLocation !== undefined ||
    updates.registration_location !== undefined ||
    updates.documentsPassed !== undefined ||
    updates.documentsStatus !== undefined ||
    updates.submittedDocuments !== undefined ||
    updates.submitted_documents !== undefined;

  if (hasRegLocUpdates) {
    dbPayload.registration_location = {
      ...(typeof updates.registration_location === 'object' ? updates.registration_location : {}),
      ...locObj,
    };
  }

  // Resolve HTE metadata
  if (dbPayload.company_name && !dbPayload.hte_id) {
    const normComp = String(dbPayload.company_name).trim().toLowerCase();
    for (const [key, known] of Object.entries(KNOWN_HTES)) {
      if (normComp.includes(key) || key.includes(normComp)) {
        dbPayload.hte_id = known.id;
        dbPayload.company_name = known.companyName;
        if (!dbPayload.supervisor_name) dbPayload.supervisor_name = known.supervisorName;
        break;
      }
    }
    // Dynamic fallback to host_supervisors table
    if (!dbPayload.hte_id && !normComp.includes('pending') && !normComp.includes('unassigned')) {
      try {
        const { data: host } = await supabase
          .from('host_supervisors')
          .select('id, company_name, name')
          .ilike('company_name', `%${normComp}%`)
          .limit(1)
          .maybeSingle();
        if (host) {
          dbPayload.hte_id = host.id;
          dbPayload.company_name = host.company_name;
          if (!dbPayload.supervisor_name) dbPayload.supervisor_name = host.name;
        }
      } catch (hErr) {
        console.warn('host_supervisors lookup error:', hErr);
      }
    }
  }

  // If hte_id is specified but company_name is missing
  if (dbPayload.hte_id && !dbPayload.company_name) {
    for (const known of Object.values(KNOWN_HTES)) {
      if (known.id === dbPayload.hte_id) {
        dbPayload.company_name = known.companyName;
        if (!dbPayload.supervisor_name) dbPayload.supervisor_name = known.supervisorName;
        break;
      }
    }
    if (!dbPayload.company_name && isUuid(dbPayload.hte_id)) {
      try {
        const { data: host } = await supabase
          .from('host_supervisors')
          .select('id, company_name, name')
          .eq('id', dbPayload.hte_id)
          .limit(1)
          .maybeSingle();
        if (host) {
          dbPayload.company_name = host.company_name;
          if (!dbPayload.supervisor_name) dbPayload.supervisor_name = host.name;
        }
      } catch (hErr) {
        console.warn('host_supervisors lookup error:', hErr);
      }
    }
  }

  return dbPayload;
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

    // GET: Fetch employees
    if (req.method === 'GET') {
      const id = query?.id;
      const email = query?.email;

      let queryBuilder = supabase.from('employees').select('*').order('created_at', { ascending: false });
      if (id) {
        if (isUuid(id)) {
          queryBuilder = queryBuilder.eq('id', id);
        } else {
          queryBuilder = queryBuilder.eq('employee_id', id);
        }
      } else if (email) {
        queryBuilder = queryBuilder.eq('email', email.trim().toLowerCase());
      }

      const { data, error } = await queryBuilder;
      if (error) {
        return sendJson(res, 500, { error: error.message });
      }

      return sendJson(res, 200, data || []);
    }

    // POST / PUT: Update or Upsert employee
    if (req.method === 'POST' || req.method === 'PUT') {
      const body = await parseBody(req);
      const targetId = body.id || query?.id;
      const updates = body.updates || body;

      // Handle batch / bulk updates
      if (body.traineeIds && Array.isArray(body.traineeIds) && body.traineeIds.length > 0) {
        const dbPayload = await mapUpdatesToDbPayload(updates);
        const ids = body.traineeIds.filter(Boolean);
        const uuidIds = ids.filter(isUuid);
        const nonUuidIds = ids.filter((id) => !isUuid(id));

        const promises = [];
        if (uuidIds.length > 0) {
          promises.push(supabase.from('employees').update(dbPayload).in('id', uuidIds));
        }
        if (nonUuidIds.length > 0) {
          promises.push(supabase.from('employees').update(dbPayload).in('employee_id', nonUuidIds));
        }

        const results = await Promise.all(promises);
        const error = results.find((r) => r.error)?.error;
        if (error) {
          console.error('Batch update employees error:', error);
          return sendJson(res, 500, { error: error.message });
        }
        return sendJson(res, 200, { success: true, count: ids.length, updated: dbPayload });
      }

      const targetEmail = updates.email || body.email;
      const targetEmpId = updates.employeeId || updates.employee_id || body.employeeId || body.employee_id;

      if (!targetId && !targetEmail && !targetEmpId) {
        return sendJson(res, 400, { error: 'Missing employee identifier (id, employeeId, or email)' });
      }

      const dbPayload = await mapUpdatesToDbPayload(updates);

      // 1. Fetch existing employee to merge location and document passes
      let empQuery = supabase.from('employees').select('id, employee_id, email, name, registration_location').limit(1);
      if (targetId && isUuid(targetId)) {
        empQuery = empQuery.eq('id', targetId);
      } else if (targetEmail) {
        empQuery = empQuery.eq('email', String(targetEmail).trim().toLowerCase());
      } else if (targetEmpId) {
        empQuery = empQuery.eq('employee_id', String(targetEmpId).trim());
      } else if (targetId) {
        empQuery = empQuery.eq('employee_id', String(targetId).trim());
      }
      const { data: existingRows } = await empQuery;
      const existingEmp = existingRows?.[0];
      const targetEmpUuid = existingEmp?.id || (targetId && isUuid(targetId) ? targetId : null);

      if (existingEmp && dbPayload.registration_location) {
        const curLoc = typeof existingEmp.registration_location === 'object' && existingEmp.registration_location !== null
          ? existingEmp.registration_location
          : {};
        dbPayload.registration_location = {
          ...curLoc,
          ...dbPayload.registration_location,
          documents: {
            ...(curLoc.documents || {}),
            ...(dbPayload.registration_location.documents || {}),
          },
          documentsPassed: dbPayload.registration_location.documentsPassed !== undefined
            ? dbPayload.registration_location.documentsPassed
            : (curLoc.documentsPassed !== undefined ? curLoc.documentsPassed : false),
          documentsStatus: dbPayload.registration_location.documentsStatus !== undefined
            ? dbPayload.registration_location.documentsStatus
            : (curLoc.documentsStatus || 'pending'),
        };
      }

      // 2. Perform employee update
      let updateQuery = supabase.from('employees').update(dbPayload);
      if (targetEmpUuid) {
        updateQuery = updateQuery.eq('id', targetEmpUuid);
      } else if (targetEmail) {
        updateQuery = updateQuery.eq('email', String(targetEmail).trim().toLowerCase());
      } else if (targetEmpId) {
        updateQuery = updateQuery.eq('employee_id', String(targetEmpId).trim());
      } else if (targetId) {
        updateQuery = updateQuery.eq('employee_id', String(targetId).trim());
      }

      const { data, error } = await updateQuery.select();

      if (error) {
        console.error('api/employees update error:', error);
        return sendJson(res, 500, { error: error.message });
      }

      // 3. Sync documents into dedicated documents table in database
      if (targetEmpUuid && dbPayload.registration_location?.documents) {
        try {
          const docEntries = Object.entries(dbPayload.registration_location.documents);
          for (const [docKey, docVal] of docEntries) {
            if (docVal && typeof docVal === 'object') {
              const fileName = docVal.name || `${docKey}.pdf`;
              const filePath = docVal.fileUrl || docVal.dataUrl || '';
              if (filePath) {
                await supabase.from('documents').delete().eq('employee_id', targetEmpUuid).eq('file_name', fileName);
                await supabase.from('documents').insert({
                  employee_id: targetEmpUuid,
                  file_name: fileName,
                  file_path: filePath,
                  file_type: docVal.fileType || 'application/pdf',
                  file_size: docVal.size || 0,
                  created_at: docVal.uploadedAt || new Date().toISOString(),
                });
              }
            }
          }
        } catch (syncErr) {
          console.warn('Sync to documents table notice:', syncErr);
        }
      }

      // 4. If no rows updated and no existing employee, attempt an insert
      if (!data || data.length === 0) {
        if (!existingEmp && dbPayload.name) {
          const insertPayload = {
            ...(targetId && isUuid(targetId) ? { id: targetId } : {}),
            ...dbPayload,
          };
          const { data: inserted, error: insertError } = await supabase
            .from('employees')
            .insert([insertPayload])
            .select();

          if (insertError) {
            console.error('api/employees insert error:', insertError);
            return sendJson(res, 500, { error: insertError.message });
          }
          return sendJson(res, 200, { success: true, data: inserted });
        }
        return sendJson(res, 200, { success: true, data: existingEmp ? [existingEmp] : [] });
      }

      return sendJson(res, 200, { success: true, data });
    }

    // DELETE: Delete employee
    if (req.method === 'DELETE') {
      const id = query?.id || (typeof req.body === 'string' ? JSON.parse(req.body)?.id : req.body?.id);
      if (!id) {
        return sendJson(res, 400, { error: 'Missing employee id' });
      }

      let deleteQuery = supabase.from('employees').delete();
      if (isUuid(id)) {
        deleteQuery = deleteQuery.eq('id', id);
      } else {
        deleteQuery = deleteQuery.eq('employee_id', id);
      }

      const { error } = await deleteQuery;
      if (error) {
        return sendJson(res, 500, { error: error.message });
      }

      return sendJson(res, 200, { success: true });
    }

    return sendJson(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    console.error('api/employees exception:', err);
    return sendJson(res, 500, { error: err.message || 'Internal server error' });
  }
}
