import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Circle, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix default marker icons — use CDN to avoid bundler asset-import issues
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.3.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.3.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.3.1/images/marker-shadow.png',
});

import {
  CheckCircle,
  XCircle,
  Clock,
  Mail,
  Building,
  User,
  Book,
  Loader,
  Eye,
  EyeOff,
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { getAbsoluteUrl } from '../services/config';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Zone {
  name?: string;
  lat?: number | string;
  lng?: number | string;
  radius?: number | string;
}

interface PendingRequest {
  id: string;
  role: 'trainee' | 'hte';
  email: string;
  full_name: string;
  company_name: string;
  otp_code: string;
  requested_at: string;
  course?: string;
  school_name?: string;
  avatar_url?: string | null;
  face_registered?: boolean;
  // location fields returned by the backend
  gps_latitude?: number | string | null;
  gps_longitude?: number | string | null;
  company_address?: string | null;
  // zone metadata injected by the backend
  zone?: Zone | null;
}

interface InstructorPendingRequestsProps {
  instructorId?: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function haversineDistance(
  lat1: number | string | undefined,
  lon1: number | string | undefined,
  lat2: number | string | undefined,
  lon2: number | string | undefined,
): number {
  try {
    const toNum = (v: unknown) => (v === null || v === undefined ? NaN : Number(v));
    const R = 6371000;
    const phi1 = (toNum(lat1) * Math.PI) / 180;
    const phi2 = (toNum(lat2) * Math.PI) / 180;
    const dPhi = ((toNum(lat2) - toNum(lat1)) * Math.PI) / 180;
    const dLambda = ((toNum(lon2) - toNum(lon1)) * Math.PI) / 180;
    const a =
      Math.sin(dPhi / 2) * Math.sin(dPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) * Math.sin(dLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c;
    return isFinite(d) ? d : NaN;
  } catch {
    return NaN;
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function InstructorPendingRequests({
  instructorId: propInstructorId,
}: InstructorPendingRequestsProps) {
  // Resolve instructor id once — prop takes priority, then localStorage
  // useMemo keeps this stable across renders without re-reading storage every time
  const resolvedInstructorId = useMemo<string | null>(() => {
    if (propInstructorId) return propInstructorId;
    try {
      const raw = localStorage.getItem('user');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.id) return String(parsed.id);
      }
    } catch {
      // ignore parse errors
    }
    return null;
  }, [propInstructorId]);

  const [requests, setRequests] = useState<PendingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [showOTP, setShowOTP] = useState<Record<string, boolean>>({});
  const [selectedRequest, setSelectedRequest] = useState<PendingRequest | null>(null);
  const [showMapModal, setShowMapModal] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [photoModalUrl, setPhotoModalUrl] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchPendingRequests = useCallback(async () => {
    if (!resolvedInstructorId) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(
        getAbsoluteUrl(`/api/security/auth/get-pending-trainee-requests/?instructor_id=${resolvedInstructorId}`),
      );
      if (!res.ok) throw new Error('Failed to fetch requests');
      const data = await res.json();
      setRequests(data.requests ?? []);
    } catch (error: unknown) {
      console.error('Fetch error:', error);
      toast.error('Failed to load pending requests');
    } finally {
      setLoading(false);
    }
  }, [resolvedInstructorId]); // ← was [instructorId] — that variable doesn't exist, causing the crash

  useEffect(() => {
    const t = setTimeout(() => void fetchPendingRequests(), 0);
    const interval = setInterval(() => void fetchPendingRequests(), 10000);
    return () => {
      clearTimeout(t);
      clearInterval(interval);
    };
  }, [fetchPendingRequests]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleApprove = async (requestId: string) => {
    setApproving(requestId);
    try {
      const res = await fetch(getAbsoluteUrl('/api/security/auth/approve-trainee-registration/'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id: requestId }),
      });
      if (!res.ok) throw new Error('Approval failed');
      const data = await res.json();
      toast.success(`OTP approved! Code: ${data.otp_code}`);
      setRequests((prev) => prev.filter((r) => r.id !== requestId));
    } catch (error: any) {
      toast.error(error?.message || 'Failed to approve request');
    } finally {
      setApproving(null);
    }
  };

  const handleReject = async () => {
  if (!selectedRequest) return;
  setRejecting(selectedRequest.id);
  try {
    const res = await fetch(getAbsoluteUrl('/api/security/auth/reject-trainee-registration/'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ request_id: selectedRequest.id, reason: rejectReason }),
    });
    if (!res.ok) throw new Error('Rejection failed');
    const successMessage = rejectReason && rejectReason.trim()
      ? `Request rejected. Reason: ${rejectReason}`
      : 'Request rejected. Notification sent to trainee.';
    toast.success(successMessage);
    setRequests((prev) => prev.filter((r) => r.id !== selectedRequest.id));
    setShowRejectModal(false);
    setRejectReason('');
    setSelectedRequest(null);
  } catch (error: any) {
    toast.error(error?.message || 'Failed to reject request');
  } finally {
    setRejecting(null);
  }
};

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p>Loading pending requests...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Pending Registration Requests</h1>
          <p className="text-gray-600">
            Review and approve trainee and HTE registration requests. A total of{' '}
            <span className="font-semibold text-blue-600">{requests.length}</span> pending requests.
          </p>
        </div>

        {/* Requests List */}
        <div className="space-y-4">
          <AnimatePresence mode="wait">
            {requests.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="bg-white rounded-lg shadow-md p-12 text-center"
              >
                <Clock className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-700 mb-2">No Pending Requests</h3>
                <p className="text-gray-500">All registration requests have been processed.</p>
              </motion.div>
            ) : (
              requests.map((request) => (
                <motion.div
                  key={request.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow p-6"
                >
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                    {/* Left: Personal Info */}
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase">Name</label>
                        <div className="flex items-center gap-2 mt-1">
                          {request.avatar_url ? (
                            <button
                              onClick={() => {
                                setPhotoModalUrl(request.avatar_url ?? null);
                                setShowPhotoModal(true);
                              }}
                              className="w-10 h-10 rounded-full overflow-hidden border"
                            >
                              <img
                                src={request.avatar_url}
                                alt={`${request.full_name} avatar`}
                                className="w-full h-full object-cover"
                              />
                            </button>
                          ) : (
                            <User className="w-6 h-6 text-blue-500" />
                          )}
                          <p className="font-semibold text-gray-900">{request.full_name}</p>
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase">Email</label>
                        <div className="flex items-center gap-2 mt-1">
                          <Mail className="w-4 h-4 text-blue-500" />
                          <p className="text-sm text-gray-700">{request.email}</p>
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase">Role</label>
                        <p className="mt-1 inline-block px-3 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded-full">
                          {request.role === 'trainee' ? 'OJT Trainee' : 'HTE'}
                        </p>
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase">
                          Requested
                        </label>
                        <p className="text-sm text-gray-700 mt-1">
                          {new Date(request.requested_at).toLocaleDateString()}{' '}
                          {new Date(request.requested_at).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>

                    {/* Middle: Company / School Info */}
                    <div className="space-y-3">
                      {request.role === 'trainee' && (
                        <>
                          {request.school_name && (
                            <div>
                              <label className="text-xs font-semibold text-gray-500 uppercase">
                                School
                              </label>
                              <div className="flex items-center gap-2 mt-1">
                                <Building className="w-4 h-4 text-green-500" />
                                <p className="text-sm text-gray-700">{request.school_name}</p>
                              </div>
                            </div>
                          )}
                          {request.course && (
                            <div>
                              <label className="text-xs font-semibold text-gray-500 uppercase">
                                Course
                              </label>
                              <div className="flex items-center gap-2 mt-1">
                                <Book className="w-4 h-4 text-purple-500" />
                                <p className="text-sm text-gray-700">{request.course}</p>
                              </div>
                            </div>
                          )}
                        </>
                      )}

                      {request.company_name && (
                        <div>
                          <label className="text-xs font-semibold text-gray-500 uppercase">
                            Company
                          </label>
                          <div className="flex flex-col gap-1 mt-1">
                            <div className="flex items-center gap-2">
                              <Building className="w-4 h-4 text-green-500 shrink-0" />
                              <p className="text-sm text-gray-700">{request.company_name}</p>
                            </div>
                            {request.gps_latitude != null && request.gps_longitude != null && (
                              <div className="flex items-center gap-2 ml-6">
                                <p className="text-xs text-gray-500">
                                  {Number(request.gps_latitude).toFixed(5)},{' '}
                                  {Number(request.gps_longitude).toFixed(5)}
                                </p>
                                <button
                                  onClick={() => {
                                    setSelectedRequest(request);
                                    setShowMapModal(true);
                                  }}
                                  className="text-xs text-blue-600 underline"
                                >
                                  View on map
                                </button>
                              </div>
                            )}
                            {request.company_address && (
                              <p className="text-xs text-gray-500 ml-6">{request.company_address}</p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Right: OTP Display */}
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-4 flex flex-col justify-center items-center space-y-3">
                      <div className="text-center">
                        <label className="text-xs font-semibold text-gray-500 uppercase block mb-2">
                          OTP Code
                        </label>
                        <div className="relative flex items-center gap-2">
                          <div
                            className={`font-mono text-2xl font-bold tracking-widest select-none ${
                              showOTP[request.id] ? 'text-blue-600' : 'text-transparent'
                            }`}
                          >
                            {showOTP[request.id] ? request.otp_code : '••••••'}
                          </div>
                          <button
                            onClick={() =>
                              setShowOTP((prev) => ({ ...prev, [request.id]: !prev[request.id] }))
                            }
                            className="text-gray-500 hover:text-gray-700"
                          >
                            {showOTP[request.id] ? (
                              <EyeOff className="w-5 h-5" />
                            ) : (
                              <Eye className="w-5 h-5" />
                            )}
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 text-center">OTP sent to trainee email</p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3 pt-4 border-t">
                    <button
                      onClick={() => handleApprove(request.id)}
                      disabled={approving === request.id}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition-colors"
                    >
                      {approving === request.id ? (
                        <>
                          <Loader className="w-4 h-4 animate-spin" />
                          Approving...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4" />
                          Approve
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => {
                        setSelectedRequest(request);
                        setShowRejectModal(true);
                      }}
                      disabled={rejecting === request.id}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 transition-colors"
                    >
                      {rejecting === request.id ? (
                        <>
                          <Loader className="w-4 h-4 animate-spin" />
                          Rejecting...
                        </>
                      ) : (
                        <>
                          <XCircle className="w-4 h-4" />
                          Reject
                        </>
                      )}
                    </button>
                  </div>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Reject Modal ───────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showRejectModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-lg shadow-xl max-w-md w-full p-6"
            >
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Reject Request</h3>
              <p className="text-sm text-gray-600 mb-4">
                Are you sure you want to reject {selectedRequest?.full_name}&apos;s registration
                request?
              </p>

              <textarea
                placeholder="Reason for rejection (optional)"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full px-4 py-3 border rounded-lg mb-6 focus:outline-none focus:ring-2 focus:ring-red-500"
                rows={3}
              />

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowRejectModal(false);
                    setRejectReason('');
                    setSelectedRequest(null);
                  }}
                  className="flex-1 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReject}
                  disabled={rejecting === selectedRequest?.id}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400"
                >
                  {rejecting === selectedRequest?.id ? 'Rejecting...' : 'Reject'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Map Modal ──────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showMapModal &&
          selectedRequest &&
          selectedRequest.gps_latitude != null &&
          selectedRequest.gps_longitude != null && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white rounded-lg shadow-xl max-w-4xl w-full p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h3 className="text-lg font-semibold">Trainee Location</h3>
                    {selectedRequest.zone?.name && (
                      <div className="text-sm text-gray-600">
                        {selectedRequest.zone.name}
                        {' · '}
                        {(() => {
                          const d = haversineDistance(
                            selectedRequest.gps_latitude,
                            selectedRequest.gps_longitude,
                            selectedRequest.zone?.lat,
                            selectedRequest.zone?.lng,
                          );
                          if (isNaN(d)) return 'distance unknown';
                          return d >= 1000
                            ? `${(d / 1000).toFixed(2)} km from zone center`
                            : `${Math.round(d)} m from zone center`;
                        })()}
                      </div>
                    )}
                  </div>
                  <button
                    className="text-sm text-blue-600"
                    onClick={() => setShowMapModal(false)}
                  >
                    Close
                  </button>
                </div>

                <div style={{ height: 480, width: '100%' }}>
                  <MapContainer
                    center={[
                      Number(selectedRequest.gps_latitude),
                      Number(selectedRequest.gps_longitude),
                    ]}
                    zoom={16}
                    style={{ height: '100%', width: '100%' }}
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <Marker
                      position={[
                        Number(selectedRequest.gps_latitude),
                        Number(selectedRequest.gps_longitude),
                      ]}
                    >
                      <Popup>
                        {selectedRequest.full_name}
                        <br />
                        {selectedRequest.company_name}
                      </Popup>
                    </Marker>
                    <Circle
                      center={[
                        Number(selectedRequest.zone?.lat ?? selectedRequest.gps_latitude),
                        Number(selectedRequest.zone?.lng ?? selectedRequest.gps_longitude),
                      ]}
                      radius={Number(selectedRequest.zone?.radius ?? 100)}
                      pathOptions={{ color: '#16a34a', fillOpacity: 0.1 }}
                    />
                  </MapContainer>
                </div>
              </motion.div>
            </motion.div>
          )}
      </AnimatePresence>

      {/* ── Photo Modal ────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showPhotoModal && photoModalUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50"
            onClick={() => setShowPhotoModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-lg shadow-xl max-w-3xl w-full p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-lg font-semibold">Trainee Photo</h3>
                <button
                  className="text-sm text-blue-600"
                  onClick={() => setShowPhotoModal(false)}
                >
                  Close
                </button>
              </div>
              <div className="w-full h-[60vh] flex items-center justify-center">
                <img
                  src={photoModalUrl}
                  alt="Trainee photo"
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}