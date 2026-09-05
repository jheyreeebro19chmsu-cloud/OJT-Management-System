import { Users, Search, Plus, Trash2, Camera, CheckCircle, XCircle, Eye, X, User, MapPin, Shield, Printer, FileText, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import React, { useState } from 'react';
import { toast } from 'sonner';

import { FaceCapture } from '../../components/FaceCapture';
import { isSecurityApiConfigured, registerFace } from '../../services/securityApi';
import { useApp } from '../../store/AppContext';
import { Employee } from '../../types';
import { getPhotoUrl } from '../../services/config';
import { campusOptions, departmentOptions, getCoursesForDepartment } from '../../data/academicOptions';




type ModalMode = 'view' | 'add' | null;

const BLANK_FORM = {
  name: '',
  email: '',
  employeeId: '',
  department: '',
  position: 'OJT Trainee',
  companyName: '',
  supervisorName: '',
  schoolName: '',
  campus: '',
  course: '',
  startDate: '',
  endDate: '',
  requiredHours: 486,
};

export function AdminEmployees() {
  const {
    employees,
    timeRecords,
    registerEmployee,
    updateEmployee,
    deleteEmployee,
    approveEmployee,
    rejectEmployee,
    settings,
    addRequiredDocument,
    getEmployeeRequiredDocuments,
    submitRequiredDocument,
    getRequiredDocumentSubmission,
    getRequirementStatus,
    getEmployeeRequirementSummary,
  } = useApp();
  const [search, setSearch] = useState('');
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
  const [previewInstructorDoc, setPreviewInstructorDoc] = useState<{ studentName: string; studentId: string; title: string; fileName?: string; fileUrl?: string; note?: string; date?: string } | null>(null);
  const [form, setForm] = useState(BLANK_FORM);
  const [faceEnrollOpen, setFaceEnrollOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState(false);
  const [addressValue, setAddressValue] = useState('');
  const [docTitle, setDocTitle] = useState('');
  const [docDescription, setDocDescription] = useState('');
  const [docDueDate, setDocDueDate] = useState('');

  const getEmployeeGroup = (emp: Employee) => {
    const normalized = emp.position?.toLowerCase() || '';
    if (normalized.includes('instructor')) return 'instructor';
    if (normalized.includes('hte') || normalized.includes('host training')) return 'hte';
    return 'student';
  };

  const filteredGroups = {
    pending: employees.filter(
      (e) =>
        (!e.active || e.approvalStatus === 'pending') &&
        (e.name.toLowerCase().includes(search.toLowerCase()) ||
          e.email.toLowerCase().includes(search.toLowerCase()) ||
          (e.department || '').toLowerCase().includes(search.toLowerCase()))
    ),
    student: employees.filter(
      (e) =>
        (e.active && e.approvalStatus !== 'pending') &&
        getEmployeeGroup(e) === 'student' &&
        (e.name.toLowerCase().includes(search.toLowerCase()) ||
          e.employeeId.toLowerCase().includes(search.toLowerCase()) ||
          e.department.toLowerCase().includes(search.toLowerCase()))
    ),
    instructor: employees.filter(
      (e) =>
        (e.active && e.approvalStatus !== 'pending') &&
        getEmployeeGroup(e) === 'instructor' &&
        (e.name.toLowerCase().includes(search.toLowerCase()) ||
          e.employeeId.toLowerCase().includes(search.toLowerCase()) ||
          e.department.toLowerCase().includes(search.toLowerCase()))
    ),
    hte: employees.filter(
      (e) =>
        (e.active && e.approvalStatus !== 'pending') &&
        getEmployeeGroup(e) === 'hte' &&
        (e.name.toLowerCase().includes(search.toLowerCase()) ||
          e.employeeId.toLowerCase().includes(search.toLowerCase()) ||
          e.department.toLowerCase().includes(search.toLowerCase()))
    ),
  };

  const totalFiltered = Object.values(filteredGroups).reduce((sum, items) => sum + items.length, 0);

  const openView = (emp: Employee) => {
    setSelectedEmp(emp);
    setFaceEnrollOpen(false);
    setEditingAddress(false);
    setAddressValue(emp.registrationAddress || '');
    setModalMode('view');
  };
  const openAdd = () => {
    setForm(BLANK_FORM);
    setModalMode('add');
  };
  const closeModal = () => {
    setModalMode(null);
    setSelectedEmp(null);
    setFaceEnrollOpen(false);
  };

  const handleAdd = () => {
    registerEmployee({
      ...form,
      requiredHours: Number(form.requiredHours),
      faceRegistered: false,
      active: true,
      approvalStatus: 'approved',
    });
    closeModal();
  };

  const handleDelete = (id: string) => {
    if (confirm('Deactivate this employee?')) deleteEmployee(id);
  };

  const handleApprove = (emp: Employee) => {
    approveEmployee(emp.id);
    toast.success(`${emp.name} approved & enrolled for Academic Year ${settings.activeAcademicYear}!`);
  };

  const handleReject = (emp: Employee) => {
    if (confirm(`Decline registration request for ${emp.name}?`)) {
      rejectEmployee(emp.id);
      toast.info(`Registration for ${emp.name} declined.`);
    }
  };

  const getEmpStats = (empId: string) => {
    const recs = timeRecords.filter((r) => r.employeeId === empId);
    const totalHours = recs.reduce((s, r) => s + (r.totalHours || 0), 0);
    const present = recs.filter((r) => r.status === 'present' || r.status === 'overtime').length;
    const late = recs.filter((r) => r.status === 'late').length;
    return { totalHours, present, late, totalDays: recs.length };
  };

  const upd = (f: string, v: string | number) => setForm((p) => ({ ...p, [f]: v }));

  const groupConfig = {
    pending: {
      title: 'Pending Approvals',
      emptyText: 'No pending student enrollments awaiting approval',
      accent: 'amber',
      badge: 'bg-amber-100 text-amber-800 font-bold',
    },
    student: {
      title: 'Active Trainees',
      emptyText: 'No active trainees found for this academic year',
      accent: 'blue',
      badge: 'bg-blue-100 text-blue-700',
    },
    instructor: {
      title: 'Instructors',
      emptyText: 'No instructors found',
      accent: 'purple',
      badge: 'bg-purple-100 text-purple-700',
    },
    hte: {
      title: 'HTE Supervisors',
      emptyText: 'No HTE accounts found',
      accent: 'emerald',
      badge: 'bg-emerald-100 text-emerald-700',
    },
  } as const;

  const renderEmployeeSection = (group: keyof typeof filteredGroups, countLabel: string) => {
    const items = filteredGroups[group];
    const config = groupConfig[group];
    const isPendingGroup = group === 'pending';

    // Hide pending section entirely if empty, unless it's the only search result
    if (isPendingGroup && items.length === 0 && search === '') return null;

    return (
      <div key={group} className={`bg-white rounded-2xl shadow-sm border ${isPendingGroup ? 'border-amber-200 ring-2 ring-amber-400/20' : 'border-gray-100'} overflow-hidden`}>
        <div className={`flex items-center justify-between px-5 py-3 ${isPendingGroup ? 'bg-amber-50/80 border-b border-amber-100' : 'bg-gray-50 border-b border-gray-100'}`}>
          <div className="flex items-center gap-2">
            <h3 className={`text-sm font-semibold ${isPendingGroup ? 'text-amber-900' : 'text-gray-800'}`}>{config.title}</h3>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${config.badge}`}>{items.length}</span>
          </div>
          <span className="text-[11px] uppercase tracking-wide text-gray-400">{countLabel}</span>
        </div>

        {items.length === 0 ? (
          <div className="text-center py-8">
            <Users size={28} className="text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500 font-medium">{config.emptyText}</p>
          </div>
        ) : (
          items.map((emp, idx) => {
            const stats = getEmpStats(emp.id);
            const progress = Math.min((stats.totalHours / emp.requiredHours) * 100, 100);
            return (
              <motion.div
                key={emp.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
              >
                <div
                  onClick={() => openView(emp)}
                  className={`hidden lg:grid ${isPendingGroup ? 'grid-cols-[2fr_1.5fr_1.5fr_auto]' : 'grid-cols-[2fr_1fr_1fr_1fr_auto]'} gap-4 items-center px-5 py-4 border-b border-gray-50 hover:bg-blue-50/60 cursor-pointer transition-colors`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center shrink-0 overflow-hidden">
                      {emp.photo ? (
                        <img
                          src={getPhotoUrl(emp.photo)}
                          alt=""
                          className="w-full h-full object-cover"
                          style={{ transform: 'scaleX(-1)' }}
                        />
                      ) : (
                        <span className="text-blue-700 font-bold text-sm">{emp.name.charAt(0)}</span>
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800 text-sm hover:text-blue-700 transition-colors">{emp.name}</p>
                      <p className="text-xs text-gray-400">
                        {emp.employeeId} • {emp.email}
                      </p>
                      {emp.academicYear && (
                        <span className="inline-block mt-0.5 text-[10px] font-bold text-sky-700 bg-sky-50 px-1.5 py-0.2 rounded border border-sky-200">
                          A.Y. {emp.academicYear}
                        </span>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-gray-700">{emp.department || 'General'}</p>
                    <p className="text-xs text-gray-400">{emp.course || emp.position}</p>
                  </div>
                  {!isPendingGroup ? (
                    <div>
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>{stats.totalHours.toFixed(0)}h</span>
                        <span>{Math.round(progress)}%</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${progress}%` }} />
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">{emp.requiredHours}h required</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-xs font-semibold text-gray-700">{emp.companyName || 'No Company Yet'}</p>
                      <p className="text-[11px] text-gray-400 truncate max-w-[200px]">{emp.registrationAddress || 'Live GPS Centered'}</p>
                    </div>
                  )}
                  {!isPendingGroup && (
                    <div className="flex items-center gap-2">
                      {emp.faceRegistered ? (
                        <span className="text-xs flex items-center gap-1 text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                          <Camera size={10} /> Enrolled
                        </span>
                      ) : (
                        <span className="text-xs flex items-center gap-1 text-red-500 bg-red-50 px-2 py-0.5 rounded-full">
                          <XCircle size={10} /> Not enrolled
                        </span>
                      )}
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    {isPendingGroup ? (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleApprove(emp);
                          }}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
                          title="Accept & Enroll Trainee"
                        >
                          <CheckCircle size={13} />
                          Accept & Enroll
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleReject(emp);
                          }}
                          className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all"
                          title="Decline Request"
                        >
                          <XCircle size={13} />
                          Decline
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openView(emp);
                          }}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                          title="View Profile"
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(emp.id);
                          }}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                          title="Delete Employee"
                        >
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div
                  onClick={() => openView(emp)}
                  className="lg:hidden p-4 border-b border-gray-50 hover:bg-blue-50/60 cursor-pointer transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center shrink-0 overflow-hidden">
                      {emp.photo ? (
                        <img
                          src={getPhotoUrl(emp.photo)}
                          alt=""
                          className="w-full h-full object-cover"
                          style={{ transform: 'scaleX(-1)' }}
                        />
                      ) : (
                        <span className="text-blue-700 font-bold">{emp.name.charAt(0)}</span>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold text-gray-800 text-sm hover:text-blue-700">{emp.name}</p>
                          <p className="text-xs text-gray-400">{emp.employeeId || emp.email}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{emp.department} • {emp.course}</p>
                        </div>
                        <div className="flex gap-1">
                          {isPendingGroup ? (
                            <div className="flex flex-col gap-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleApprove(emp);
                                }}
                                className="px-2 py-1 bg-emerald-600 text-white rounded-lg text-xs font-bold"
                              >
                                Accept
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleReject(emp);
                                }}
                                className="px-2 py-1 bg-red-50 text-red-600 rounded-lg text-xs"
                              >
                                Decline
                              </button>
                            </div>
                          ) : (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openView(emp);
                                }}
                                className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg"
                                title="View Profile"
                              >
                                <Eye size={14} />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(emp.id);
                                }}
                                className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg"
                                title="Delete Employee"
                              >
                                <Trash2 size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      {!isPendingGroup && (
                        <div className="mt-2">
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${progress}%` }} />
                          </div>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {stats.totalHours.toFixed(0)} / {emp.requiredHours}h ({Math.round(progress)}%)
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">OJT/Records</h2>
          <p className="text-sm text-gray-500">
            {filteredGroups.student.length} Active Trainees • Current Academic Year: <span className="font-semibold text-blue-700">A.Y. {settings.activeAcademicYear}</span>
          </p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 bg-blue-700 text-white rounded-xl text-sm font-medium hover:bg-blue-800 transition-colors shadow-sm"
        >
          <Plus size={15} />
          Add Employee
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Object.entries(groupConfig).map(([key, config]) => (
          <div key={key} className={`rounded-xl border ${key === 'pending' && filteredGroups.pending.length > 0 ? 'border-amber-300 bg-amber-50/50' : 'border-gray-200 bg-white'} px-3 py-2`}>
            <p className="text-[11px] uppercase tracking-wide text-gray-400">{config.title}</p>
            <p className={`text-lg font-bold ${key === 'pending' && filteredGroups.pending.length > 0 ? 'text-amber-700' : 'text-gray-800'}`}>
              {filteredGroups[key as keyof typeof filteredGroups].length}
            </p>
          </div>
        ))}
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, ID, or department..."
          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        />
      </div>

      <div className="space-y-5">
        {totalFiltered === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 text-center py-12">
            <Users size={40} className="text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500 font-medium">No employees found</p>
          </div>
        ) : (
          (['pending', 'student', 'instructor', 'hte'] as const).map((group) => renderEmployeeSection(group, groupConfig[group].title))
        )}
      </div>

      {/* Modal */}
      <AnimatePresence>
        {modalMode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={(e) => e.target === e.currentTarget && closeModal()}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between p-5 border-b border-gray-100">
                <h3 className="font-bold text-gray-800">
                  {modalMode === 'view' ? `${selectedEmp?.name}` : 'Add New Trainee'}
                </h3>
                <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                  <X size={20} />
                </button>
              </div>

              <div className="p-5">
                {modalMode === 'view' && selectedEmp ? (
                  faceEnrollOpen ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-gray-800 text-sm">Enroll face — {selectedEmp.name}</p>
                          <p className="text-xs text-gray-500">
                            Use a clear, frontal photo. Saved to the Django server for clock-in verification.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setFaceEnrollOpen(false)}
                          className="text-xs text-gray-500 hover:text-gray-800"
                        >
                          Back
                        </button>
                      </div>
                      <FaceCapture
                        mode="register"
                        employeeName={selectedEmp.name}
                        autoStart
                        onSuccess={async (imageData) => {
                          if (!imageData) {
                            toast.error('No image captured. Try again or allow the camera.');
                            setFaceEnrollOpen(false);
                            return;
                          }
                          try {
                            const res = await registerFace({ employee_id: selectedEmp.id, image: imageData });
                            if (res.success && res.image_url) {
                              updateEmployee(selectedEmp.id, { photo: res.image_url, faceRegistered: true });
                              setSelectedEmp({ ...selectedEmp, photo: res.image_url, faceRegistered: true });
                              toast.success('Face enrolled on server. Trainee can use clock-in verification.');
                            } else {
                              toast.error(res.message || 'Registration failed');
                            }
                          } catch (e) {
                            toast.error(
                              e instanceof Error
                                ? e.message
                                : 'Could not reach the security API. Check URL and API key.'
                            );
                          }
                          setFaceEnrollOpen(false);
                        }}
                        onCancel={() => setFaceEnrollOpen(false)}
                      />
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Profile header */}
                      <div className="flex items-center gap-4 p-4 bg-blue-50 rounded-2xl">
                        <div className="w-16 h-16 bg-blue-200 rounded-2xl flex items-center justify-center overflow-hidden">
                          {selectedEmp.photo ? (
                            <img
                              src={getPhotoUrl(selectedEmp.photo)}
                              alt=""
                              className="w-full h-full object-cover"
                              style={{ transform: 'scaleX(-1)' }}
                            />
                          ) : (
                            <User size={28} className="text-blue-700" />
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-blue-900">{selectedEmp.name}</p>
                          <p className="text-blue-600 text-sm">{selectedEmp.employeeId}</p>
                          <div className="flex gap-2 mt-1">
                            {selectedEmp.faceRegistered ? (
                              <span className="text-xs flex items-center gap-0.5 text-green-600 bg-green-100 px-2 py-0.5 rounded-full">
                                <Camera size={10} /> Face Enrolled
                              </span>
                            ) : (
                              <span className="text-xs text-red-500 bg-red-50 px-2 py-0.5 rounded-full">
                                Not Enrolled
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="mt-3">
                        <label className="text-xs font-semibold text-gray-600 block mb-1">Home Address</label>
                        {!editingAddress ? (
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-sm text-gray-700">{selectedEmp.registrationAddress || '—'}</div>
                            <button
                              onClick={() => setEditingAddress(true)}
                              className="text-sm text-blue-600 hover:text-blue-800"
                            >
                              Edit
                            </button>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <input
                              value={addressValue}
                              onChange={(e) => setAddressValue(e.target.value)}
                              className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm"
                            />
                            <button
                              onClick={async () => {
                                if (!selectedEmp) return;
                                await updateEmployee(selectedEmp.id, { registrationAddress: addressValue });
                                setSelectedEmp({ ...selectedEmp, registrationAddress: addressValue });
                                setEditingAddress(false);
                                toast.success('Address updated');
                              }}
                              className="px-3 py-2 bg-blue-600 text-white rounded-xl text-sm"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => { setEditingAddress(false); setAddressValue(selectedEmp.registrationAddress || '') }}
                              className="px-3 py-2 bg-gray-100 text-gray-700 rounded-xl text-sm"
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Stats */}
                      {(() => {
                        const stats = getEmpStats(selectedEmp.id);
                        const prog = Math.min((stats.totalHours / selectedEmp.requiredHours) * 100, 100);
                        return (
                          <div className="grid grid-cols-3 gap-2">
                            <div className="bg-green-50 rounded-xl p-3 text-center">
                              <p className="font-bold text-green-700">{stats.present}</p>
                              <p className="text-xs text-gray-500">Present</p>
                            </div>
                            <div className="bg-orange-50 rounded-xl p-3 text-center">
                              <p className="font-bold text-orange-700">{stats.late}</p>
                              <p className="text-xs text-gray-500">Late</p>
                            </div>
                            <div className="bg-blue-50 rounded-xl p-3 text-center">
                              <p className="font-bold text-blue-700">{stats.totalHours.toFixed(0)}h</p>
                              <p className="text-xs text-gray-500">Hours</p>
                            </div>
                          </div>
                        );
                      })()}

                      {[
                        { label: 'Email', val: selectedEmp.email },
                        { label: 'Department', val: selectedEmp.department },
                        { label: 'Company', val: selectedEmp.companyName },
                        { label: 'Supervisor', val: selectedEmp.supervisorName },
                        { label: 'School', val: selectedEmp.schoolName },
                        { label: 'Campus', val: selectedEmp.campus || 'Not specified' },
                        { label: 'Course', val: selectedEmp.course },
                        { label: 'OJT Period', val: `${selectedEmp.startDate} → ${selectedEmp.endDate}` },
                        { label: 'Required Hours', val: `${selectedEmp.requiredHours} hrs` },
                        { label: 'Requirements', val: (() => { const summary = getEmployeeRequirementSummary(selectedEmp.id); return `${summary.complete} complete, ${summary.incomplete} incomplete, ${summary.missing} missing`; })() },
                      ].map(({ label, val }) => (
                        <div key={label} className="flex gap-3 text-sm border-b border-gray-50 pb-2 last:border-0">
                          <span className="text-gray-400 w-28 shrink-0">{label}</span>
                          <span className="font-medium text-gray-700">{val}</span>
                        </div>
                      ))}

                      <div className="rounded-2xl border border-violet-100 bg-violet-50/70 p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-violet-900">Required Documents</p>
                          {(() => {
                            const summary = getEmployeeRequirementSummary(selectedEmp.id);
                            const total = summary.complete + summary.incomplete + summary.missing;
                            const allPassed = total > 0 && summary.missing === 0 && summary.incomplete === 0;
                            const allMissing = total > 0 && summary.complete === 0;
                            return (
                              <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${allPassed ? 'bg-green-100 text-green-700 border-green-200' : allMissing ? 'bg-red-100 text-red-700 border-red-200' : 'bg-orange-100 text-orange-700 border-orange-200'}`}>
                                {allPassed ? '✓ All Documents Passed' : allMissing ? '✗ No Documents Uploaded' : `${summary.complete}/${total} Passed`}
                              </span>
                            );
                          })()}
                        </div>

                        <div className="space-y-2">
                          {getEmployeeRequiredDocuments(selectedEmp.id).length === 0 ? (
                            <p className="text-xs text-violet-700">No required documents assigned yet.</p>
                          ) : (
                            getEmployeeRequiredDocuments(selectedEmp.id).map((doc) => {
                              const submission = getRequiredDocumentSubmission(doc.id, selectedEmp.id);
                              const status = getRequirementStatus(doc.id, selectedEmp.id);
                              const isPassed = status === 'complete';
                              const isMissing = status === 'missing';
                              return (
                                <div key={doc.id} className={`rounded-xl bg-white p-2.5 border ${isPassed ? 'border-green-200' : isMissing ? 'border-red-200' : 'border-orange-200'}`}>
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1">
                                      <p className="text-sm font-semibold text-gray-800">{doc.title}</p>
                                      {doc.description && <p className="text-[11px] text-gray-500 mt-1">{doc.description}</p>}
                                    </div>
                                    <span className={`shrink-0 text-[10px] rounded-full px-2.5 py-1 font-bold border ${isPassed ? 'bg-green-100 text-green-700 border-green-200' : isMissing ? 'bg-red-100 text-red-700 border-red-200' : 'bg-orange-100 text-orange-700 border-orange-200'}`}>
                                      {isPassed ? '✓ Passed' : isMissing ? '✗ Missing' : '⚠ Incomplete'}
                                    </span>
                                  </div>
                                  {doc.dueDate && <p className="text-[11px] text-gray-500 mt-2">Due: {doc.dueDate}</p>}
                                  {submission && (
                                    <div className="mt-2 border-t border-violet-50 pt-2 space-y-1.5">
                                      {submission.note && (
                                        <p className="text-[11px] text-gray-500 italic">Note: {submission.note}</p>
                                      )}
                                      {submission.fileName && (
                                        <p className="text-[11px] font-medium text-slate-700">📎 {submission.fileName}</p>
                                      )}
                                      <p className="text-[10px] text-gray-400">Submitted: {new Date(submission.submittedAt).toLocaleDateString()}</p>
                                      <div className="flex items-center gap-2 flex-wrap">
                                        {submission.fileUrl && (
                                          <button
                                            type="button"
                                            onClick={() => setPreviewInstructorDoc({
                                              studentName: selectedEmp.name,
                                              studentId: selectedEmp.employeeId,
                                              title: doc.title,
                                              fileName: submission.fileName,
                                              fileUrl: submission.fileUrl,
                                              note: submission.note,
                                              date: new Date(submission.submittedAt).toLocaleDateString(),
                                            })}
                                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-violet-600 text-white rounded-lg text-[11px] font-semibold hover:bg-violet-700 transition-all"
                                          >
                                            <Eye size={11} /> View
                                          </button>
                                        )}
                                        {submission.fileUrl && (
                                          <a
                                            href={submission.fileUrl}
                                            download={submission.fileName || 'ojt-document'}
                                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-violet-200 text-violet-700 rounded-lg text-[11px] font-semibold hover:bg-violet-50 transition-all"
                                          >
                                            <Download size={11} /> Download
                                          </a>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })
                          )}
                        </div>


                        <div className="space-y-2 rounded-xl bg-white p-3 border border-violet-100">
                          <input
                            value={docTitle}
                            onChange={(e) => setDocTitle(e.target.value)}
                            placeholder="Document title"
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                          />
                          <textarea
                            value={docDescription}
                            onChange={(e) => setDocDescription(e.target.value)}
                            placeholder="Description / notes"
                            rows={2}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                          />
                          <input
                            type="date"
                            value={docDueDate}
                            onChange={(e) => setDocDueDate(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (!docTitle.trim()) {
                                toast.error('Document title is required.');
                                return;
                              }
                              addRequiredDocument(selectedEmp.id, {
                                title: docTitle.trim(),
                                description: docDescription.trim(),
                                notes: docDescription.trim(),
                                dueDate: docDueDate || undefined,
                                required: true,
                              });
                              setDocTitle('');
                              setDocDescription('');
                              setDocDueDate('');
                              toast.success('Required document added.');
                            }}
                            className="w-full py-2.5 rounded-xl bg-violet-600 text-white text-sm font-medium hover:bg-violet-700"
                          >
                            Add Required Document
                          </button>
                        </div>
                      </div>

                      {selectedEmp.registrationAddress && (
                        <div className="flex gap-3 text-sm border-t border-gray-50 pt-2">
                          <span className="text-gray-400 w-28 shrink-0 flex items-center gap-1">
                            <MapPin size={11} /> Registered At
                          </span>
                          <span className="font-mono text-xs text-gray-600">{selectedEmp.registrationAddress}</span>
                        </div>
                      )}

                      {isSecurityApiConfigured() ? (
                        <div className="rounded-2xl border border-sky-100 bg-sky-50/80 p-4 space-y-2">
                          <div className="flex items-center gap-2 text-sky-900">
                            <Shield size={16} className="shrink-0" />
                            <p className="text-sm font-semibold">Server face enrollment</p>
                          </div>
                          <p className="text-xs text-sky-800/90">
                            Registers this trainee’s face with{' '}
                            <code className="text-[11px] bg-white/70 px-1 rounded">/api/face/register/</code> so
                            clock-in uses <code className="text-[11px] bg-white/70 px-1 rounded">employee_id</code>{' '}
                            matching this app’s internal ID.
                          </p>
                          <button
                            type="button"
                            onClick={() => setFaceEnrollOpen(true)}
                            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-sky-600 text-white text-sm font-medium hover:bg-sky-700 transition-colors"
                          >
                            <Camera size={16} />
                            {selectedEmp.faceRegistered ? 'Re-enroll face (camera)' : 'Enroll face (camera)'}
                          </button>
                        </div>
                      ) : (
                        <p className="text-xs text-amber-700 bg-amber-50 rounded-xl p-3 border border-amber-100">
                          Set <code className="text-[11px]">VITE_DJANGO_API_URL</code> (and API key if the server
                          requires it) to enroll faces on the backend.
                        </p>
                      )}
                    </div>
                  )
                ) : (
                  <div className="space-y-3">
                      {[
                        { label: 'Full Name', field: 'name', placeholder: 'Juan Dela Cruz' },
                        { label: 'Email', field: 'email', placeholder: 'email@example.com' },
                        { label: 'Employee ID', field: 'employeeId', placeholder: 'OJT-2024-XXX (optional)' },
                        { label: 'Company Name', field: 'companyName', placeholder: 'Company Name' },
                        { label: 'Supervisor', field: 'supervisorName', placeholder: 'Mr./Ms. Supervisor' },
                      ].map(({ label, field, placeholder }) => (
                      <div key={field}>
                        <label className="text-xs font-semibold text-gray-600 block mb-1">{label}</label>
                        <input
                          value={(form as Record<string, string | number>)[field] as string}
                          onChange={(e) => upd(field, e.target.value)}
                          placeholder={placeholder}
                          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                        />
                      </div>
                    ))}
                    <div>
                      <label className="text-xs font-semibold text-gray-600 block mb-1">Campus</label>
                      <select
                        value={form.campus}
                        onChange={(e) => upd('campus', e.target.value)}
                        className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                      >
                        <option value="">Select Campus</option>
                        {campusOptions.map((campus) => <option key={campus} value={campus}>{campus}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600 block mb-1">School</label>
                      <select
                        value={form.schoolName}
                        onChange={(e) => upd('schoolName', e.target.value)}
                        className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                      >
                        <option value="">Select School</option>
                        <option value="Carlos Hilado Memorial State University">
                          Carlos Hilado Memorial State University
                        </option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600 block mb-1">Department</label>
                      <select
                        value={form.department}
                        onChange={(e) => {
                          upd('department', e.target.value);
                          upd('course', '');
                        }}
                        className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                      >
                        <option value="">Select Department</option>
                        {departmentOptions.map((department) => <option key={department} value={department}>{department}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600 block mb-1">Course</label>
                      <select
                        value={form.course}
                        onChange={(e) => upd('course', e.target.value)}
                        className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                      >
                        <option value="">Select Course</option>
                        {getCoursesForDepartment(form.department, form.campus).map((course) => <option key={course} value={course}>{course}</option>)}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs font-semibold text-gray-600 block mb-1">Start Date</label>
                        <input
                          type="date"
                          value={form.startDate}
                          onChange={(e) => upd('startDate', e.target.value)}
                          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-600 block mb-1">End Date</label>
                        <input
                          type="date"
                          value={form.endDate}
                          onChange={(e) => upd('endDate', e.target.value)}
                          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600 block mb-1">Required OJT Hours</label>
                      <input
                        type="number"
                        value={form.requiredHours}
                        onChange={(e) => upd('requiredHours', e.target.value)}
                        className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                      />
                    </div>
                    <button
                      onClick={handleAdd}
                      className="w-full py-3 bg-blue-700 text-white rounded-xl font-semibold text-sm hover:bg-blue-800 transition-colors mt-2"
                    >
                      Add Trainee
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Instructor Document Preview & Print Modal */}
      {previewInstructorDoc && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl max-h-[92vh] flex flex-col overflow-hidden">
            {/* Print header – visible only on print */}
            <div className="hidden print:block p-6 border-b border-gray-200 text-center">
              <p className="text-xs uppercase tracking-widest text-gray-500 mb-1">Carlos Hilado Memorial State University</p>
              <h2 className="text-lg font-bold text-gray-900">{previewInstructorDoc.title}</h2>
              <p className="text-sm text-gray-600 mt-1">OJT Management System – Official Document</p>
            </div>

            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 print:hidden">
              <div>
                <h3 className="font-bold text-gray-900">{previewInstructorDoc.title}</h3>
                <p className="text-xs text-gray-500">{previewInstructorDoc.fileName || 'Attached Document'}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 transition-all shadow-sm"
                >
                  <Printer size={13} /> Print
                </button>
                {previewInstructorDoc.fileUrl && (
                  <a
                    href={previewInstructorDoc.fileUrl}
                    download={previewInstructorDoc.fileName || 'ojt-document'}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-xl text-xs font-semibold hover:bg-green-700 transition-all shadow-sm"
                  >
                    <Download size={13} /> Save
                  </a>
                )}
                <button
                  onClick={() => setPreviewInstructorDoc(null)}
                  className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Student info strip */}
            <div className="px-6 py-3 bg-violet-50 border-b border-violet-100 print:bg-white">
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-slate-700">
                <span><strong>Student Name:</strong> {previewInstructorDoc.studentName}</span>
                <span><strong>Student ID:</strong> {previewInstructorDoc.studentId}</span>
                <span><strong>Document:</strong> {previewInstructorDoc.title}</span>
                <span><strong>Date Submitted:</strong> {previewInstructorDoc.date}</span>
                {previewInstructorDoc.note && (
                  <span className="col-span-2"><strong>Note:</strong> {previewInstructorDoc.note}</span>
                )}
              </div>
            </div>

            {/* File preview */}
            <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
              {previewInstructorDoc.fileUrl ? (
                previewInstructorDoc.fileUrl.startsWith('data:image/') || previewInstructorDoc.fileUrl.match(/\.(jpeg|jpg|gif|png|webp)$/i) ? (
                  <div className="flex justify-center">
                    <img
                      src={previewInstructorDoc.fileUrl}
                      alt="Document preview"
                      className="max-h-[500px] object-contain rounded-xl shadow border border-gray-200"
                    />
                  </div>
                ) : (
                  <iframe
                    src={previewInstructorDoc.fileUrl}
                    className="w-full h-[480px] rounded-xl border border-gray-200 bg-white"
                    title="Document Preview"
                  />
                )
              ) : (
                <div className="flex flex-col items-center justify-center h-48 text-gray-400 gap-3">
                  <FileText size={40} />
                  <p className="text-sm">No file preview available</p>
                </div>
              )}
            </div>

            {/* Signature block – print only */}
            <div className="hidden print:block px-6 py-4 border-t border-gray-200 mt-4">
              <div className="flex justify-between mt-8">
                <div className="text-center">
                  <div className="border-t border-gray-400 w-40 mx-auto mb-1" />
                  <p className="text-xs text-gray-600">OJT Coordinator Signature</p>
                </div>
                <div className="text-center">
                  <div className="border-t border-gray-400 w-40 mx-auto mb-1" />
                  <p className="text-xs text-gray-600">Date Received</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
