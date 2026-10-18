import React from 'react';
import { Printer, X, Award, Building, User, Calendar, MapPin, Phone, ShieldCheck, CheckCircle2, Star } from 'lucide-react';
import { MonitoringReport } from '../types';

interface MonitoringReportPrintViewProps {
  report: MonitoringReport;
  onClose: () => void;
}

export function MonitoringReportPrintView({ report, onClose }: MonitoringReportPrintViewProps) {
  const handlePrint = () => {
    window.print();
  };

  const getPeriodLabel = (type: string) => {
    switch (type) {
      case 'weekly':
        return {
          title: 'WEEKLY OJT MONITORING REPORT & EVALUATION',
          badge: 'Weekly Monitoring Period',
          color: 'bg-blue-600 text-white',
        };
      case 'monthly':
        return {
          title: 'MONTHLY OJT MONITORING REPORT & EVALUATION',
          badge: 'Monthly Monitoring Assessment',
          color: 'bg-emerald-600 text-white',
        };
      case 'midterm':
        return {
          title: 'MID-TERM OJT MONITORING & PROGRESS EVALUATION (300H)',
          badge: 'Mid-Term Evaluation Milestone',
          color: 'bg-purple-600 text-white',
        };
      case 'endterm':
        return {
          title: 'END-TERM FINAL OJT MONITORING & EXIT COMPLETION (600H)',
          badge: 'End-Term Practicum Completion',
          color: 'bg-amber-600 text-white',
        };
      default:
        return {
          title: 'OFFICIAL OJT MONITORING AND EVALUATION REPORT',
          badge: 'Monitoring Report',
          color: 'bg-slate-900 text-white',
        };
    }
  };

  const periodConfig = getPeriodLabel(report.reportType || 'weekly');

  // Compute or extract questionnaire criteria
  const q = report.questionnaire || {
    attendanceScore: report.ratings?.workQuality ?? 5,
    performanceScore: report.ratings?.punctuality ?? 5,
    attitudeScore: report.ratings?.professionalism ?? 5,
    communicationScore: report.ratings?.technicalCompetence ?? 5,
    teamworkScore: report.ratings?.policyAdherence ?? 5,
    overallScore: 100,
    strengths: report.highlights || '',
    areasForImprovement: report.issuesIdentified || '',
    recommendation: 'Highly Recommended' as const,
  };

  const avgScoreOutOf5 = (
    (q.attendanceScore + q.performanceScore + q.attitudeScore + q.communicationScore + q.teamworkScore) /
    5
  ).toFixed(1);

  const getScoreDescriptor = (score: number) => {
    if (score >= 5) return 'Exceptional / Outstanding';
    if (score >= 4) return 'Very Satisfactory / Exceeds Target';
    if (score >= 3) return 'Satisfactory / Meets Standards';
    if (score >= 2) return 'Fair / Needs Improvement';
    return 'Poor / Action Required';
  };

  const requiredHours = report.requiredHours || 600;
  const renderedHours = report.totalCumulativeHours ?? report.renderedHours ?? 0;
  const remainingHours = report.remainingHours ?? Math.max(0, requiredHours - renderedHours);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl border border-gray-200 w-full max-w-4xl max-h-[94vh] flex flex-col overflow-hidden">
        {/* Top Modal Bar (Excluded from Print) */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-gray-100 bg-slate-50 no-print shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <h3 className="text-sm font-bold text-gray-800">
              OJT Monitoring Report Preview — <span className="font-mono text-blue-900">{report.reportNumber}</span>
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-[#152B4D] to-[#1E3A66] hover:opacity-95 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-900/20 transition-all cursor-pointer"
            >
              <Printer size={14} /> Print / Save as PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 cursor-pointer"
              title="Close Preview"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Printable Document Body */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-10 bg-white text-gray-900 print:p-0 print:overflow-visible">
          {/* Institutional Document Header */}
          <div className="border-b-2 border-slate-900 pb-5 text-center relative">
            <div className="flex items-center justify-center gap-4 mb-2">
              <img
                src="/chmsu-logo.png"
                alt="CHMSU Logo"
                className="w-16 h-16 object-contain"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
              <div className="text-center">
                <p className="text-[11px] uppercase tracking-wider text-gray-600 font-semibold">Republic of the Philippines</p>
                <h1 className="text-base sm:text-lg font-black text-[#152B4D] tracking-tight uppercase">
                  Carlos Hilado Memorial State University
                </h1>
                <p className="text-xs text-gray-700 font-medium">
                  {report.campus || 'Talisay (Main Campus)'} • Negros Occidental, Philippines
                </p>
                <p className="text-xs font-bold text-[#146B4D]">
                  OFFICE OF ON-THE-JOB TRAINING & STUDENT INTERNSHIP PROGRAM
                </p>
              </div>
            </div>

            <div className={`mt-3 inline-block px-5 py-1.5 rounded-md text-xs font-extrabold uppercase tracking-widest ${periodConfig.color}`}>
              {periodConfig.title}
            </div>

            <div className="mt-2 flex items-center justify-between text-[11px] text-gray-500 px-2">
              <span>Report Ref: <strong className="text-gray-900 font-mono">{report.reportNumber}</strong></span>
              <span>Milestone: <strong className="text-gray-900 uppercase">{report.reportType}</strong></span>
              <span>A.Y. <strong className="text-gray-900">{report.academicYear || '2026-2027'}</strong></span>
              <span>Date: <strong className="text-gray-900">{report.dateSubmitted || new Date(report.createdAt).toLocaleDateString()}</strong></span>
            </div>
          </div>

          {/* Section 1: Trainee & HTE Profile */}
          <div className="mt-6 border border-gray-300 rounded-xl overflow-hidden">
            <div className="bg-slate-100 px-4 py-2 border-b border-gray-300 font-bold text-xs uppercase tracking-wider text-slate-800 flex items-center justify-between">
              <span>I. Trainee & Host Training Establishment Information</span>
              <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase border ${
                report.status === 'reviewed' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-amber-100 text-amber-800 border-amber-300'
              }`}>
                Status: {report.status || 'Submitted'}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 text-xs divide-y md:divide-y-0 md:divide-x divide-gray-200">
              <div className="p-3.5 space-y-1.5">
                <p><strong className="text-gray-600">Student Intern:</strong> <span className="font-bold text-gray-900">{report.traineeName}</span></p>
                <p><strong className="text-gray-600">Student ID:</strong> <span className="font-mono font-bold text-blue-900">{report.studentId || report.traineeId}</span></p>
                <p><strong className="text-gray-600">Degree Program:</strong> <span className="font-semibold text-gray-800">{report.course || 'BS Information Technology'}</span></p>
                <p><strong className="text-gray-600">Department:</strong> <span>{report.department || 'College of Computer Studies'}</span></p>
                <div className="pt-2 border-t border-gray-150 flex items-center justify-between text-[11px]">
                  <span>Required: <strong>{requiredHours}h</strong></span>
                  <span>Rendered: <strong className="text-emerald-700">{renderedHours}h</strong></span>
                  <span>This Period: <strong className="text-blue-700">+{report.hoursRenderedThisPeriod || 0}h</strong></span>
                  <span>Balance: <strong className="text-amber-700">{remainingHours}h</strong></span>
                </div>
              </div>

              <div className="p-3.5 space-y-1.5">
                <p><strong className="text-gray-600">Host Establishment (HTE):</strong> <span className="font-bold text-gray-900">{report.hteCompanyName}</span></p>
                <p><strong className="text-gray-600">Company Station / Address:</strong> <span>{report.hteAddress || 'Official Assigned Station'}</span></p>
                <p><strong className="text-gray-600">HTE Supervisor / Mentor:</strong> <span className="font-semibold">{report.supervisorName || 'Engr. Roberto M. Tan'}</span></p>
                <p><strong className="text-gray-600">Supervisor Designation:</strong> <span>{report.supervisorDesignation || 'OJT Mentor / Supervisor'}</span></p>
                <p><strong className="text-gray-600">Contact Number:</strong> <span>{report.supervisorContact || 'N/A'}</span></p>
              </div>
            </div>
          </div>

          {/* Section 2: Period & Scope */}
          <div className="mt-4 border border-gray-300 rounded-xl overflow-hidden">
            <div className="bg-slate-100 px-4 py-2 border-b border-gray-300 font-bold text-xs uppercase tracking-wider text-slate-800">
              II. Period Details & Time Allocation
            </div>
            <div className="p-3.5 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-[10px] text-gray-500 uppercase block font-semibold">Period Covered</span>
                <span className="font-bold text-gray-900">{report.periodCovered || 'Training Period'}</span>
              </div>
              <div>
                <span className="text-[10px] text-gray-500 uppercase block font-semibold">Report Type</span>
                <span className="font-bold text-blue-900 uppercase">{report.reportType}</span>
              </div>
              <div>
                <span className="text-[10px] text-gray-500 uppercase block font-semibold">Hours This Period</span>
                <span className="font-bold text-emerald-800">{report.hoursRenderedThisPeriod || 0} Hours</span>
              </div>
              <div>
                <span className="text-[10px] text-gray-500 uppercase block font-semibold">Date Submitted</span>
                <span className="font-semibold text-gray-800">{report.dateSubmitted || new Date(report.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          </div>

          {/* Section 3: Tasks Accomplished & Competencies */}
          <div className="mt-4 border border-gray-300 rounded-xl overflow-hidden text-xs">
            <div className="bg-slate-100 px-4 py-2 border-b border-gray-300 font-bold uppercase tracking-wider text-slate-800">
              III. Training Accomplishments & Applied Competencies
            </div>
            <div className="p-4 space-y-3">
              <div>
                <strong className="text-gray-700 block mb-1">Key Duties & Tasks Accomplished:</strong>
                <p className="bg-gray-50 p-2.5 rounded-lg border border-gray-200 text-gray-800 leading-relaxed whitespace-pre-line">
                  {report.tasksAccomplished || report.tasksObserved || 'Standard workplace tasks and departmental operations completed.'}
                </p>
              </div>

              {report.skillsApplied && (
                <div>
                  <strong className="text-blue-900 block mb-1">Technical Skills & Competencies Applied:</strong>
                  <p className="bg-blue-50/50 p-2.5 rounded-lg border border-blue-200 text-blue-950 leading-relaxed whitespace-pre-line">
                    {report.skillsApplied}
                  </p>
                </div>
              )}

              {report.challengesEncountered && (
                <div>
                  <strong className="text-amber-800 block mb-1">Challenges Encountered & Solutions:</strong>
                  <p className="bg-amber-50/50 p-2.5 rounded-lg border border-amber-200 text-amber-950 leading-relaxed whitespace-pre-line">
                    {report.challengesEncountered}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Section 4: Host Feedback Questionnaire Matrix */}
          <div className="mt-4 border border-gray-300 rounded-xl overflow-hidden">
            <div className="bg-slate-100 px-4 py-2 border-b border-gray-300 font-bold text-xs uppercase tracking-wider text-slate-800 flex items-center justify-between">
              <span>IV. Host Feedback & Training Environment Evaluation Matrix</span>
              <span className="text-xs font-black text-indigo-900">
                Composite Score: {avgScoreOutOf5} / 5.0 ({q.overallScore}%)
              </span>
            </div>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-gray-200 text-gray-600 text-left">
                  <th className="py-2 px-3 font-semibold">Evaluation Criteria / Focus Dimension</th>
                  <th className="py-2 px-3 text-center w-28 font-semibold">Rating (1-5)</th>
                  <th className="py-2 px-3 font-semibold">Descriptor Assessment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                <tr>
                  <td className="py-2.5 px-3 font-medium">1. Work Environment & Workplace Safety Protocols</td>
                  <td className="py-2.5 px-3 text-center font-bold text-indigo-900">{q.attendanceScore} / 5 ★</td>
                  <td className="py-2.5 px-3 text-gray-600">{getScoreDescriptor(q.attendanceScore)}</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-medium">2. Mentorship, Supervision & Technical Guidance</td>
                  <td className="py-2.5 px-3 text-center font-bold text-indigo-900">{q.performanceScore} / 5 ★</td>
                  <td className="py-2.5 px-3 text-gray-600">{getScoreDescriptor(q.performanceScore)}</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-medium">3. Learning Opportunities & Practical Skill Acquisition</td>
                  <td className="py-2.5 px-3 text-center font-bold text-indigo-900">{q.attitudeScore} / 5 ★</td>
                  <td className="py-2.5 px-3 text-gray-600">{getScoreDescriptor(q.attitudeScore)}</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-medium">4. Workplace Culture, Ethics & Team Professionalism</td>
                  <td className="py-2.5 px-3 text-center font-bold text-indigo-900">{q.communicationScore} / 5 ★</td>
                  <td className="py-2.5 px-3 text-gray-600">{getScoreDescriptor(q.communicationScore)}</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-medium">5. Resources, Facilities & Equipment Support Provided</td>
                  <td className="py-2.5 px-3 text-center font-bold text-indigo-900">{q.teamworkScore} / 5 ★</td>
                  <td className="py-2.5 px-3 text-gray-600">{getScoreDescriptor(q.teamworkScore)}</td>
                </tr>
              </tbody>
            </table>

            {/* Qualitative Feedback */}
            <div className="p-4 bg-slate-50 border-t border-gray-200 text-xs space-y-3">
              {q.strengths && (
                <div>
                  <strong className="text-emerald-900 block mb-1">Key Strengths of Host Training Establishment (HTE):</strong>
                  <p className="bg-white p-2.5 rounded-lg border border-gray-200 text-gray-800 leading-relaxed whitespace-pre-line">
                    {q.strengths}
                  </p>
                </div>
              )}
              {q.areasForImprovement && (
                <div>
                  <strong className="text-amber-900 block mb-1">Identified Areas for Improvement / Suggestions:</strong>
                  <p className="bg-white p-2.5 rounded-lg border border-gray-200 text-gray-800 leading-relaxed whitespace-pre-line">
                    {q.areasForImprovement}
                  </p>
                </div>
              )}
              <div className="flex items-center justify-between pt-1">
                <span className="text-gray-600 font-medium">Recommendation for Future Student Interns:</span>
                <span className="font-bold text-emerald-800 px-3 py-1 bg-emerald-100 rounded-lg border border-emerald-300">
                  {q.recommendation || 'Highly Recommended'}
                </span>
              </div>
            </div>
          </div>

          {/* Section 5: Instructor Review & Remarks */}
          <div className="mt-4 border border-gray-300 rounded-xl overflow-hidden text-xs">
            <div className="bg-slate-100 px-4 py-2 border-b border-gray-300 font-bold uppercase tracking-wider text-slate-800">
              V. OJT Instructor Review, Endorsement & Guidance
            </div>
            <div className="p-4">
              <strong className="text-indigo-900 block mb-1">Instructor Assessment & Remarks:</strong>
              <p className="bg-indigo-50/50 p-3 rounded-lg border border-indigo-200 text-indigo-950 leading-relaxed whitespace-pre-line">
                {report.instructorRemarks || 'Milestone report received and validated. Trainee is demonstrating consistent progress toward OJT objectives.'}
              </p>
              {report.reviewedByInstructorAt && (
                <p className="text-[10px] text-gray-500 mt-2">
                  Reviewed on: {new Date(report.reviewedByInstructorAt).toLocaleString()}
                </p>
              )}
            </div>
          </div>

          {/* Section 6: Signatures & Certification */}
          <div className="mt-8 pt-4 border-t-2 border-gray-200">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center text-xs">
              <div>
                <div className="h-14 flex items-end justify-center pb-1 font-serif italic text-blue-900">
                  {report.instructorName || 'Prof. Ma. Cristina Ramos, MIT'}
                </div>
                <div className="border-t border-gray-800 pt-1.5">
                  <p className="font-bold text-gray-900 uppercase">{report.instructorName || 'Prof. Ma. Cristina Ramos, MIT'}</p>
                  <p className="text-[11px] text-gray-500">OJT Coordinator / Instructor</p>
                  <p className="text-[10px] text-gray-400">Date: {report.dateSubmitted || new Date().toLocaleDateString()}</p>
                </div>
              </div>

              <div>
                <div className="h-14 flex items-end justify-center pb-1 font-serif italic text-gray-800">
                  {report.supervisorName || 'Engr. Roberto M. Tan'}
                </div>
                <div className="border-t border-gray-800 pt-1.5">
                  <p className="font-bold text-gray-900 uppercase">{report.supervisorName || 'Engr. Roberto M. Tan'}</p>
                  <p className="text-[11px] text-gray-500">HTE Mentor / Industry Supervisor</p>
                  <p className="text-[10px] text-gray-400">Host Training Establishment</p>
                </div>
              </div>

              <div>
                <div className="h-14 flex items-end justify-center pb-1 font-serif italic text-emerald-800">
                  {report.traineeName}
                </div>
                <div className="border-t border-gray-800 pt-1.5">
                  <p className="font-bold text-gray-900 uppercase">{report.traineeName}</p>
                  <p className="text-[11px] text-gray-500">Student Intern / Trainee</p>
                  <p className="text-[10px] text-gray-400">Date Submitted: {report.dateSubmitted || new Date().toLocaleDateString()}</p>
                </div>
              </div>
            </div>

            <div className="mt-6 text-center text-[10px] text-gray-400 border-t border-gray-150 pt-2">
              Carlos Hilado Memorial State University • Certified Official OJT Document • Valid Without Alteration
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
