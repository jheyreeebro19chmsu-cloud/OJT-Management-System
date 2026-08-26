import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Loader, ShieldCheck, Users, UserRoundCheck } from 'lucide-react';

import { HTELayout } from '../components/HTELayout';
import {
  getHTEAccessRequests,
  getHTEApplications,
  getHTERegistrations,
} from '../services/hteApi';


type RecordKind = 'applications' | 'approvals' | 'registrations';

export function HTERecords() {
  const location = useLocation();
  const navigate = useNavigate();
  const kind: RecordKind = location.pathname.endsWith('approvals')
    ? 'approvals'
    : location.pathname.endsWith('registrations')
      ? 'registrations'
      : 'applications';
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    const request =
      kind === 'applications'
        ? getHTEApplications().then((response) => response.applications || [])
        : kind === 'approvals'
          ? getHTEAccessRequests().then((response) => response.access_requests || [])
          : getHTERegistrations().then((response) => response.registrations || []);

    request
      .then((records) => {
        if (active) setItems(records);
      })
      .catch(() => {
        if (active) setError('Unable to load HTE records. Please try again.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [kind]);

  const config = {
    applications: { title: 'Student Applications', icon: Users },
    approvals: { title: 'Pending Access Requests', icon: UserRoundCheck },
    registrations: { title: 'Face Registrations', icon: ShieldCheck },
  }[kind];
  const Icon = config.icon;

  return (
    <HTELayout hteCompany={localStorage.getItem('ojt_hte_company') || 'HTE Dashboard'}>
      <div className="space-y-5">
        <button onClick={() => navigate('/hte')} className="flex items-center gap-2 text-sm text-blue-700 hover:text-blue-900">
          <ArrowLeft size={16} /> Back to dashboard
        </button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
            <Icon className="text-blue-600" size={20} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{config.title}</h2>
            <p className="text-sm text-gray-500">Records available to your host establishment account</p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader className="animate-spin text-blue-600" /></div>
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex items-center gap-2">
            <AlertCircle size={16} /> {error}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-gray-100 bg-white p-10 text-center text-sm text-gray-500 shadow-sm">
            No records found.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3">Name / Reference</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3 font-medium text-gray-800">
                      {item.student_name || item.employee_id || `Request #${item.id}`}
                    </td>
                    <td className="px-4 py-3 capitalize text-gray-600">{item.status || 'Registered'}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {kind === 'applications'
                        ? `${item.rendered_hours ?? 0} / ${item.required_hours ?? 0} hours`
                        : kind === 'approvals'
                          ? item.requested_at || 'Awaiting review'
                          : item.created_at || 'Face data registered'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </HTELayout>
  );
}
