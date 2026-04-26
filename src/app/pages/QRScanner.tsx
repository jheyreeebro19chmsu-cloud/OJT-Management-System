import React, { useState } from 'react';
import authApi from '../services/authApi';
import { useApp } from '../store/AppContext';

export default function QRScanner() {
  const [qr, setQr] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const app = useApp();

  const verify = async () => {
    setLoading(true);
    setResult(null);
    try {
      // Try backend verification
      const res = await authApi.verifyQR(qr);
      setResult(res.data);
    } catch (err: any) {
      // fallback: parse local format instructor_local_{email}
      if (qr.startsWith('instructor_local_')) {
        const email = qr.replace('instructor_local_', '');
        const found = app?.employees.find(e => e.email.toLowerCase() === email.toLowerCase());
        setResult({ success: true, instructor: found ? { email: found.email, name: found.name } : { email } });
      } else {
        setResult({ success: false, error: err?.response?.data || 'Verification failed' });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Scan / Paste Instructor QR</h1>
      <p className="text-sm text-slate-600 mb-4">Paste the QR payload or scan using your device camera (camera scanning not implemented: paste supported).</p>

      <div className="max-w-lg">
        <textarea value={qr} onChange={e => setQr(e.target.value)} placeholder="Paste QR payload here" className="w-full rounded border p-2" rows={3} />
        <div className="mt-3">
          <button onClick={verify} disabled={loading || !qr} className="rounded bg-slate-900 text-white px-4 py-2">{loading ? 'Verifying...' : 'Verify QR'}</button>
        </div>

        <div className="mt-4">
          {result && (
            <div className="rounded border p-4">
              {result.success ? (
                <div>
                  <h3 className="font-semibold">Instructor Found</h3>
                  <p className="text-sm">Name: {result.instructor?.name || '—'}</p>
                  <p className="text-sm">Email: {result.instructor?.email || '—'}</p>
                </div>
              ) : (
                <div>
                  <h3 className="font-semibold">Verification Failed</h3>
                  <pre className="text-xs text-red-600 mt-2">{JSON.stringify(result.error || result, null, 2)}</pre>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
