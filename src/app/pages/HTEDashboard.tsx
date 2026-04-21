import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HTELayout } from '../components/HTELayout';
import { getHTEDashboard, isHTEAuthenticated } from '../services/hteApi';
import { BarChart3, Users, Clock, CheckCircle2, AlertCircle, TrendingUp, Loader } from 'lucide-react';

interface DashboardMetrics {
  total_applications: number;
  status_counts: {
    pending: number;
    approved: number;
    rejected: number;
    completed: number;
    cancelled: number;
  };
  total_required_hours: number;
  total_rendered_hours: number;
  total_remaining_hours: number;
  unique_students: number;
}

interface TimeRecord {
  id: number;
  student_name: string;
  date: string;
  hours_rendered: number;
  is_approved: boolean;
}

export function HTEDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [recentRecords, setRecentRecords] = useState<TimeRecord[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Redirect if not authenticated
    if (!isHTEAuthenticated()) {
      navigate('/login');
      return;
    }

    loadDashboard();
  }, [navigate]);

  const loadDashboard = async () => {
    setLoading(true);
    setError(null);

    const response = await getHTEDashboard();
    if (response.success) {
      setMetrics(response.metrics);
      setRecentRecords(response.recent_time_records || []);
    } else {
      setError(response.error || 'Failed to load dashboard');
    }

    setLoading(false);
  };

  if (loading) {
    return (
      <HTELayout>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <Loader className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Loading dashboard...</p>
          </div>
        </div>
      </HTELayout>
    );
  }

  if (error) {
    return (
      <HTELayout>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="text-red-600 shrink-0 mt-0.5" size={20} />
            <div>
              <h3 className="font-semibold text-red-900">Error Loading Dashboard</h3>
              <p className="text-red-700 text-sm mt-1">{error}</p>
              <button
                onClick={loadDashboard}
                className="mt-3 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-800 rounded-lg transition-colors text-sm font-medium"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      </HTELayout>
    );
  }

  return (
    <HTELayout hteCompany={localStorage.getItem('ojt_hte_company') || 'HTE Dashboard'}>
      <div className="space-y-8">
        {/* Page Header */}
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Dashboard</h2>
          <p className="text-gray-600 mt-1">Monitor employee attendance, hours, and approvals</p>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Total Applications */}
          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-gray-500 text-sm font-medium">Total Applications</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{metrics?.total_applications || 0}</p>
              </div>
              <Users className="w-10 h-10 text-blue-500 opacity-20" />
            </div>
          </div>

          {/* Pending Applications */}
          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-yellow-500">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-gray-500 text-sm font-medium">Pending</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{metrics?.status_counts.pending || 0}</p>
                <p className="text-xs text-yellow-600 mt-2">Awaiting approval</p>
              </div>
              <AlertCircle className="w-10 h-10 text-yellow-500 opacity-20" />
            </div>
          </div>

          {/* Approved Applications */}
          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-gray-500 text-sm font-medium">Approved</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{metrics?.status_counts.approved || 0}</p>
                <p className="text-xs text-green-600 mt-2">Active placements</p>
              </div>
              <CheckCircle2 className="w-10 h-10 text-green-500 opacity-20" />
            </div>
          </div>

          {/* Unique Students */}
          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-purple-500">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-gray-500 text-sm font-medium">Unique Students</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{metrics?.unique_students || 0}</p>
                <p className="text-xs text-purple-600 mt-2">Currently employed</p>
              </div>
              <TrendingUp className="w-10 h-10 text-purple-500 opacity-20" />
            </div>
          </div>
        </div>

        {/* Hours Summary */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow p-6 text-white">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-blue-100 text-sm font-medium">Total Required Hours</p>
                <p className="text-4xl font-bold mt-2">{metrics?.total_required_hours || 0}</p>
              </div>
              <Clock className="w-12 h-12 text-blue-300 opacity-30" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow p-6 text-white">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-green-100 text-sm font-medium">Total Rendered Hours</p>
                <p className="text-4xl font-bold mt-2">{metrics?.total_rendered_hours || 0}</p>
              </div>
              <BarChart3 className="w-12 h-12 text-green-300 opacity-30" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg shadow p-6 text-white">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-orange-100 text-sm font-medium">Remaining Hours</p>
                <p className="text-4xl font-bold mt-2">{metrics?.total_remaining_hours || 0}</p>
              </div>
              <AlertCircle className="w-12 h-12 text-orange-300 opacity-30" />
            </div>
          </div>
        </div>

        {/* Status Distribution */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Application Status Distribution</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: 'Pending', count: metrics?.status_counts.pending, color: 'bg-yellow-100 text-yellow-800' },
              { label: 'Approved', count: metrics?.status_counts.approved, color: 'bg-green-100 text-green-800' },
              { label: 'Rejected', count: metrics?.status_counts.rejected, color: 'bg-red-100 text-red-800' },
              { label: 'Completed', count: metrics?.status_counts.completed, color: 'bg-blue-100 text-blue-800' },
              { label: 'Cancelled', count: metrics?.status_counts.cancelled, color: 'bg-gray-100 text-gray-800' },
            ].map((status) => (
              <div key={status.label} className={`p-4 rounded-lg ${status.color}`}>
                <p className="text-sm font-semibold">{status.count}</p>
                <p className="text-xs mt-1">{status.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Time Records */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-bold text-gray-900">Recent Time Records</h3>
            <p className="text-sm text-gray-600 mt-1">Last 20 entries from your employees</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr className="text-left text-xs font-semibold text-gray-600 uppercase">
                  <th className="px-6 py-3">Student Name</th>
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3">Hours</th>
                  <th className="px-6 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {recentRecords.length > 0 ? (
                  recentRecords.map((record) => (
                    <tr key={record.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-900 font-medium">{record.student_name}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{new Date(record.date).toLocaleDateString()}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{record.hours_rendered.toFixed(2)}h</td>
                      <td className="px-6 py-4 text-sm">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            record.is_approved
                              ? 'bg-green-100 text-green-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}
                        >
                          {record.is_approved ? 'Approved' : 'Pending'}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                      No time records yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick Links */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <button
            onClick={() => navigate('/hte/applications')}
            className="bg-white hover:shadow-lg rounded-lg shadow p-6 text-left transition-all"
          >
            <Users className="w-8 h-8 text-blue-600 mb-3" />
            <h4 className="font-bold text-gray-900 mb-1">View Applications</h4>
            <p className="text-sm text-gray-600">See all employee applications and status</p>
          </button>

          <button
            onClick={() => navigate('/hte/approvals')}
            className="bg-white hover:shadow-lg rounded-lg shadow p-6 text-left transition-all"
          >
            <CheckCircle2 className="w-8 h-8 text-green-600 mb-3" />
            <h4 className="font-bold text-gray-900 mb-1">Pending Approvals</h4>
            <p className="text-sm text-gray-600">Approve or reject access requests</p>
          </button>

          <button
            onClick={() => navigate('/hte/registrations')}
            className="bg-white hover:shadow-lg rounded-lg shadow p-6 text-left transition-all"
          >
            <BarChart3 className="w-8 h-8 text-purple-600 mb-3" />
            <h4 className="font-bold text-gray-900 mb-1">Face Registrations</h4>
            <p className="text-sm text-gray-600">Manage employee face data</p>
          </button>
        </div>
      </div>
    </HTELayout>
  );
}
