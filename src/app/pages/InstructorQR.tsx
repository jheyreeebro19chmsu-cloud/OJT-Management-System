import React from 'react';
import { useApp } from '../store/AppContext';

export default function InstructorQR() {
  const app = useApp();
  const emp = app?.getCurrentEmployee();
  const email = emp?.email || '';
  const name = emp?.name || 'Instructor';
  const qrData = `instructor_local_${email || Date.now()}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(qrData)}`;

  const downloadQr = () => {
    const link = document.createElement('a');
    link.href = qrUrl;
    link.download = `qr_${(email || 'instructor').replace(/[^a-z0-9]/gi, '_')}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Instructor QR</h1>
      <p className="text-sm text-slate-600 mb-4">This QR encodes a local instructor token used for student enrollment.</p>
      <div className="flex items-center gap-6">
        <img src={qrUrl} alt="Instructor QR" className="w-56 h-56 border" />
        <div>
          <p className="font-medium">{name}</p>
          <p className="text-sm text-slate-500">{email || 'No email available'}</p>

          <div className="mt-4">
            <button onClick={downloadQr} className="rounded bg-slate-900 text-white px-4 py-2">Download QR</button>
          </div>

          <div className="mt-4">
            <label className="block text-xs text-slate-500">QR payload</label>
            <textarea readOnly value={qrData} className="mt-1 w-full rounded border p-2 text-sm" rows={3} />
          </div>
        </div>
      </div>
    </div>
  );
}
