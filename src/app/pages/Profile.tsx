import {
  User,
  Building,
  GraduationCap,
  Clock,
  Camera,
  Edit2,
  Check,
  X,
  MapPin,
  Award,
  Star,
  KeyRound,
} from 'lucide-react';
import { motion } from 'motion/react';
import React, { useState } from 'react';
import { toast } from 'sonner';

import { useApp } from '../store/AppContext';


const GRADE_CONFIG = {
  Excellent: { color: 'text-green-700', bg: 'bg-green-100' },
  'Very Good': { color: 'text-blue-700', bg: 'bg-blue-100' },
  Good: { color: 'text-sky-700', bg: 'bg-sky-100' },
  Satisfactory: { color: 'text-yellow-700', bg: 'bg-yellow-100' },
  'Needs Improvement': { color: 'text-red-700', bg: 'bg-red-100' },
};

const CRITERIA_LABELS: Record<string, string> = {
  attendanceScore: 'Attendance',
  performanceScore: 'Performance',
  attitudeScore: 'Attitude',
  punctualityScore: 'Punctuality',
  communicationScore: 'Communication',
};

export function Profile() {
  const {
    getCurrentEmployee,
    getEmployeeRecords,
    updateEmployee,
    getEmployeeEvaluation,
    getLatestHostFeedback,
    changeCurrentUserPassword,
  } = useApp();
  const employee = getCurrentEmployee();
  const records = employee ? getEmployeeRecords(employee.id) : [];
  const evaluation = employee ? getEmployeeEvaluation(employee.id) : null;
  const hostFeedback = employee ? getLatestHostFeedback(employee.id) : null;
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: employee?.name || '',
    email: employee?.email || '',
    supervisorName: employee?.supervisorName || '',
  });
  const [passwordForm, setPasswordForm] = useState({ current: '', new: '', confirm: '' });

  if (!employee) return null;

  const totalHours = records.reduce((s, r) => s + (r.totalHours || 0), 0);
  const presentDays = records.filter((r) => r.status === 'present' || r.status === 'overtime').length;
  const progressPct = Math.min((totalHours / employee.requiredHours) * 100, 100);

  const handleSave = () => {
    updateEmployee(employee.id, form);
    setEditing(false);
  };

  const handlePasswordChange = async () => {
    const result = await changeCurrentUserPassword(passwordForm.current, passwordForm.new);
    if (result.success) {
      toast.success(result.message);
      setPasswordForm({ current: '', new: '', confirm: '' });
    } else {
      toast.error(result.message);
    }
  };

  const Section = ({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) => (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">{icon}</div>
        <h3 className="font-bold text-gray-800 text-sm">{title}</h3>
      </div>
      {children}
    </div>
  );

  const InfoRow = ({ label, value }: { label: string; value: string }) => (
    <div className="flex items-start justify-between py-2 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-500 shrink-0 w-28">{label}</span>
      <span className="text-xs font-medium text-gray-800 text-right flex-1 ml-2">{value || '—'}</span>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Profile Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-blue-800 to-blue-900 rounded-3xl p-5 text-white"
      >
        <div className="flex items-start gap-4">
          <div className="relative">
            <div className="w-16 h-16 bg-blue-700 rounded-2xl flex items-center justify-center overflow-hidden">
              {employee.photo ? (
                <img
                  src={employee.photo}
                  alt={employee.name}
                  className="w-full h-full object-cover"
                  style={{ transform: 'scaleX(-1)' }}
                />
              ) : (
                <User size={28} className="text-blue-300" />
              )}
            </div>
            {employee.faceRegistered && (
              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center border-2 border-blue-800">
                <Camera size={9} className="text-white" />
              </div>
            )}
          </div>
          <div className="flex-1">
            <h2 className="font-bold text-lg leading-tight">{employee.name}</h2>
            <p className="text-blue-200 text-sm">{employee.employeeId}</p>
            <p className="text-blue-300 text-xs mt-0.5">
              {employee.position} • {employee.department}
            </p>
            {employee.faceRegistered ? (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-green-300">
                <Camera size={12} />
                Facial Recognition Enrolled
              </div>
            ) : (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-red-300">
                <Camera size={12} />
                Face Not Registered
              </div>
            )}
          </div>
        </div>

        {/* Progress */}
        <div className="mt-4">
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-blue-200">OJT Progress</span>
            <span className="text-white font-medium">
              {totalHours.toFixed(1)} / {employee.requiredHours} hrs ({Math.round(progressPct)}%)
            </span>
          </div>
          <div className="h-2 bg-blue-700 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-sky-400 to-green-400 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 1, delay: 0.2 }}
            />
          </div>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-2 mt-4">
          <div className="bg-white/15 rounded-xl p-2 text-center">
            <p className="font-bold">{presentDays}</p>
            <p className="text-blue-200 text-xs">Present</p>
          </div>
          <div className="bg-white/15 rounded-xl p-2 text-center">
            <p className="font-bold">{records.filter((r) => r.status === 'late').length}</p>
            <p className="text-blue-200 text-xs">Late Days</p>
          </div>
          <div className="bg-white/15 rounded-xl p-2 text-center">
            <p className="font-bold">{totalHours.toFixed(0)}</p>
            <p className="text-blue-200 text-xs">Total Hrs</p>
          </div>
        </div>
      </motion.div>

      {/* Evaluation Result (if finalized) */}
      {evaluation &&
        evaluation.status === 'final' &&
        (() => {
          const gc = GRADE_CONFIG[evaluation.grade];
          return (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 }}
              className={`rounded-2xl p-5 border ${gc.bg} shadow-sm`}
            >
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-white/60 rounded-lg flex items-center justify-center">
                  <Award size={16} className={gc.color} />
                </div>
                <h3 className={`font-bold text-sm ${gc.color}`}>OJT Evaluation Result</h3>
                <span className="ml-auto text-xs text-gray-500">
                  {new Date(evaluation.evaluatedAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
              </div>

              <div className="text-center mb-4">
                <p className={`text-4xl font-bold ${gc.color}`}>{evaluation.overallScore}%</p>
                <p className={`text-lg font-semibold mt-1 ${gc.color}`}>{evaluation.grade}</p>
              </div>

              {/* Score breakdown */}
              <div className="space-y-2 mb-4">
                {Object.entries(CRITERIA_LABELS).map(([key, label]) => {
                  const score = evaluation[key as keyof typeof evaluation] as number;
                  return (
                    <div key={key}>
                      <div className="flex justify-between text-xs mb-0.5">
                        <span className="text-gray-600">{label}</span>
                        <span className="font-semibold text-gray-800">{score}%</span>
                      </div>
                      <div className="h-1.5 bg-white/60 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${score >= 90 ? 'bg-green-500' : score >= 80 ? 'bg-blue-500' : score >= 70 ? 'bg-sky-500' : score >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`}
                          style={{ width: `${score}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {evaluation.strengths && (
                <div className="bg-white/50 rounded-xl p-3 mb-2">
                  <p className="text-xs font-semibold text-gray-500 mb-1">Strengths</p>
                  <p className="text-sm text-gray-700">{evaluation.strengths}</p>
                </div>
              )}
              {evaluation.recommendations && (
                <div className="bg-white/50 rounded-xl p-3">
                  <p className="text-xs font-semibold text-gray-500 mb-1">Recommendations</p>
                  <p className="text-sm text-gray-700">{evaluation.recommendations}</p>
                </div>
              )}
            </motion.div>
          );
        })()}

      {hostFeedback && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100"
        >
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
              <Star size={15} className="text-amber-700" />
            </div>
            <div>
              <h3 className="font-bold text-gray-800 text-sm">Host Establishment Feedback</h3>
              <p className="text-xs text-gray-500">
                {hostFeedback.hostCompany} - {hostFeedback.hostName}
              </p>
            </div>
            <span className="ml-auto text-xs text-gray-400">
              {new Date(hostFeedback.submittedAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-amber-50 rounded-xl p-3 text-center">
              <p className="text-xs text-amber-700">Overall Score</p>
              <p className="text-xl font-bold text-amber-800">{hostFeedback.overallScore}%</p>
            </div>
            <div className="bg-amber-50 rounded-xl p-3 text-center">
              <p className="text-xs text-amber-700">Recommendation</p>
              <p className="text-sm font-semibold text-amber-800">{hostFeedback.recommendation}</p>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 text-xs mb-4">
            <div className="bg-gray-50 rounded-xl p-2 text-center">
              Attendance: <span className="font-semibold">{hostFeedback.attendanceScore}%</span>
            </div>
            <div className="bg-gray-50 rounded-xl p-2 text-center">
              Performance: <span className="font-semibold">{hostFeedback.performanceScore}%</span>
            </div>
            <div className="bg-gray-50 rounded-xl p-2 text-center">
              Attitude: <span className="font-semibold">{hostFeedback.attitudeScore}%</span>
            </div>
            <div className="bg-gray-50 rounded-xl p-2 text-center">
              Communication: <span className="font-semibold">{hostFeedback.communicationScore}%</span>
            </div>
            <div className="bg-gray-50 rounded-xl p-2 text-center">
              Teamwork: <span className="font-semibold">{hostFeedback.teamworkScore}%</span>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs font-semibold text-gray-500 mb-1">Strengths</p>
              <p className="text-sm text-gray-700">{hostFeedback.strengths || '-'}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs font-semibold text-gray-500 mb-1">Areas for Improvement</p>
              <p className="text-sm text-gray-700">{hostFeedback.areasForImprovement || '-'}</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Editable Personal Info */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <User size={15} className="text-blue-700" />
            </div>
            <h3 className="font-bold text-gray-800 text-sm">Personal Information</h3>
          </div>
          {!editing ? (
            <button
              onClick={() => setEditing(true)}
              className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              <Edit2 size={12} /> Edit
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                className="text-xs text-green-600 hover:text-green-800 flex items-center gap-1"
              >
                <Check size={12} /> Save
              </button>
              <button
                onClick={() => setEditing(false)}
                className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
              >
                <X size={12} /> Cancel
              </button>
            </div>
          )}
        </div>
        {editing ? (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">Full Name</label>
              <input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">Email</label>
              <input
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">Supervisor Name</label>
              <input
                value={form.supervisorName}
                onChange={(e) => setForm((p) => ({ ...p, supervisorName: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        ) : (
          <div>
            <InfoRow label="Full Name" value={employee.name} />
            <InfoRow label="Email" value={employee.email} />
            <InfoRow label="Supervisor" value={employee.supervisorName} />
            <InfoRow label="Department" value={employee.department} />
            {employee.registrationAddress && (
              <div className="flex items-start gap-2 py-2 border-b border-gray-50">
                <MapPin size={12} className="text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-gray-500">Registered From</p>
                  <p className="text-xs font-mono text-gray-700 mt-0.5">{employee.registrationAddress}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </motion.div>

      {/* Security Settings */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12 }}
        className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100"
      >
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center">
            <KeyRound size={15} className="text-indigo-700" />
          </div>
          <h3 className="font-bold text-gray-800 text-sm">Security</h3>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 font-medium block mb-1">Current Password</label>
            <input
              type="password"
              value={passwordForm.current}
              onChange={(e) => setPasswordForm((p) => ({ ...p, current: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="••••••••"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium block mb-1">New Password</label>
            <input
              type="password"
              value={passwordForm.new}
              onChange={(e) => setPasswordForm((p) => ({ ...p, new: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Min 8 characters"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium block mb-1">Confirm New Password</label>
            <input
              type="password"
              value={passwordForm.confirm}
              onChange={(e) => setPasswordForm((p) => ({ ...p, confirm: e.target.value }))}
              className={`w-full px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${passwordForm.confirm && passwordForm.new !== passwordForm.confirm ? 'border-red-300' : 'border-gray-200'}`}
              placeholder="••••••••"
            />
          </div>
          <button
            onClick={handlePasswordChange}
            disabled={
              !passwordForm.current ||
              !passwordForm.new ||
              passwordForm.new !== passwordForm.confirm ||
              passwordForm.new.length < 8
            }
            className="w-full py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 transition-all"
          >
            Update Password
          </button>
        </div>
      </motion.div>

      {/* Company Info */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <Section title="Company Information" icon={<Building size={15} className="text-blue-700" />}>
          <InfoRow label="Company" value={employee.companyName} />
          <InfoRow label="Department" value={employee.department} />
          <InfoRow label="Position" value={employee.position} />
          <InfoRow
            label="Start Date"
            value={new Date(employee.startDate).toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          />
          <InfoRow
            label="End Date"
            value={new Date(employee.endDate).toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          />
        </Section>
      </motion.div>

      {/* School Info */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Section title="School Information" icon={<GraduationCap size={15} className="text-blue-700" />}>
          <InfoRow label="School" value={employee.schoolName} />
          <InfoRow label="Course" value={employee.course} />
          <InfoRow label="Required Hours" value={`${employee.requiredHours} hours`} />
        </Section>
      </motion.div>

      {/* Schedule */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
        <Section title="Schedule Info" icon={<Clock size={15} className="text-blue-700" />}>
          <InfoRow
            label="OJT Start"
            value={new Date(employee.startDate).toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          />
          <InfoRow
            label="OJT End"
            value={new Date(employee.endDate).toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          />
          <InfoRow
            label="Hours Left"
            value={`${Math.max(0, employee.requiredHours - totalHours).toFixed(1)} hrs remaining`}
          />
        </Section>
      </motion.div>
    </div>
  );
}
