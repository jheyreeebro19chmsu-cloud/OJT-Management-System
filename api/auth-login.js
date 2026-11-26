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

const EMP_AUTH_COLS =
  'id, employee_id, email, name, department, position, company_name, supervisor_name, school_name, campus, course, start_date, end_date, required_hours, photo, face_registered, face_descriptor, active, academic_year, instructor_id, hte_id, application_status, created_at';
const HOST_AUTH_COLS =
  'id, name, email, company_name, position, active, is_approved, created_at';

const isUuid = (val) =>
  Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(val)));

function withTimeout(promise, ms = 4500) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('DB lookup timeout')), ms)),
  ]);
}

// Warm in-memory pool of pre-minted GoTrue Google OAuth authorize URLs (each state nonce is single-use)
const _googleUrlPool = new Map(); // redirectTo -> Array<{ url: string, expiresAt: number }>
const _replenishingRedirects = new Set();

async function fetchSingleGoogleAuthorizeUrl(redirectTo, timeoutMs = 8500) {
  const targetAuthorize = `${SUPABASE_URL.replace(/\/$/, '')}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectTo)}`;
  const controller = new AbortController();
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
      return loc;
    }
    throw new Error(`Unexpected status ${resp.status}`);
  } catch (err) {
    clearTimeout(abortTimer);
    throw err;
  }
}

function replenishGoogleUrlPool(redirectTo) {
  if (_replenishingRedirects.has(redirectTo)) return;
  const now = Date.now();
  const existing = (_googleUrlPool.get(redirectTo) || []).filter((item) => item.expiresAt > now);
  _googleUrlPool.set(redirectTo, existing);
  if (existing.length >= 2) return;

  _replenishingRedirects.add(redirectTo);
  fetchSingleGoogleAuthorizeUrl(redirectTo, 8500)
    .then((url) => {
      if (url) {
        const list = (_googleUrlPool.get(redirectTo) || []).filter((item) => item.expiresAt > Date.now());
        list.push({ url, expiresAt: Date.now() + 3.5 * 60 * 1000 });
        _googleUrlPool.set(redirectTo, list.slice(-3));
      }
    })
    .catch(() => {})
    .finally(() => {
      _replenishingRedirects.delete(redirectTo);
    });
}

/**
 * Staggered hedged resolver for Supabase GoTrue /auth/v1/authorize with warm single-use URL pool.
 * Returns in < 5ms when warm, or races staggered probes (8.5s window) so GoTrue Disk-IO stalls never 504.
 */
async function resolveGoogleAuthorizeUrlHedged(redirectTo) {
  const now = Date.now();
  const pool = (_googleUrlPool.get(redirectTo) || []).filter((item) => item.expiresAt > now);
  if (pool.length > 0) {
    const popped = pool.shift();
    _googleUrlPool.set(redirectTo, pool);
    replenishGoogleUrlPool(redirectTo);
    return popped.url;
  }

  const controllers = [];
  const singleAttempt = (delayMs, timeoutMs) =>
    new Promise((resolve, reject) => {
      const startTimer = setTimeout(async () => {
        const controller = new AbortController();
        controllers.push(controller);
        const abortTimer = setTimeout(() => controller.abort(), timeoutMs);
        try {
          const targetAuthorize = `${SUPABASE_URL.replace(/\/$/, '')}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectTo)}`;
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
      singleAttempt(0, 8500),
      singleAttempt(1200, 8500),
      singleAttempt(2800, 8500),
    ]);
    controllers.forEach((c) => {
      try { c.abort(); } catch {}
    });
    replenishGoogleUrlPool(redirectTo);
    return winnerUrl;
  } catch {
    controllers.forEach((c) => {
      try { c.abort(); } catch {}
    });
    return null;
  }
}

let _accountsIndexCache = { data: null, expiresAt: 0 };

async function readStorageAccountsIndex() {
  if (_accountsIndexCache.data && _accountsIndexCache.expiresAt > Date.now()) {
    return _accountsIndexCache.data;
  }
  try {
    const { data: blob, error } = await supabaseAdmin.storage
      .from('face-photos')
      .download('settings/accounts_index.json');
    if (!error && blob) {
      const parsed = JSON.parse(await blob.text());
      if (parsed && typeof parsed === 'object') {
        _accountsIndexCache = { data: parsed, expiresAt: Date.now() + 15000 };
        return parsed;
      }
    }
  } catch {}
  return null;
}

async function lookupAccountInStorageIndex(cleanId, lowerId, authUserId = '') {
  const index = await readStorageAccountsIndex();
  if (!index) return { employee: null, hostSupervisor: null, indexAvailable: false };

  const emps = Array.isArray(index.employees) ? index.employees : [];
  const hosts = Array.isArray(index.hostSupervisors) ? index.hostSupervisors : [];

  const matchedEmp =
    emps.find(
      (e) =>
        (lowerId && e.email && String(e.email).trim().toLowerCase() === lowerId) ||
        (cleanId && e.employee_id && String(e.employee_id).trim().toLowerCase() === lowerId) ||
        (authUserId && e.id === authUserId)
    ) || null;

  const matchedHost = matchedEmp
    ? null
    : hosts.find(
        (h) =>
          (lowerId && h.email && String(h.email).trim().toLowerCase() === lowerId) ||
          (authUserId && h.id === authUserId)
      ) || null;

  return { employee: matchedEmp, hostSupervisor: matchedHost, indexAvailable: true };
}

async function findEmployeeByIdentifier(cleanId, lowerId, authUserId = '') {
  try {
    if (authUserId && isUuid(authUserId)) {
      const { data: byUuid, error: uuidErr } = await withTimeout(
        supabaseAdmin.from('employees').select(EMP_AUTH_COLS).eq('id', authUserId).limit(1).maybeSingle(),
        3500
      );
      if (!uuidErr && byUuid) return byUuid;
    }

    if (lowerId && lowerId.includes('@')) {
      const { data: byExactEmail, error: emailErr } = await withTimeout(
        supabaseAdmin.from('employees').select(EMP_AUTH_COLS).eq('email', lowerId).limit(1).maybeSingle(),
        3500
      );
      if (!emailErr && byExactEmail) return byExactEmail;

      const { data: byIlikeEmail, error: ilikeErr } = await withTimeout(
        supabaseAdmin.from('employees').select(EMP_AUTH_COLS).ilike('email', lowerId).limit(1).maybeSingle(),
        3500
      );
      if (!ilikeErr && byIlikeEmail) return byIlikeEmail;
    } else if (cleanId) {
      const { data: byExactEmpId, error: empErr } = await withTimeout(
        supabaseAdmin.from('employees').select(EMP_AUTH_COLS).eq('employee_id', cleanId).limit(1).maybeSingle(),
        3500
      );
      if (!empErr && byExactEmpId) return byExactEmpId;

      const { data: byIlikeEmpId } = await withTimeout(
        supabaseAdmin.from('employees').select(EMP_AUTH_COLS).ilike('employee_id', cleanId).limit(1).maybeSingle(),
        3500
      );
      if (byIlikeEmpId) return byIlikeEmpId;
    }
  } catch (err) {
    console.warn('findEmployeeByIdentifier DB fallback to Storage index:', err?.message || err);
  }

  const fromIndex = await lookupAccountInStorageIndex(cleanId, lowerId, authUserId);
  return fromIndex.employee;
}

async function findHostByIdentifier(cleanId, lowerId, authUserId = '') {
  try {
    if (authUserId && isUuid(authUserId)) {
      const { data: byUuid, error: uuidErr } = await withTimeout(
        supabaseAdmin.from('host_supervisors').select(HOST_AUTH_COLS).eq('id', authUserId).limit(1).maybeSingle(),
        3500
      );
      if (!uuidErr && byUuid) return byUuid;
    }

    if (lowerId && lowerId.includes('@')) {
      const { data: byEmail, error: emailErr } = await withTimeout(
        supabaseAdmin.from('host_supervisors').select(HOST_AUTH_COLS).eq('email', lowerId).limit(1).maybeSingle(),
        3500
      );
      if (!emailErr && byEmail) return byEmail;

      const { data: byIlike } = await withTimeout(
        supabaseAdmin.from('host_supervisors').select(HOST_AUTH_COLS).ilike('email', lowerId).limit(1).maybeSingle(),
        3500
      );
      if (byIlike) return byIlike;
    }
  } catch (err) {
    console.warn('findHostByIdentifier DB fallback to Storage index:', err?.message || err);
  }

  const fromIndex = await lookupAccountInStorageIndex(cleanId, lowerId, authUserId);
  return fromIndex.hostSupervisor;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Fast hedged pre-resolver for Google OAuth authorize URL & OAuth account lookup
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

    if (query.action === 'lookup-oauth-user') {
      const cleanEmail = String(query.email || '').trim().toLowerCase();
      const authId = String(query.id || '').trim();
      res.setHeader('Cache-Control', 'no-store');
      if (!cleanEmail && !authId) {
        return res.status(400).json({ success: false, error: 'Missing email or id' });
      }
      const matchedEmp = await findEmployeeByIdentifier(cleanEmail, cleanEmail, authId);
      const matchedHost = matchedEmp ? null : await findHostByIdentifier(cleanEmail, cleanEmail, authId);
      return res.status(200).json({
        success: true,
        employee: matchedEmp || null,
        hostSupervisor: matchedHost || null,
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
      matchedEmp = await findEmployeeByIdentifier(targetEmail, targetEmail, userId);
      if (!matchedEmp) {
        matchedHost = await findHostByIdentifier(targetEmail, targetEmail, userId);
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

