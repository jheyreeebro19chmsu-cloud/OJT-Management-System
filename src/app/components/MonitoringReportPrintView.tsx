import React from 'react';
import { Printer, X, Download, CheckCircle2, Award, Building, User, Calendar, MapPin, Phone, ShieldCheck } from 'lucide-react';
import { MonitoringReport } from '../types';

interface MonitoringReportPrintViewProps {
  report: MonitoringReport;
  onClose: () => void;
}

export function MonitoringReportPrintView({ report, onClose }: MonitoringReportPrintViewProps) {
  const handlePrint = () => {
    window.print();
  };

  const getVisitTypeLabel = (type: string) => {
    switch (type) {
      case 'on_site':
        return 'On-Site Workplace Visitation';
      case 'virtual':
        return 'Virtual Monitoring / Video Conference';
      case 'phone':
        return 'Phone / Remote Coordination';
      case 'midterm':
        return 'Midterm Progress Review';
      case 'final':
        return 'Final Exit & Completion Verification';
      case 'spot_check':
        return 'Unannounced Spot Inspection';
      default:
        return 'Workplace Monitoring';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'commendable':
        return { label: 'Commendable Performance', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
      case 'satisfactory':
        return { label: 'Satisfactory Progress', color: 'bg-blue-100 text-blue-800 border-blue-300' };
      case 'needs_guidance':
        return { label: 'Needs Guidance & Follow-up', color: 'bg-amber-100 text-amber-800 border-amber-300' };
      case 'critical':
        return { label: 'Critical / At-Risk', color: 'bg-rose-100 text-rose-800 border-rose-300' };
      default:
        return { label: 'Completed', color: 'bg-gray-100 text-gray-800 border-gray-300' };
    }
  };

  const statusInfo = getStatusBadge(report.overallStatus);
  const avgRating = (
    (report.ratings.workQuality +
      report.ratings.punctuality +
      report.ratings.professionalism +
      report.ratings.technicalCompetence +
      report.ratings.policyAdherence) /
    5
  ).toFixed(1);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl border border-gray-200 w-full max-w-4xl max-h-[94vh] flex flex-col overflow-hidden">
        {/* Top Modal Bar (Excluded from Print) */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-gray-100 bg-slate-50 no-print shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <h3 className="text-sm font-bold text-gray-800">
              Official OJT Monitoring Report — {report.reportNumber}
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

            <div className="mt-3 inline-block bg-slate-900 text-white px-5 py-1 rounded-md text-xs font-extrabold uppercase tracking-widest">
              OFFICIAL OJT MONITORING AND VISITATION REPORT
            </div>

            <div className="mt-2 flex items-center justify-between text-[11px] text-gray-500 px-2">
              <span>Report Ref: <strong className="text-gray-900 font-mono">{report.reportNumber}</strong></span>
              <span>A.Y. <strong className="text-gray-900">{report.academicYear || '2026-2027'}</strong></span>
              <span>Date Generated: <strong className="text-gray-900">{new Date(report.createdAt).toLocaleDateString()}</strong></span>
            </div>
          </div>

          {/* Section 1: Trainee & HTE Profile */}
          <div className="mt-6 border border-gray-300 rounded-xl overflow-hidden">
            <div className="bg-slate-100 px-4 py-2 border-b border-gray-300 font-bold text-xs uppercase tracking-wider text-slate-800 flex items-center justify-between">
              <span>I. Trainee & Host Training Establishment Information</span>
              <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${statusInfo.color}`}>
                {statusInfo.label}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 text-xs divide-y md:divide-y-0 md:divide-x divide-gray-200">
              <div className="p-3.5 space-y-1.5">
                <p><strong className="text-gray-600">Student Name:</strong> <span className="font-bold text-gray-900">{report.traineeName}</span></p>
                <p><strong className="text-gray-600">Student ID / No.:</strong> <span className="font-mono font-bold text-blue-900">{report.studentId || report.traineeId}</span></p>
                <p><strong className="text-gray-600">Degree Program / Course:</strong> <span className="font-semibold text-gray-800">{report.course || 'BS Information Technology'}</span></p>
                <p><strong className="text-gray-600">College / Department:</strong> <span>{report.department || 'College of Computer Studies'}</span></p>
                <div className="pt-2 border-t border-gray-150 flex items-center justify-between text-[11px]">
                  <span>Required: <strong>{report.requiredHours || 600}h</strong></span>
                  <span>Rendered: <strong className="text-emerald-700">{report.renderedHours || 0}h</strong></span>
                  <span>Balance: <strong className="text-amber-700">{report.remainingHours ?? Math.max(0, (report.requiredHours || 600) - (report.renderedHours || 0))}h</strong></span>
                </div>
              </div>

              <div className="p-3.5 space-y-1.5">
                <p><strong className="text-gray-600">Host Establishment (HTE):</strong> <span className="font-bold text-gray-900">{report.hteCompanyName}</span></p>
                <p><strong className="text-gray-600">Company Station / Address:</strong> <span>{report.hteAddress || 'Official Assigned Station'}</span></p>
                <p><strong className="text-gray-600">Immediate Supervisor:</strong> <span className="font-semibold">{report.supervisorName || 'Engr. Roberto M. Tan'}</span></p>
                <p><strong className="text-gray-600">Supervisor Designation:</strong> <span>{report.supervisorDesignation || 'OJT Mentor / Supervisor'}</span></p>
                <p><strong className="text-gray-600">Contact / Phone:</strong> <span>{report.supervisorContact || 'N/A'}</span></p>
              </div>
            </div>
          </div>

          {/* Section 2: Monitoring Visit Modality & Schedule */}
          <div className="mt-4 border border-gray-300 rounded-xl overflow-hidden">
            <div className="bg-slate-100 px-4 py-2 border-b border-gray-300 font-bold text-xs uppercase tracking-wider text-slate-800">
              II. Monitoring Visitation Specifics
            </div>
            <div className="p-3.5 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-[10px] text-gray-500 uppercase block font-semibold">Monitoring Date</span>
                <span className="font-bold text-gray-900">{report.visitDate}</span>
              </div>
              <div>
                <span className="text-[10px] text-gray-500 uppercase block font-semibold">Visit Time</span>
                <span className="font-bold text-gray-900">{report.visitTime || '10:00 AM'}</span>
              </div>
              <div>
                <span className="text-[10px] text-gray-500 uppercase block font-semibold">Visit Modality</span>
                <span className="font-bold text-indigo-900">{getVisitTypeLabel(report.visitType)}</span>
              </div>
              <div>
                <span className="text-[10px] text-gray-500 uppercase block font-semibold">Attendance Consistency</span>
                <span className="font-semibold text-emerald-800">{report.attendanceConsistency || 'Regular & Punctual'}</span>
              </div>
            </div>
          </div>

          {/* Section 3: Performance & Competency Assessment Matrix */}
          <div className="mt-4 border border-gray-300 rounded-xl overflow-hidden">
            <div className="bg-slate-100 px-4 py-2 border-b border-gray-300 font-bold text-xs uppercase tracking-wider text-slate-800 flex items-center justify-between">
              <span>III. Supervisory Performance Rating Matrix (Scale: 1 - 5)</span>
              <span className="text-xs font-black text-indigo-900">
                Average Composite: {avgRating} / 5.0
              </span>
            </div>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-gray-200 text-gray-600 text-left">
                  <th className="py-2 px-3 font-semibold">Criteria / Evaluation Indicator</th>
                  <th className="py-2 px-3 text-center w-24 font-semibold">Rating (1-5)</th>
                  <th className="py-2 px-3 font-semibold">Descriptor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                <tr>
                  <td className="py-2 px-3 font-medium">1. Quality & Timeliness of Assigned Deliverables / Outputs</td>
                  <td className="py-2 px-3 text-center font-bold text-indigo-900">{report.ratings.workQuality} / 5</td>
                  <td className="py-2 px-3 text-gray-600">{report.ratings.workQuality >= 4 ? 'Exceeds Standard Quality' : 'Satisfactory'}</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-medium">2. Punctuality, Attendance Record & Geofenced Check-in Regularity</td>
                  <td className="py-2 px-3 text-center font-bold text-indigo-900">{report.ratings.punctuality} / 5</td>
                  <td className="py-2 px-3 text-gray-600">{report.ratings.punctuality >= 4 ? 'Strict Adherence to Schedule' : 'Acceptable'}</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-medium">3. Professionalism, Work Ethic & Interpersonal Relationships</td>
                  <td className="py-2 px-3 text-center font-bold text-indigo-900">{report.ratings.professionalism} / 5</td>
                  <td className="py-2 px-3 text-gray-600">{report.ratings.professionalism >= 4 ? 'Excellent Demeanor' : 'Good Conduct'}</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-medium">4. Technical Competence & Application of Academic Knowledge</td>
                  <td className="py-2 px-3 text-center font-bold text-indigo-900">{report.ratings.technicalCompetence} / 5</td>
                  <td className="py-2 px-3 text-gray-600">{report.ratings.technicalCompetence >= 4 ? 'Strong Technical Skill' : 'Competent'}</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-medium">5. Compliance with HTE Office Policies & Safety Protocols</td>
                  <td className="py-2 px-3 text-center font-bold text-indigo-900">{report.ratings.policyAdherence} / 5</td>
                  <td className="py-2 px-3 text-gray-600">{report.ratings.policyAdherence >= 4 ? 'Fully Compliant' : 'Compliant'}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Section 4: Qualitative Observations & Corrective Actions */}
          <div className="mt-4 border border-gray-300 rounded-xl overflow-hidden text-xs">
            <div className="bg-slate-100 px-4 py-2 border-b border-gray-300 font-bold uppercase tracking-wider text-slate-800">
              IV. Observed Tasks, Highlights & Recommendations
            </div>
            <div className="p-4 space-y-3">
              <div>
                <strong className="text-gray-700 block mb-1">Key Duties & Specific Tasks Observed:</strong>
                <p className="bg-gray-50 p-2.5 rounded-lg border border-gray-200 text-gray-800 leading-relaxed">
                  {report.tasksObserved || 'Standard technical operations and departmental workflow.'}
                </p>
              </div>

              {report.highlights && (
                <div>
                  <strong className="text-emerald-800 block mb-1">Supervisor Commendations & Trainee Highlights:</strong>
                  <p className="bg-emerald-50/50 p-2.5 rounded-lg border border-emerald-200 text-emerald-950 leading-relaxed">
                    {report.highlights}
                  </p>
                </div>
              )}

              {report.issuesIdentified && (
                <div>
                  <strong className="text-amber-800 block mb-1">Issues, Challenges or Concerns Raised:</strong>
                  <p className="bg-amber-50/50 p-2.5 rounded-lg border border-amber-200 text-amber-950 leading-relaxed">
                    {report.issuesIdentified}
                  </p>
                </div>
              )}

              <div>
                <strong className="text-indigo-900 block mb-1">Instructor Recommendations & Action Steps:</strong>
                <p className="bg-indigo-50/50 p-2.5 rounded-lg border border-indigo-200 text-indigo-950 leading-relaxed">
                  {report.recommendations || 'Continue steady completion of required training hours and maintain high quality output.'}
                </p>
              </div>

              {report.actionTaken && (
                <div>
                  <strong className="text-gray-700 block mb-1">Action Taken / Resolution:</strong>
                  <p className="bg-gray-50 p-2.5 rounded-lg border border-gray-200 text-gray-800 leading-relaxed">
                    {report.actionTaken}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Section 5: Signatures & Certification */}
          <div className="mt-8 pt-4 border-t-2 border-gray-200">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center text-xs">
              <div>
                <div className="h-14 flex items-end justify-center pb-1 font-serif italic text-blue-900">
                  {report.instructorSignature || report.instructorName}
                </div>
                <div className="border-t border-gray-800 pt-1.5">
                  <p className="font-bold text-gray-900 uppercase">{report.instructorName}</p>
                  <p className="text-[11px] text-gray-500">OJT Instructor / Coordinator</p>
                  <p className="text-[10px] text-gray-400">Date: {report.visitDate}</p>
                </div>
              </div>

              <div>
                <div className="h-14 flex items-end justify-center pb-1 font-serif italic text-gray-800">
                  {report.supervisorName}
                </div>
                <div className="border-t border-gray-800 pt-1.5">
                  <p className="font-bold text-gray-900 uppercase">{report.supervisorName}</p>
                  <p className="text-[11px] text-gray-500">HTE Mentor / Industry Supervisor</p>
                  <p className="text-[10px] text-gray-400">Host Training Establishment</p>
                </div>
              </div>

              <div>
                <div className="h-14 flex items-end justify-center pb-1 font-serif italic text-emerald-800">
                  {report.isAcknowledgedByTrainee ? `Acknowledged: ${report.traineeName}` : '(Pending Trainee Signature)'}
                </div>
                <div className="border-t border-gray-800 pt-1.5">
                  <p className="font-bold text-gray-900 uppercase">{report.traineeName}</p>
                  <p className="text-[11px] text-gray-500">Student Intern / Trainee</p>
                  <p className="text-[10px] text-gray-400">
                    {report.traineeAcknowledgedAt
                      ? `Signed: ${new Date(report.traineeAcknowledgedAt).toLocaleDateString()}`
                      : 'Status: Pending Acknowledgment'}
                  </p>
                </div>
              </div>
            </div>

            {report.traineeFeedback && (
              <div className="mt-4 p-2.5 bg-gray-50 rounded-lg border border-gray-200 text-xs text-gray-700">
                <strong>Trainee Acknowledgment Note:</strong> &ldquo;{report.traineeFeedback}&rdquo;
              </div>
            )}

            <div className="mt-6 text-center text-[10px] text-gray-400 border-t border-gray-150 pt-2">
              Carlos Hilado Memorial State University • Certified Official OJT Document • Valid Without Alteration
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
