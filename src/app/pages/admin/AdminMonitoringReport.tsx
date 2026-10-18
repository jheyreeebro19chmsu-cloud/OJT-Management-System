import {
  ClipboardCheck,
  Plus,
  Search,
  Filter,
  Calendar,
  Building,
  User,
  Star,
  Printer,
  Download,
  Eye,
  Trash2,
  Edit3,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
  Phone,
  MapPin,
  RefreshCw,
  ExternalLink,
  MessageSquare,
  FileText,
  Users,
  Check,
  X,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import React, { useState, useMemo, useEffect } from 'react';
import { toast } from 'sonner';

import { useApp } from '../../store/AppContext';
import { MonitoringReport, MonitoringVisitType, MonitoringOverallStatus, Employee, TraineeSelfMonitoringReport } from '../../types';
import { MonitoringReportPrintView } from '../../components/MonitoringReportPrintView';
import { UserAvatar } from '../../components/UserAvatar';

export function AdminMonitoringReport() {
  const {
    currentUser,
    getCurrentEmployee,
    employees,
    timeRecords,
    settings,
    monitoringReports,
    addMonitoringReport,
    updateMonitoringReport,
    deleteMonitoringReport,
    traineeSelfMonitoringReports,
    reviewTraineeSelfMonitoringReport,
    deleteTraineeSelfMonitoringReport,
  } = useApp();

  const currentEmp = getCurrentEmployee();
  const instructorName = currentUser?.name || currentEmp?.name || 'OJT Instructor';

  // Active tab
  const [activeTab, setActiveTab] = useState<'official' | 'self_reports' | 'roster'>('official');

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterModality, setFilterModality] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterCourse, setFilterCourse] = useState<string>('all');

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingReport, setEditingReport] = useState<MonitoringReport | null>(null);
  const [printReport, setPrintReport] = useState<MonitoringReport | null>(null);

  // Review self report modal
  const [reviewSelfReport, setReviewSelfReport] = useState<TraineeSelfMonitoringReport | null>(null);
  const [instructorRemarksInput, setInstructorRemarksInput] = useState('');

  // Trainee selection in create modal
  const [selectedTraineeId, setSelectedTraineeId] = useState('');

  // Form states
  const [formTraineeName, setFormTraineeName] = useState('');
  const [formStudentId, setFormStudentId] = useState('');
  const [formCourse, setFormCourse] = useState('');
  const [formDepartment, setFormDepartment] = useState('');
  const [formCampus, setFormCampus] = useState('');
  const [formHteCompany, setFormHteCompany] = useState('');
  const [formHteAddress, setFormHteAddress] = useState('');
  const [formSupervisorName, setFormSupervisorName] = useState('');
  const [formSupervisorContact, setFormSupervisorContact] = useState('');
  const [formSupervisorDesignation, setFormSupervisorDesignation] = useState('');
  const [formVisitDate, setFormVisitDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [formVisitTime, setFormVisitTime] = useState('10:00 AM');
  const [formVisitType, setFormVisitType] = useState<MonitoringVisitType>('on_site');
  const [formRequiredHours, setFormRequiredHours] = useState<number>(600);
  const [formRenderedHours, setFormRenderedHours] = useState<number>(0);
  const [formAttendanceConsistency, setFormAttendanceConsistency] = useState('Regular & Consistently Punctual');

  // Ratings (1 - 5)
  const [ratingWorkQuality, setRatingWorkQuality] = useState(5);
  const [ratingPunctuality, setRatingPunctuality] = useState(5);
  const [ratingProfessionalism, setRatingProfessionalism] = useState(5);
  const [ratingTechnical, setRatingTechnical] = useState(5);
  const [ratingPolicy, setRatingPolicy] = useState(5);

  // Qualitative
  const [formTasksObserved, setFormTasksObserved] = useState('');
  const [formHighlights, setFormHighlights] = useState('');
  const [formIssues, setFormIssues] = useState('');
  const [formRecommendations, setFormRecommendations] = useState('');
  const [formActionTaken, setFormActionTaken] = useState('');
  const [formOverallStatus, setFormOverallStatus] = useState<MonitoringOverallStatus>('commendable');
  const [formNextVisitDate, setFormNextVisitDate] = useState('');

  // Filter student trainees only
  const allTrainees = useMemo(() => {
    return employees.filter((emp) => {
      const pos = (emp.position || '').toLowerCase();
      const role = ((emp as any).role || '').toLowerCase();
      return (
        role !== 'admin' &&
        role !== 'instructor' &&
        role !== 'hte' &&
        pos !== 'administrator' &&
        !pos.includes('instructor') &&
        !pos.includes('faculty') &&
        !pos.includes('hte') &&
        !pos.includes('host')
      );
    });
  }, [employees]);

  // List of courses for filtering
  const availableCourses = useMemo(() => {
    const set = new Set<string>();
    allTrainees.forEach((t) => {
      if (t.course) set.add(t.course);
    });
    return Array.from(set).sort();
  }, [allTrainees]);

  // Helper to compute rendered hours for a trainee
  const getRenderedHoursForTrainee = (traineeId: string, employeeIdCode?: string) => {
    return (timeRecords || [])
      .filter(
        (r) =>
          (r.employeeId === traineeId || (employeeIdCode && r.employeeId === employeeIdCode)) &&
          r.approvalStatus !== 'disapproved'
      )
      .reduce((sum, r) => sum + (Number(r.totalHours) || 0), 0);
  };

  // When a trainee is chosen in the Create Report modal, auto-fill all details
  const handleSelectTrainee = (empId: string) => {
    setSelectedTraineeId(empId);
    const emp = allTrainees.find((t) => t.id === empId || t.employeeId === empId);
    if (!emp) return;

    setFormTraineeName(emp.name || '');
    setFormStudentId(emp.employeeId || emp.id || '');
    setFormCourse(emp.course || 'BS Information Technology');
    setFormDepartment(emp.department || 'College of Computer Studies');
    setFormCampus(emp.campus || 'Talisay (Main Campus)');
    setFormHteCompany(emp.companyName || 'Host Training Establishment');
    setFormHteAddress(emp.address || emp.residentialAddress || 'Official Assigned Workplace Station');
    setFormSupervisorName(emp.supervisorName || 'Department Head / Mentor');
    setFormSupervisorContact(emp.contactPhone || emp.phone || '+63 917 555 4321');
    setFormSupervisorDesignation('OJT Mentor & Supervisor');

    const reqHours = emp.requiredHours || 600;
    setFormRequiredHours(reqHours);

    const rendered = getRenderedHoursForTrainee(emp.id, emp.employeeId);
    setFormRenderedHours(Math.round(rendered));
  };

  const openCreateModal = () => {
    setEditingReport(null);
    setSelectedTraineeId('');
    setFormTraineeName('');
    setFormStudentId('');
    setFormCourse('');
    setFormDepartment('');
    setFormCampus('');
    setFormHteCompany('');
    setFormHteAddress('');
    setFormSupervisorName('');
    setFormSupervisorContact('');
    setFormSupervisorDesignation('OJT Mentor & Supervisor');
    setFormVisitDate(new Date().toISOString().split('T')[0]);
    setFormVisitTime('10:00 AM');
    setFormVisitType('on_site');
    setFormRequiredHours(600);
    setFormRenderedHours(0);
    setFormAttendanceConsistency('Regular & Consistently Punctual');
    setRatingWorkQuality(5);
    setRatingPunctuality(5);
    setRatingProfessionalism(5);
    setRatingTechnical(5);
    setRatingPolicy(5);
    setFormTasksObserved('');
    setFormHighlights('');
    setFormIssues('');
    setFormRecommendations('');
    setFormActionTaken('');
    setFormOverallStatus('commendable');
    setFormNextVisitDate('');
    setShowCreateModal(true);
  };

  const openEditModal = (report: MonitoringReport) => {
    setEditingReport(report);
    setSelectedTraineeId(report.traineeId);
    setFormTraineeName(report.traineeName);
    setFormStudentId(report.studentId || report.traineeId);
    setFormCourse(report.course || '');
    setFormDepartment(report.department || '');
    setFormCampus(report.campus || '');
    setFormHteCompany(report.hteCompanyName);
    setFormHteAddress(report.hteAddress || '');
    setFormSupervisorName(report.supervisorName || '');
    setFormSupervisorContact(report.supervisorContact || '');
    setFormSupervisorDesignation(report.supervisorDesignation || '');
    setFormVisitDate(report.visitDate);
    setFormVisitTime(report.visitTime || '10:00 AM');
    setFormVisitType(report.visitType);
    setFormRequiredHours(report.requiredHours || 600);
    setFormRenderedHours(report.renderedHours || 0);
    setFormAttendanceConsistency(report.attendanceConsistency || 'Regular');
    setRatingWorkQuality(report.ratings.workQuality);
    setRatingPunctuality(report.ratings.punctuality);
    setRatingProfessionalism(report.ratings.professionalism);
    setRatingTechnical(report.ratings.technicalCompetence);
    setRatingPolicy(report.ratings.policyAdherence);
    setFormTasksObserved(report.tasksObserved);
    setFormHighlights(report.highlights || '');
    setFormIssues(report.issuesIdentified || '');
    setFormRecommendations(report.recommendations);
    setFormActionTaken(report.actionTaken || '');
    setFormOverallStatus(report.overallStatus);
    setFormNextVisitDate(report.nextVisitDate || '');
    setShowCreateModal(true);
  };

  const handleSaveReport = async () => {
    if (!formTraineeName.trim()) {
      toast.error('Please select or enter the Trainee Name.');
      return;
    }
    if (!formHteCompany.trim()) {
      toast.error('Please specify the Host Training Establishment (HTE).');
      return;
    }
    if (!formTasksObserved.trim()) {
      toast.error('Please describe the key tasks observed during this visit.');
      return;
    }

    const payload = {
      traineeId: selectedTraineeId || formStudentId || `trainee-${Date.now()}`,
      traineeName: formTraineeName.trim(),
      studentId: formStudentId.trim(),
      course: formCourse.trim(),
      department: formDepartment.trim() || 'College of Computer Studies',
      campus: formCampus.trim() || 'Talisay (Main Campus)',
      academicYear: settings.activeAcademicYear || '2026-2027',
      hteCompanyName: formHteCompany.trim(),
      hteAddress: formHteAddress.trim(),
      supervisorName: formSupervisorName.trim(),
      supervisorContact: formSupervisorContact.trim(),
      supervisorDesignation: formSupervisorDesignation.trim(),
      instructorId: currentUser?.id || currentEmp?.id,
      instructorName,
      visitDate: formVisitDate,
      visitTime: formVisitTime,
      visitType: formVisitType,
      requiredHours: formRequiredHours,
      renderedHours: formRenderedHours,
      remainingHours: Math.max(0, formRequiredHours - formRenderedHours),
      attendanceConsistency: formAttendanceConsistency,
      ratings: {
        workQuality: ratingWorkQuality,
        punctuality: ratingPunctuality,
        professionalism: ratingProfessionalism,
        technicalCompetence: ratingTechnical,
        policyAdherence: ratingPolicy,
      },
      tasksObserved: formTasksObserved.trim(),
      highlights: formHighlights.trim(),
      issuesIdentified: formIssues.trim(),
      recommendations: formRecommendations.trim(),
      actionTaken: formActionTaken.trim(),
      overallStatus: formOverallStatus,
      nextVisitDate: formNextVisitDate.trim(),
      instructorSignature: instructorName,
    };

    if (editingReport) {
      await updateMonitoringReport(editingReport.id, payload);
      toast.success(`Monitoring report ${editingReport.reportNumber} updated successfully!`);
    } else {
      const created = await addMonitoringReport(payload);
      toast.success(`Monitoring report ${created.reportNumber} generated & published to trainee portal!`);
    }

    setShowCreateModal(false);
  };

  // Filtered official reports
  const filteredOfficialReports = useMemo(() => {
    return monitoringReports.filter((r) => {
      const q = searchQuery.toLowerCase().trim();
      if (q) {
        const matchName = r.traineeName.toLowerCase().includes(q);
        const matchId = (r.studentId || '').toLowerCase().includes(q);
        const matchHte = r.hteCompanyName.toLowerCase().includes(q);
        const matchNum = r.reportNumber.toLowerCase().includes(q);
        if (!matchName && !matchId && !matchHte && !matchNum) return false;
      }
      if (filterModality !== 'all' && r.visitType !== filterModality) return false;
      if (filterStatus !== 'all' && r.overallStatus !== filterStatus) return false;
      if (filterCourse !== 'all' && r.course !== filterCourse) return false;
      return true;
    });
  }, [monitoringReports, searchQuery, filterModality, filterStatus, filterCourse]);

  // Statistics
  const stats = useMemo(() => {
    const totalTrainees = allTrainees.length;
    const totalReports = monitoringReports.length;
    const onSiteVisits = monitoringReports.filter((r) => r.visitType === 'on_site').length;
    const virtualVisits = monitoringReports.filter((r) => r.visitType === 'virtual').length;
    const needsGuidance = monitoringReports.filter(
      (r) => r.overallStatus === 'needs_guidance' || r.overallStatus === 'critical'
    ).length;
    const pendingSelfReports = traineeSelfMonitoringReports.filter((s) => s.status === 'submitted').length;

    return {
      totalTrainees,
      totalReports,
      onSiteVisits,
      virtualVisits,
      needsGuidance,
      pendingSelfReports,
    };
  }, [allTrainees, monitoringReports, traineeSelfMonitoringReports]);

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-sm relative overflow-hidden">
        <div className="absolute right-0 top-0 w-80 h-full bg-gradient-to-l from-indigo-50/70 to-transparent pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-bold">
              <ClipboardCheck size={14} className="text-indigo-600" />
              <span>OJT Trainee Monitoring Module</span>
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
              <span className="text-slate-500 font-medium">Instructor & Trainee Hub</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Trainee Monitoring & Visitation Reports
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 max-w-2xl leading-relaxed">
              Conduct official supervisory visits, log workplace performance assessments, and review weekly/monthly self-monitoring journals across all partner Host Training Establishments.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-700 hover:opacity-95 text-white rounded-2xl text-xs font-bold shadow-md shadow-indigo-300 transition-all cursor-pointer"
            >
              <Plus size={16} /> + Log Monitoring Visit
            </button>
          </div>
        </div>
      </div>

      {/* 4 Stat KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <Users size={18} />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-gray-500">Supervised Trainees</p>
              <p className="text-xl font-bold text-gray-900">{stats.totalTrainees}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-emerald-100 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <CheckCircle2 size={18} />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-gray-500">Monitoring Reports</p>
              <p className="text-xl font-bold text-emerald-700">{stats.totalReports}</p>
            </div>
          </div>
        </div>

        <div className={`p-4 rounded-2xl border shadow-xs transition-all ${
          stats.pendingSelfReports > 0 ? 'bg-amber-50/70 border-amber-200' : 'bg-white border-gray-100'
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
              <Clock size={18} />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-gray-500">Trainee Self-Reports</p>
              <p className="text-xl font-bold text-amber-800">
                {stats.pendingSelfReports}
                {stats.pendingSelfReports > 0 && (
                  <span className="text-[10px] font-bold text-amber-800 ml-1.5 px-1.5 py-0.5 rounded bg-amber-200">
                    Needs Review
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
              <AlertTriangle size={18} />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-gray-500">Needs Guidance</p>
              <p className="text-xl font-bold text-rose-700">{stats.needsGuidance}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('official')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'official'
              ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <ClipboardCheck size={14} /> Official Monitoring Visits ({monitoringReports.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('self_reports')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'self_reports'
              ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <FileText size={14} /> Trainee Self-Monitoring Progress ({traineeSelfMonitoringReports.length})
          {stats.pendingSelfReports > 0 && (
            <span className="w-2 h-2 rounded-full bg-amber-400" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('roster')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'roster'
              ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Users size={14} /> Trainee Monitoring Roster ({allTrainees.length})
        </button>
      </div>

      {/* TAB 1: Official Monitoring Reports */}
      {activeTab === 'official' && (
        <div className="space-y-4">
          {/* Search & Filter Bar */}
          <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by student name, ID, HTE company, report #..."
                className="w-full pl-9 pr-3.5 py-2 text-xs border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={filterModality}
                onChange={(e) => setFilterModality(e.target.value)}
                className="px-3 py-2 text-xs border border-gray-200 rounded-xl bg-white font-medium focus:ring-1 focus:ring-indigo-500"
              >
                <option value="all">All Modalities</option>
                <option value="on_site">On-Site Workplace</option>
                <option value="virtual">Virtual Conference</option>
                <option value="phone">Phone Check-in</option>
                <option value="midterm">Midterm Review</option>
                <option value="final">Final Exit</option>
                <option value="spot_check">Spot Inspection</option>
              </select>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-2 text-xs border border-gray-200 rounded-xl bg-white font-medium focus:ring-1 focus:ring-indigo-500"
              >
                <option value="all">All Statuses</option>
                <option value="commendable">Commendable</option>
                <option value="satisfactory">Satisfactory</option>
                <option value="needs_guidance">Needs Guidance</option>
                <option value="critical">Critical</option>
              </select>

              {availableCourses.length > 0 && (
                <select
                  value={filterCourse}
                  onChange={(e) => setFilterCourse(e.target.value)}
                  className="px-3 py-2 text-xs border border-gray-200 rounded-xl bg-white font-medium focus:ring-1 focus:ring-indigo-500 max-w-[180px] truncate"
                >
                  <option value="all">All Courses</option>
                  {availableCourses.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Reports Grid */}
          {filteredOfficialReports.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-gray-200 space-y-3">
              <ClipboardCheck size={40} className="text-gray-300 mx-auto" />
              <p className="text-sm font-bold text-gray-700">No monitoring reports match your filters.</p>
              <p className="text-xs text-gray-500 max-w-sm mx-auto">
                Click &ldquo;+ Log Monitoring Visit&rdquo; above to record your first official supervisory visit.
              </p>
              <button
                type="button"
                onClick={openCreateModal}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-xs hover:bg-indigo-700 cursor-pointer"
              >
                <Plus size={14} /> + Log Monitoring Visit
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredOfficialReports.map((report) => {
                const avg = (
                  (report.ratings.workQuality +
                    report.ratings.punctuality +
                    report.ratings.professionalism +
                    report.ratings.technicalCompetence +
                    report.ratings.policyAdherence) /
                  5
                ).toFixed(1);

                return (
                  <div
                    key={report.id}
                    className="bg-white rounded-3xl p-5 border border-gray-200 hover:border-indigo-300 hover:shadow-md transition-all space-y-4 flex flex-col justify-between"
                  >
                    <div>
                      {/* Card Header */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <UserAvatar
                            name={report.traineeName}
                            role="employee"
                            size="md"
                            className="border border-indigo-100 shrink-0"
                          />
                          <div className="min-w-0">
                            <h4 className="font-bold text-sm text-gray-900 truncate" title={report.traineeName}>
                              {report.traineeName}
                            </h4>
                            <p className="text-xs text-gray-500 font-mono">
                              {report.studentId || report.traineeId} • {report.course || 'IT Intern'}
                            </p>
                          </div>
                        </div>

                        <span
                          className={`text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full border shrink-0 ${
                            report.overallStatus === 'commendable'
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                              : report.overallStatus === 'satisfactory'
                              ? 'bg-blue-100 text-blue-800 border-blue-300'
                              : report.overallStatus === 'needs_guidance'
                              ? 'bg-amber-100 text-amber-800 border-amber-300'
                              : 'bg-rose-100 text-rose-800 border-rose-300'
                          }`}
                        >
                          {report.overallStatus.replace('_', ' ')}
                        </span>
                      </div>

                      {/* HTE and Visit Details */}
                      <div className="mt-3.5 p-3 rounded-2xl bg-gray-50 border border-gray-150 space-y-1.5 text-xs text-gray-700">
                        <div className="flex items-center gap-2">
                          <Building size={14} className="text-indigo-600 shrink-0" />
                          <span className="font-semibold text-gray-900 truncate" title={report.hteCompanyName}>
                            {report.hteCompanyName}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-gray-500">
                          <span>Supervisor: {report.supervisorName || 'Department Mentor'}</span>
                          <span>Visit: <strong className="text-indigo-900 font-semibold">{report.visitDate}</strong></span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-gray-500 pt-1 border-t border-gray-200">
                          <span>Modality: <strong className="text-gray-800 capitalize">{report.visitType.replace('_', ' ')}</strong></span>
                          <span>Rendered: <strong className="text-emerald-700 font-semibold">{report.renderedHours || 0} / {report.requiredHours || 600}h</strong></span>
                        </div>
                      </div>

                      {/* Observed Tasks & Recommendations */}
                      <div className="mt-3 space-y-1.5 text-xs">
                        <p className="text-gray-600 line-clamp-2">
                          <strong className="text-gray-800">Tasks Observed:</strong> {report.tasksObserved}
                        </p>
                        {report.recommendations && (
                          <p className="text-indigo-950 font-medium line-clamp-2 bg-indigo-50/60 p-2 rounded-xl border border-indigo-100 text-[11px]">
                            <strong>Guidance:</strong> {report.recommendations}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-indigo-100 text-indigo-900 text-xs font-black">
                          <Star size={11} className="fill-indigo-700 text-indigo-700" />
                          {avg} / 5
                        </span>
                        {report.isAcknowledgedByTrainee ? (
                          <span className="text-[10px] text-emerald-700 font-semibold flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                            <CheckCircle2 size={11} /> Signed by Trainee
                          </span>
                        ) : (
                          <span className="text-[10px] text-gray-400 italic">
                            Pending student sign-off
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setPrintReport(report)}
                          className="p-1.5 rounded-lg text-indigo-700 hover:bg-indigo-50 transition-colors cursor-pointer"
                          title="Print / View Official Document"
                        >
                          <Printer size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditModal(report)}
                          className="p-1.5 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
                          title="Edit Report"
                        >
                          <Edit3 size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`Delete monitoring report ${report.reportNumber}?`)) {
                              deleteMonitoringReport(report.id);
                              toast.success('Report deleted.');
                            }
                          }}
                          className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Delete Report"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Trainee Self-Monitoring Progress Reports */}
      {activeTab === 'self_reports' && (
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-xs flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-gray-900">Trainee Periodic Self-Monitoring Journals</h3>
              <p className="text-xs text-gray-500">
                Submitted by student interns detailing tasks, milestones, and challenges for OJT Instructor review.
              </p>
            </div>
            <span className="text-xs font-bold text-gray-700 bg-gray-100 px-3 py-1 rounded-xl">
              {traineeSelfMonitoringReports.length} Submissions
            </span>
          </div>

          {traineeSelfMonitoringReports.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-gray-200 space-y-2">
              <FileText size={36} className="text-gray-300 mx-auto" />
              <p className="text-sm font-bold text-gray-700">No self-monitoring submissions yet.</p>
              <p className="text-xs text-gray-500">
                When student interns submit their periodic progress journals, they will appear here for review.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {traineeSelfMonitoringReports.map((item) => (
                <div
                  key={item.id}
                  className="bg-white p-5 rounded-3xl border border-gray-200 hover:border-indigo-200 shadow-xs space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-3">
                    <div className="flex items-center gap-3">
                      <UserAvatar name={item.traineeName} role="employee" size="md" />
                      <div>
                        <h4 className="font-bold text-sm text-gray-900">{item.traineeName}</h4>
                        <p className="text-xs text-gray-500 font-mono">
                          {item.studentId || item.traineeId} • {item.course}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                        {item.periodCovered}
                      </span>
                      <span
                        className={`text-xs font-extrabold px-2.5 py-1 rounded-full border uppercase ${
                          item.status === 'reviewed' || item.status === 'acknowledged'
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                            : 'bg-amber-100 text-amber-800 border-amber-300'
                        }`}
                      >
                        {item.status === 'reviewed' ? '✓ Reviewed' : 'Pending Review'}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div className="p-3 bg-gray-50 rounded-2xl border border-gray-150 space-y-1">
                      <p className="text-gray-500 font-semibold uppercase text-[10px]">Host Company & Period</p>
                      <p className="font-bold text-gray-900">{item.hteCompanyName}</p>
                      <p className="text-gray-600">Supervisor: {item.supervisorName || 'Assigned Mentor'}</p>
                      <p className="text-gray-600">Hours Rendered this Period: <strong className="text-indigo-900">{item.hoursRenderedThisPeriod}h</strong></p>
                    </div>

                    <div className="p-3 bg-gray-50 rounded-2xl border border-gray-150 space-y-1">
                      <p className="text-gray-500 font-semibold uppercase text-[10px]">Trainee Self-Assessment</p>
                      <p className="text-gray-800 leading-relaxed"><strong className="text-gray-900">Key Accomplishments:</strong> {item.keyAccomplishments}</p>
                      {item.challengesEncountered && (
                        <p className="text-gray-700 leading-relaxed mt-1"><strong className="text-gray-900">Challenges & Resolution:</strong> {item.challengesEncountered}</p>
                      )}
                    </div>
                  </div>

                  {item.instructorRemarks && (
                    <div className="p-3 rounded-2xl bg-indigo-50/70 border border-indigo-200 text-xs text-indigo-950 space-y-0.5">
                      <p className="font-bold text-indigo-900">Instructor Remarks & Guidance:</p>
                      <p className="italic">&ldquo;{item.instructorRemarks}&rdquo;</p>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                    <span className="text-[11px] text-gray-400">
                      Submitted: {new Date(item.dateSubmitted || item.createdAt).toLocaleDateString()}
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setReviewSelfReport(item);
                          setInstructorRemarksInput(item.instructorRemarks || '');
                        }}
                        className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs cursor-pointer"
                      >
                        {item.instructorRemarks ? 'Edit Remarks' : 'Review & Add Remarks'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm('Delete this self-monitoring journal entry?')) {
                            deleteTraineeSelfMonitoringReport(item.id);
                            toast.success('Entry deleted.');
                          }
                        }}
                        className="p-1.5 text-gray-400 hover:text-rose-600 rounded-lg cursor-pointer"
                        title="Delete entry"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Trainee Roster & Quick Log */}
      {activeTab === 'roster' && (
        <div className="bg-white rounded-3xl border border-gray-200 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-gray-100 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-gray-900">Assigned Trainee Monitoring Roster</h3>
              <p className="text-xs text-gray-500">
                Track rendered training hours and last supervisory visitation date for each deployed student.
              </p>
            </div>
            <span className="text-xs font-bold text-gray-600 bg-gray-100 px-3 py-1 rounded-xl">
              {allTrainees.length} Students
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-gray-600 uppercase text-[10px] tracking-wider border-b border-gray-200">
                <tr>
                  <th className="py-3 px-4 font-bold">Student Trainee</th>
                  <th className="py-3 px-4 font-bold">Host Establishment (HTE)</th>
                  <th className="py-3 px-4 font-bold">Training Hours Progress</th>
                  <th className="py-3 px-4 font-bold">Monitoring Status</th>
                  <th className="py-3 px-4 font-bold text-right">Quick Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-150">
                {allTrainees.map((trainee) => {
                  const rendered = getRenderedHoursForTrainee(trainee.id, trainee.employeeId);
                  const required = trainee.requiredHours || 600;
                  const pct = Math.min(100, Math.round((rendered / required) * 100));
                  const reports = monitoringReports.filter(
                    (r) => r.traineeId === trainee.id || r.studentId === trainee.employeeId
                  );
                  const lastReport = reports[0];

                  return (
                    <tr key={trainee.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <UserAvatar name={trainee.name} role="employee" size="sm" />
                          <div>
                            <p className="font-bold text-gray-900">{trainee.name}</p>
                            <p className="text-[10px] text-gray-500 font-mono">
                              {trainee.employeeId} • {trainee.course || 'IT Intern'}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <p className="font-semibold text-gray-900">{trainee.companyName || 'Host Pending'}</p>
                        <p className="text-[10px] text-gray-500">{trainee.supervisorName || 'Supervisor TBA'}</p>
                      </td>

                      <td className="py-3.5 px-4 min-w-[160px]">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-bold text-gray-800">{Math.round(rendered)}h / {required}h</span>
                            <span className="font-mono text-gray-500">{pct}%</span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 rounded-full transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        {lastReport ? (
                          <div>
                            <span
                              className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${
                                lastReport.overallStatus === 'commendable'
                                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                  : 'bg-blue-100 text-blue-800 border-blue-300'
                              }`}
                            >
                              {lastReport.overallStatus}
                            </span>
                            <p className="text-[10px] text-gray-400 mt-0.5">
                              Last visit: {lastReport.visitDate}
                            </p>
                          </div>
                        ) : (
                          <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 font-semibold">
                            No visits logged yet
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            openCreateModal();
                            handleSelectTrainee(trainee.id);
                          }}
                          className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl font-bold text-xs inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Plus size={12} /> Log Visit
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CREATE / EDIT MONITORING REPORT MODAL */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 w-full max-w-3xl shadow-2xl border border-gray-100 max-h-[92vh] flex flex-col overflow-hidden"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-4 border-b border-gray-100 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold">
                    <ClipboardCheck size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-gray-900">
                      {editingReport ? `Edit Report — ${editingReport.reportNumber}` : 'Log New Supervisory Monitoring Visit'}
                    </h3>
                    <p className="text-xs text-gray-500">Record observations, ratings, and recommendations for this trainee.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto py-4 space-y-4">
                {/* 1. Trainee Autocomplete Picker */}
                <div>
                  <label className="text-xs font-bold text-gray-800 block mb-1">
                    Select Student Intern / Trainee *
                  </label>
                  <select
                    value={selectedTraineeId}
                    onChange={(e) => handleSelectTrainee(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-white font-medium"
                  >
                    <option value="">-- Choose a Deployed Trainee to Auto-fill --</option>
                    {allTrainees.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.employeeId || 'ID Pending'}) — {t.companyName || 'Host Pending'}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="text-[11px] font-semibold text-gray-700 block mb-1">Trainee Full Name *</label>
                    <input
                      type="text"
                      value={formTraineeName}
                      onChange={(e) => setFormTraineeName(e.target.value)}
                      placeholder="e.g. Juan Dela Cruz"
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-gray-700 block mb-1">Student ID / Number</label>
                    <input
                      type="text"
                      value={formStudentId}
                      onChange={(e) => setFormStudentId(e.target.value)}
                      placeholder="e.g. 20231379"
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-gray-700 block mb-1">Host Establishment (HTE) *</label>
                    <input
                      type="text"
                      value={formHteCompany}
                      onChange={(e) => setFormHteCompany(e.target.value)}
                      placeholder="e.g. Provincial Capitol IT Division"
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-gray-700 block mb-1">Immediate Supervisor</label>
                    <input
                      type="text"
                      value={formSupervisorName}
                      onChange={(e) => setFormSupervisorName(e.target.value)}
                      placeholder="e.g. Engr. Roberto Tan"
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                {/* 2. Visit Specifics */}
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-gray-200/80 space-y-3">
                  <h4 className="text-xs font-bold text-gray-800">Visit Modality & Schedule</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <label className="text-[11px] font-semibold text-gray-700 block mb-1">Visit Modality</label>
                      <select
                        value={formVisitType}
                        onChange={(e) => setFormVisitType(e.target.value as MonitoringVisitType)}
                        className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg bg-white"
                      >
                        <option value="on_site">On-Site Workplace Visitation</option>
                        <option value="virtual">Virtual Video Conference</option>
                        <option value="phone">Phone / Remote Coordination</option>
                        <option value="midterm">Midterm Milestone Review</option>
                        <option value="final">Final Exit Verification</option>
                        <option value="spot_check">Spot Inspection</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-gray-700 block mb-1">Visit Date</label>
                      <input
                        type="date"
                        value={formVisitDate}
                        onChange={(e) => setFormVisitDate(e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg bg-white"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-gray-700 block mb-1">Visit Time</label>
                      <input
                        type="text"
                        value={formVisitTime}
                        onChange={(e) => setFormVisitTime(e.target.value)}
                        placeholder="e.g. 10:30 AM"
                        className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg bg-white"
                      />
                    </div>
                  </div>
                </div>

                {/* 3. Rating Matrix (1 to 5) */}
                <div className="p-3.5 bg-indigo-50/50 rounded-2xl border border-indigo-200/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-indigo-950">
                      Performance Evaluation Matrix (Score: 1 - 5)
                    </h4>
                    <span className="text-xs font-extrabold text-indigo-700">
                      Average: {((ratingWorkQuality + ratingPunctuality + ratingProfessionalism + ratingTechnical + ratingPolicy) / 5).toFixed(1)} / 5.0
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    {[
                      { label: 'Work Quality & Output', val: ratingWorkQuality, set: setRatingWorkQuality },
                      { label: 'Punctuality & Attendance', val: ratingPunctuality, set: setRatingPunctuality },
                      { label: 'Professionalism & Conduct', val: ratingProfessionalism, set: setRatingProfessionalism },
                      { label: 'Technical Competence', val: ratingTechnical, set: setRatingTechnical },
                      { label: 'Adherence to Policies', val: ratingPolicy, set: setRatingPolicy },
                    ].map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 bg-white rounded-xl border border-indigo-100">
                        <span className="font-medium text-gray-800">{item.label}</span>
                        <select
                          value={item.val}
                          onChange={(e) => item.set(Number(e.target.value))}
                          className="px-2 py-1 text-xs font-bold text-indigo-900 border border-indigo-200 rounded-lg bg-indigo-50"
                        >
                          <option value={5}>5 - Excellent</option>
                          <option value={4}>4 - Very Good</option>
                          <option value={3}>3 - Good</option>
                          <option value={2}>2 - Fair</option>
                          <option value={1}>1 - Poor</option>
                        </select>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 4. Qualitative Fields */}
                <div className="space-y-3 text-xs">
                  <div>
                    <label className="font-semibold text-gray-800 block mb-1">
                      Key Tasks & Duties Observed *
                    </label>
                    <textarea
                      rows={2}
                      value={formTasksObserved}
                      onChange={(e) => setFormTasksObserved(e.target.value)}
                      placeholder="e.g. Assisting the network infrastructure team with structured cabling and switch configuration."
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-1 focus:ring-indigo-500 resize-none"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-gray-800 block mb-1">
                      Trainee Commendations / Highlights
                    </label>
                    <input
                      type="text"
                      value={formHighlights}
                      onChange={(e) => setFormHighlights(e.target.value)}
                      placeholder="e.g. Supervisor commended proactive attitude and fast learning curve."
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="font-semibold text-gray-800 block mb-1">
                        Issues / Concerns Raised (if any)
                      </label>
                      <input
                        type="text"
                        value={formIssues}
                        onChange={(e) => setFormIssues(e.target.value)}
                        placeholder="e.g. None observed, or occasional internet latency"
                        className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="font-semibold text-gray-800 block mb-1">
                        Overall Evaluation Status
                      </label>
                      <select
                        value={formOverallStatus}
                        onChange={(e) => setFormOverallStatus(e.target.value as MonitoringOverallStatus)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-xl bg-white font-bold text-gray-800"
                      >
                        <option value="commendable">Commendable Performance</option>
                        <option value="satisfactory">Satisfactory Progress</option>
                        <option value="needs_guidance">Needs Guidance & Follow-up</option>
                        <option value="critical">Critical / At-Risk</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="font-semibold text-gray-800 block mb-1">
                      Instructor Recommendations & Guidance for Student *
                    </label>
                    <textarea
                      rows={2}
                      value={formRecommendations}
                      onChange={(e) => setFormRecommendations(e.target.value)}
                      placeholder="e.g. Continue active participation in network security protocol reviews and keep DTR logs updated daily."
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-1 focus:ring-indigo-500 resize-none"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-gray-800 block mb-1">
                      Next Recommended Monitoring Visit Date
                    </label>
                    <input
                      type="date"
                      value={formNextVisitDate}
                      onChange={(e) => setFormNextVisitDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-between pt-4 border-t border-gray-100 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveReport}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-200 transition-all cursor-pointer"
                >
                  {editingReport ? 'Save Changes' : 'Generate & Publish Monitoring Report'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* REVIEW TRAINEE SELF REPORT MODAL */}
      <AnimatePresence>
        {reviewSelfReport && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-2xl border border-gray-100 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <h3 className="text-sm font-bold text-gray-900">
                  Review Trainee Self-Monitoring Journal
                </h3>
                <button
                  type="button"
                  onClick={() => setReviewSelfReport(null)}
                  className="p-1 text-gray-400 hover:text-gray-700 rounded-lg cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-3 bg-gray-50 rounded-2xl border border-gray-150 space-y-1 text-xs">
                <p><strong>Intern:</strong> {reviewSelfReport.traineeName}</p>
                <p><strong>Period:</strong> {reviewSelfReport.periodCovered}</p>
                <p><strong>Accomplishments:</strong> {reviewSelfReport.keyAccomplishments}</p>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-800 block mb-1">
                  Instructor Remarks & Feedback for Intern *
                </label>
                <textarea
                  rows={3}
                  value={instructorRemarksInput}
                  onChange={(e) => setInstructorRemarksInput(e.target.value)}
                  placeholder="Provide encouragement, constructive feedback, or recommendations..."
                  className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:ring-1 focus:ring-indigo-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setReviewSelfReport(null)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!instructorRemarksInput.trim()) {
                      toast.error('Please enter your remarks before marking as reviewed.');
                      return;
                    }
                    await reviewTraineeSelfMonitoringReport(reviewSelfReport.id, instructorRemarksInput.trim(), 'reviewed');
                    toast.success('Remarks saved & trainee progress acknowledged!');
                    setReviewSelfReport(null);
                  }}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  Save & Acknowledge
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* PRINT VIEW MODAL */}
      {printReport && (
        <MonitoringReportPrintView
          report={printReport}
          onClose={() => setPrintReport(null)}
        />
      )}
    </div>
  );
}
