import React, { useState, useMemo } from 'react';
import {
  ClipboardCheck,
  Plus,
  Search,
  Calendar,
  Building,
  User,
  Star,
  Printer,
  CheckCircle2,
  Clock,
  Sparkles,
  Phone,
  MapPin,
  ExternalLink,
  MessageSquare,
  FileText,
  AlertTriangle,
  Award,
  ChevronRight,
  TrendingUp,
  X,
  Edit3,
  Trash2,
  Check,
  Info,
  ShieldCheck,
  Send,
  Eye,
  BookOpen,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

import { useApp } from '../store/AppContext';
import { MonitoringReport as IMonitoringReport, TraineeSelfMonitoringReport } from '../types';
import { MonitoringReportPrintView } from '../components/MonitoringReportPrintView';
import { UserAvatar } from '../components/UserAvatar';

export function MonitoringReport() {
  const {
    currentUser,
    getCurrentEmployee,
    employees,
    timeRecords,
    monitoringReports,
    acknowledgeMonitoringReport,
    traineeSelfMonitoringReports,
    addTraineeSelfMonitoringReport,
    updateTraineeSelfMonitoringReport,
    deleteTraineeSelfMonitoringReport,
  } = useApp();

  const currentEmp = getCurrentEmployee();
  const [activeTab, setActiveTab] = useState<'official' | 'self_reports'>('official');

  // Modals
  const [selectedReportForPrint, setSelectedReportForPrint] = useState<IMonitoringReport | null>(null);
  const [acknowledgingReport, setAcknowledgingReport] = useState<IMonitoringReport | null>(null);
  const [acknowledgmentFeedback, setAcknowledgmentFeedback] = useState('');
  const [ackConfirmed, setAckConfirmed] = useState(false);

  // Self Report Modals
  const [showSelfReportModal, setShowSelfReportModal] = useState(false);
  const [editingSelfReport, setEditingSelfReport] = useState<TraineeSelfMonitoringReport | null>(null);
  const [viewingSelfReport, setViewingSelfReport] = useState<TraineeSelfMonitoringReport | null>(null);

  // Self Report Form Fields
  const [selfPeriodCovered, setSelfPeriodCovered] = useState('');
  const [selfHoursRendered, setSelfHoursRendered] = useState<number>(40);
  const [selfAccomplishments, setSelfAccomplishments] = useState('');
  const [selfSkillsApplied, setSelfSkillsApplied] = useState('');
  const [selfChallenges, setSelfChallenges] = useState('');
  const [selfResolution, setSelfResolution] = useState('');
  const [selfRating, setSelfRating] = useState<number>(5);

  // Search in tabs
  const [searchQuery, setSearchQuery] = useState('');

  // Hours rendered calculation for current trainee
  const totalRenderedHours = useMemo(() => {
    if (!currentEmp) return 0;
    const empId = currentEmp.id;
    const empCode = currentEmp.employeeId;
    return (timeRecords || [])
      .filter(
        (r) =>
          (r.employeeId === empId || (empCode && r.employeeId === empCode)) &&
          r.approvalStatus !== 'disapproved'
      )
      .reduce((sum, r) => sum + (Number(r.totalHours) || 0), 0);
  }, [timeRecords, currentEmp]);

  const requiredHours = currentEmp?.requiredHours || 600;
  const remainingHours = Math.max(0, requiredHours - totalRenderedHours);
  const progressPercentage = Math.min(100, Math.round((totalRenderedHours / requiredHours) * 100));

  // Match official instructor monitoring reports for this trainee
  const myOfficialReports = useMemo(() => {
    if (!currentEmp && !currentUser) return [];
    const empId = currentEmp?.id?.toLowerCase();
    const empCode = (currentEmp?.employeeId || (currentEmp as any)?.studentId || '').toLowerCase();
    const empName = (currentEmp?.name || currentUser?.name || '').toLowerCase();

    return monitoringReports.filter((r) => {
      if (empId && (r.traineeId?.toLowerCase() === empId || r.studentId?.toLowerCase() === empId)) return true;
      if (empCode && (r.traineeId?.toLowerCase() === empCode || r.studentId?.toLowerCase() === empCode)) return true;
      if (empName && r.traineeName?.toLowerCase() === empName) return true;
      return false;
    });
  }, [monitoringReports, currentEmp, currentUser]);

  // Match trainee self-monitoring reports
  const mySelfReports = useMemo(() => {
    if (!currentEmp && !currentUser) return [];
    const empId = currentEmp?.id?.toLowerCase();
    const empCode = (currentEmp?.employeeId || (currentEmp as any)?.studentId || '').toLowerCase();
    const empName = (currentEmp?.name || currentUser?.name || '').toLowerCase();

    return traineeSelfMonitoringReports.filter((r) => {
      if (empId && (r.traineeId?.toLowerCase() === empId || r.studentId?.toLowerCase() === empId)) return true;
      if (empCode && (r.traineeId?.toLowerCase() === empCode || r.studentId?.toLowerCase() === empCode)) return true;
      if (empName && r.traineeName?.toLowerCase() === empName) return true;
      return false;
    });
  }, [traineeSelfMonitoringReports, currentEmp, currentUser]);

  // Filtered lists based on search
  const filteredOfficialReports = useMemo(() => {
    if (!searchQuery.trim()) return myOfficialReports;
    const q = searchQuery.toLowerCase();
    return myOfficialReports.filter(
      (r) =>
        r.reportNumber.toLowerCase().includes(q) ||
        r.instructorName.toLowerCase().includes(q) ||
        r.hteCompanyName.toLowerCase().includes(q) ||
        r.visitType.toLowerCase().includes(q) ||
        (r.tasksObserved && r.tasksObserved.toLowerCase().includes(q))
    );
  }, [myOfficialReports, searchQuery]);

  const filteredSelfReports = useMemo(() => {
    if (!searchQuery.trim()) return mySelfReports;
    const q = searchQuery.toLowerCase();
    return mySelfReports.filter(
      (r) =>
        r.periodCovered.toLowerCase().includes(q) ||
        r.keyAccomplishments.toLowerCase().includes(q) ||
        r.skillsApplied.toLowerCase().includes(q) ||
        (r.instructorRemarks && r.instructorRemarks.toLowerCase().includes(q))
    );
  }, [mySelfReports, searchQuery]);

  // Handle open Acknowledgment modal
  const handleOpenAcknowledge = (report: IMonitoringReport) => {
    setAcknowledgingReport(report);
    setAcknowledgmentFeedback(report.traineeFeedback || '');
    setAckConfirmed(!!report.isAcknowledgedByTrainee);
  };

  const handleSubmitAcknowledgment = async () => {
    if (!acknowledgingReport) return;
    if (!ackConfirmed) {
      toast.error('Please check the confirmation box to sign and acknowledge.');
      return;
    }

    try {
      await acknowledgeMonitoringReport(acknowledgingReport.id, acknowledgmentFeedback.trim());
      toast.success('Monitoring report successfully acknowledged and signed!');
      setAcknowledgingReport(null);
    } catch {
      toast.error('Failed to acknowledge report.');
    }
  };

  // Open Self Report Form (New or Edit)
  const openNewSelfReport = () => {
    setEditingSelfReport(null);
    setSelfPeriodCovered(`Week ${mySelfReports.length + 1}: ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${new Date(Date.now() + 5 * 86400000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`);
    setSelfHoursRendered(40);
    setSelfAccomplishments('');
    setSelfSkillsApplied('');
    setSelfChallenges('');
    setSelfResolution('');
    setSelfRating(5);
    setShowSelfReportModal(true);
  };

  const openEditSelfReport = (report: TraineeSelfMonitoringReport) => {
    setEditingSelfReport(report);
    setSelfPeriodCovered(report.periodCovered);
    setSelfHoursRendered(report.hoursRenderedThisPeriod);
    setSelfAccomplishments(report.keyAccomplishments);
    setSelfSkillsApplied(report.skillsApplied);
    setSelfChallenges(report.challengesEncountered || '');
    setSelfResolution(report.resolutionOrAction || '');
    setSelfRating(report.selfRating || 5);
    setShowSelfReportModal(true);
  };

  const handleSaveSelfReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selfPeriodCovered.trim()) {
      toast.error('Please specify the period covered.');
      return;
    }
    if (!selfAccomplishments.trim()) {
      toast.error('Please detail your key accomplishments and tasks performed.');
      return;
    }
    if (!selfSkillsApplied.trim()) {
      toast.error('Please specify competencies or skills applied.');
      return;
    }

    try {
      if (editingSelfReport) {
        await updateTraineeSelfMonitoringReport(editingSelfReport.id, {
          periodCovered: selfPeriodCovered.trim(),
          hoursRenderedThisPeriod: Number(selfHoursRendered) || 0,
          keyAccomplishments: selfAccomplishments.trim(),
          skillsApplied: selfSkillsApplied.trim(),
          challengesEncountered: selfChallenges.trim() || undefined,
          resolutionOrAction: selfResolution.trim() || undefined,
          selfRating,
        });
        toast.success('Self-monitoring report updated successfully!');
      } else {
        await addTraineeSelfMonitoringReport({
          traineeId: currentEmp?.id || currentUser?.id || 'trainee-1',
          traineeName: currentEmp?.name || currentUser?.name || 'Trainee Student',
          studentId: currentEmp?.employeeId || (currentEmp as any)?.studentId || '2023-00123',
          course: currentEmp?.course || 'BS Information Technology',
          hteCompanyName: currentEmp?.companyName || 'Host Training Establishment',
          supervisorName: currentEmp?.supervisorName || 'OJT Workplace Mentor',
          periodCovered: selfPeriodCovered.trim(),
          dateSubmitted: new Date().toISOString().split('T')[0],
          hoursRenderedThisPeriod: Number(selfHoursRendered) || 0,
          totalCumulativeHours: Math.round(totalRenderedHours + (Number(selfHoursRendered) || 0)),
          keyAccomplishments: selfAccomplishments.trim(),
          skillsApplied: selfSkillsApplied.trim(),
          challengesEncountered: selfChallenges.trim() || undefined,
          resolutionOrAction: selfResolution.trim() || undefined,
          selfRating,
        });
        toast.success('Self-monitoring report submitted to Instructor!');
      }
      setShowSelfReportModal(false);
    } catch {
      toast.error('An error occurred while saving the report.');
    }
  };

  const handleDeleteSelfReport = async (id: string) => {
    if (confirm('Are you sure you want to delete this self-monitoring report?')) {
      try {
        await deleteTraineeSelfMonitoringReport(id);
        toast.success('Report deleted successfully.');
      } catch {
        toast.error('Failed to delete report.');
      }
    }
  };

  const getVisitTypeBadge = (type: string) => {
    switch (type) {
      case 'on_site':
        return { label: 'On-Site Visitation', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
      case 'virtual':
        return { label: 'Virtual Conference', bg: 'bg-blue-50 text-blue-700 border-blue-200' };
      case 'phone':
        return { label: 'Phone Coordination', bg: 'bg-purple-50 text-purple-700 border-purple-200' };
      case 'midterm':
        return { label: 'Midterm Review', bg: 'bg-amber-50 text-amber-700 border-amber-200' };
      case 'final':
        return { label: 'Final Exit Visit', bg: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
      default:
        return { label: 'Visitation', bg: 'bg-gray-50 text-gray-700 border-gray-200' };
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'commendable':
        return { label: 'Commendable', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
      case 'satisfactory':
        return { label: 'Satisfactory', color: 'bg-blue-100 text-blue-800 border-blue-300' };
      case 'needs_guidance':
        return { label: 'Needs Guidance', color: 'bg-amber-100 text-amber-800 border-amber-300' };
      case 'critical':
        return { label: 'Critical / At-Risk', color: 'bg-rose-100 text-rose-800 border-rose-300' };
      default:
        return { label: 'Recorded', color: 'bg-gray-100 text-gray-800 border-gray-300' };
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Top Header Card */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0B1E36] via-[#152B4D] to-[#1E3A66] p-6 sm:p-8 text-white shadow-xl shadow-blue-950/20 border border-blue-900/40">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-semibold uppercase tracking-wider backdrop-blur-xs">
              <ClipboardCheck size={13} />
              OJT Supervisory Monitoring Module
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Workplace Monitoring & Progress Reports
            </h1>
            <p className="text-sm text-blue-200/90 max-w-2xl leading-relaxed">
              Review official faculty supervisory visits, sign off on institutional evaluations, and submit periodic self-monitoring logs for your OJT portfolio.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={openNewSelfReport}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-sm shadow-lg shadow-emerald-950/40 transition-all cursor-pointer transform hover:-translate-y-0.5"
            >
              <Plus size={16} />
              + Submit Self-Monitoring Log
            </button>
          </div>
        </div>

        {/* Quick Placement & Training Context Banner */}
        <div className="mt-6 pt-6 border-t border-white/10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div className="bg-white/5 backdrop-blur-xs rounded-2xl p-3.5 border border-white/10 flex items-start gap-3">
            <div className="p-2 rounded-xl bg-blue-500/20 text-blue-300 shrink-0">
              <Building size={16} />
            </div>
            <div>
              <div className="text-blue-300 font-medium">Host Training Establishment</div>
              <div className="text-white font-bold text-sm truncate max-w-[180px]">
                {currentEmp?.companyName || 'Host Training Establishment'}
              </div>
              <div className="text-blue-200/70 truncate max-w-[180px]">
                {currentEmp?.supervisorName ? `Mentor: ${currentEmp.supervisorName}` : 'Designated Workplace Mentor'}
              </div>
            </div>
          </div>

          <div className="bg-white/5 backdrop-blur-xs rounded-2xl p-3.5 border border-white/10 flex items-start gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-300 shrink-0">
              <User size={16} />
            </div>
            <div>
              <div className="text-emerald-300 font-medium">Assigned Faculty Instructor</div>
              <div className="text-white font-bold text-sm truncate max-w-[180px]">
                {myOfficialReports[0]?.instructorName || currentEmp?.instructorName || 'Faculty OJT Coordinator'}
              </div>
              <div className="text-emerald-200/70">CHMSU College Faculty</div>
            </div>
          </div>

          <div className="bg-white/5 backdrop-blur-xs rounded-2xl p-3.5 border border-white/10 flex items-start gap-3">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-300 shrink-0">
              <Clock size={16} />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between text-amber-300 font-medium">
                <span>Rendered Hours</span>
                <span className="font-bold text-white">{Math.round(totalRenderedHours)} / {requiredHours} hrs</span>
              </div>
              <div className="mt-1.5 w-full bg-white/10 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-amber-400 to-emerald-400 h-full rounded-full transition-all duration-500"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
              <div className="mt-1 text-[11px] text-amber-200/70">
                {remainingHours === 0 ? '✓ Completed Required Hours' : `${Math.round(remainingHours)} hours remaining (${progressPercentage}%)`}
              </div>
            </div>
          </div>

          <div className="bg-white/5 backdrop-blur-xs rounded-2xl p-3.5 border border-white/10 flex items-start gap-3">
            <div className="p-2 rounded-xl bg-purple-500/20 text-purple-300 shrink-0">
              <Award size={16} />
            </div>
            <div>
              <div className="text-purple-300 font-medium">Supervisory Evaluation</div>
              <div className="text-white font-bold text-sm flex items-center gap-1.5">
                <span className="capitalize">{myOfficialReports[0]?.overallStatus.replace('_', ' ') || 'In Progress'}</span>
                {myOfficialReports.length > 0 && (
                  <span className="text-amber-400 flex items-center gap-0.5 text-xs">
                    <Star size={12} className="fill-amber-400" />
                    {(
                      (myOfficialReports[0].ratings.workQuality +
                        myOfficialReports[0].ratings.punctuality +
                        myOfficialReports[0].ratings.professionalism +
                        myOfficialReports[0].ratings.technicalCompetence +
                        myOfficialReports[0].ratings.policyAdherence) /
                      5
                    ).toFixed(1)}
                  </span>
                )}
              </div>
              <div className="text-purple-200/70">{myOfficialReports.length} Official Visits Logged</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-white p-3 rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex items-center gap-1 bg-gray-100/80 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveTab('official')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'official'
                ? 'bg-white text-gray-900 shadow-xs'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <ShieldCheck size={14} className={activeTab === 'official' ? 'text-emerald-600' : ''} />
            Official Faculty Visits
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-emerald-100 text-emerald-800 font-extrabold">
              {myOfficialReports.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('self_reports')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'self_reports'
                ? 'bg-white text-gray-900 shadow-xs'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <BookOpen size={14} className={activeTab === 'self_reports' ? 'text-blue-600' : ''} />
            My Self-Monitoring Logs
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-blue-100 text-blue-800 font-extrabold">
              {mySelfReports.length}
            </span>
          </button>
        </div>

        <div className="relative min-w-[240px]">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder={activeTab === 'official' ? 'Search faculty reports...' : 'Search self logs...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl border border-gray-200 bg-gray-50/50 focus:bg-white focus:outline-hidden focus:border-blue-500 transition-all"
          />
        </div>
      </div>

      {/* TAB 1: OFFICIAL FACULTY MONITORING VISITS */}
      {activeTab === 'official' && (
        <div className="space-y-4">
          {filteredOfficialReports.length === 0 ? (
            <div className="bg-white rounded-3xl border border-dashed border-gray-300 p-12 text-center">
              <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4 shadow-inner">
                <ClipboardCheck size={28} />
              </div>
              <h3 className="text-base font-bold text-gray-800 mb-1">No Faculty Visits Recorded Yet</h3>
              <p className="text-xs text-gray-500 max-w-md mx-auto">
                Your OJT Instructor has not logged an official workplace monitoring report for your placement yet. When a visitation or virtual consultation is conducted, it will appear here for your review and acknowledgment.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5">
              {filteredOfficialReports.map((report) => {
                const visitTypeBadge = getVisitTypeBadge(report.visitType);
                const statusBadge = getStatusBadge(report.overallStatus);
                const avgRating = (
                  (report.ratings.workQuality +
                    report.ratings.punctuality +
                    report.ratings.professionalism +
                    report.ratings.technicalCompetence +
                    report.ratings.policyAdherence) /
                  5
                ).toFixed(1);

                return (
                  <motion.div
                    key={report.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-3xl border border-gray-200 shadow-sm hover:shadow-md transition-all overflow-hidden"
                  >
                    {/* Header bar */}
                    <div className="p-5 sm:p-6 border-b border-gray-100 bg-gradient-to-r from-slate-50/80 to-white flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                      <div className="flex items-start gap-3.5">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#152B4D] to-[#1E3A66] text-white flex items-center justify-center font-extrabold text-sm shadow-md shrink-0">
                          <ClipboardCheck size={22} />
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-xs font-bold text-gray-600 bg-gray-100 px-2 py-0.5 rounded-md">
                              {report.reportNumber}
                            </span>
                            <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${visitTypeBadge.bg}`}>
                              {visitTypeBadge.label}
                            </span>
                            <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${statusBadge.color}`}>
                              {statusBadge.label}
                            </span>
                          </div>
                          <h3 className="text-base font-bold text-gray-900 mt-1">
                            Supervisory Visit by {report.instructorName}
                          </h3>
                          <p className="text-xs text-gray-500 flex items-center gap-3 mt-0.5">
                            <span className="flex items-center gap-1">
                              <Calendar size={12} className="text-gray-400" />
                              {new Date(report.visitDate).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                              {report.visitTime && ` at ${report.visitTime}`}
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Building size={12} className="text-gray-400" />
                              {report.hteCompanyName}
                            </span>
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
                        <button
                          type="button"
                          onClick={() => setSelectedReportForPrint(report)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 font-semibold text-xs transition-colors shadow-xs cursor-pointer"
                        >
                          <Printer size={14} className="text-gray-500" />
                          View Official Document / PDF
                        </button>

                        {report.isAcknowledgedByTrainee ? (
                          <div className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
                            <CheckCircle2 size={15} className="text-emerald-600" />
                            Acknowledged by You
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleOpenAcknowledge(report)}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs shadow-md shadow-emerald-900/10 transition-all cursor-pointer"
                          >
                            <Check size={14} />
                            Acknowledge & Sign Report
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Body content */}
                    <div className="p-5 sm:p-6 space-y-5">
                      {/* Rating Matrix Pills */}
                      <div className="bg-slate-50/70 rounded-2xl p-4 border border-gray-100">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                            <Award size={14} className="text-amber-500" />
                            Faculty Evaluation Ratings
                          </span>
                          <span className="text-xs font-extrabold text-blue-900 bg-blue-100/80 px-2.5 py-0.5 rounded-full">
                            Composite Score: {avgRating} / 5.0
                          </span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-xs">
                          <div className="bg-white rounded-xl p-2.5 border border-gray-200/60 shadow-xs">
                            <div className="text-gray-500 text-[11px]">Work Quality</div>
                            <div className="font-extrabold text-gray-900 text-sm mt-0.5 flex items-center justify-between">
                              <span>{report.ratings.workQuality}/5</span>
                              <div className="flex text-amber-400">
                                {[...Array(report.ratings.workQuality)].map((_, i) => (
                                  <Star key={i} size={11} className="fill-amber-400" />
                                ))}
                              </div>
                            </div>
                          </div>
                          <div className="bg-white rounded-xl p-2.5 border border-gray-200/60 shadow-xs">
                            <div className="text-gray-500 text-[11px]">Punctuality</div>
                            <div className="font-extrabold text-gray-900 text-sm mt-0.5 flex items-center justify-between">
                              <span>{report.ratings.punctuality}/5</span>
                              <div className="flex text-amber-400">
                                {[...Array(report.ratings.punctuality)].map((_, i) => (
                                  <Star key={i} size={11} className="fill-amber-400" />
                                ))}
                              </div>
                            </div>
                          </div>
                          <div className="bg-white rounded-xl p-2.5 border border-gray-200/60 shadow-xs">
                            <div className="text-gray-500 text-[11px]">Professionalism</div>
                            <div className="font-extrabold text-gray-900 text-sm mt-0.5 flex items-center justify-between">
                              <span>{report.ratings.professionalism}/5</span>
                              <div className="flex text-amber-400">
                                {[...Array(report.ratings.professionalism)].map((_, i) => (
                                  <Star key={i} size={11} className="fill-amber-400" />
                                ))}
                              </div>
                            </div>
                          </div>
                          <div className="bg-white rounded-xl p-2.5 border border-gray-200/60 shadow-xs">
                            <div className="text-gray-500 text-[11px]">Tech Competence</div>
                            <div className="font-extrabold text-gray-900 text-sm mt-0.5 flex items-center justify-between">
                              <span>{report.ratings.technicalCompetence}/5</span>
                              <div className="flex text-amber-400">
                                {[...Array(report.ratings.technicalCompetence)].map((_, i) => (
                                  <Star key={i} size={11} className="fill-amber-400" />
                                ))}
                              </div>
                            </div>
                          </div>
                          <div className="bg-white rounded-xl p-2.5 border border-gray-200/60 shadow-xs">
                            <div className="text-gray-500 text-[11px]">Policy Adherence</div>
                            <div className="font-extrabold text-gray-900 text-sm mt-0.5 flex items-center justify-between">
                              <span>{report.ratings.policyAdherence}/5</span>
                              <div className="flex text-amber-400">
                                {[...Array(report.ratings.policyAdherence)].map((_, i) => (
                                  <Star key={i} size={11} className="fill-amber-400" />
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Observations & Feedback Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                        <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-xs space-y-2">
                          <h4 className="font-bold text-gray-800 flex items-center gap-1.5 text-xs">
                            <Eye size={13} className="text-blue-600" />
                            Workplace Tasks Observed
                          </h4>
                          <p className="text-gray-600 leading-relaxed whitespace-pre-wrap">
                            {report.tasksObserved || 'Routine OJT assigned functions under mentor supervision.'}
                          </p>
                          {report.highlights && (
                            <div className="mt-2 pt-2 border-t border-gray-100">
                              <span className="font-bold text-emerald-800 block mb-0.5">Key Highlights:</span>
                              <p className="text-gray-600">{report.highlights}</p>
                            </div>
                          )}
                        </div>

                        <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-xs space-y-2">
                          <h4 className="font-bold text-gray-800 flex items-center gap-1.5 text-xs">
                            <Sparkles size={13} className="text-purple-600" />
                            Faculty Recommendations & Guidance
                          </h4>
                          <p className="text-gray-600 leading-relaxed whitespace-pre-wrap">
                            {report.recommendations}
                          </p>
                          {report.issuesIdentified && (
                            <div className="mt-2 pt-2 border-t border-gray-100">
                              <span className="font-bold text-amber-800 block mb-0.5">Areas for Development:</span>
                              <p className="text-amber-900">{report.issuesIdentified}</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Trainee Acknowledgment Reflection (If signed) */}
                      {report.isAcknowledgedByTrainee && (
                        <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-4 flex items-start gap-3 text-xs">
                          <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700 shrink-0">
                            <CheckCircle2 size={16} />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-emerald-950">
                                Signed & Acknowledged by You
                              </span>
                              <span className="text-[11px] text-emerald-700">
                                {report.traineeAcknowledgedAt
                                  ? new Date(report.traineeAcknowledgedAt).toLocaleDateString('en-US', {
                                      month: 'short',
                                      day: 'numeric',
                                      year: 'numeric',
                                    })
                                  : 'Completed'}
                              </span>
                            </div>
                            <p className="text-emerald-900 mt-1 italic">
                              "{report.traineeFeedback || 'I confirm receipt and review of this supervisory monitoring visit evaluation.'}"
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: TRAINEE SELF-MONITORING LOGS */}
      {activeTab === 'self_reports' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-blue-50/60 border border-blue-200/80 rounded-2xl p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-blue-100 text-blue-700 shrink-0">
                <Info size={16} />
              </div>
              <div className="text-xs">
                <div className="font-bold text-blue-900">Weekly & Periodic Self-Monitoring Requirement</div>
                <div className="text-blue-700 mt-0.5">
                  Log your progress periodically. Your instructor reads these journals to review competencies applied, address bottlenecks, and give institutional feedback.
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={openNewSelfReport}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition-all cursor-pointer shrink-0 ml-4"
            >
              <Plus size={14} /> Log Period Entry
            </button>
          </div>

          {filteredSelfReports.length === 0 ? (
            <div className="bg-white rounded-3xl border border-dashed border-gray-300 p-12 text-center">
              <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-4 shadow-inner">
                <BookOpen size={28} />
              </div>
              <h3 className="text-base font-bold text-gray-800 mb-1">No Self-Monitoring Logs Submitted Yet</h3>
              <p className="text-xs text-gray-500 max-w-md mx-auto mb-5">
                Keep an ongoing record of your training hours, key tasks completed, skills learned, and challenges encountered during your internship.
              </p>
              <button
                type="button"
                onClick={openNewSelfReport}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold text-xs shadow-md cursor-pointer"
              >
                <Plus size={14} /> Submit Your First Self-Monitoring Log
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredSelfReports.map((report) => {
                const isReviewed = report.status === 'reviewed';

                return (
                  <motion.div
                    key={report.id}
                    layout
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-white rounded-3xl border border-gray-200 p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
                  >
                    <div className="space-y-3.5">
                      {/* Top Bar */}
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-sm text-gray-900 flex items-center gap-1.5">
                          <BookOpen size={15} className="text-blue-600" />
                          {report.periodCovered}
                        </span>
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                              isReviewed
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : 'bg-amber-50 text-amber-800 border-amber-200'
                            }`}
                          >
                            {isReviewed ? '✓ Reviewed by Instructor' : 'Pending Review'}
                          </span>
                        </div>
                      </div>

                      {/* Meta Info */}
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Calendar size={12} />
                          {new Date(report.dateSubmitted).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1 font-semibold text-gray-700">
                          <Clock size={12} className="text-blue-600" />
                          {report.hoursRenderedThisPeriod} hrs rendered
                        </span>
                        {report.selfRating && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-0.5 text-amber-500 font-bold">
                              <Star size={11} className="fill-amber-400" />
                              {report.selfRating}/5
                            </span>
                          </>
                        )}
                      </div>

                      {/* Key Accomplishments */}
                      <div className="bg-gray-50 rounded-2xl p-3.5 border border-gray-100 text-xs space-y-1.5">
                        <span className="font-bold text-gray-800 block text-[11px] uppercase tracking-wide">
                          Accomplishments & Tasks:
                        </span>
                        <p className="text-gray-700 line-clamp-3 leading-relaxed whitespace-pre-wrap">
                          {report.keyAccomplishments}
                        </p>
                      </div>

                      {/* Skills Applied */}
                      <div className="text-xs">
                        <span className="font-bold text-gray-700 text-[11px]">Competencies Applied:</span>
                        <p className="text-gray-600 line-clamp-2 mt-0.5">{report.skillsApplied}</p>
                      </div>

                      {/* Instructor Remarks (if reviewed) */}
                      {isReviewed && report.instructorRemarks && (
                        <div className="bg-emerald-50/80 border border-emerald-200 rounded-2xl p-3.5 text-xs">
                          <div className="flex items-center justify-between text-emerald-900 font-bold mb-1">
                            <span className="flex items-center gap-1.5">
                              <ShieldCheck size={14} className="text-emerald-700" />
                              Instructor Remarks:
                            </span>
                            {report.reviewedByInstructorAt && (
                              <span className="text-[10px] font-normal text-emerald-700">
                                {new Date(report.reviewedByInstructorAt).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                })}
                              </span>
                            )}
                          </div>
                          <p className="text-emerald-950 italic whitespace-pre-wrap">
                            "{report.instructorRemarks}"
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Bottom Actions */}
                    <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => setViewingSelfReport(report)}
                        className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800 cursor-pointer"
                      >
                        <Eye size={13} /> Full Details
                      </button>

                      <div className="flex items-center gap-1.5">
                        {!isReviewed && (
                          <button
                            type="button"
                            onClick={() => openEditSelfReport(report)}
                            className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                            title="Edit report"
                          >
                            <Edit3 size={14} />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteSelfReport(report.id)}
                          className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Delete report"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MODAL: ACKNOWLEDGE OFFICIAL REPORT */}
      <AnimatePresence>
        {acknowledgingReport && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl border border-gray-200 w-full max-w-xl overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-emerald-50 to-teal-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold">
                    <CheckCircle2 size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">Acknowledge Supervisory Monitoring Report</h3>
                    <p className="text-[11px] text-gray-500">Report No. {acknowledgingReport.reportNumber}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setAcknowledgingReport(null)}
                  className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-6 space-y-4 text-xs">
                {/* Summary Info */}
                <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Instructor:</span>
                    <span className="font-bold text-gray-900">{acknowledgingReport.instructorName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Visit Date:</span>
                    <span className="font-semibold text-gray-800">{acknowledgingReport.visitDate}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Overall Assessment:</span>
                    <span className="font-bold text-emerald-800 capitalize">
                      {acknowledgingReport.overallStatus.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="pt-2 border-t border-gray-200">
                    <span className="text-gray-500 block mb-0.5">Faculty Guidance / Recommendation:</span>
                    <p className="text-gray-800 italic">"{acknowledgingReport.recommendations}"</p>
                  </div>
                </div>

                {/* Trainee Reflection / Feedback */}
                <div>
                  <label className="block font-bold text-gray-800 mb-1">
                    Student Reflection / Response Notes (Optional):
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Provide any comments or action steps you are taking based on your instructor's feedback..."
                    value={acknowledgmentFeedback}
                    onChange={(e) => setAcknowledgmentFeedback(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-xs focus:outline-hidden focus:border-emerald-500 transition-all resize-none"
                  />
                </div>

                {/* Agreement Checkbox */}
                <label className="flex items-start gap-2.5 cursor-pointer p-3 rounded-xl bg-emerald-50/60 border border-emerald-200/80">
                  <input
                    type="checkbox"
                    checked={ackConfirmed}
                    onChange={(e) => setAckConfirmed(e.target.checked)}
                    className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                  <span className="text-emerald-950 font-medium text-[11px] leading-relaxed">
                    I confirm that I have reviewed this official OJT monitoring report, understand the evaluations provided by my faculty coordinator, and agree to follow through on the recommendations.
                  </span>
                </label>
              </div>

              <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setAcknowledgingReport(null)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmitAcknowledgment}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-900/10 cursor-pointer"
                >
                  Confirm & Sign Acknowledgment
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: SUBMIT / EDIT SELF-MONITORING REPORT */}
      <AnimatePresence>
        {showSelfReportModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl border border-gray-200 w-full max-w-2xl overflow-hidden my-6"
            >
              <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold">
                    <BookOpen size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">
                      {editingSelfReport ? 'Edit Self-Monitoring Log' : 'New Self-Monitoring Log Entry'}
                    </h3>
                    <p className="text-[11px] text-gray-500">CHMSU OJT Periodic Progress Documentation</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSelfReportModal(false)}
                  className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSaveSelfReport} className="p-6 space-y-4 text-xs max-h-[75vh] overflow-y-auto">
                {/* Period & Hours */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">
                      Period Covered <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Week 4: Oct 6 – Oct 10, 2026"
                      value={selfPeriodCovered}
                      onChange={(e) => setSelfPeriodCovered(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-gray-200 focus:outline-hidden focus:border-blue-500 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 mb-1">
                      Hours Rendered This Period <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      required
                      min={1}
                      max={80}
                      value={selfHoursRendered}
                      onChange={(e) => setSelfHoursRendered(Number(e.target.value))}
                      className="w-full px-3.5 py-2 rounded-xl border border-gray-200 focus:outline-hidden focus:border-blue-500 transition-all"
                    />
                  </div>
                </div>

                {/* Self-Rating */}
                <div>
                  <label className="block font-bold text-gray-700 mb-1">
                    Your Self-Evaluation Rating for This Period:
                  </label>
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        type="button"
                        key={star}
                        onClick={() => setSelfRating(star)}
                        className={`p-2 rounded-xl border flex items-center gap-1.5 transition-all cursor-pointer ${
                          selfRating >= star
                            ? 'bg-amber-50 border-amber-300 text-amber-700 font-bold'
                            : 'bg-gray-50 border-gray-200 text-gray-400'
                        }`}
                      >
                        <Star
                          size={16}
                          className={selfRating >= star ? 'fill-amber-400 text-amber-500' : 'text-gray-300'}
                        />
                        <span>{star}</span>
                      </button>
                    ))}
                    <span className="text-gray-500 text-[11px] ml-2">
                      {selfRating === 5 && 'Outstanding Performance'}
                      {selfRating === 4 && 'Very Satisfactory'}
                      {selfRating === 3 && 'Satisfactory / Met Goals'}
                      {selfRating <= 2 && 'Need More Guidance'}
                    </span>
                  </div>
                </div>

                {/* Key Accomplishments */}
                <div>
                  <label className="block font-bold text-gray-700 mb-1">
                    Key Tasks & Major Accomplishments Completed <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    required
                    placeholder="Describe specific modules developed, equipment serviced, reports drafted, or business processes assisted..."
                    value={selfAccomplishments}
                    onChange={(e) => setSelfAccomplishments(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 focus:outline-hidden focus:border-blue-500 transition-all resize-none"
                  />
                </div>

                {/* Skills & Competencies Applied */}
                <div>
                  <label className="block font-bold text-gray-700 mb-1">
                    Technical & Professional Competencies Applied <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={2}
                    required
                    placeholder="e.g. React.js, SQL database queries, network cabling, client coordination, troubleshooting..."
                    value={selfSkillsApplied}
                    onChange={(e) => setSelfSkillsApplied(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 focus:outline-hidden focus:border-blue-500 transition-all resize-none"
                  />
                </div>

                {/* Challenges Encountered */}
                <div>
                  <label className="block font-bold text-gray-700 mb-1">
                    Challenges or Difficulties Encountered (Optional):
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Any bottlenecks, unfamiliar tools, or workflow difficulties you faced during this period..."
                    value={selfChallenges}
                    onChange={(e) => setSelfChallenges(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 focus:outline-hidden focus:border-blue-500 transition-all resize-none"
                  />
                </div>

                {/* Resolutions or Guidance Needed */}
                <div>
                  <label className="block font-bold text-gray-700 mb-1">
                    Actions Taken or Guidance Requested from Instructor (Optional):
                  </label>
                  <textarea
                    rows={2}
                    placeholder="How you resolved the issue, or what questions you would like your faculty instructor to address..."
                    value={selfResolution}
                    onChange={(e) => setSelfResolution(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 focus:outline-hidden focus:border-blue-500 transition-all resize-none"
                  />
                </div>

                <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setShowSelfReportModal(false)}
                    className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-800 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs shadow-md shadow-blue-900/10 cursor-pointer"
                  >
                    {editingSelfReport ? 'Update Entry' : 'Submit Log to Instructor'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: VIEW SELF REPORT FULL DETAILS */}
      <AnimatePresence>
        {viewingSelfReport && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl border border-gray-200 w-full max-w-xl overflow-hidden my-6"
            >
              <div className="px-6 py-4 border-b border-gray-100 bg-slate-50 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-gray-900">Self-Monitoring Progress Log</h3>
                  <p className="text-[11px] text-gray-500">{viewingSelfReport.periodCovered}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setViewingSelfReport(null)}
                  className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-6 space-y-4 text-xs max-h-[75vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-3 bg-gray-50 p-3.5 rounded-2xl border border-gray-200">
                  <div>
                    <span className="text-gray-500 text-[11px]">Date Submitted:</span>
                    <div className="font-bold text-gray-800 mt-0.5">{viewingSelfReport.dateSubmitted}</div>
                  </div>
                  <div>
                    <span className="text-gray-500 text-[11px]">Hours Rendered:</span>
                    <div className="font-bold text-gray-800 mt-0.5">{viewingSelfReport.hoursRenderedThisPeriod} Hours</div>
                  </div>
                  <div>
                    <span className="text-gray-500 text-[11px]">Self Rating:</span>
                    <div className="font-bold text-amber-600 mt-0.5 flex items-center gap-1">
                      <Star size={13} className="fill-amber-400" />
                      {viewingSelfReport.selfRating || 5}/5
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-500 text-[11px]">Review Status:</span>
                    <div className="font-bold text-emerald-700 mt-0.5 capitalize">{viewingSelfReport.status}</div>
                  </div>
                </div>

                <div>
                  <h4 className="font-bold text-gray-800 mb-1">Key Accomplishments & Tasks</h4>
                  <div className="bg-white p-3 rounded-xl border border-gray-200 whitespace-pre-wrap leading-relaxed text-gray-700">
                    {viewingSelfReport.keyAccomplishments}
                  </div>
                </div>

                <div>
                  <h4 className="font-bold text-gray-800 mb-1">Competencies & Skills Applied</h4>
                  <div className="bg-white p-3 rounded-xl border border-gray-200 whitespace-pre-wrap leading-relaxed text-gray-700">
                    {viewingSelfReport.skillsApplied}
                  </div>
                </div>

                {viewingSelfReport.challengesEncountered && (
                  <div>
                    <h4 className="font-bold text-gray-800 mb-1">Challenges Encountered</h4>
                    <div className="bg-amber-50/50 p-3 rounded-xl border border-amber-200 whitespace-pre-wrap leading-relaxed text-amber-900">
                      {viewingSelfReport.challengesEncountered}
                    </div>
                  </div>
                )}

                {viewingSelfReport.resolutionOrAction && (
                  <div>
                    <h4 className="font-bold text-gray-800 mb-1">Action Taken / Assistance Requested</h4>
                    <div className="bg-white p-3 rounded-xl border border-gray-200 whitespace-pre-wrap leading-relaxed text-gray-700">
                      {viewingSelfReport.resolutionOrAction}
                    </div>
                  </div>
                )}

                {viewingSelfReport.instructorRemarks && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
                    <h4 className="font-bold text-emerald-950 flex items-center gap-1.5 mb-1">
                      <ShieldCheck size={16} className="text-emerald-700" />
                      Instructor Remarks & Feedback
                    </h4>
                    <p className="text-emerald-900 italic whitespace-pre-wrap">
                      "{viewingSelfReport.instructorRemarks}"
                    </p>
                  </div>
                )}
              </div>

              <div className="px-6 py-3.5 bg-gray-50 border-t border-gray-100 flex justify-end">
                <button
                  type="button"
                  onClick={() => setViewingSelfReport(null)}
                  className="px-4 py-2 rounded-xl bg-gray-800 text-white text-xs font-bold hover:bg-gray-700 cursor-pointer"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* PRINT VIEW MODAL */}
      {selectedReportForPrint && (
        <MonitoringReportPrintView
          report={selectedReportForPrint}
          onClose={() => setSelectedReportForPrint(null)}
        />
      )}
    </div>
  );
}
