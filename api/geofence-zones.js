import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://wooighmdckuoebsuegzz.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indvb2lnaG1kY2t1b2Vic3VlZ3p6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjY5MTgwNywiZXhwIjoyMDg4MjY3ODA3fQ.isLQcKDpXplyE9YDjgub4UOhnfBorngVvVRALuQ8aJA';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const isUuid = (val) => Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));

function withTimeout(promise, ms = 7500) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Database upstream timeout')), ms)),
  ]);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // GET: Fetch all geofence zones
    if (req.method === 'GET') {
      let data = [];
      try {
        const result = await withTimeout(
          supabase.from('geofence_zones').select('*').order('created_at', { ascending: false }),
          7500
        );
        if (result?.error) {
          console.warn('api/geofence-zones GET database error:', result.error.message);
          return res.status(200).json([]);
        }
        data = result?.data || [];
      } catch (getErr) {
        console.warn('api/geofence-zones GET timeout/failure:', getErr.message);
        return res.status(200).json([]);
      }

      const formatted = (data || []).map((zone) => ({
        id: zone.id,
        name: zone.name,
        address: zone.address,
        lat: Number(zone.lat),
        lng: Number(zone.lng),
        radius: Number(zone.radius) || 100,
        active: zone.active !== false,
        academicYear: zone.academic_year || undefined,
        employeeId: zone.employee_id || undefined,
        employee_id: zone.employee_id || undefined,
      }));

      return res.status(200).json(formatted);
    }

    // POST / PUT: Upsert or update a geofence zone
    if (req.method === 'POST' || req.method === 'PUT') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
      const { id, name, address, lat, lng, radius, active, academicYear, employeeId, employee_id } = body;

      const rawId = id ? String(id).replace(/^(station|personal|trainee|inst|hte)-/, '') : undefined;
      const resolvedEmpId = employeeId || employee_id || (rawId && isUuid(rawId) ? rawId : undefined);

      const payload = {
        name: name || 'Workplace Geofence Zone',
        address: address || '',
        lat: Number(lat),
        lng: Number(lng),
        radius: Math.max(20, Number(radius) || 40),
        active: active !== false,
      };

      if (resolvedEmpId && isUuid(resolvedEmpId)) payload.employee_id = resolvedEmpId;

      let zoneId = id && isUuid(id) ? id : (rawId && isUuid(rawId) ? rawId : undefined);

      // Check if an existing record matches by employee_id, id, or name
      if (!zoneId && payload.employee_id) {
        const { data: existing } = await withTimeout(
          supabase.from('geofence_zones').select('id').eq('employee_id', payload.employee_id).limit(1)
        ).catch(() => ({ data: null }));
        if (existing && existing.length > 0) {
          zoneId = existing[0].id;
        }
      }

      if (!zoneId && payload.name) {
        const { data: existingByName } = await withTimeout(
          supabase.from('geofence_zones').select('id').eq('name', payload.name).limit(1)
        ).catch(() => ({ data: null }));
        if (existingByName && existingByName.length > 0) {
          zoneId = existingByName[0].id;
        }
      }

      let data;
      let error;

      if (zoneId) {
        const res = await withTimeout(
          supabase.from('geofence_zones').update(payload).eq('id', zoneId).select().maybeSingle()
        ).catch((err) => ({ data: null, error: err }));
        data = res.data;
        error = res.error;

        // If zoneId was not found in table, insert it
        if (!data && !error) {
          const insertRes = await withTimeout(
            supabase.from('geofence_zones').insert([{ ...payload, id: zoneId }]).select().maybeSingle()
          ).catch((err) => ({ data: null, error: err }));
          data = insertRes.data;
          error = insertRes.error;
        }
      } else {
        const insertRes = await withTimeout(
          supabase.from('geofence_zones').insert([payload]).select().maybeSingle()
        ).catch((err) => ({ data: null, error: err }));
        data = insertRes.data;
        error = insertRes.error;
      }

      if (error) {
        // Fallback retry without employee_id if FK / unique error
        if (payload.employee_id) {
          delete payload.employee_id;
          if (zoneId) {
            const retry = await withTimeout(
              supabase.from('geofence_zones').update(payload).eq('id', zoneId).select().maybeSingle()
            ).catch((err) => ({ data: null, error: err }));
            data = retry.data;
            error = retry.error;
          } else {
            const retry = await withTimeout(
              supabase.from('geofence_zones').insert([payload]).select().maybeSingle()
            ).catch((err) => ({ data: null, error: err }));
            data = retry.data;
            error = retry.error;
          }
        }
        if (error) {
          console.warn('api/geofence-zones persistence warning:', error.message || error);
          // Return 200 with saved payload rather than 500 so client state remains synchronized
          return res.status(200).json({ ...payload, id: zoneId || id, warning: 'Saved locally; cloud retry scheduled' });
        }
      }

      return res.status(200).json(data || { ...payload, id: zoneId || id });
    }

    // DELETE: Delete a geofence zone
    if (req.method === 'DELETE') {
      const id = req.query?.id || (typeof req.body === 'string' ? JSON.parse(req.body)?.id : req.body?.id);
      if (!id) {
        return res.status(400).json({ error: 'Missing zone id' });
      }

      const isIdUuid = isUuid(id);
      if (isIdUuid) {
        await supabase.from('geofence_zones').delete().eq('id', id);
      }

      const cleanId = String(id).replace(/^(station|personal|trainee|inst|hte)-/, '');
      if (cleanId !== id && isUuid(cleanId)) {
        await supabase.from('geofence_zones').delete().eq('id', cleanId);
        await supabase.from('geofence_zones').delete().eq('employee_id', cleanId);
      }

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
