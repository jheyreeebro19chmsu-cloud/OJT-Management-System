import React, { useState } from 'react';
import { X, Check, Camera } from 'lucide-react';
import { toast } from 'sonner';
import { readAsDataUrl } from '../pages/Announcements';
import { isSecurityApiConfigured, registerFace } from '../services/securityApi';
import { useApp } from '../store/AppContext';

export function AvatarEditor({ employeeId, onClose }: { employeeId: string; onClose: () => void }) {
  const { updateEmployee } = useApp();
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const onPick = async (file?: File) => {
    if (!file) return;
    const dataUrl = await readAsDataUrl(file);
    setPreview(dataUrl);
  };

  const handleUpload = async () => {
    if (!preview) return toast.error('Select an image first');
    setUploading(true);
    try {
      if (isSecurityApiConfigured()) {
        const resp = await registerFace({ employee_id: String(employeeId), image: preview });
        if (resp.success && resp.image_url) {
          updateEmployee(employeeId, { photo: resp.image_url, faceRegistered: true });
          toast.success('Avatar uploaded');
          onClose();
          return;
        }
      }

      // fallback: store data URL locally
      updateEmployee(employeeId, { photo: preview, faceRegistered: true });
      toast.success('Avatar saved locally');
      onClose();
    } catch (err) {
      console.error('Avatar upload error:', err);
      // Try to parse backend error message if present
      let message = 'Failed to upload avatar';
      try {
        const e = err as any;
        if (e && e.message) {
          // server may return JSON body as text
          try {
            const parsed = JSON.parse(e.message);
            message = parsed.message || parsed.error || parsed.detail || JSON.stringify(parsed);
          } catch {
            message = e.message;
          }
        }
      } catch (_) {
        // ignore
      }
      toast.error(message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md bg-white rounded-2xl p-4 shadow-lg">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold">Edit Avatar</h3>
          <button onClick={onClose} className="text-gray-500"><X size={16} /></button>
        </div>

        <div className="space-y-3">
          <div className="h-48 bg-gray-50 rounded-lg border border-gray-200 flex items-center justify-center overflow-hidden">
            {preview ? (
              <img src={preview} alt="preview" className="w-full h-full object-cover" />
            ) : (
              <div className="text-center text-gray-400">
                <Camera size={36} className="mx-auto" />
                <div className="text-sm">No image selected</div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <label className="px-3 py-2 bg-gray-50 border rounded-lg cursor-pointer">
              Choose Image
              <input type="file" accept="image/*" className="hidden" onChange={(e) => onPick(e.target.files?.[0])} />
            </label>
            <button onClick={() => setPreview(null)} disabled={!preview} className="px-3 py-2 border rounded-lg text-sm">Clear</button>
            <div className="ml-auto flex gap-2">
              <button onClick={onClose} className="px-3 py-2 text-sm">Cancel</button>
              <button onClick={handleUpload} disabled={!preview || uploading} className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm">
                {uploading ? 'Uploading...' : (<><Check size={14} /> Upload</>)}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AvatarEditor;
