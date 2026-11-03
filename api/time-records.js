import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://wooighmdckuoebsuegzz.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indvb2lnaG1kY2t1b2Vic3VlZ3p6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjY5MTgwNywiZXhwIjoyMDg4MjY3ODA3fQ.isLQcKDpXplyE9YDjgub4UOhnfBorngVvVRALuQ8aJA';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function sendJson(res, statusCode, data) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  if (typeof res.status === 'function' && typeof res.json === 'function') {
    return res.status(statusCode).json(data);
  }
  return res.end(JSON.stringify(data));
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

const isUuid = (val) => Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));

function transformToDbPayload(r) {
  const cleanDate = r.date ? String(r.date).split('T')[0].split(' ')[0].trim() : new Date().toISOString().split('T')[0];
  const payload = {
    employee_id: r.employee_id || r.employeeId || r.employeeID,
    date: cleanDate,
    time_in: r.time_in ?? r.timeIn ?? r.amArrival ?? r.pmArrival ?? null,
    time_out: r.time_out ?? r.timeOut ?? r.pmDeparture ?? r.amDeparture ?? null,
    total_hours: r.total_hours != null ? Number(r.total_hours) : (r.totalHours != null ? Number(r.totalHours) : 0),
    status: r.status || 'present',
    notes: r.notes || null,
  };

  if (r.id && isUuid(r.id)) {
    payload.id = r.id;
  }
  if (r.time_in_geofenced !== undefined || r.timeInGeofenced !== undefined) {
    payload.time_in_geofenced = Boolean(r.time_in_geofenced ?? r.timeInGeofenced);
  }
  if (r.time_out_geofenced !== undefined || r.timeOutGeofenced !== undefined) {
    payload.time_out_geofenced = Boolean(r.time_out_geofenced ?? r.timeOutGeofenced);
  }
  if (r.time_in_face_verified !== undefined || r.timeInFaceVerified !== undefined) {
    payload.time_in_face_verified = Boolean(r.time_in_face_verified ?? r.timeInFaceVerified);
  }
  if (r.time_out_face_verified !== undefined || r.timeOutFaceVerified !== undefined) {
    payload.time_out_face_verified = Boolean(r.time_out_face_verified ?? r.timeOutFaceVerified);
  }
  if (r.academic_year || r.academicYear) {
    payload.academic_year = r.academic_year || r.academicYear;
  }
  return payload;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    return res.end();
  }

  try {
    // ─── GET: Fetch Time Records ──────────────────────────────────────────────
    if (req.method === 'GET') {
      const queryParams = parseQuery(req);
      let query = supabase
        .from('time_records')
        .select('*')
        .order('date', { ascending: false });

      const empIds = [];
      if (queryParams.employeeId) {
        empIds.push(...queryParams.employeeId.split(',').map((s) => s.trim()).filter(Boolean));
      }
      if (queryParams.employeeIds) {
        empIds.push(...queryParams.employeeIds.split(',').map((s) => s.trim()).filter(Boolean));
      }
      if (queryParams.altIds) {
        empIds.push(...queryParams.altIds.split(',').map((s) => s.trim()).filter(Boolean));
      }

      if (empIds.length > 0) {
        const uniqueEmpIds = Array.from(new Set(empIds));
        if (uniqueEmpIds.length === 1) {
          query = query.eq('employee_id', uniqueEmpIds[0]);
        } else {
          query = query.in('employee_id', uniqueEmpIds);
        }
      }

      if (queryParams.month) {
        query = query.like('date', `${queryParams.month}%`);
      }

      const defaultLimit = empIds.length > 0 ? 5000 : 5000;
      const limit = parseInt(queryParams.limit, 10) || defaultLimit;
      query = query.limit(limit);

      const { data, error } = await query;
      if (error) {
        return sendJson(res, 500, { error: error.message });
      }

      return sendJson(res, 200, data || []);
    }

    // ─── POST / PUT: Create or Upsert Time Records (Service Role) ─────────────
    if (req.method === 'POST' || req.method === 'PUT') {
      const body = await parseBody(req);
      const incomingRecords = Array.isArray(body.records)
        ? body.records
        : Array.isArray(body)
        ? body
        : [body];

      const validRecords = incomingRecords.filter(
        (r) => r && (r.employee_id || r.employeeId || r.employeeID) && r.date
      );

      if (validRecords.length === 0) {
        return sendJson(res, 400, { error: 'No valid time records provided' });
      }

      const payloads = validRecords.map(transformToDbPayload);
      const savedResults = [];

      for (const payload of payloads) {
        try {
          // Check if record exists for this employee and date
          let query = supabase
            .from('time_records')
            .select('id, time_in, time_out, total_hours, notes')
            .eq('employee_id', payload.employee_id)
            .eq('date', payload.date);

          const { data: existingList } = await query;
          const existing = existingList && existingList.length > 0 ? existingList[0] : null;

          if (existing?.id) {
            // Merge & Update existing record
            const mergedPayload = {
              ...payload,
              time_in: payload.time_in || existing.time_in,
              time_out: payload.time_out || existing.time_out,
              total_hours: Math.max(Number(payload.total_hours) || 0, Number(existing.total_hours) || 0),
              notes: payload.notes || existing.notes,
            };
            delete mergedPayload.id;

            const { data: updated, error: updateErr } = await supabase
              .from('time_records')
              .update(mergedPayload)
              .eq('id', existing.id)
              .select()
              .single();

            if (!updateErr && updated) {
              savedResults.push(updated);
            }
          } else {
            // Insert new record
            const { data: inserted, error: insertErr } = await supabase
              .from('time_records')
              .insert([payload])
              .select()
              .single();

            if (!insertErr && inserted) {
              savedResults.push(inserted);
            }
          }
        } catch (recordErr) {
          console.warn('Error processing time record upsert:', recordErr);
        }
      }

      return sendJson(res, 200, {
        success: true,
        count: savedResults.length,
        records: savedResults,
      });
    }

    return sendJson(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    return sendJson(res, 500, { error: err.message || 'Server error' });
  }
}
