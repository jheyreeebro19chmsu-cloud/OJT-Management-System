import React, { useState } from 'react';
import { Users, Search, Plus, Trash2, Camera, CheckCircle, XCircle, Eye, X, User, MapPin, Shield } from 'lucide-react';
import { useApp } from '../../store/AppContext';
import { Employee } from '../../types';
import { motion, AnimatePresence } from 'motion/react';
import { FaceCapture } from '../../components/FaceCapture';
import { isSecurityApiConfigured, registerFace } from '../../services/securityApi';
import { toast } from 'sonner';

type ModalMode = 'view' | 'add' | null;

const BLANK_FORM = {
  name: '', email: '', employeeId: '', department: '', position: 'OJT Trainee',
  companyName: '', supervisorName: '', schoolName: '', course: '',
  startDate: '', endDate: '', requiredHours: 486,
};

export function AdminEmployees() {
  const { employees, timeRecords, registerEmployee, updateEmployee, deleteEmployee } = useApp();
  const [search, setSearch] = useState('');
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
  const [form, setForm] = useState(BLANK_FORM);
  const [faceEnrollOpen, setFaceEnrollOpen] = useState(false);

  const filtered = employees.filter(e =>
    e.active && (
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.employeeId.toLowerCase().includes(search.toLowerCase()) ||
      e.department.toLowerCase().includes(search.toLowerCase())
    )
  );

  const openView = (emp: Employee) => {
    setSelectedEmp(emp);
    setFaceEnrollOpen(false);
    setModalMode('view');
  };
  const openAdd = () => { setForm(BLANK_FORM); setModalMode('add'); };
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
    });
    closeModal();
  };

  const handleDelete = (id: string) => {
    if (confirm('Deactivate this employee?')) deleteEmployee(id);
  };

  const getEmpStats = (empId: string) => {
    const recs = timeRecords.filter(r => r.employeeId === empId);
    const totalHours = recs.reduce((s, r) => s + (r.totalHours || 0), 0);
    const present = recs.filter(r => r.status === 'present' || r.status === 'overtime').length;
    const late = recs.filter(r => r.status === 'late').length;
    return { totalHours, present, late, totalDays: recs.length };
  };

  const upd = (f: string, v: string | number) => setForm(p => ({ ...p, [f]: v }));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Employees</h2>
          <p className="text-sm text-gray-500">{filtered.length} active trainees</p>
        </div>
        <button onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 bg-blue-700 text-white rounded-xl text-sm font-medium hover:bg-blue-800 transition-colors shadow-sm">
          <Plus size={15} />
          Add Trainee
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, ID, or department..."
          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        />
      </div>

      {/* Table / Cards */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Desktop Table Header */}
        <div className="hidden lg:grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-4 px-5 py-3 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase">
          <span>Trainee</span>
          <span>Department</span>
          <span>OJT Progress</span>
          <span>Status</span>
          <span>Actions</span>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-12">
            <Users size={40} className="text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500 font-medium">No trainees found</p>
          </div>
        ) : (
          filtered.map((emp, idx) => {
            const stats = getEmpStats(emp.id);
            const progress = Math.min((stats.totalHours / emp.requiredHours) * 100, 100);
            return (
              <motion.div
                key={emp.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
              >
                {/* Desktop Row */}
                <div className="hidden lg:grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-4 items-center px-5 py-4 border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center shrink-0 overflow-hidden">
                      {emp.photo ? (
                        <img src={emp.photo} alt="" className="w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />
                      ) : (
                        <span className="text-blue-700 font-bold text-sm">{emp.name.charAt(0)}</span>
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800 text-sm">{emp.name}</p>
                      <p className="text-xs text-gray-400">{emp.employeeId} • {emp.email}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-gray-700">{emp.department}</p>
                    <p className="text-xs text-gray-400">{emp.position}</p>
                  </div>
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
                  <div className="flex items-center gap-1">
                    <button onClick={() => openView(emp)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all">
                      <Eye size={14} />
                    </button>
                    <button onClick={() => handleDelete(emp.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Mobile Card */}
                <div className="lg:hidden p-4 border-b border-gray-50">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center shrink-0 overflow-hidden">
                      {emp.photo ? (
                        <img src={emp.photo} alt="" className="w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />
                      ) : (
                        <span className="text-blue-700 font-bold">{emp.name.charAt(0)}</span>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold text-gray-800 text-sm">{emp.name}</p>
                          <p className="text-xs text-gray-400">{emp.employeeId}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{emp.department}</p>
                        </div>
                        <div className="flex gap-1">
                          <button onClick={() => openView(emp)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg">
                            <Eye size={14} />
                          </button>
                          <button onClick={() => handleDelete(emp.id)} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                      <div className="mt-2">
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500 rounded-full" style={{ width: `${progress}%` }} />
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">{stats.totalHours.toFixed(0)} / {emp.requiredHours}h ({Math.round(progress)}%)</p>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })
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
            onClick={e => e.target === e.currentTarget && closeModal()}
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
                <button onClick={closeModal} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
              </div>

              <div className="p-5">
                {modalMode === 'view' && selectedEmp ? (
                  faceEnrollOpen ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-gray-800 text-sm">Enroll face — {selectedEmp.name}</p>
                          <p className="text-xs text-gray-500">Use a clear, frontal photo. Saved to the Django server for clock-in verification.</p>
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
                        onSuccess={async imageData => {
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
                            toast.error(e instanceof Error ? e.message : 'Could not reach the security API. Check URL and API key.');
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
                          <img src={selectedEmp.photo} alt="" className="w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />
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
                            <span className="text-xs text-red-500 bg-red-50 px-2 py-0.5 rounded-full">Not Enrolled</span>
                          )}
                        </div>
                      </div>
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
                      { label: 'Course', val: selectedEmp.course },
                      { label: 'OJT Period', val: `${selectedEmp.startDate} → ${selectedEmp.endDate}` },
                      { label: 'Required Hours', val: `${selectedEmp.requiredHours} hrs` },
                    ].map(({ label, val }) => (
                      <div key={label} className="flex gap-3 text-sm border-b border-gray-50 pb-2 last:border-0">
                        <span className="text-gray-400 w-28 shrink-0">{label}</span>
                        <span className="font-medium text-gray-700">{val}</span>
                      </div>
                    ))}

                    {selectedEmp.registrationAddress && (
                      <div className="flex gap-3 text-sm border-t border-gray-50 pt-2">
                        <span className="text-gray-400 w-28 shrink-0 flex items-center gap-1"><MapPin size={11} /> Registered At</span>
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
                          Registers this trainee’s face with <code className="text-[11px] bg-white/70 px-1 rounded">/api/face/register/</code> so clock-in uses <code className="text-[11px] bg-white/70 px-1 rounded">employee_id</code> matching this app’s internal ID.
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
                        Set <code className="text-[11px]">VITE_DJANGO_API_URL</code> (and API key if the server requires it) to enroll faces on the backend.
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
                      { label: 'Department', field: 'department', placeholder: 'e.g. IT, HR, Finance' },
                      { label: 'Company Name', field: 'companyName', placeholder: 'Company Name' },
                      { label: 'Supervisor', field: 'supervisorName', placeholder: 'Mr./Ms. Supervisor' },
                      { label: 'School', field: 'schoolName', placeholder: 'University Name' },
                      { label: 'Course', field: 'course', placeholder: 'BS Information Technology' },
                    ].map(({ label, field, placeholder }) => (
                      <div key={field}>
                        <label className="text-xs font-semibold text-gray-600 block mb-1">{label}</label>
                        <input
                          value={(form as Record<string, string | number>)[field] as string}
                          onChange={e => upd(field, e.target.value)}
                          placeholder={placeholder}
                          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                        />
                      </div>
                    ))}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs font-semibold text-gray-600 block mb-1">Start Date</label>
                        <input type="date" value={form.startDate} onChange={e => upd('startDate', e.target.value)}
                          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50" />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-600 block mb-1">End Date</label>
                        <input type="date" value={form.endDate} onChange={e => upd('endDate', e.target.value)}
                          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50" />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600 block mb-1">Required OJT Hours</label>
                      <input type="number" value={form.requiredHours} onChange={e => upd('requiredHours', e.target.value)}
                        className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50" />
                    </div>
                    <button onClick={handleAdd}
                      className="w-full py-3 bg-blue-700 text-white rounded-xl font-semibold text-sm hover:bg-blue-800 transition-colors mt-2">
                      Add Trainee
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}