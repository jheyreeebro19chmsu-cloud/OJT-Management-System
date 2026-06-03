import React, { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Clock, Mail, Building, User, MapPin, Book, Loader, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';

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
}

interface InstructorPendingRequestsProps {
  instructorId: string;
}

export default function InstructorPendingRequests({ instructorId }: InstructorPendingRequestsProps) {
  const [requests, setRequests] = useState<PendingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [showOTP, setShowOTP] = useState<{ [key: string]: boolean }>({});
  const [selectedRequest, setSelectedRequest] = useState<PendingRequest | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);

  useEffect(() => {
    fetchPendingRequests();
    // Refresh every 10 seconds
    const interval = setInterval(fetchPendingRequests, 10000);
    return () => clearInterval(interval);
  }, [instructorId]);

  const fetchPendingRequests = async () => {
    try {
      const res = await fetch(
        `/api/security/auth/get-pending-trainee-requests/?instructor_id=${instructorId}`
      );
      if (!res.ok) throw new Error('Failed to fetch requests');

      const data = await res.json();
      setRequests(data.requests || []);
    } catch (error: any) {
      console.error('Fetch error:', error);
      toast.error('Failed to load pending requests');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (requestId: string) => {
    setApproving(requestId);
    try {
      const res = await fetch('/api/security/auth/approve-trainee-registration/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id: requestId }),
      });

      if (!res.ok) throw new Error('Approval failed');

      const data = await res.json();
      toast.success(`OTP approved! Code: ${data.otp_code}`);
      
      // Remove from pending list
      setRequests(requests.filter((r) => r.id !== requestId));
    } catch (error: any) {
      toast.error(error.message || 'Failed to approve request');
    } finally {
      setApproving(null);
    }
  };

  const handleReject = async () => {
    if (!selectedRequest) return;

    setRejecting(selectedRequest.id);
    try {
      const res = await fetch('/api/security/auth/reject-trainee-registration/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          request_id: selectedRequest.id,
          reason: rejectReason,
        }),
      });

      if (!res.ok) throw new Error('Rejection failed');

      toast.success('Request rejected. Notification sent to trainee.');
      setRequests(requests.filter((r) => r.id !== selectedRequest.id));
      setShowRejectModal(false);
      setRejectReason('');
      setSelectedRequest(null);
    } catch (error: any) {
      toast.error(error.message || 'Failed to reject request');
    } finally {
      setRejecting(null);
    }
  };

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
                          <User className="w-4 h-4 text-blue-500" />
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
                        <label className="text-xs font-semibold text-gray-500 uppercase">Requested</label>
                        <p className="text-sm text-gray-700 mt-1">
                          {new Date(request.requested_at).toLocaleDateString()} {new Date(request.requested_at).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>

                    {/* Middle: Company/School Info */}
                    <div className="space-y-3">
                      {request.role === 'trainee' && (
                        <>
                          {request.school_name && (
                            <div>
                              <label className="text-xs font-semibold text-gray-500 uppercase">School</label>
                              <div className="flex items-center gap-2 mt-1">
                                <Building className="w-4 h-4 text-green-500" />
                                <p className="text-sm text-gray-700">{request.school_name}</p>
                              </div>
                            </div>
                          )}
                          {request.course && (
                            <div>
                              <label className="text-xs font-semibold text-gray-500 uppercase">Course</label>
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
                          <label className="text-xs font-semibold text-gray-500 uppercase">Company</label>
                          <div className="flex items-center gap-2 mt-1">
                            <Building className="w-4 h-4 text-green-500" />
                            <p className="text-sm text-gray-700">{request.company_name}</p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Right: OTP Display */}
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-4 flex flex-col justify-center items-center space-y-3">
                      <div className="text-center">
                        <label className="text-xs font-semibold text-gray-500 uppercase block mb-2">OTP Code</label>
                        <div className="relative">
                          <div
                            className={`font-mono text-2xl font-bold tracking-widest ${
                              showOTP[request.id] ? 'text-blue-600' : 'text-transparent'
                            } select-none`}
                          >
                            {showOTP[request.id] ? request.otp_code : '••••••'}
                          </div>
                          <button
                            onClick={() =>
                              setShowOTP((prev) => ({
                                ...prev,
                                [request.id]: !prev[request.id],
                              }))
                            }
                            className="absolute right-0 top-0 text-gray-500 hover:text-gray-700"
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

      {/* Reject Modal */}
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
                Are you sure you want to reject {selectedRequest?.full_name}'s registration request?
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
    </div>
  );
}
