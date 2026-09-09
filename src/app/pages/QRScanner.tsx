import React, { useState } from 'react';
import { toast } from 'sonner';

import { authAPI } from '../services/authApi';
import { linkTraineeToInstructor } from '../services/accountSync';
import { useApp } from '../store/AppContext';

export default function QRScanner() {
  const [qr, setQr] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [linking, setLinking] = useState(false);
  const app = useApp();

  const verify = async () => {
    const rawQr = qr.trim();
    if (!rawQr) return;

    setLoading(true);
    setResult(null);

    // 1. Try JSON parsing (standard instructor QR from registration)
    let parsed: any = null;
    try {
      parsed = JSON.parse(rawQr);
    } catch {}

    if (parsed && (parsed.type === 'instructor_enrollment' || parsed.instructorId)) {
      const instId = parsed.instructorId || parsed.email || parsed.id;
      const found = app?.employees.find(
        (e) =>
          instId &&
          (e.id === instId ||
            e.employeeId?.toLowerCase() === String(instId).toLowerCase() ||
            e.email.toLowerCase() === String(instId).toLowerCase())
      );
      setResult({
        success: true,
        instructor: found
          ? { id: found.id, email: found.email, name: found.name, employeeId: found.employeeId }
          : { id: instId, email: parsed.email || instId, name: parsed.name || 'Instructor' },
      });
      setLoading(false);
      return;
    }

    // 2. Try instructor_local_{email} format
    if (rawQr.startsWith('instructor_local_')) {
      const email = rawQr.replace('instructor_local_', '').trim();
      const found = app?.employees.find((e) => e.email.toLowerCase() === email.toLowerCase());
      setResult({
        success: true,
        instructor: found
          ? { id: found.id, email: found.email, name: found.name, employeeId: found.employeeId }
          : { email, name: 'Instructor' },
      });
      setLoading(false);
      return;
    }

    // 3. Fallback: query in-memory employees by ID or email
    const matched = app?.employees.find(
      (e) =>
        e.email.toLowerCase() === rawQr.toLowerCase() ||
        e.id === rawQr ||
        e.employeeId?.toLowerCase() === rawQr.toLowerCase()
    );
    if (matched && (matched.position === 'OJT Instructor' || matched.position?.toLowerCase().includes('instructor') || matched.position === 'Administrator')) {
      setResult({
        success: true,
        instructor: { id: matched.id, email: matched.email, name: matched.name, employeeId: matched.employeeId },
      });
      setLoading(false);
      return;
    }

    // 4. Try backend verification
    try {
      const res = await authAPI.verifyQR(rawQr);
      setResult(res.data);
    } catch (err: any) {
      setResult({ success: false, error: err?.response?.data || 'Verification failed: Unknown instructor QR' });
    } finally {
      setLoading(false);
    }
  };

  const handleLinkToInstructor = async () => {
    if (!result?.instructor || !app?.currentUser) return;
    const instructorId = result.instructor.id || result.instructor.email;
    const traineeId = app.currentUser.id || app.currentUser.employeeId;
    if (!traineeId) return;

    setLinking(true);
    try {
      await linkTraineeToInstructor(traineeId, instructorId);
      if (app.updateEmployee) {
        app.updateEmployee(traineeId, {
          instructorId: result.instructor.id,
          applicationStatus: 'pending',
          approvalStatus: 'pending',
          linkedAt: new Date().toISOString(),
        });
      }
      toast.success(`Successfully enrolled with ${result.instructor.name || 'Instructor'}! Awaiting approval.`);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to link to instructor');
    } finally {
      setLinking(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-900 mb-2">Instructor Enrollment QR</h1>
      <p className="text-sm text-slate-600 mb-6">
        Scan your instructor's QR code or paste their enrollment code below to connect your trainee account.
      </p>

      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <textarea
          value={qr}
          onChange={(e) => setQr(e.target.value)}
          placeholder="Paste instructor QR code data or JSON here"
          className="w-full rounded-xl border border-slate-300 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
          rows={3}
        />
        <div className="mt-4 flex gap-3">
          <button
            onClick={verify}
            disabled={loading || !qr.trim()}
            className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2.5 text-sm transition-all disabled:opacity-50"
          >
            {loading ? 'Verifying...' : 'Verify QR Code'}
          </button>
          {qr && (
            <button
              onClick={() => {
                setQr('');
                setResult(null);
              }}
              className="rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold px-4 py-2.5 text-sm transition-all"
            >
              Clear
            </button>
          )}
        </div>

        {result && (
          <div className="mt-6 rounded-xl border p-4 transition-all">
            {result.success ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-bold">
                    ✓
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900">Instructor Verified</h3>
                    <p className="text-sm text-slate-600">{result.instructor?.name || 'Instructor'}</p>
                    <p className="text-xs text-slate-400">{result.instructor?.email || 'No email'}</p>
                  </div>
                </div>

                {app?.currentUser?.role === 'employee' && (
                  <button
                    onClick={handleLinkToInstructor}
                    disabled={linking}
                    className="w-full py-2.5 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl text-sm transition-all shadow-sm disabled:opacity-50"
                  >
                    {linking ? 'Enrolling...' : `Enroll with ${result.instructor?.name || 'this Instructor'}`}
                  </button>
                )}
              </div>
            ) : (
              <div>
                <h3 className="font-bold text-red-600">Verification Failed</h3>
                <p className="text-sm text-slate-600 mt-1">
                  {typeof result.error === 'string' ? result.error : 'Invalid or unrecognized QR token.'}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
