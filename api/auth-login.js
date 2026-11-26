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

function parseQuery(req) {
  if (req.query && typeof req.query === 'object') return req.query;
  try {
    const url = new URL(req.url, 'http://localhost');
    return Object.fromEntries(url.searchParams.entries());
  } catch {
    return {};
  }
}

/**
 * Staggered hedged resolver for Supabase GoTrue /auth/v1/authorize.
 * When Supabase Nano's GoTrue pool has a stuck Postgres socket (which hangs 10-62s -> 504),
 * staggered parallel probes at 0ms, 1100ms, and 2400ms hit a healthy worker and return the
 * direct `https://accounts.google.com/o/oauth2/v2/auth?...` redirect URL immediately.
 */
async function resolveGoogleAuthorizeUrlHedged(redirectTo) {
  const targetAuthorize = `${SUPABASE_URL.replace(/\/$/, '')}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectTo)}`;
  const controllers = [];

  const singleAttempt = (delayMs, timeoutMs) =>
    new Promise((resolve, reject) => {
      const startTimer = setTimeout(async () => {
        const controller = new AbortController();
        controllers.push(controller);
        const abortTimer = setTimeout(() => controller.abort(), timeoutMs);
        try {
          const resp = await fetch(targetAuthorize, {
            method: 'GET',
            redirect: 'manual',
            signal: controller.signal,
            headers: {
              Accept: 'text/html,application/xhtml+xml',
              'Cache-Control': 'no-cache',
            },
          });
          clearTimeout(abortTimer);
          const loc = resp.headers.get('location') || '';
          if ((resp.status === 302 || resp.status === 303 || resp.status === 307) && loc.includes('accounts.google.com')) {
            resolve(loc);
          } else {
            reject(new Error(`Unexpected status ${resp.status}`));
          }
        } catch (err) {
          clearTimeout(abortTimer);
          reject(err);
        }
      }, delayMs);

      controllers.push({ abort: () => clearTimeout(startTimer) });
    });

  try {
    const winnerUrl = await Promise.any([
      singleAttempt(0, 4800),
      singleAttempt(1100, 4800),
      singleAttempt(2400, 5200),
    ]);
    controllers.forEach((c) => {
      try { c.abort(); } catch {}
    });
    return winnerUrl;
  } catch {
    controllers.forEach((c) => {
      try { c.abort(); } catch {}
    });
    return null;
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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Fast hedged pre-resolver for Google OAuth authorize URL (avoids 60s browser 504 hangs)
  if (req.method === 'GET') {
    const query = parseQuery(req);
    if (query.action === 'google-url') {
      const redirectTo = String(query.redirectTo || 'https://chmsuojtmis.site/oauth-callback').trim();
      const googleUrl = await resolveGoogleAuthorizeUrlHedged(redirectTo);
      if (googleUrl) {
        res.setHeader('Cache-Control', 'no-store');
        return res.status(200).json({ success: true, url: googleUrl });
      }
      return res.status(503).json({
        success: false,
        code: 'SUPABASE_AUTH_UNHEALTHY',
        fallbackUrl: `${SUPABASE_URL.replace(/\/$/, '')}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectTo)}`,
        error: 'Supabase Auth is temporarily congested. Retrying connection...',
      });
    }
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const body = await parseBody(req);

    // Zero-GoTrue Direct Google ID Token verification (when VITE_GOOGLE_CLIENT_ID is configured)
    if (body.action === 'google-id-token' && body.idToken) {
      const tokenRes = await fetch(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(String(body.idToken))}`
      );
      if (!tokenRes.ok) {
        return res.status(401).json({ success: false, error: 'Invalid Google credential token.' });
      }
      const tokenPayload = await tokenRes.json();
      if (!tokenPayload?.email || tokenPayload.email_verified === 'false') {
        return res.status(401).json({ success: false, error: 'Google email is not verified.' });
      }
      const expectedClientId = process.env.VITE_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || '';
      if (expectedClientId && tokenPayload.aud !== expectedClientId) {
        return res.status(401).json({ success: false, error: 'Google token audience mismatch.' });
      }
      const cleanEmail = String(tokenPayload.email).trim().toLowerCase();
      const matchedEmp = await findEmployeeByIdentifier(cleanEmail, cleanEmail);
      const matchedHost = matchedEmp ? null : await findHostByIdentifier(cleanEmail, cleanEmail);
      return res.status(200).json({
        success: true,
        authUser: {
          id: matchedEmp?.id || matchedHost?.id || tokenPayload.sub,
          email: cleanEmail,
          user_metadata: {
            full_name: tokenPayload.name || cleanEmail.split('@')[0],
            given_name: tokenPayload.given_name || '',
            family_name: tokenPayload.family_name || '',
            avatar_url: tokenPayload.picture || '',
            picture: tokenPayload.picture || '',
          },
        },
        employee: matchedEmp || null,
        hostSupervisor: matchedHost || null,
      });
    }
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
      return res.status(401).json({
        success: false,
        code: 'INVALID_CREDENTIALS',
        error: 'Wrong credentials. Invalid email or password. (If you signed up with Google, click Continue with Google or use Forgot password? to set a password.)',
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

