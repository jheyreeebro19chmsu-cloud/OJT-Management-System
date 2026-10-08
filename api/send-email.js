const RESEND_API_KEY = process.env.VITE_RESEND_API_KEY || process.env.RESEND_API_KEY;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!RESEND_API_KEY) {
    return res.status(200).json({ skipped: true, message: 'RESEND_API_KEY not configured' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { to, subject, html } = body;

    const recipients = Array.isArray(to) ? to.filter((e) => e && typeof e === 'string' && e.includes('@')) : [to].filter(Boolean);
    if (recipients.length === 0) {
      return res.status(400).json({ error: 'Valid recipient email(s) required.' });
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

    const data = await resendResponse.json();
    return res.status(resendResponse.ok ? 200 : resendResponse.status).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
