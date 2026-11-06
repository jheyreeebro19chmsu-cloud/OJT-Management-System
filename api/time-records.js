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

function isUuid(val) {
  return Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));
}

function withTimeout(promise, ms = 7500) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Database upstream timeout')), ms)),
  ]);
}

async function resolveToUuid(empId) {
  if (!empId) return null;
  const raw = String(empId).trim();
  if (isUuid(raw)) return raw;
  try {
    let q = supabase.from('employees').select('id').limit(1);
    if (raw.includes('@')) {
      q = q.eq('email', raw.toLowerCase());
    } else {
      q = q.eq('employee_id', raw);
    }
    const { data } = await q.maybeSingle();
    if (data?.id && isUuid(data.id)) return data.id;
  } catch {}
  return raw;
}

function parseTimeToMinutes(t) {
  if (!t || typeof t !== 'string') return null;
  t = t.trim();
  const match12 = t.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)$/i);
  if (match12) {
    let h = parseInt(match12[1], 10);
    const m = parseInt(match12[2], 10);
    const ampm = match12[3].toUpperCase();
    if (ampm === 'PM' && h !== 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;
    return h * 60 + m;
  }
  const match24 = t.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (match24) {
    return parseInt(match24[1], 10) * 60 + parseInt(match24[2], 10);
  }
  return null;
}

function enrichRecordWithSlots(row) {
  if (!row) return row;
  const slots = extractSlotNotes(row.notes);
  const timeInMins = parseTimeToMinutes(row.time_in);
  const timeOutMins = parseTimeToMinutes(row.time_out);

  const amArrival = slots.amArrival || row.amArrival || row.am_arrival || (timeInMins !== null && timeInMins < 12 * 60 ? row.time_in : undefined);
  let amDeparture = slots.amDeparture || row.amDeparture || row.am_departure || undefined;
  const pmArrival = slots.pmArrival || row.pmArrival || row.pm_arrival || (timeInMins !== null && timeInMins >= 12 * 60 ? row.time_in : undefined);
  let pmDeparture = slots.pmDeparture || row.pmDeparture || row.pm_departure || (timeOutMins !== null && timeOutMins >= 12 * 60 ? row.time_out : undefined);

  // If amDeparture was erroneously recorded during afternoon / evening, shift it to pmDeparture
  const amOutMins = parseTimeToMinutes(amDeparture);
  if (amOutMins !== null && amOutMins >= 13 * 60 && !pmDeparture) {
    pmDeparture = amDeparture;
    amDeparture = undefined;
  }

  // Auto bridge lunch break for full day continuous attendance
  const amInMins = parseTimeToMinutes(amArrival);
  const pmOutMins = parseTimeToMinutes(pmDeparture);
  if (amInMins !== null && pmOutMins !== null && amInMins < 12 * 60 && pmOutMins >= 13 * 60) {
    if (!amDeparture) amDeparture = '12:00:00';
    if (!pmArrival) pmArrival = '13:00:00';
  }

  return {
    ...row,
    employeeId: row.employee_id || row.employeeId,
    timeIn: row.time_in || row.timeIn,
    timeOut: row.time_out || row.timeOut,
    totalHours: row.total_hours != null ? Number(row.total_hours) : (row.totalHours != null ? Number(row.totalHours) : 0),
    amArrival,
    amDeparture,
    pmArrival,
    pmDeparture,
    am_arrival: amArrival,
    am_departure: amDeparture,
    pm_arrival: pmArrival,
    pm_departure: pmDeparture,
    amArrivalFaceVerified: slots.amArrivalFaceVerified ?? row.time_in_face_verified,
    amDepartureFaceVerified: slots.amDepartureFaceVerified ?? row.time_out_face_verified,
    pmArrivalFaceVerified: slots.pmArrivalFaceVerified ?? row.time_in_face_verified,
    pmDepartureFaceVerified: slots.pmDepartureFaceVerified ?? row.time_out_face_verified,
    amArrivalGeofenced: slots.amArrivalGeofenced ?? row.time_in_geofenced,
    amDepartureGeofenced: slots.amDepartureGeofenced ?? row.time_out_geofenced,
    pmArrivalGeofenced: slots.pmArrivalGeofenced ?? row.time_in_geofenced,
    pmDepartureGeofenced: slots.pmDepartureGeofenced ?? row.time_out_geofenced,
  };
}

function extractSlotNotes(notes) {
  if (!notes || typeof notes !== 'string') return {};
  const match = notes.match(/\[slots:(.*?)\]/);
  if (match) {
    try {
      return JSON.parse(match[1]);
    } catch {}
  }
  return {};
}

function encodeSlotNotes(existingNotes, r) {
  const existingSlots = extractSlotNotes(existingNotes);
  const slots = { ...existingSlots };

  if (r.amArrival || r.am_arrival) slots.amArrival = r.amArrival || r.am_arrival;
  if (r.amDeparture || r.am_departure) slots.amDeparture = r.amDeparture || r.am_departure;
  if (r.pmArrival || r.pm_arrival) slots.pmArrival = r.pmArrival || r.pm_arrival;
  if (r.pmDeparture || r.pm_departure) slots.pmDeparture = r.pmDeparture || r.pm_departure;

  if (r.amArrivalFaceVerified ?? r.am_arrival_face_verified) slots.amArrivalFaceVerified = true;
  if (r.amDepartureFaceVerified ?? r.am_departure_face_verified) slots.amDepartureFaceVerified = true;
  if (r.pmArrivalFaceVerified ?? r.pm_arrival_face_verified) slots.pmArrivalFaceVerified = true;
  if (r.pmDepartureFaceVerified ?? r.pm_departure_face_verified) slots.pmDepartureFaceVerified = true;

  if (r.amArrivalGeofenced ?? r.am_arrival_geofenced) slots.amArrivalGeofenced = true;
  if (r.amDepartureGeofenced ?? r.am_departure_geofenced) slots.amDepartureGeofenced = true;
  if (r.pmArrivalGeofenced ?? r.pm_arrival_geofenced) slots.pmArrivalGeofenced = true;
  if (r.pmDepartureGeofenced ?? r.pm_departure_geofenced) slots.pmDepartureGeofenced = true;

  if (Object.keys(slots).length === 0) return existingNotes || null;

  const baseNote = (existingNotes || '').replace(/\s*\[slots:.*?\]/g, '').trim();
  const slotTag = `[slots:${JSON.stringify(slots)}]`;
  return baseNote ? `${baseNote} ${slotTag}` : slotTag;
}

function transformToDbPayload(r) {
  const cleanDate = r.date ? String(r.date).split('T')[0].split(' ')[0].trim() : new Date().toISOString().split('T')[0];
  const encodedNotes = encodeSlotNotes(r.notes, r);
  const payload = {
    employee_id: r.employee_id || r.employeeId || r.employeeID,
    date: cleanDate,
    time_in: r.time_in ?? r.timeIn ?? r.amArrival ?? r.pmArrival ?? null,
    time_out: r.time_out ?? r.timeOut ?? r.pmDeparture ?? r.amDeparture ?? null,
    total_hours: r.total_hours != null ? Number(r.total_hours) : (r.totalHours != null ? Number(r.totalHours) : 0),
    status: r.status || 'present',
    notes: encodedNotes || r.notes || null,
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
      const includePhotos = queryParams.photos === 'true' || queryParams.includePhotos === 'true';

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

      let uniqueEmpIds = [];
      if (empIds.length > 0) {
        const resolvedIds = [];
        for (const raw of empIds) {
          const resolved = await resolveToUuid(raw);
          if (resolved && isUuid(resolved)) {
            resolvedIds.push(resolved);
          }
        }
        uniqueEmpIds = Array.from(new Set(resolvedIds));
        if (uniqueEmpIds.length === 0) {
          // If IDs could not be resolved to any valid UUID, return empty result safely
          return sendJson(res, 200, []);
        }
      }

      const defaultLimit = empIds.length > 0 ? 5000 : 5000;
      const limit = parseInt(queryParams.limit, 10) || defaultLimit;

      const executeQuery = async (fields) => {
        let q = supabase
          .from('time_records')
          .select(fields)
          .order('date', { ascending: false });

        if (uniqueEmpIds.length === 1) {
          q = q.eq('employee_id', uniqueEmpIds[0]);
        } else if (uniqueEmpIds.length > 1) {
          q = q.in('employee_id', uniqueEmpIds);
        }

        if (queryParams.month) {
          const parts = String(queryParams.month).trim().split('-');
          if (parts.length === 2) {
            const y = parseInt(parts[0], 10);
            const m = parseInt(parts[1], 10);
            if (!isNaN(y) && !isNaN(m)) {
              const start = `${parts[0]}-${parts[1].padStart(2, '0')}-01`;
              const lastDay = new Date(y, m, 0).getDate();
              const end = `${parts[0]}-${parts[1].padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
              q = q.gte('date', start).lte('date', end);
            }
          }
        }

        return q.limit(limit);
      };

      const coreFields = 'id, employee_id, date, time_in, time_out, total_hours, status, notes, academic_year, time_in_geofenced, time_out_geofenced, time_in_face_verified, time_out_face_verified, time_in_lat, time_in_lng, time_out_lat, time_out_lng, created_at';
      const extendedFields = `${coreFields}, approval_status, approved_by, approved_at, approval_note`;
      const selectFields = includePhotos ? '*' : extendedFields;

      let data = [];
      try {
        let queryRes = await withTimeout(executeQuery(selectFields), 7500);
        let error = queryRes?.error;
        if (error && (error.message?.includes('does not exist') || error.code === '42703')) {
          const fallback = await withTimeout(executeQuery(coreFields), 7500);
          if (!fallback.error) {
            return sendJson(res, 200, (fallback.data || []).map(enrichRecordWithSlots));
          }
        }
        if (error) {
          console.warn('api/time-records query note:', error.message);
          return sendJson(res, 200, []);
        }
        data = queryRes?.data || [];
      } catch (tErr) {
        console.warn('api/time-records timeout/failure:', tErr.message);
        return sendJson(res, 200, []);
      }

      return sendJson(res, 200, (data || []).map(enrichRecordWithSlots));
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
          payload.employee_id = await resolveToUuid(payload.employee_id);
          if (!payload.employee_id || !isUuid(payload.employee_id)) {
            console.warn('Skipping payload with unresolvable employee_id:', payload);
            continue;
          }

          let existing = null;
          if (payload.id && isUuid(payload.id)) {
            const { data: byId } = await supabase
              .from('time_records')
              .select('id, time_in, time_out, total_hours, notes')
              .eq('id', payload.id)
              .maybeSingle();
            if (byId?.id) existing = byId;
          }

          if (!existing) {
            let query = supabase
              .from('time_records')
              .select('id, time_in, time_out, total_hours, notes')
              .eq('employee_id', payload.employee_id)
              .eq('date', payload.date);

            const { data: existingList } = await query;
            existing = existingList && existingList.length > 0 ? existingList[0] : null;
          }

          if (existing?.id) {
            // Merge & Update existing record while preserving and merging slot notes
            const mergedNotes = encodeSlotNotes(existing.notes, payload) || payload.notes || existing.notes;
            const existingSlots = extractSlotNotes(existing.notes);
            const payloadSlots = extractSlotNotes(payload.notes);
            const effectiveTimeIn = payload.time_in || payloadSlots.amArrival || payloadSlots.pmArrival || existing.time_in || existingSlots.amArrival || existingSlots.pmArrival || null;
            const effectiveTimeOut = payload.time_out || payloadSlots.pmDeparture || payloadSlots.amDeparture || existing.time_out || existingSlots.pmDeparture || existingSlots.amDeparture || null;

            const mergedPayload = {
              ...payload,
              time_in: effectiveTimeIn,
              time_out: effectiveTimeOut,
              total_hours: Math.max(Number(payload.total_hours) || 0, Number(existing.total_hours) || 0),
              notes: mergedNotes,
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
    console.warn('api/time-records handler exception:', err);
    return sendJson(res, 200, []);
  }
}
