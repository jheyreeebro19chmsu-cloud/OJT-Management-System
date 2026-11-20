import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://wooighmdckuoebsuegzz.supabase.co';
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indvb2lnaG1kY2t1b2Vic3VlZ3p6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjY5MTgwNywiZXhwIjoyMDg4MjY3ODA3fQ.isLQcKDpXplyE9YDjgub4UOhnfBorngVvVRALuQ8aJA';
const AUTH_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function parseBody(req) {
  if (req.body !== undefined && req.body !== null) {
    return typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body;
  }
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
}

async function findAuthUserByEmail(cleanEmail) {
  let page = 1;
  const perPage = 1000;
  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) {
      console.warn('findAuthUserByEmail listUsers error:', error.message);
      return null;
    }
    const users = data?.users || [];
    const match = users.find((u) => (u.email || '').trim().toLowerCase() === cleanEmail);
    if (match) return match;
    if (users.length < perPage) return null;
    page += 1;
  }
}

async function findEmployeeByIdentifier(cleanId, lowerId) {
  const { data: byEmail } = await supabaseAdmin
    .from('employees')
    .select('*')
    .ilike('email', lowerId)
    .limit(1)
    .maybeSingle();
  if (byEmail) return byEmail;

  const { data: byEmpId } = await supabaseAdmin
    .from('employees')
    .select('*')
    .ilike('employee_id', cleanId)
    .limit(1)
    .maybeSingle();
  if (byEmpId) return byEmpId;

  return null;
}

async function findHostByIdentifier(cleanId, lowerId) {
  const { data: byEmail } = await supabaseAdmin
    .from('host_supervisors')
    .select('*')
    .ilike('email', lowerId)
    .limit(1)
    .maybeSingle();
  if (byEmail) return byEmail;

  const { data: byEmpId } = await supabaseAdmin
    .from('host_supervisors')
    .select('*')
    .ilike('employee_id', cleanId)
    .limit(1)
    .maybeSingle();
  if (byEmpId) return byEmpId;

  return null;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const body = await parseBody(req);
    const rawIdentifier = String(body.identifier || body.email || '').trim();
    const lowerIdentifier = rawIdentifier.toLowerCase();
    const password = typeof body.password === 'string' ? body.password : '';

    if (!rawIdentifier || !password) {
      return res.status(400).json({
        success: false,
        code: 'MISSING_CREDENTIALS',
        error: 'Email or username and password are required.',
      });
    }

    let matchedEmp = await findEmployeeByIdentifier(rawIdentifier, lowerIdentifier);
    let matchedHost = matchedEmp ? null : await findHostByIdentifier(rawIdentifier, lowerIdentifier);

    const targetEmail =
      (matchedEmp?.email && String(matchedEmp.email).trim().toLowerCase()) ||
      (matchedHost?.email && String(matchedHost.email).trim().toLowerCase()) ||
      (lowerIdentifier.includes('@') ? lowerIdentifier : '');

    if (!targetEmail) {
      return res.status(401).json({
        success: false,
        code: 'INVALID_CREDENTIALS',
        error: 'Wrong credentials. Invalid email or password. Please try again.',
      });
    }

    // Create a fresh ephemeral client per request so global/shared auth state is never mutated
    const authClient = createClient(SUPABASE_URL, AUTH_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: authData, error: authError } = await authClient.auth.signInWithPassword({
      email: targetEmail,
      password,
    });

    if (authError || !authData?.user) {
      const authUserRecord = await findAuthUserByEmail(targetEmail);
      const providers = Array.isArray(authUserRecord?.app_metadata?.providers)
        ? authUserRecord.app_metadata.providers.map((p) => String(p).toLowerCase())
        : [];
      const isGoogleOnly = Boolean(
        authUserRecord && providers.includes('google') && !providers.includes('email')
      );

      if (isGoogleOnly) {
        return res.status(401).json({
          success: false,
          code: 'GOOGLE_ONLY_ACCOUNT',
          error:
            "Wrong credentials. This Google account was signed up with Google and has no password set yet. Click 'Continue with Google' or use 'Forgot password?' to create a password.",
        });
      }

      return res.status(401).json({
        success: false,
        code: 'INVALID_CREDENTIALS',
        error: 'Wrong credentials. Invalid email or password. Please try again.',
      });
    }

    const userId = authData.user.id;

    // Ensure profile record is loaded by auth user ID or resolved email if initial lookup missed
    if (!matchedEmp && !matchedHost) {
      const { data: empById } = await supabaseAdmin
        .from('employees')
        .select('*')
        .eq('id', userId)
        .limit(1)
        .maybeSingle();
      if (empById) {
        matchedEmp = empById;
      } else {
        matchedEmp = await findEmployeeByIdentifier(targetEmail, targetEmail);
      }

      if (!matchedEmp) {
        const { data: hostById } = await supabaseAdmin
          .from('host_supervisors')
          .select('*')
          .eq('id', userId)
          .limit(1)
          .maybeSingle();
        if (hostById) {
          matchedHost = hostById;
        } else {
          matchedHost = await findHostByIdentifier(targetEmail, targetEmail);
        }
      }
    }

    return res.status(200).json({
      success: true,
      session: authData.session || null,
      authUser: authData.user,
      employee: matchedEmp || null,
      hostSupervisor: matchedHost || null,
    });
  } catch (err) {
    console.error('api/auth-login error:', err);
    return res.status(500).json({
      success: false,
      code: 'SERVER_ERROR',
      error: 'Unable to verify credentials right now. Please try again.',
    });
  }
}

