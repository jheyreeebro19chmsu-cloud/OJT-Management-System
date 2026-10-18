import React from 'react';
import { Printer, X, CheckSquare, Square } from 'lucide-react';
import { MonitoringReport } from '../types';

interface MonitoringReportPrintViewProps {
  report: MonitoringReport;
  onClose: () => void;
}

export function MonitoringReportPrintView({ report, onClose }: MonitoringReportPrintViewProps) {
  const handlePrint = () => {
    window.print();
  };

  const q = report.questionnaire || {};

  const getPeriodTitle = (type: string) => {
    switch (type) {
      case 'weekly':
        return 'WEEKLY OJT MONITORING & EVALUATION REPORT';
      case 'monthly':
        return 'MONTHLY OJT MONITORING & EVALUATION REPORT';
      case 'midterm':
        return 'MID-TERM OJT MONITORING & EVALUATION REPORT (300 HOURS)';
      case 'endterm':
        return 'END-TERM OJT MONITORING & EVALUATION REPORT (600 HOURS)';
      default:
        return 'ON-THE-JOB TRAINING EVALUATION FORM / MONITORING REPORT';
    }
  };

  const periodTitle = getPeriodTitle(report.reportType || 'weekly');

  const employabilityStatus = q.employabilityStatus || 'OJT Trainee';
  const allowanceSalary = q.allowanceSalary || 'None / Stipend';
  const telephoneNo = q.telephoneNo || report.supervisorContact || 'N/A';
  const departmentAssigned = q.department || report.department || 'COLLEGE OF COMPUTER STUDIES';
  const positionAssigned = q.position || 'ON - THE - JOB TRAINEE';
  const otherDept = q.otherDeptAssigned || 'None';

  const questionsList = [
    {
      num: 1,
      prompt: '1. Describe your duties briefly:',
      answer: q.q1_dutiesBriefly || report.tasksAccomplished || 'No response recorded',
    },
    {
      num: 2,
      prompt: '2. What do you consider your strongest area of performance?',
      answer: q.q2_strongestPerformanceArea || q.strengths || 'No response recorded',
    },
    {
      num: 3,
      prompt: '3. In what areas do you feel you have improved the most?',
      answer: q.q3_areasImprovedMost || report.skillsApplied || 'No response recorded',
    },
    {
      num: 4,
      prompt: '4. In what areas do you feel need the most improvement?',
      answer: q.q4_areasNeedImprovement || q.areasForImprovement || 'No response recorded',
    },
    {
      num: 5,
      prompt: '5. What situation challenged you the most?',
      answer: q.q5_situationChallengedMost || report.challengesEncountered || 'No response recorded',
    },
    {
      num: 6,
      prompt: '6. How did you overcome this challenge or situation?',
      answer: q.q6_howOvercameChallenge || 'No response recorded',
    },
    {
      num: 7,
      prompt: '7. What did you learn from your overall training experience?',
      answer: q.q7_whatLearnedFromExperience || 'No response recorded',
    },
    {
      num: 8,
      prompt: '8. Is this training establishment well-qualified for student OJT placement?',
      answer: q.q8_isQualifiedLinkage || (q.recommendation ? `Yes, ${q.recommendation}` : 'No response recorded'),
    },
    {
      num: 9,
      prompt: '9. Other comments, suggestions, and recommendations:',
      answer: q.q9_ojtSuggestionsRecommendations || 'No response recorded',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl border border-gray-200 w-full max-w-4xl max-h-[95vh] flex flex-col overflow-hidden">
        {/* Top Modal Navigation Bar (Hidden when printing) */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-slate-50 no-print shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <h3 className="text-xs sm:text-sm font-bold text-gray-800">
              CHMSU OJT Monitoring Report Preview — <span className="font-mono text-blue-900">{report.reportNumber}</span>
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-[#146B4D] to-[#152B4D] hover:opacity-95 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-900/20 transition-all cursor-pointer"
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

        {/* Printable Document Container (Matches CHMSU Official Form) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-white text-gray-900 print:p-0 print:overflow-visible font-sans text-xs">
          {/* INSTITUTIONAL HEADER */}
          <div className="text-center relative pb-3 border-b-2 border-[#146B4D]">
            <div className="flex items-center justify-between px-2 sm:px-6 mb-1">
              <img
                src="/chmsu-logo.png"
                alt="CHMSU Logo"
                className="w-14 h-14 object-contain"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
              <div className="text-center flex-1 px-2">
                <h1 className="text-sm sm:text-base font-black text-[#152B4D] tracking-wide uppercase">
                  Carlos Hilado Memorial State University
                </h1>
                <p className="text-[10px] text-gray-600 font-medium tracking-tight">
                  Alijis Campus • Binalbagan Campus • Fortune Towne Campus • Talisay (Main) Campus
                </p>
                <p className="text-[9px] text-[#146B4D] italic font-semibold">
                  A leading GREEN institution of higher learning in the global community by 2030
                </p>
                <h2 className="text-xs font-black text-[#152B4D] uppercase mt-1">
                  College of Computer Studies
                </h2>
                <h3 className="text-xs sm:text-sm font-black text-[#146B4D] tracking-wider uppercase mt-0.5">
                  {periodTitle}
                </h3>
              </div>
              <div className="w-12 h-12 rounded-full border-2 border-[#146B4D] flex items-center justify-center text-[8px] font-black text-[#146B4D] text-center uppercase leading-tight p-1 shrink-0">
                GREEN CHMSU CCS
              </div>
            </div>
          </div>

          {/* SECTION 1: TRAINEE & COMPANY DETAILS BOX */}
          <div className="mt-4 border border-gray-300 rounded-xl p-3 sm:p-4 bg-white">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs">
              <div className="flex items-baseline">
                <span className="font-bold text-gray-700 w-36 shrink-0">Name of Trainee:</span>
                <span className="font-black text-gray-900 uppercase border-b border-dotted border-gray-400 flex-1 pb-0.5">
                  {report.traineeName}
                </span>
              </div>

              <div className="flex items-baseline">
                <span className="font-bold text-gray-700 w-36 shrink-0">Training Company:</span>
                <span className="font-bold text-gray-900 border-b border-dotted border-gray-400 flex-1 pb-0.5">
                  {report.hteCompanyName}
                </span>
              </div>

              <div className="flex items-baseline">
                <span className="font-bold text-gray-700 w-36 shrink-0">Company Address:</span>
                <span className="text-gray-800 border-b border-dotted border-gray-400 flex-1 pb-0.5 truncate">
                  {report.hteAddress || 'College of Computer Studies / Bacolod City'}
                </span>
              </div>

              <div className="flex items-baseline">
                <span className="font-bold text-gray-700 w-36 shrink-0">Inclusive Dates:</span>
                <span className="text-gray-800 border-b border-dotted border-gray-400 flex-1 pb-0.5 text-[11px]">
                  From: <strong>{q.trainingDateFrom || report.periodCovered || 'Start of OJT'}</strong> to: <strong>{q.trainingDateTo || 'End of OJT'}</strong>
                </span>
              </div>

              <div className="flex items-baseline">
                <span className="font-bold text-gray-700 w-36 shrink-0">Contact Person:</span>
                <span className="text-gray-800 border-b border-dotted border-gray-400 flex-1 pb-0.5">
                  {report.supervisorName || 'Jhey Ree C Ebro'}
                </span>
              </div>

              <div className="flex items-baseline">
                <span className="font-bold text-gray-700 w-36 shrink-0">Date of Evaluation:</span>
                <span className="text-gray-800 border-b border-dotted border-gray-400 flex-1 pb-0.5 font-mono">
                  {report.dateSubmitted || new Date(report.createdAt).toLocaleDateString()}
                </span>
              </div>

              <div className="flex items-baseline">
                <span className="font-bold text-gray-700 w-36 shrink-0">Student ID / Course:</span>
                <span className="text-gray-800 border-b border-dotted border-gray-400 flex-1 pb-0.5">
                  {report.studentId || report.traineeId} — {report.course || 'BS Information Systems'}
                </span>
              </div>

              <div className="flex items-baseline">
                <span className="font-bold text-gray-700 w-36 shrink-0">Date of Last Eval:</span>
                <span className="text-gray-800 border-b border-dotted border-gray-400 flex-1 pb-0.5">
                  {q.dateOfLastEvaluation || 'N/A'}
                </span>
              </div>
            </div>
          </div>

          {/* SECTION 2: EMPLOYABILITY BOX */}
          <div className="mt-3 border border-gray-300 rounded-xl p-3 sm:p-4 bg-white">
            <h4 className="font-black text-gray-800 text-[11px] uppercase tracking-wider mb-2">
              EMPLOYABILITY:
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="grid grid-cols-3 gap-2">
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-800 cursor-default">
                    {employabilityStatus === 'OJT Trainee' ? (
                      <CheckSquare size={14} className="text-[#146B4D]" />
                    ) : (
                      <Square size={14} className="text-gray-400" />
                    )}
                    <span>OJT Trainee</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-800 cursor-default">
                    {employabilityStatus === 'Contractual' ? (
                      <CheckSquare size={14} className="text-[#146B4D]" />
                    ) : (
                      <Square size={14} className="text-gray-400" />
                    )}
                    <span>Contractual</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-800 cursor-default">
                    {employabilityStatus === 'Regular' ? (
                      <CheckSquare size={14} className="text-[#146B4D]" />
                    ) : (
                      <Square size={14} className="text-gray-400" />
                    )}
                    <span>Regular</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-800 cursor-default">
                    {employabilityStatus === 'Probationary' ? (
                      <CheckSquare size={14} className="text-[#146B4D]" />
                    ) : (
                      <Square size={14} className="text-gray-400" />
                    )}
                    <span>Probationary</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-800 cursor-default">
                    {employabilityStatus === 'Casual' ? (
                      <CheckSquare size={14} className="text-[#146B4D]" />
                    ) : (
                      <Square size={14} className="text-gray-400" />
                    )}
                    <span>Casual</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-800 cursor-default">
                    {employabilityStatus === 'Applicant' ? (
                      <CheckSquare size={14} className="text-[#146B4D]" />
                    ) : (
                      <Square size={14} className="text-gray-400" />
                    )}
                    <span>Applicant</span>
                  </label>
                </div>
                <div className="flex items-baseline pt-1">
                  <span className="text-[11px] text-gray-600 mr-2">If employed, company name:</span>
                  <span className="border-b border-dotted border-gray-400 flex-1 text-gray-800 pb-0.5">
                    {q.employedCompanyName || '—'}
                  </span>
                </div>
              </div>

              <div className="space-y-2 sm:pl-4 sm:border-l border-gray-200">
                <div className="flex items-baseline">
                  <span className="font-bold text-gray-700 w-28 shrink-0">Allowance/Salary:</span>
                  <span className="text-gray-800 border-b border-dotted border-gray-400 flex-1 pb-0.5">
                    Php {allowanceSalary}
                  </span>
                </div>
                <div className="flex items-baseline">
                  <span className="font-bold text-gray-700 w-28 shrink-0">Telephone No:</span>
                  <span className="text-gray-800 border-b border-dotted border-gray-400 flex-1 pb-0.5">
                    {telephoneNo}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 3: ASSIGNMENT BOX */}
          <div className="mt-3 border border-gray-300 rounded-xl p-3 sm:p-4 bg-white">
            <h4 className="font-black text-gray-800 text-[11px] uppercase tracking-wider mb-2">
              ASSIGNMENT
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="flex items-baseline">
                <span className="font-bold text-gray-700 mr-2 shrink-0">DEPARTMENT:</span>
                <span className="font-bold text-gray-900 border-b border-dotted border-gray-400 flex-1 pb-0.5 truncate uppercase">
                  {departmentAssigned}
                </span>
              </div>
              <div className="flex items-baseline">
                <span className="font-bold text-gray-700 mr-2 shrink-0">POSITION:</span>
                <span className="font-bold text-gray-900 border-b border-dotted border-gray-400 flex-1 pb-0.5 truncate uppercase">
                  {positionAssigned}
                </span>
              </div>
              <div className="flex items-baseline">
                <span className="font-bold text-gray-700 mr-2 shrink-0">OTHER DEPT:</span>
                <span className="text-gray-800 border-b border-dotted border-gray-400 flex-1 pb-0.5 truncate">
                  {otherDept}
                </span>
              </div>
            </div>
          </div>

          {/* SECTION 4: QUESTIONNAIRE (STUDENT PRACTICUM FEEDBACK) TABLE */}
          <div className="mt-4 border border-gray-300 rounded-xl overflow-hidden bg-white">
            <div className="bg-[#146B4D] text-white px-4 py-2 font-black text-xs uppercase tracking-wider flex items-center justify-between">
              <span>| QUESTIONNAIRE (STUDENT PRACTICUM FEEDBACK)</span>
              <span className="text-[10px] font-normal tracking-normal text-emerald-100">
                Milestone: <strong className="uppercase">{report.reportType}</strong> ({report.hoursRenderedThisPeriod || 0}h)
              </span>
            </div>

            <table className="w-full text-xs border-collapse">
              <tbody className="divide-y divide-gray-200">
                {questionsList.map((item) => (
                  <tr key={item.num} className="hover:bg-slate-50/50">
                    <td className="w-2/5 p-3 sm:p-3.5 font-bold text-gray-800 align-top border-r border-gray-200 bg-slate-50/30">
                      {item.prompt}
                    </td>
                    <td className="w-3/5 p-3 sm:p-3.5 text-gray-800 align-top leading-relaxed whitespace-pre-line italic">
                      {item.answer}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* SECTION 5: INSTRUCTOR ENDORSEMENT & REMARKS */}
          {report.instructorRemarks && (
            <div className="mt-3 border border-emerald-300 bg-emerald-50/60 rounded-xl p-3 text-xs">
              <strong className="text-emerald-950 font-bold uppercase block mb-1">
                Official OJT Instructor Evaluation & Remarks:
              </strong>
              <p className="text-emerald-900 leading-relaxed italic">
                &ldquo;{report.instructorRemarks}&rdquo;
              </p>
              {report.reviewedByInstructorAt && (
                <p className="text-[10px] text-emerald-700 mt-1">
                  Reviewed on: {new Date(report.reviewedByInstructorAt).toLocaleString()}
                </p>
              )}
            </div>
          )}

          {/* SECTION 6: SIGNATURES BLOCK */}
          <div className="mt-8 pt-4 border-t-2 border-gray-300">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 text-center text-xs">
              <div>
                <div className="h-10 flex items-end justify-center pb-1 font-serif italic text-gray-900 font-bold text-sm">
                  {report.traineeName}
                </div>
                <div className="border-t border-gray-900 pt-1">
                  <p className="font-black text-gray-900 uppercase">{report.traineeName}</p>
                  <p className="text-[10px] text-gray-600 font-bold uppercase tracking-wider">
                    OJT TRAINEE'S SIGNATURE OVER PRINTED NAME
                  </p>
                  <p className="text-[10px] text-gray-500">
                    Date: {report.dateSubmitted || new Date().toLocaleDateString()}
                  </p>
                </div>
              </div>

              <div>
                <div className="h-10 flex items-end justify-center pb-1 font-serif italic text-gray-900 font-bold text-sm">
                  {report.supervisorName || 'JHEY REE C EBRO'}
                </div>
                <div className="border-t border-gray-900 pt-1">
                  <p className="font-black text-gray-900 uppercase">
                    {report.supervisorName || 'JHEY REE C EBRO'}
                  </p>
                  <p className="text-[10px] text-gray-600 font-bold uppercase tracking-wider">
                    IMMEDIATE SUPERVISOR / HTE REPRESENTATIVE
                  </p>
                  <p className="text-[10px] text-gray-500">
                    Date: {report.dateSubmitted || new Date().toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>

            {/* INSTITUTIONAL FOOTER */}
            <div className="mt-6 text-center text-[9px] text-gray-500 border-t border-gray-200 pt-3 space-y-0.5">
              <p className="font-mono text-gray-600">
                college.computerstudies@chmsu.edu.ph • (034) 434-8148 • chmsu.edu.ph
              </p>
              <p className="font-black text-[#146B4D] uppercase tracking-widest text-[10px]">
                GREEN CHMSU EXCELSIOR!
              </p>
              <p className="text-[8px] text-gray-400 tracking-tight">
                Excellence • Compassion • Environmentalism • Love of Country • Social Responsibility • Integrity • Openness • Resilience
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
