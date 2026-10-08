const RESEND_API_KEY = process.env.VITE_RESEND_API_KEY || process.env.RESEND_API_KEY;

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
    req.on('data', chunk => (body += chunk));
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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    return res.end();
  }

  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  if (!RESEND_API_KEY) {
    return sendJson(res, 200, { skipped: true, message: 'RESEND_API_KEY not configured' });
  }

  try {
    const body = await parseBody(req);
    const { to, subject, html } = body;

    const recipients = Array.isArray(to) ? to.filter((e) => e && typeof e === 'string' && e.includes('@')) : [to].filter(Boolean);
    if (recipients.length === 0) {
      return sendJson(res, 400, { error: 'Valid recipient email(s) required.' });
    }

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'OJT System <onboarding@resend.dev>',
        to: recipients.slice(0, 50),
        subject: subject || 'OJT System Notification',
        html: html || '<p>You have a new notification from OJT Management System.</p>',
      }),
    });

    const data = await resendResponse.json().catch(() => ({}));
    return sendJson(res, resendResponse.ok ? 200 : resendResponse.status, data);
  } catch (err) {
    return sendJson(res, 500, { error: err.message || 'Internal server error' });
  }
}
