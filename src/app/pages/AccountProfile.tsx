import {
  User,
  Mail,
  Building2,
  ShieldCheck,
  Briefcase,
  MapPin,
  GraduationCap,
  BadgeCheck,
  Camera,
  Phone,
  Calendar,
  Building,
  CheckCircle,
} from 'lucide-react';
import React from 'react';

import { useApp } from '../store/AppContext';
import { getPhotoUrl } from '../services/config';

export function AccountProfile({ role }: { role: 'admin' | 'hte' }) {
  const { currentUser, getCurrentEmployee, employees, settings } = useApp();
  const currentEmp = getCurrentEmployee();

  const hteUser = (() => {
    try {
      const stored = localStorage.getItem('ojt_hte_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  })();

  // Match employee record by email or id
  const employee =
    currentEmp ||
    employees.find(
      (e) =>
        (currentUser?.email && e.email?.toLowerCase() === currentUser.email.toLowerCase()) ||
        (hteUser?.email && e.email?.toLowerCase() === hteUser.email.toLowerCase()) ||
        e.id === currentUser?.id ||
        e.id === hteUser?.id
    );

  const name =
    employee?.name ||
    employee?.contactPerson ||
    currentUser?.name ||
    hteUser?.name ||
    'Authorized User';

  const email = employee?.email || currentUser?.email || hteUser?.email || 'N/A';
  const company =
    employee?.companyName ||
    hteUser?.companyName ||
    localStorage.getItem('ojt_hte_company') ||
    'Host Training Establishment';

  const employeePhoto = employee?.photo || currentUser?.photo || hteUser?.photo || null;
  const position =
    employee?.position ||
    hteUser?.position ||
    (role === 'hte' ? 'HTE Representative' : 'OJT Instructor');

  const department =
    employee?.department ||
    hteUser?.department ||
    (role === 'hte' ? 'Corporate Training & Internship Division' : 'College of Computer Studies');

  const school =
    employee?.schoolName ||
    (role === 'hte' ? 'CHMSU Industry Partner Network' : 'Carlos Hilado Memorial State University');

  const campus =
    employee?.campus ||
    (role === 'hte' ? 'Main Operations' : 'Talisay Campus');

  const phone =
    employee?.contactPhone ||
    (employee as any)?.phone ||
    hteUser?.contactPhone ||
    '+63 (034) 712-0000';

  // Construct readable address
  const address = (() => {
    if (employee?.street || employee?.barangay || employee?.city) {
      const parts = [
        employee.street,
        employee.barangay,
        employee.city,
        employee.province,
        employee.region,
      ].filter(Boolean);
      if (parts.length > 0) return parts.join(', ');
    }
    return employee?.registrationAddress || employee?.companyAddress || 'Negros Occidental, Philippines';
  })();

  const employeeId =
    employee?.employeeId ||
    currentUser?.employeeId ||
    (role === 'hte' ? `HTE-${(currentUser?.id || '88392').slice(0, 6).toUpperCase()}` : 'INSTR-001');

  const isHte = role === 'hte';

  return (
    <div className="max-w-3xl mx-auto space-y-6 font-sans">
      {/* Header */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm">
        <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
          <User className="text-blue-600" size={26} />
          <span>{isHte ? 'HTE Establishment Profile' : 'Instructor Profile'}</span>
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {isHte
            ? 'Account information, partner establishment details, and authorized coordinator profile'
            : 'Academic credentials, faculty information, and department assignment'}
        </p>
      </div>

      {/* Main Profile Card */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 sm:p-8 space-y-6">
        {/* User Top Section */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-5 pb-6 border-b border-slate-100">
          <div className="w-20 h-20 rounded-2xl bg-blue-50 border-2 border-blue-200 flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
            {employeePhoto ? (
              <img src={getPhotoUrl(employeePhoto)} alt={name} className="w-full h-full object-cover" />
            ) : isHte ? (
              <Building2 className="text-blue-600" size={36} />
            ) : (
              <User className="text-blue-600" size={36} />
            )}
          </div>
          <div className="space-y-1 min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-extrabold text-slate-900 leading-tight">{name}</h2>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                <CheckCircle size={12} className="text-blue-600" />
                {position}
              </span>
            </div>
            <p className="text-sm text-slate-600 font-medium">{isHte ? company : school}</p>

            <div className="flex items-center gap-4 text-xs pt-1">
              <div className="flex items-center gap-1.5 text-emerald-600 font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Active Verified {isHte ? 'Partner' : 'Faculty'}</span>
              </div>
              <div className="flex items-center gap-1 text-slate-400 font-mono">
                <Calendar size={12} />
                <span>AY {settings?.activeAcademicYear || '2026-2027'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Detailed Grid Info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          {/* Email */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-start gap-3.5">
            <div className="p-2 bg-blue-100/60 rounded-xl text-blue-600 shrink-0 mt-0.5">
              <Mail size={18} />
            </div>
            <div className="min-w-0">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Official Email</span>
              <span className="font-bold text-slate-800 break-all text-xs sm:text-sm">{email}</span>
            </div>
          </div>

          {/* Account / Employee ID */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-start gap-3.5">
            <div className="p-2 bg-blue-100/60 rounded-xl text-blue-600 shrink-0 mt-0.5">
              <BadgeCheck size={18} />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                {isHte ? 'Partner ID' : 'Faculty ID'}
              </span>
              <span className="font-mono font-extrabold text-slate-800">{employeeId}</span>
            </div>
          </div>

          {/* Contact Phone */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-start gap-3.5">
            <div className="p-2 bg-blue-100/60 rounded-xl text-blue-600 shrink-0 mt-0.5">
              <Phone size={18} />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Contact Number</span>
              <span className="font-bold text-slate-800">{phone}</span>
            </div>
          </div>

          {/* Establishment / Institution */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-start gap-3.5">
            <div className="p-2 bg-blue-100/60 rounded-xl text-blue-600 shrink-0 mt-0.5">
              <Building2 size={18} />
            </div>
            <div className="min-w-0">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                {isHte ? 'Establishment / Company' : 'University'}
              </span>
              <span className="font-bold text-slate-800 text-xs sm:text-sm truncate block">
                {isHte ? company : school}
              </span>
            </div>
          </div>

          {/* Department / Division */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-start gap-3.5">
            <div className="p-2 bg-blue-100/60 rounded-xl text-blue-600 shrink-0 mt-0.5">
              <Briefcase size={18} />
            </div>
            <div className="min-w-0">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Department / Unit</span>
              <span className="font-bold text-slate-800 text-xs sm:text-sm truncate block">{department}</span>
            </div>
          </div>

          {/* Campus / Location */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-start gap-3.5">
            <div className="p-2 bg-blue-100/60 rounded-xl text-blue-600 shrink-0 mt-0.5">
              <GraduationCap size={18} />
            </div>
            <div className="min-w-0">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                {isHte ? 'Branch / Campus Assigned' : 'Campus'}
              </span>
              <span className="font-bold text-slate-800 text-xs sm:text-sm truncate block">{campus}</span>
            </div>
          </div>

          {/* Full Address */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 sm:col-span-2 flex items-start gap-3.5">
            <div className="p-2 bg-blue-100/60 rounded-xl text-blue-600 shrink-0 mt-0.5">
              <MapPin size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Address</span>
              <span className="font-medium text-slate-800 text-xs sm:text-sm leading-relaxed">{address}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
