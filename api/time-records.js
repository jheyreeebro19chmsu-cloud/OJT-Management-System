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

function format12h(t) {
  if (!t || typeof t !== 'string') return '';
  const trimmed = t.trim();
  if (!trimmed) return '';
  if (/\b(AM|PM)\b/i.test(trimmed)) return trimmed.toUpperCase();
  const parts = trimmed.split(':').map((p) => parseInt(p, 10));
  if (parts.length < 2 || isNaN(parts[0]) || isNaN(parts[1])) return trimmed;
  const h = parts[0];
  const m = parts[1];
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${String(m).padStart(2, '0')} ${ampm}`;
}

function enrichRecordWithSlots(row) {
  if (!row) return row;
  const slots = extractSlotNotes(row.notes);
  const rawTimeIn = row.time_in || row.timeIn;
  const rawTimeOut = row.time_out || row.timeOut;
  const safeTimeOut = rawTimeOut && rawTimeOut !== rawTimeIn ? rawTimeOut : undefined;
  const timeInMins = parseTimeToMinutes(rawTimeIn);
  const timeOutMins = parseTimeToMinutes(safeTimeOut);

  const amArrival = slots.amArrival || row.amArrival || row.am_arrival || (timeInMins !== null && timeInMins < 12 * 60 ? rawTimeIn : undefined);
  let amDeparture = slots.amDeparture || row.amDeparture || row.am_departure || undefined;
  const pmArrival = slots.pmArrival || row.pmArrival || row.pm_arrival || (timeInMins !== null && timeInMins >= 12 * 60 && !amArrival ? rawTimeIn : undefined);
  let pmDeparture =
    slots.pmDeparture ||
    row.pmDeparture ||
    row.pm_departure ||
    (timeOutMins !== null && safeTimeOut !== amDeparture && (timeOutMins >= 13 * 60 || (timeOutMins >= 12 * 60 && Boolean(pmArrival)))
      ? safeTimeOut
      : undefined);

  if (!amDeparture && !pmDeparture && timeOutMins !== null && timeOutMins < 13 * 60 && amArrival && !pmArrival) {
    amDeparture = safeTimeOut;
  }

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

  // Recompute realistic hours from slots when stored total_hours is missing or corrupted (> 16h from negative overnight wrap)
  const rawStoredHours = row.total_hours != null ? Number(row.total_hours) : (row.totalHours != null ? Number(row.totalHours) : 0);
  let computedMinutes = 0;
  const amOutM = parseTimeToMinutes(amDeparture);
  const pmInM = parseTimeToMinutes(pmArrival);
  if (amInMins !== null && amOutM !== null && amOutM > amInMins) {
    computedMinutes += amOutM - amInMins;
  }
  if (pmInM !== null && pmOutMins !== null && pmOutMins > pmInM) {
    computedMinutes += pmOutMins - pmInM;
  }
  const slotHours = Math.round((computedMinutes / 60) * 100) / 100;
  const resolvedTotalHours =
    rawStoredHours > 16 || (slotHours > 0 && rawStoredHours === 0)
      ? slotHours
      : Math.max(rawStoredHours, slotHours);

  return {
    ...row,
    employeeId: row.employee_id || row.employeeId,
    timeIn: rawTimeIn,
    timeOut: safeTimeOut || (pmDeparture || amDeparture || undefined),
    totalHours: resolvedTotalHours,
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

  if (r.academic_year || r.academicYear) slots.academicYear = r.academic_year || r.academicYear;

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
    amArrival: r.amArrival || r.am_arrival,
    amDeparture: r.amDeparture || r.am_departure,
    pmArrival: r.pmArrival || r.pm_arrival,
    pmDeparture: r.pmDeparture || r.pm_departure,
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
  return payload;
}

async function mirrorSavedRecordsToDttrStore(savedRecords) {
  if (!Array.isArray(savedRecords) || savedRecords.length === 0) return;
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
    } catch {}

    const pickSlot = (nv, ov, bridge) => {
      if (ov && ov !== bridge && (!nv || nv === bridge)) return ov;
      return nv || ov;
    };

    // 1. Merge timeRecords
    const recMap = new Map();
    const putRec = (r) => {
      if (!r || typeof r !== 'object') return;
      const empId = r.employeeId || r.employee_id;
      if (!empId || !r.date) return;
      const dateKey = String(r.date).split('T')[0].trim();
      const key = `${String(empId).toLowerCase()}_${dateKey}`;
      const prev = recMap.get(key);
      const rSafeOut = (r.timeOut || r.time_out) && (r.timeOut || r.time_out) !== (prev?.timeIn || prev?.time_in || r.timeIn || r.time_in) ? (r.timeOut || r.time_out) : undefined;
      const prevSafeOut = (prev?.timeOut || prev?.time_out) && (prev?.timeOut || prev?.time_out) !== (prev?.timeIn || prev?.time_in) ? (prev?.timeOut || prev?.time_out) : undefined;
      recMap.set(
        key,
        prev
          ? {
              ...prev,
              ...r,
              employeeId: empId,
              timeIn: prev.timeIn || prev.time_in || r.timeIn || r.time_in,
              timeOut: rSafeOut || prevSafeOut,
              amArrival: pickSlot(r.amArrival, prev.amArrival),
              amDeparture: pickSlot(r.amDeparture, prev.amDeparture, '12:00:00'),
              pmArrival: pickSlot(r.pmArrival, prev.pmArrival, '13:00:00'),
              pmDeparture: pickSlot(r.pmDeparture, prev.pmDeparture),
              totalHours: Math.max(Number(r.totalHours ?? r.total_hours) || 0, Number(prev.totalHours ?? prev.total_hours) || 0),
              notes: r.notes !== undefined ? r.notes : prev.notes,
            }
          : { ...r, employeeId: empId, timeIn: r.timeIn || r.time_in, timeOut: rSafeOut }
      );
    };

    for (const r of Array.isArray(existingStore.timeRecords) ? existingStore.timeRecords : []) putRec(r);
    for (const r of savedRecords) putRec(r);

    // 2. Also mirror each saved record's slots directly into monthlyDttrs so DTTR sheets always reflect punches immediately
    const dttrMap = new Map();
    for (const m of Array.isArray(existingStore.monthlyDttrs) ? existingStore.monthlyDttrs : []) {
      if (m && m.employeeId) {
        dttrMap.set(`${String(m.employeeId).toLowerCase()}_${Number(m.year)}_${Number(m.month)}`, m);
      }
    }

    for (const rec of savedRecords) {
      const empId = rec.employeeId || rec.employee_id;
      const cleanDate = String(rec.date || '').split('T')[0].trim();
      const parts = cleanDate.split('-').map((p) => parseInt(p, 10));
      if (!empId || parts.length !== 3 || parts.some((n) => isNaN(n))) continue;
      const [yearNum, monthNum, dayNum] = parts;
      const dKey = `${String(empId).toLowerCase()}_${yearNum}_${monthNum}`;
      const prevDttr = dttrMap.get(dKey);
      const prevCustom = prevDttr?.customEntries || {};
      const prevDay = prevCustom[dayNum];

      const amIn12 = format12h(rec.amArrival);
      const amOut12 = format12h(rec.amDeparture);
      const pmIn12 = format12h(rec.pmArrival);
      const pmOut12 = format12h(rec.pmDeparture);
      const cleanTasks = String(rec.notes || '').replace(/\s*\[slots:.*?\]/g, '').trim();

      const nextDay = {
        ...(prevDay || {}),
        day: dayNum,
        amArrival: pickSlot(amIn12, prevDay?.amArrival) || '',
        amDeparture: pickSlot(amOut12, prevDay?.amDeparture, '12:00 PM') || '',
        pmArrival: pickSlot(pmIn12, prevDay?.pmArrival, '1:00 PM') || '',
        pmDeparture: pickSlot(pmOut12, prevDay?.pmDeparture) || '',
        hours: Math.max(Number(rec.totalHours ?? rec.total_hours) || 0, Number(prevDay?.hours) || 0),
        tasks: cleanTasks || prevDay?.tasks || '',
      };

      dttrMap.set(dKey, {
        ...(prevDttr || {}),
        id: prevDttr?.id || `${empId}_${yearNum}_${monthNum}`,
        employeeId: empId,
        year: yearNum,
        month: monthNum,
        customEntries: {
          ...prevCustom,
          [dayNum]: nextDay,
        },
        hteSignatureStatus: prevDttr?.hteSignatureStatus || 'pending',
        updatedAt: new Date().toISOString(),
      });
    }

    const slimTimeRecords = Array.from(recMap.values())
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
      .filter((r) => !String(r?.id || '').startsWith('demo-') && !String(r?.employeeId || '').startsWith('demo-'))
      .slice(0, 400)
      .map((r) => {
        const copy = { ...r };
        if (typeof copy.timeInPhoto === 'string' && copy.timeInPhoto.startsWith('data:')) delete copy.timeInPhoto;
        if (typeof copy.timeOutPhoto === 'string' && copy.timeOutPhoto.startsWith('data:')) delete copy.timeOutPhoto;
        if (typeof copy.time_in_photo === 'string' && copy.time_in_photo.startsWith('data:')) delete copy.time_in_photo;
        if (typeof copy.time_out_photo === 'string' && copy.time_out_photo.startsWith('data:')) delete copy.time_out_photo;
        return copy;
      });

    const storeBuf = Buffer.from(
      JSON.stringify({
        monthlyDttrs: Array.from(dttrMap.values()),
        timeRecords: slimTimeRecords,
        updatedAt: new Date().toISOString(),
      }),
      'utf8'
    );
    await supabase.storage.from('face-photos').upload('settings/dttr_store.json', storeBuf, {
      contentType: 'application/json',
      cacheControl: '60',
      upsert: true,
    });
  } catch (e) {
    console.warn('api/time-records dttr_store mirror notice:', e?.message || e);
  }
}

let _unfilteredTimeRecordsCache = { data: null, expiresAt: 0 };

async function readPublicCdnDttrRecords(uniqueEmpIds = []) {
  try {
    const base = SUPABASE_URL.replace(/\/$/, '');
    const res = await fetch(`${base}/storage/v1/object/public/face-photos/settings/dttr_store.json`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return [];
    const parsed = await res.json();
    const list = Array.isArray(parsed?.timeRecords) ? parsed.timeRecords : [];
    if (uniqueEmpIds.length === 0) return list.slice(0, 400);
    const idSet = new Set(uniqueEmpIds.map((id) => String(id).toLowerCase()));
    return list.filter((r) => {
      const eid = String(r?.employeeId || r?.employee_id || '').toLowerCase();
      return eid && idSet.has(eid);
    });
  } catch {
    return [];
  }
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

      if (
        empIds.length === 0 &&
        !queryParams.month &&
        !includePhotos &&
        _unfilteredTimeRecordsCache.data &&
        _unfilteredTimeRecordsCache.expiresAt > Date.now()
      ) {
        return sendJson(res, 200, _unfilteredTimeRecordsCache.data);
      }

      let uniqueEmpIds = [];
      if (empIds.length > 0) {
        const resolvedIds = await Promise.all(empIds.map((raw) => resolveToUuid(raw)));
        uniqueEmpIds = Array.from(new Set(resolvedIds.filter((r) => r && isUuid(r))));
        if (uniqueEmpIds.length === 0) {
          // If IDs could not be resolved to any valid UUID, return empty result safely
          return sendJson(res, 200, []);
        }
      }

      const defaultLimit = empIds.length > 0 ? 1500 : 400;
      const limit = Math.min(parseInt(queryParams.limit, 10) || defaultLimit, 2000);

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

      const coreFields = 'id, employee_id, date, time_in, time_out, total_hours, status, notes, time_in_geofenced, time_out_geofenced, time_in_face_verified, time_out_face_verified, time_in_lat, time_in_lng, time_out_lat, time_out_lng, created_at';
      const extendedFields = `${coreFields}, approval_status, approved_by, approved_at, approval_note`;
      const selectFields = includePhotos ? '*' : coreFields;

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
          const cdnFallback = await readPublicCdnDttrRecords(uniqueEmpIds);
          return sendJson(res, 200, cdnFallback.map(enrichRecordWithSlots));
        }
        data = queryRes?.data || [];
      } catch (tErr) {
        console.warn('api/time-records timeout/failure:', tErr.message);
        const cdnFallback = await readPublicCdnDttrRecords(uniqueEmpIds);
        return sendJson(res, 200, cdnFallback.map(enrichRecordWithSlots));
      }

      const enrichedList = (data || []).map(enrichRecordWithSlots);
      if (empIds.length === 0 && !queryParams.month && !includePhotos && enrichedList.length > 0) {
        _unfilteredTimeRecordsCache = { data: enrichedList, expiresAt: Date.now() + 4000 };
      }
      return sendJson(res, 200, enrichedList);
    }

    // ─── POST / PUT: Create or Upsert Time Records (Service Role) ─────────────
    if (req.method === 'POST' || req.method === 'PUT') {
      _unfilteredTimeRecordsCache = { data: null, expiresAt: 0 };
      const body = await parseBody(req);
      const incomingRecords = Array.isArray(body.records)
        ? body.records
        : Array.isArray(body)
        ? body
        : [body];

      const validRecords = incomingRecords
        .filter((r) => r && (r.employee_id || r.employeeId || r.employeeID) && r.date)
        .slice(0, 25); // Guard against accidental bulk dumps choking Nano Postgres connections

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
            // Merge & Update existing record while permanently locking verified slot timestamps
            const existingSlots = extractSlotNotes(existing.notes);
            const payloadSlots = extractSlotNotes(payload.notes);
            const rawSlots = {
              ...(payload.amArrival ? { amArrival: payload.amArrival } : {}),
              ...(payload.amDeparture ? { amDeparture: payload.amDeparture } : {}),
              ...(payload.pmArrival ? { pmArrival: payload.pmArrival } : {}),
              ...(payload.pmDeparture ? { pmDeparture: payload.pmDeparture } : {}),
            };
            const mergedSlots = { ...existingSlots, ...payloadSlots, ...rawSlots };
            // Lock already-recorded authentic slot timestamps so later punches never overwrite earlier ones
            if (existingSlots.amArrival) mergedSlots.amArrival = existingSlots.amArrival;
            if (existingSlots.amDeparture && existingSlots.amDeparture !== '12:00:00') {
              mergedSlots.amDeparture = existingSlots.amDeparture;
            }
            if (existingSlots.pmArrival && existingSlots.pmArrival !== '13:00:00') {
              mergedSlots.pmArrival = existingSlots.pmArrival;
            }
            if (existingSlots.pmDeparture) mergedSlots.pmDeparture = existingSlots.pmDeparture;

            const stripSlots = (s) => (s || '').replace(/\s*\[slots:.*?\]/g, '').trim();
            const incomingClean = payload.notes !== undefined && payload.notes !== null ? stripSlots(payload.notes) : '';
            const existingClean = stripSlots(existing.notes);
            const baseNote = incomingClean || existingClean;
            const mergedNotes = Object.keys(mergedSlots).length
              ? `${baseNote} [slots:${JSON.stringify(mergedSlots)}]`.trim()
              : (baseNote || null);

            const effectiveTimeIn = existing.time_in || mergedSlots.amArrival || mergedSlots.pmArrival || payload.time_in || null;
            const rawCandidateOut = payload.time_out || mergedSlots.pmDeparture || mergedSlots.amDeparture || existing.time_out || null;
            const effectiveTimeOut = rawCandidateOut && rawCandidateOut !== effectiveTimeIn ? rawCandidateOut : null;

            const prevSafeHours = Number(existing.total_hours) > 16 ? 0 : (Number(existing.total_hours) || 0);
            const nextSafeHours = Number(payload.total_hours) > 16 ? 0 : (Number(payload.total_hours) || 0);
            const mergedPayload = {
              ...payload,
              time_in: effectiveTimeIn,
              time_out: effectiveTimeOut,
              total_hours: Math.max(nextSafeHours, prevSafeHours),
              notes: mergedNotes,
            };
            delete mergedPayload.id;
            delete mergedPayload.amArrival;
            delete mergedPayload.amDeparture;
            delete mergedPayload.pmArrival;
            delete mergedPayload.pmDeparture;
            delete mergedPayload.academic_year;

            const { data: updated, error: updateErr } = await supabase
              .from('time_records')
              .update(mergedPayload)
              .eq('id', existing.id)
              .select()
              .single();

            if (!updateErr && updated) {
              savedResults.push(enrichRecordWithSlots(updated));
            } else {
              if (updateErr) console.warn('api/time-records update error:', updateErr.message);
              savedResults.push(enrichRecordWithSlots({ id: existing.id, ...mergedPayload }));
            }
          } else {
            // Insert new record (strip virtual slot fields not in SQL schema; guard time_out !== time_in)
            const insertPayload = { ...payload };
            if (insertPayload.time_out && insertPayload.time_out === insertPayload.time_in) {
              insertPayload.time_out = null;
            }
            delete insertPayload.id;
            delete insertPayload.amArrival;
            delete insertPayload.amDeparture;
            delete insertPayload.pmArrival;
            delete insertPayload.pmDeparture;
            delete insertPayload.academic_year;

            const { data: inserted, error: insertErr } = await supabase
              .from('time_records')
              .insert([insertPayload])
              .select()
              .single();

            if (!insertErr && inserted) {
              savedResults.push(enrichRecordWithSlots(inserted));
            } else {
              if (insertErr) console.warn('api/time-records insert error:', insertErr.message);
              savedResults.push(enrichRecordWithSlots({ id: payload.id || `rec-${Date.now()}`, ...insertPayload }));
            }
          }
        } catch (recordErr) {
          console.warn('Error processing time record upsert:', recordErr);
        }
      }

      if (savedResults.length > 0) {
        await mirrorSavedRecordsToDttrStore(savedResults);
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
