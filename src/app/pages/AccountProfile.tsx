import { User, Mail, Building2, ShieldCheck, Briefcase, MapPin, GraduationCap, BadgeCheck, Camera } from 'lucide-react';
import { HTELayout } from '../components/HTELayout';
import { useApp } from '../store/AppContext';
import { getPhotoUrl } from '../services/config';

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
  const employeePhoto = employee?.photo || currentUser?.photo || hteUser?.photo || null;
  const position = employee?.position || (role === 'hte' ? 'HTE Representative' : 'OJT Instructor');
  const department = employee?.department || 'N/A';
  const school = employee?.schoolName || 'N/A';
  const campus = employee?.campus || 'N/A';
  const course = employee?.course || 'N/A';
  const address = employee?.registrationAddress || employee?.companyAddress || 'N/A';
  const employeeId = employee?.employeeId || currentUser?.employeeId || 'N/A';

  const content = (
    <div className="max-w-2xl space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Profile</h2>
        <p className="text-sm text-gray-500 mt-1">View your account information</p>
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
        <div className="flex items-center gap-4 pb-4 border-b border-gray-100">
          <div className="w-16 h-16 rounded-2xl bg-blue-100 flex items-center justify-center overflow-hidden">
            {employeePhoto ? (
              <img src={getPhotoUrl(employeePhoto)} alt={name} className="w-full h-full object-cover" />
            ) : (
              <User className="text-blue-700" size={28} />
            )}
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">{name}</h3>
            <p className="text-sm text-blue-700 capitalize">{position}</p>
            {employee?.faceRegistered || currentUser?.faceRegistered ? (
              <div className="mt-1 flex items-center gap-1 text-xs text-green-600">
                <Camera size={12} />
                Face verified
              </div>
            ) : (
              <div className="mt-1 flex items-center gap-1 text-xs text-amber-600">
                <Camera size={12} />
                Face not enrolled
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 text-sm text-gray-700">
          <div className="flex items-center gap-3"><Mail size={16} className="text-gray-400" /> {email}</div>
          <div className="flex items-center gap-3"><BadgeCheck size={16} className="text-gray-400" /> {employeeId}</div>
          <div className="flex items-center gap-3"><Building2 size={16} className="text-gray-400" /> {company}</div>
          <div className="flex items-center gap-3"><Briefcase size={16} className="text-gray-400" /> {department}</div>
          <div className="flex items-center gap-3"><GraduationCap size={16} className="text-gray-400" /> {school}</div>
          <div className="flex items-center gap-3"><ShieldCheck size={16} className="text-green-600" /> {course}</div>
          <div className="flex items-center gap-3 sm:col-span-2"><MapPin size={16} className="text-gray-400" /> {address}</div>
          <div className="flex items-center gap-3 sm:col-span-2"><User size={16} className="text-gray-400" /> {campus}</div>
        </div>
      </div>
    </div>
  );

  return role === 'hte' ? <HTELayout hteCompany={company}>{content}</HTELayout> : content;
}
