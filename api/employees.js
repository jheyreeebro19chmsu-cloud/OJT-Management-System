import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://wooighmdckuoebsuegzz.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indvb2lnaG1kY2t1b2Vic3VlZ3p6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjY5MTgwNywiZXhwIjoyMDg4MjY3ODA3fQ.isLQcKDpXplyE9YDjgub4UOhnfBorngVvVRALuQ8aJA';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const isUuid = (val) => Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));

// Known HTE mappings for automatic linking
const KNOWN_HTES = {
  'printing services': {
    id: '95558630-499b-4aac-b869-ba64b0694e8c',
    companyName: 'Printing Services',
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
  if (updates.registrationLocation !== undefined) {
    const loc = updates.registrationLocation;
    if (loc && typeof loc === 'object') {
      dbPayload.registration_lat = loc.lat ?? null;
      dbPayload.registration_lng = loc.lng ?? null;
      if (loc.radius) dbPayload.registration_radius = loc.radius;
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
  if (updates.registrationRadius !== undefined || updates.registration_radius !== undefined) {
    dbPayload.registration_radius = updates.registrationRadius ?? updates.registration_radius;
  }
  if (updates.registrationLocation !== undefined || updates.registration_location !== undefined) {
    dbPayload.registration_location = updates.registrationLocation ?? updates.registration_location;
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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // GET: Fetch employees
    if (req.method === 'GET') {
      const id = req.query?.id;
      const email = req.query?.email;

      let query = supabase.from('employees').select('*').order('created_at', { ascending: false });
      if (id) {
        if (isUuid(id)) {
          query = query.eq('id', id);
        } else {
          query = query.eq('employee_id', id);
        }
      } else if (email) {
        query = query.eq('email', email.trim().toLowerCase());
      }

      const { data, error } = await query;
      if (error) {
        return res.status(500).json({ error: error.message });
      }

      return res.status(200).json(data || []);
    }

    // POST / PUT: Update or Upsert employee
    if (req.method === 'POST' || req.method === 'PUT') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
      const targetId = body.id || req.query?.id;
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
          return res.status(500).json({ error: error.message });
        }
        return res.status(200).json({ success: true, count: ids.length, updated: dbPayload });
      }

      const targetEmail = updates.email || body.email;
      const targetEmpId = updates.employeeId || updates.employee_id || body.employeeId || body.employee_id;

      if (!targetId && !targetEmail && !targetEmpId) {
        return res.status(400).json({ error: 'Missing employee identifier (id, employeeId, or email)' });
      }

      const dbPayload = await mapUpdatesToDbPayload(updates);

      // Target selection
      let updateQuery = supabase.from('employees').update(dbPayload);
      if (targetId && isUuid(targetId)) {
        updateQuery = updateQuery.eq('id', targetId);
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
        return res.status(500).json({ error: error.message });
      }

      // If no rows updated, attempt an insert
      if (!data || data.length === 0) {
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
          return res.status(500).json({ error: insertError.message });
        }
        return res.status(200).json({ success: true, data: inserted });
      }

      return res.status(200).json({ success: true, data });
    }

    // DELETE: Delete employee
    if (req.method === 'DELETE') {
      const id = req.query?.id || (typeof req.body === 'string' ? JSON.parse(req.body)?.id : req.body?.id);
      if (!id) {
        return res.status(400).json({ error: 'Missing employee id' });
      }

      let deleteQuery = supabase.from('employees').delete();
      if (isUuid(id)) {
        deleteQuery = deleteQuery.eq('id', id);
      } else {
        deleteQuery = deleteQuery.eq('employee_id', id);
      }

      const { error } = await deleteQuery;
      if (error) {
        return res.status(500).json({ error: error.message });
      }

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('api/employees exception:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
