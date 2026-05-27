import {
  Settings,
  Clock,
  MapPin,
  Camera,
  Save,
  RotateCcw,
  Database,
  CheckCircle,
  XCircle,
  Server,
  KeyRound,
} from 'lucide-react';
import { motion } from 'motion/react';
import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';

import { isSupabaseConfigured } from '../../lib/supabase';
import addressApi from '../../services/addressApi';
import { fetchSecurityHealth, isSecurityApiConfigured, type SecurityHealthResponse } from '../../services/securityApi';
import { useApp } from '../../store/AppContext';

export function AdminSettings() {
  const { settings, updateSettings, changeCurrentUserPassword } = useApp();
  const [form, setForm] = useState(settings);
  const supabaseConnected = isSupabaseConfigured();
  const [securityHealth, setSecurityHealth] = useState<SecurityHealthResponse | null>(null);
  const [securityHealthLoading, setSecurityHealthLoading] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const upd = (f: string, v: string | number | boolean) => setForm((p) => ({ ...p, [f]: v }));

  const handleSave = () => {
    updateSettings(form);
    toast.success('Settings saved successfully!');
  };

  const handleReset = () => {
    setForm(settings);
    toast.info('Changes discarded.');
  };

  const probeSecurityBackend = async () => {
    if (!isSecurityApiConfigured()) {
      toast.error('Set VITE_DJANGO_API_URL in .env and restart the dev server.');
      return;
    }
    setSecurityHealthLoading(true);
    try {
      const h = await fetchSecurityHealth();
      setSecurityHealth(h);
      if (h.face_recognition_installed) {
        toast.success('Django security API reachable; face_recognition is installed.');
      } else {
        toast.warning('API reachable but face_recognition is not available on the server (verify returns 501).');
      }
    } catch {
      setSecurityHealth(null);
      toast.error('Could not reach GET /api/health/. Is Django running?');
    } finally {
      setSecurityHealthLoading(false);
    }
  };

  const handlePasswordChange = async () => {
    const result = await changeCurrentUserPassword(currentPassword, newPassword);
    if (result.success) {
      toast.success(result.message);
      setCurrentPassword('');
      setNewPassword('');
    } else {
      toast.error(result.message);
    }
  };

  // Offline streets uploader state
  const [uploadCountry, setUploadCountry] = useState('');
  const [uploadUrl, setUploadUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [dropboxUrl, setDropboxUrl] = useState('');
  const [progressPercent, setProgressPercent] = useState<number | null>(null);
  const [persistedCountries, setPersistedCountries] = useState<string[]>([]);
  const [persistedSummaries, setPersistedSummaries] = useState<
    Record<string, { citiesCount: number; hasMeta: boolean }>
  >({});
  const [persistedDetails, setPersistedDetails] = useState<
    Record<string, { name: string; regions: string[]; sampleCities: string[] }>
  >({});

  const handleFileUpload = async (file?: File) => {
    if (!file) return;
    if (!uploadCountry) return toast.error('Enter country code (e.g. PH)');
    setUploading(true);
    setProgressPercent(null);
    try {
      const txt = await file.text();
      const data = JSON.parse(txt);
      const ok = addressApi.registerOfflineStreets(uploadCountry, data as any);
      if (ok) {
        toast.success(`Registered offline streets for ${uploadCountry.toUpperCase()}`);
      } else {
        toast.error('Registration failed (invalid data)');
      }
    } catch (err) {
      toast.error('Failed to read or parse file');
    } finally {
      setUploading(false);
      setProgressPercent(null);
    }
  };

  const handleUrlRegister = async () => {
    if (!uploadUrl) return toast.error('Enter a URL');
    if (!uploadCountry) return toast.error('Enter country code (e.g. PH)');
    setUploading(true);
    setProgressPercent(null);
    try {
      const res = await fetch(uploadUrl);
      // try streaming the response to report progress
      const contentLength = res.headers.get('content-length');
      if (res.body && contentLength) {
        const total = parseInt(contentLength, 10);
        const reader = res.body.getReader();
        let received = 0;
        const chunks: Uint8Array[] = [];
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            chunks.push(value);
            received += value.length;
            setProgressPercent(Math.round((received / total) * 100));
          }
        }
        const decoder = new TextDecoder('utf-8');
        const text = chunks.map((c) => decoder.decode(c)).join('');
        const data = JSON.parse(text);
        const ok = addressApi.registerOfflineStreets(uploadCountry, data as any);
        if (ok) toast.success(`Registered offline streets for ${uploadCountry.toUpperCase()}`);
        else toast.error('Registration failed (invalid data)');
      } else {
        const data = await res.json();
        const ok = addressApi.registerOfflineStreets(uploadCountry, data as any);
        if (ok) toast.success(`Registered offline streets for ${uploadCountry.toUpperCase()}`);
        else toast.error('Registration failed (invalid data)');
      }
    } catch (err) {
      toast.error('Failed to fetch or parse JSON from URL');
    } finally {
      setUploading(false);
      setProgressPercent(null);
    }
  };

  const handleDropboxRegister = async () => {
    if (!dropboxUrl) return toast.error('Enter Dropbox share URL');
    if (!uploadCountry) return toast.error('Enter country code (e.g. PH)');
    setUploading(true);
    setProgressPercent(null);
    try {
      // Convert common Dropbox share url to direct download
      let url = dropboxUrl.trim();
      // If it's a www.dropbox.com link with ?dl=0, replace with dl=1
      if (url.includes('dropbox.com')) {
        url = url.replace('www.dropbox.com', 'dl.dropboxusercontent.com').replace('?dl=0', '');
      }
      const res = await fetch(url);
      const contentLength = res.headers.get('content-length');
      if (res.body && contentLength) {
        const total = parseInt(contentLength, 10);
        const reader = res.body.getReader();
        let received = 0;
        const chunks: Uint8Array[] = [];
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            chunks.push(value);
            received += value.length;
            setProgressPercent(Math.round((received / total) * 100));
          }
        }
        const decoder = new TextDecoder('utf-8');
        const text = chunks.map((c) => decoder.decode(c)).join('');
        const data = JSON.parse(text);
        const ok = addressApi.registerOfflineStreets(uploadCountry, data as any);
        if (ok) toast.success(`Registered offline streets for ${uploadCountry.toUpperCase()} from Dropbox`);
        else toast.error('Registration failed (invalid data)');
      } else {
        const data = await res.json();
        const ok = addressApi.registerOfflineStreets(uploadCountry, data as any);
        if (ok) toast.success(`Registered offline streets for ${uploadCountry.toUpperCase()} from Dropbox`);
        else toast.error('Registration failed (invalid data)');
      }
    } catch (err) {
      toast.error('Failed to fetch or parse JSON from Dropbox URL');
    } finally {
      setUploading(false);
      setProgressPercent(null);
      // refresh list
      refreshPersistedList();
    }
  };

  const refreshPersistedList = async () => {
    try {
      const list = await addressApi.listOfflineCountries();
      setPersistedCountries(list || []);
      const map: Record<string, { citiesCount: number; hasMeta: boolean }> = {};
      const detailsMap: Record<string, { name: string; regions: string[]; sampleCities: string[] }> = {};
      await Promise.all(
        (list || []).map(async (c) => {
          const s = await addressApi.getOfflineSummary(c);
          map[c] = { citiesCount: s.citiesCount, hasMeta: s.hasMeta };
          const d = await addressApi.getOfflineDetails(c, 8);
          detailsMap[c] = { name: d.name, regions: d.regions, sampleCities: d.sampleCities };
        })
      );
      setPersistedSummaries(map);
      setPersistedDetails(detailsMap);
    } catch (err) {
      // ignore
    }
  };

  useEffect(() => {
    refreshPersistedList();
     
  }, []);

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-xl font-bold text-gray-800">System Settings</h2>
        <p className="text-sm text-gray-500">Configure attendance rules and verification requirements</p>
      </div>

      {/* Work Schedule */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100"
      >
        <div className="flex items-center gap-2 mb-4">
          <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center">
            <Clock size={18} className="text-blue-700" />
          </div>
          <div>
            <h3 className="font-bold text-gray-800">Work Schedule</h3>
            <p className="text-xs text-gray-500">Define standard work hours and late threshold</p>
          </div>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1.5">Work Start Time</label>
              <input
                type="time"
                value={form.workStartTime}
                onChange={(e) => upd('workStartTime', e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1.5">Work End Time</label>
              <input
                type="time"
                value={form.workEndTime}
                onChange={(e) => upd('workEndTime', e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1.5">
              Late Threshold: <span className="text-blue-600">{form.lateThresholdMinutes} minutes</span>
            </label>
            <input
              type="range"
              min="0"
              max="60"
              step="5"
              value={form.lateThresholdMinutes}
              onChange={(e) => upd('lateThresholdMinutes', parseInt(e.target.value))}
              className="w-full accent-blue-600"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-0.5">
              <span>0 min (exact)</span>
              <span>30 min</span>
              <span>60 min</span>
            </div>
            <p className="text-xs text-gray-500 mt-1.5">
              Trainees who clock in more than {form.lateThresholdMinutes} minutes after {form.workStartTime} will be
              marked as late.
            </p>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.11 }}
        className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100"
      >
        <div className="flex items-center gap-2 mb-3">
          <div className="w-9 h-9 bg-indigo-100 rounded-xl flex items-center justify-center">
            <KeyRound size={18} className="text-indigo-700" />
          </div>
          <div>
            <h3 className="font-bold text-gray-800">Change Password</h3>
            <p className="text-xs text-gray-500">Update your admin account password</p>
          </div>
        </div>
        <div className="space-y-3">
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Current password"
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50"
          />
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="New password (min 6 chars)"
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50"
          />
          <button
            type="button"
            onClick={handlePasswordChange}
            className="w-full py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
          >
            Update Password
          </button>
        </div>
      </motion.div>

      {/* Geofencing Settings */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100"
      >
        <div className="flex items-center gap-2 mb-4">
          <div className="w-9 h-9 bg-green-100 rounded-xl flex items-center justify-center">
            <MapPin size={18} className="text-green-700" />
          </div>
          <div>
            <h3 className="font-bold text-gray-800">Geofencing</h3>
            <p className="text-xs text-gray-500">Location-based attendance verification</p>
          </div>
        </div>
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
          <div>
            <p className="font-medium text-gray-700 text-sm">Enable Geofencing</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Require trainees to be within a geofence zone to clock in/out
            </p>
          </div>
          <button
            onClick={() => upd('geofenceEnabled', !form.geofenceEnabled)}
            className={`relative w-12 h-6 rounded-full transition-all ${form.geofenceEnabled ? 'bg-green-500' : 'bg-gray-300'}`}
          >
            <div
              className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.geofenceEnabled ? 'translate-x-6' : ''}`}
            />
          </button>
        </div>
        {form.geofenceEnabled && (
          <div className="mt-3 bg-green-50 rounded-xl p-3 text-xs text-green-700">
            <p>✓ Trainees must be within an active geofence zone to record attendance.</p>
            <p className="mt-0.5">
              Configure zones in the <strong>Geofence Zones</strong> section.
            </p>
          </div>
        )}
        {!form.geofenceEnabled && (
          <div className="mt-3 bg-yellow-50 rounded-xl p-3 text-xs text-yellow-700">
            <p>⚠ Geofencing is disabled. Trainees can clock in/out from any location.</p>
          </div>
        )}
      </motion.div>

      {/* Facial Recognition Settings */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100"
      >
        <div className="flex items-center gap-2 mb-4">
          <div className="w-9 h-9 bg-purple-100 rounded-xl flex items-center justify-center">
            <Camera size={18} className="text-purple-700" />
          </div>
          <div>
            <h3 className="font-bold text-gray-800">Facial Recognition</h3>
            <p className="text-xs text-gray-500">Biometric identity verification for attendance</p>
          </div>
        </div>
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
          <div>
            <p className="font-medium text-gray-700 text-sm">Enable Facial Recognition</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Verify trainee identity using facial recognition before recording time
            </p>
          </div>
          <button
            onClick={() => upd('facialRecognitionEnabled', !form.facialRecognitionEnabled)}
            className={`relative w-12 h-6 rounded-full transition-all ${form.facialRecognitionEnabled ? 'bg-purple-500' : 'bg-gray-300'}`}
          >
            <div
              className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.facialRecognitionEnabled ? 'translate-x-6' : ''}`}
            />
          </button>
        </div>
        {form.facialRecognitionEnabled && (
          <div className="mt-3 bg-purple-50 rounded-xl p-3 text-xs text-purple-700">
            <p>✓ Trainees must pass facial recognition to record attendance.</p>
            <p className="mt-0.5">Trainees need to register their face during account setup.</p>
          </div>
        )}
      </motion.div>

      {/* Verification Mode Info */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="bg-blue-50 rounded-2xl p-4 border border-blue-100"
      >
        <h4 className="font-semibold text-blue-800 text-sm mb-2">Current Verification Mode</h4>
        <div className="text-xs text-blue-700 space-y-1.5">
          {form.geofenceEnabled && form.facialRecognitionEnabled && (
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs">
                ✓
              </span>
              <span>
                <strong>Full Security:</strong> Location + Face verification required
              </span>
            </div>
          )}
          {form.geofenceEnabled && !form.facialRecognitionEnabled && (
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 bg-green-500 text-white rounded-full flex items-center justify-center text-xs">
                ✓
              </span>
              <span>
                <strong>Location Only:</strong> Geofence verification required
              </span>
            </div>
          )}
          {!form.geofenceEnabled && form.facialRecognitionEnabled && (
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 bg-purple-500 text-white rounded-full flex items-center justify-center text-xs">
                ✓
              </span>
              <span>
                <strong>Face Only:</strong> Facial recognition required
              </span>
            </div>
          )}
          {!form.geofenceEnabled && !form.facialRecognitionEnabled && (
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 bg-yellow-500 text-white rounded-full flex items-center justify-center text-xs">
                !
              </span>
              <span>
                <strong>No Verification:</strong> Time recorded without security checks
              </span>
            </div>
          )}
        </div>
      </motion.div>

      {/* Offline Streets Uploader */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.16 }}
        className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100"
      >
        <div className="flex items-center gap-2 mb-3">
          <div className="w-9 h-9 bg-indigo-100 rounded-xl flex items-center justify-center">
            <Database size={18} className="text-indigo-700" />
          </div>
          <div>
            <h3 className="font-bold text-gray-800">Offline Streets Uploader</h3>
            <p className="text-xs text-gray-500">
              Upload a JSON file or provide a URL to register offline street datasets per country.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">Country Code (ISO alpha-2)</label>
            <input
              value={uploadCountry}
              onChange={(e) => setUploadCountry(e.target.value.toUpperCase())}
              placeholder="e.g. PH"
              className="w-40 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">Upload JSON File</label>
            <input
              type="file"
              accept="application/json"
              onChange={(e) => handleFileUpload(e.target.files?.[0])}
              className="text-sm"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">Or register from URL</label>
            <div className="flex gap-2">
              <input
                value={uploadUrl}
                onChange={(e) => setUploadUrl(e.target.value)}
                placeholder="https://example.com/streets/PH.json"
                className="flex-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50"
              />
              <button
                onClick={handleUrlRegister}
                className={`px-3 py-2 rounded-xl bg-indigo-600 text-white text-sm ${uploading ? 'opacity-60' : ''}`}
              >
                Register
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">
              Or register from Dropbox share link
            </label>
            <div className="flex gap-2">
              <input
                value={dropboxUrl}
                onChange={(e) => setDropboxUrl(e.target.value)}
                placeholder="https://www.dropbox.com/s/FILEID/streets.json?dl=0"
                className="flex-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50"
              />
              <button
                onClick={handleDropboxRegister}
                className={`px-3 py-2 rounded-xl bg-indigo-600 text-white text-sm ${uploading ? 'opacity-60' : ''}`}
              >
                Import
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Dropbox links will be converted to direct downloads; the file must be valid JSON matching the expected
              structure.
            </p>
          </div>

          {progressPercent !== null && (
            <div className="mt-2">
              <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                <div className="h-2 bg-indigo-600" style={{ width: `${progressPercent}%` }} />
              </div>
              <div className="text-xs text-gray-500 mt-1">Downloading & parsing: {progressPercent}%</div>
            </div>
          )}

          {/* Persisted offline datasets list */}
          <div className="mt-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Persisted Offline Datasets</h4>
            {persistedCountries.length === 0 ? (
              <div className="text-xs text-gray-500">No persisted datasets found.</div>
            ) : (
              <div className="space-y-2">
                {persistedCountries.map((code) => {
                  const s = persistedSummaries[code] || { citiesCount: 0, hasMeta: false };
                  const d = persistedDetails[code] || { name: code, regions: [], sampleCities: [] };
                  return (
                    <div key={code} className="p-3 rounded-lg border border-gray-100 bg-white">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="font-medium text-sm">
                            {d.name} <span className="text-xs text-gray-400">({code})</span>
                          </div>
                          <div className="text-xs text-gray-500">
                            {s.citiesCount} cities{s.hasMeta ? ' · regions present' : ''}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={async () => {
                              const loaded = await addressApi.loadOfflineStreets(code);
                              if (loaded) toast.success(`Loaded ${d.name} into memory`);
                              else toast.error('Failed to load');
                            }}
                            className="px-3 py-1 rounded-xl border text-xs"
                          >
                            Load
                          </button>
                          <button
                            onClick={async () => {
                              if (!confirm(`Delete persisted dataset for ${d.name}? This cannot be undone.`)) return;
                              const ok = await addressApi.deleteOfflineCountry(code);
                              if (ok) {
                                toast.success(`Deleted ${d.name}`);
                                refreshPersistedList();
                              } else toast.error('Failed to delete');
                            }}
                            className="px-3 py-1 rounded-xl border text-xs text-red-600"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                      {d.regions.length > 0 && (
                        <div className="mt-2 text-xs text-gray-600">
                          <div className="font-semibold text-[12px] text-gray-700">Regions</div>
                          <div className="flex gap-2 flex-wrap mt-1">
                            {d.regions.map((r) => (
                              <div key={r} className="px-2 py-0.5 bg-gray-100 rounded text-xs">
                                {r}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {d.sampleCities.length > 0 && (
                        <div className="mt-2 text-xs text-gray-600">
                          <div className="font-semibold text-[12px] text-gray-700">Sample Cities</div>
                          <div className="flex gap-2 flex-wrap mt-1">
                            {d.sampleCities.map((cn) => (
                              <div key={cn} className="px-2 py-0.5 bg-gray-50 rounded text-xs">
                                {cn}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="text-xs text-gray-500">
            Registered datasets are kept in memory for the current session. Use the <strong>Clear Cache</strong> button
            below to clear street lookup cache.
          </div>
          <div className="flex gap-2">
            <button
              onClick={async () => {
                const ok = await addressApi.clearStreetCache();
                if (ok) toast.success('Street cache cleared');
                else toast.error('Failed to clear cache');
              }}
              className="px-3 py-2 rounded-xl border"
            >
              Clear Cache
            </button>
            <button
              onClick={async () => {
                const ok = await addressApi.clearOfflineStreets();
                if (ok) toast.success('Offline datasets cleared');
                else toast.error('Failed to clear offline datasets');
              }}
              className="px-3 py-2 rounded-xl border"
            >
              Clear Offline Datasets
            </button>
            <button
              onClick={async () => {
                if (!uploadCountry) return toast.error('Enter country code');
                const loaded = await addressApi.loadOfflineStreets(uploadCountry);
                if (loaded) toast.success(`Loaded offline streets for ${uploadCountry}`);
                else toast.error('No offline file found for that country');
              }}
              className="px-3 py-2 rounded-xl border"
            >
              Load From Bundle
            </button>
          </div>
        </div>
      </motion.div>

      {/* Database Connection Status */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100"
      >
        <div className="flex items-center gap-2 mb-4">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center ${supabaseConnected ? 'bg-green-100' : 'bg-gray-100'}`}
          >
            <Database size={18} className={supabaseConnected ? 'text-green-700' : 'text-gray-500'} />
          </div>
          <div>
            <h3 className="font-bold text-gray-800">Database Connection</h3>
            <p className="text-xs text-gray-500">Supabase cloud database status</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className={`p-4 rounded-xl ${supabaseConnected ? 'bg-green-50' : 'bg-yellow-50'}`}>
            <div className="flex items-center gap-2 mb-2">
              {supabaseConnected ? (
                <>
                  <CheckCircle size={16} className="text-green-600" />
                  <span className="font-semibold text-green-800 text-sm">Connected to Supabase</span>
                </>
              ) : (
                <>
                  <XCircle size={16} className="text-yellow-600" />
                  <span className="font-semibold text-yellow-800 text-sm">Using Local Storage</span>
                </>
              )}
            </div>
            <p className="text-xs text-gray-600">
              {supabaseConnected ? (
                <>
                  All data is being synced to your Supabase cloud database. Data is persistent and accessible across
                  devices.
                </>
              ) : (
                <>
                  Data is stored locally in your browser. To enable cloud sync and multi-device access, connect to
                  Supabase.
                </>
              )}
            </p>
          </div>

          {!supabaseConnected && (
            <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
              <h4 className="font-semibold text-blue-800 text-sm mb-2">Connect to Supabase</h4>
              <div className="text-xs text-blue-700 space-y-2">
                <p>To enable cloud database:</p>
                <ol className="list-decimal list-inside space-y-1 ml-1">
                  <li>
                    Create a Supabase project at{' '}
                    <a href="https://supabase.com" target="_blank" rel="noopener noreferrer" className="underline">
                      supabase.com
                    </a>
                  </li>
                  <li>Copy your project URL and anon key</li>
                  <li>
                    Create a <code className="bg-blue-100 px-1.5 py-0.5 rounded">.env</code> file with:
                    <div className="bg-blue-100 rounded p-2 mt-1 font-mono text-xs">
                      VITE_SUPABASE_URL=your_url
                      <br />
                      VITE_SUPABASE_ANON_KEY=your_key
                    </div>
                  </li>
                  <li>
                    Follow the <strong>SUPABASE_SETUP.md</strong> guide for database schema
                  </li>
                  <li>Restart your app</li>
                </ol>
              </div>
            </div>
          )}

          {supabaseConnected && (
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-gray-50 rounded-xl">
                <p className="text-xs text-gray-500 mb-1">Storage Mode</p>
                <p className="font-semibold text-sm text-gray-800">Cloud Database</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-xl">
                <p className="text-xs text-gray-500 mb-1">Sync Status</p>
                <p className="font-semibold text-sm text-green-600">Real-time</p>
              </div>
            </div>
          )}
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12 }}
        className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100"
      >
        <div className="flex items-center gap-2 mb-3">
          <div className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center">
            <Server size={18} className="text-slate-700" />
          </div>
          <div>
            <h3 className="font-bold text-gray-800">Django security API</h3>
            <p className="text-xs text-gray-500">Geofence check, face register/verify, attendance photos</p>
          </div>
        </div>
        <p className="text-xs text-gray-600 mb-3">
          Configure <code className="bg-gray-100 px-1 rounded text-[11px]">VITE_DJANGO_API_URL</code> and optionally{' '}
          <code className="bg-gray-100 px-1 rounded text-[11px]">VITE_SECURITY_API_KEY</code> to match{' '}
          <code className="bg-gray-100 px-1 rounded text-[11px]">DJANGO_SECURITY_API_KEY</code> on the server. Lock CORS
          with <code className="bg-gray-100 px-1 rounded text-[11px]">DJANGO_CORS_ORIGINS</code> and enable HTTPS flags
          when deployed.
        </p>
        <button
          type="button"
          onClick={probeSecurityBackend}
          disabled={securityHealthLoading || !isSecurityApiConfigured()}
          className="w-full py-2.5 rounded-xl bg-slate-800 text-white text-sm font-medium hover:bg-slate-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {securityHealthLoading ? 'Checking…' : 'Probe /api/health/'}
        </button>
        {securityHealth && (
          <div className="mt-3 text-xs rounded-xl bg-gray-50 border border-gray-100 p-3 space-y-1 font-mono text-gray-700">
            <p>status: {securityHealth.status}</p>
            <p>face_recognition_installed: {String(securityHealth.face_recognition_installed)}</p>
            {securityHealth.note && <p className="text-gray-500 whitespace-pre-wrap">{securityHealth.note}</p>}
          </div>
        )}
      </motion.div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={handleSave}
          className="flex-1 flex items-center justify-center gap-2 py-3 bg-blue-700 text-white rounded-xl font-semibold text-sm hover:bg-blue-800 transition-colors shadow-sm"
        >
          <Save size={16} />
          Save Settings
        </button>
        <button
          onClick={handleReset}
          className="flex items-center gap-2 px-4 py-3 border border-gray-200 text-gray-600 rounded-xl font-medium text-sm hover:bg-gray-50 transition-colors"
        >
          <RotateCcw size={14} />
          Reset
        </button>
      </div>
    </div>
  );
}
