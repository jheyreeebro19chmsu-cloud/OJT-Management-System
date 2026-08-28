import { User, Mail, Building2, ShieldCheck } from 'lucide-react';
import { HTELayout } from '../components/HTELayout';
import { useApp } from '../store/AppContext';

export function AccountProfile({ role }: { role: 'admin' | 'hte' }) {
  const { currentUser, getCurrentEmployee } = useApp();
  const employee = getCurrentEmployee();
  const hteUser = (() => {
    try {
      const stored = localStorage.getItem('ojt_hte_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  })();
  const name = employee?.name || currentUser?.name || hteUser?.name || 'Account User';
  const email = employee?.email || currentUser?.email || hteUser?.email || 'No email available';
  const company = employee?.companyName || hteUser?.company_name || hteUser?.companyName || 'OJT Daily Time Record';

  const content = (
    <div className="max-w-xl space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Profile</h2>
        <p className="text-sm text-gray-500 mt-1">View your account information</p>
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
        <div className="flex items-center gap-4 pb-4 border-b border-gray-100">
          <div className="w-16 h-16 rounded-2xl bg-blue-100 flex items-center justify-center">
            <User className="text-blue-700" size={28} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">{name}</h3>
            <p className="text-sm text-blue-700 capitalize">{role === 'hte' ? 'HTE Representative' : 'OJT Instructor'}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm text-gray-700"><Mail size={16} className="text-gray-400" />{email}</div>
        <div className="flex items-center gap-3 text-sm text-gray-700"><Building2 size={16} className="text-gray-400" />{company}</div>
        <div className="flex items-center gap-3 text-sm text-gray-700"><ShieldCheck size={16} className="text-green-600" />Verified account</div>
      </div>
    </div>
  );

  return role === 'hte' ? <HTELayout hteCompany={company}>{content}</HTELayout> : content;
}
