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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    return res.end();
  }

  try {
    const queryParams = parseQuery(req);
    let query = supabase
      .from('time_records')
      .select('*')
      .order('date', { ascending: false });

    // Multi-ID support: trainee UUID, employeeId/student ID, or comma-separated list
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
  } catch (err) {
    return sendJson(res, 500, { error: err.message || 'Server error' });
  }
}
