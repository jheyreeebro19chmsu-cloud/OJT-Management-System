import { Star, Users, X, Save, ChevronRight, Award, Clock, Check, Edit2, Trash2, AlertCircle, Printer, FileText, Building, GraduationCap, Calendar, CheckCircle2, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import React, { useState, useMemo } from 'react';
import { toast } from 'sonner';

import { useApp } from '../../store/AppContext';
import { CHMSU_EVALUATION_CATEGORIES, Employee, Evaluation, EvaluationQuestionnaire } from '../../types';
import { CHMSUEvaluationSheet } from '../../components/CHMSUEvaluationSheet';

const GRADE_CONFIG: Record<Evaluation['grade'], { color: string; bg: string; border: string; min: number; label: string }> = {
  Excellent: { color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', min: 90, label: 'Excellent / Outstanding (90-100%)' },
  'Very Good': { color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200', min: 80, label: 'Very Good / Above Average (80-89%)' },
  Good: { color: 'text-sky-700', bg: 'bg-sky-50', border: 'border-sky-200', min: 70, label: 'Good / Average (70-79%)' },
  Satisfactory: { color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', min: 60, label: 'Satisfactory / Fair (60-69%)' },
  'Needs Improvement': { color: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200', min: 0, label: 'Needs Improvement / Poor (<60%)' },
};

function getGrade(score: number): Evaluation['grade'] {
  if (score >= 90) return 'Excellent';
  if (score >= 80) return 'Very Good';
  if (score >= 70) return 'Good';
  if (score >= 60) return 'Satisfactory';
  return 'Needs Improvement';
}

function getDefaultRatings(): Record<string, number> {
  const ratings: Record<string, number> = {};
  CHMSU_EVALUATION_CATEGORIES.forEach((cat) => {
    cat.items.forEach((item) => {
      ratings[item.id] = 4;
    });
  });
  return ratings;
}

export function AdminEvaluations() {
  const {
    employees,
    timeRecords,
    evaluations,
    addEvaluation,
    updateEvaluation,
    deleteEvaluation,
    getEmployeeRequiredDocuments,
    getEmployeeRequirementSummary,
    settings,
    currentUser,
  } = useApp();
  const [selectedAcademicYear, setSelectedAcademicYear] = useState<string>(settings?.activeAcademicYear || 'all');
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
  const [ratings, setRatings] = useState<Record<string, number>>(getDefaultRatings);
  const [ratingComments, setRatingComments] = useState<Record<string, string>>({
    workHabits: '',
    workSkills: '',
    socialSkills: '',
  });
  const [commentsSuggestions, setCommentsSuggestions] = useState<string>('');
  const [questionnaire, setQuestionnaire] = useState<EvaluationQuestionnaire>({});
  const [formStatus, setFormStatus] = useState<Evaluation['status']>('draft');
  const [editEvalId, setEditEvalId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'form' | 'view'>('list');

  const instructorName = useMemo(() => {
    if (selectedEmp?.instructorId) {
      const linked = employees.find((e) => e.id === selectedEmp.instructorId || e.employeeId === selectedEmp.instructorId);
      if (linked?.name) return linked.name;
    }
    if (currentUser?.name && (currentUser.role === 'admin' || (currentUser as any).position === 'OJT Instructor')) {
      return currentUser.name;
    }
    const anyInst = employees.find((e) => e.position === 'OJT Instructor' || (e.position && e.position.toLowerCase().includes('instructor')));
    if (anyInst?.name) return anyInst.name;
    return 'OJT INSTRUCTOR';
  }, [selectedEmp, employees, currentUser]);

  const activeEmployees = useMemo(() => {
    return employees.filter((e) => {
      if (!e.active) return false;
      const normalized = (e.position || '').toLowerCase();
      if (normalized.includes('instructor') || normalized.includes('hte') || normalized.includes('host training')) return false;
      if (selectedAcademicYear === 'all') return true;
      if (!e.academicYear) return true;
      return e.academicYear === selectedAcademicYear;
    });
  }, [employees, selectedAcademicYear]);

  const categoryStats = useMemo(() => {
    const stats: Record<string, number> = { workHabits: 4, workSkills: 4, socialSkills: 4 };
    CHMSU_EVALUATION_CATEGORIES.forEach((cat) => {
      const valid = cat.items
        .map((item) => ratings[item.id] ?? 4)
        .filter((score) => score > 0);
      const avg = valid.length > 0 ? valid.reduce((a, b) => a + b, 0) / valid.length : 4;
      stats[cat.id] = Number(avg.toFixed(2));
    });
    return stats;
  }, [ratings]);

  const overallRating = useMemo(() => {
    const allItems = CHMSU_EVALUATION_CATEGORIES.flatMap((c) => c.items);
    const valid = allItems
      .map((item) => ratings[item.id] ?? 4)
      .filter((score) => score > 0);
    const avg = valid.length > 0 ? valid.reduce((a, b) => a + b, 0) / valid.length : 4;
    return Number(avg.toFixed(2));
  }, [ratings]);

  const grade = useMemo<Evaluation['grade']>(() => {
    if (overallRating >= 4.5) return 'Excellent';
    if (overallRating >= 3.5) return 'Very Good';
    if (overallRating >= 2.5) return 'Good';
    if (overallRating >= 1.5) return 'Satisfactory';
    return 'Needs Improvement';
  }, [overallRating]);

  const openNewEval = (emp: Employee) => {
    const existing = evaluations.find((e) => e.employeeId === emp.id);
    setSelectedEmp(emp);
    if (existing) {
      setViewMode('view');
      return;
    } else {
      const recs = timeRecords.filter((r) => r.employeeId === emp.id);
      const lateCount = recs.filter((r) => r.status === 'late').length;
      const initialRatings = getDefaultRatings();
      if (recs.length > 0 && lateCount === 0) {
        initialRatings['wh_1'] = 5;
        initialRatings['wh_2'] = 5;
      } else if (lateCount > 2) {
        initialRatings['wh_1'] = 3;
      }
      setEditEvalId(null);
      setRatings(initialRatings);
      setRatingComments({ workHabits: '', workSkills: '', socialSkills: '' });
      setCommentsSuggestions('');
      setQuestionnaire({
        companyAddress: emp.department || '',
        contactPerson: emp.supervisorName || 'OJT Supervisor',
        trainingDateFrom: '',
        trainingDateTo: '',
        dateOfEvaluation: new Date().toISOString().split('T')[0],
        dateOfLastEvaluation: '',
        employabilityStatus: 'OJT Trainee',
        employedCompanyName: '',
        allowanceSalary: '',
        telephoneNo: emp.phone || '',
        department: emp.department || 'IT Department',
        position: 'ON - THE - JOB TRAINEE',
        otherDeptAssigned: 'None',
      });
      setFormStatus('draft');
    }
    setViewMode('form');
  };

  const viewEval = (emp: Employee) => {
    const existing = evaluations.find((e) => e.employeeId === emp.id);
    setSelectedEmp(emp);
    if (existing) {
      setRatings(existing.ratings || getDefaultRatings());
      setRatingComments(
        existing.ratingComments || {
          workHabits: existing.strengths || '',
          workSkills: '',
          socialSkills: existing.areasForImprovement || '',
        }
      );
      setCommentsSuggestions(existing.commentsSuggestions || existing.recommendations || '');
      setQuestionnaire(existing.questionnaire || {});
    }
    setViewMode('view');
  };

  const handleSave = (status: Evaluation['status']) => {
    if (!selectedEmp) return;
    if (status === 'final') {
      const summary = getEmployeeRequirementSummary(selectedEmp.id);
      if (summary.missing > 0 || summary.incomplete > 0) {
        toast.error(`Upload all required documents before finalizing. ${summary.missing} missing, ${summary.incomplete} incomplete.`);
        return;
      }
    }

    const overallPercent = Math.round((overallRating / 5) * 100);
    const attendanceScore = Math.round((categoryStats.workHabits / 5) * 100);
    const performanceScore = Math.round((categoryStats.workSkills / 5) * 100);
    const attitudeScore = Math.round((categoryStats.workHabits / 5) * 100);
    const punctualityScore = ratings['wh_1'] ? Math.round((ratings['wh_1'] / 5) * 100) : attendanceScore;
    const communicationScore = Math.round((categoryStats.socialSkills / 5) * 100);

    const compiledStrengths =
      ratingComments.workSkills ||
      ratingComments.workHabits ||
      'Demonstrates strong technical competence and dedication.';

    const compiledImprovement =
      ratingComments.socialSkills ||
      'Continue broadening industry capabilities and professional communication.';

    const data: Omit<Evaluation, 'id'> = {
      employeeId: selectedEmp.id,
      evaluatedBy: instructorName,
      evaluatorName: instructorName,
      evaluatorPosition: 'CHMSU OJT Instructor',
      date: new Date().toISOString().split('T')[0],
      ratings,
      categoryScores: {
        workHabits: categoryStats.workHabits,
        workSkills: categoryStats.workSkills,
        socialSkills: categoryStats.socialSkills,
      },
      ratingComments,
      overallRating,
      commentsSuggestions,
      questionnaire,
      totalScore: overallPercent,
      attendanceScore,
      performanceScore,
      attitudeScore,
      punctualityScore,
      communicationScore,
      overallScore: overallPercent,
      grade,
      strengths: compiledStrengths,
      areasForImprovement: compiledImprovement,
      recommendations:
        commentsSuggestions ||
        (overallRating >= 3.5 ? 'Endorsed for completion of OJT program.' : 'Requires performance improvement.'),
      evaluatedAt: new Date().toISOString(),
      status,
      academicYear: selectedEmp.academicYear || settings?.activeAcademicYear || '2026-2027',
    };

    if (editEvalId) {
      updateEvaluation(editEvalId, data);
      toast.success(`Evaluation ${status === 'final' ? 'finalized' : 'saved as draft'}!`);
    } else {
      addEvaluation(data);
      toast.success(`Evaluation ${status === 'final' ? 'finalized' : 'saved as draft'}!`);
    }
    setViewMode('list');
  };

  const handleDelete = (evalId: string) => {
    if (confirm('Delete this evaluation?')) {
      deleteEvaluation(evalId);
      toast.success('Evaluation deleted.');
    }
  };

  const handleMarkDoneViewed = (evalId: string) => {
    const existing = evaluations.find((e) => e.id === evalId);
    if (!existing) return;
    const updated: Partial<Evaluation> = {
      status: 'reviewed_by_instructor',
      instructorViewedAt: new Date().toISOString(),
      instructorViewedBy: instructorName,
    };
    updateEvaluation(evalId, updated);
    toast.success('✓ Evaluation marked as Done Viewed! Automatically synchronized to HTE and Trainee.');
  };

  const getEmpStats = (empId: string) => {
    const recs = timeRecords.filter((r) => r.employeeId === empId);
    const totalHours = recs.reduce((s, r) => s + (r.totalHours || 0), 0);
    const present = recs.filter((r) => r.status === 'present' || r.status === 'overtime').length;
    const late = recs.filter((r) => r.status === 'late').length;
    return { totalHours, present, late, totalDays: recs.length };
  };

  // ── Evaluation Form Screen (Create / Edit) ───────────────────────────
  if (viewMode === 'form' && selectedEmp) {
    return (
      <CHMSUEvaluationSheet
        trainee={selectedEmp}
        companyName={selectedEmp.companyName || 'Host Training Establishment'}
        supervisorName={selectedEmp.supervisorName || 'OJT Supervisor'}
        instructorName={instructorName}
        evaluationDate={editEvalId ? evaluations.find((e) => e.id === editEvalId)?.evaluatedAt : undefined}
        ratings={ratings}
        ratingComments={ratingComments}
        commentsSuggestions={commentsSuggestions}
        overallRating={overallRating}
        grade={grade}
        questionnaire={questionnaire}
        isReadOnly={false}
        status={formStatus}
        role="instructor"
        onRatingChange={(id, score) => setRatings((prev) => ({ ...prev, [id]: score }))}
        onRatingCommentChange={(catId, comment) =>
          setRatingComments((prev) => ({ ...prev, [catId]: comment }))
        }
        onCommentsSuggestionsChange={setCommentsSuggestions}
        onQuestionnaireChange={setQuestionnaire}
        onSaveDraft={() => handleSave('draft')}
        onSubmitFinal={() => handleSave('final')}
        onClose={() => setViewMode('list')}
      />
    );
  }

  // ── Evaluation Form Screen (View / Printable Sheet) ─────────────────
  if (viewMode === 'view' && selectedEmp) {
    const ev = evaluations.find((e) => e.employeeId === selectedEmp.id);
    if (!ev) return null;
    const viewRatings = ev.ratings || ratings;
    const viewComments = ev.ratingComments || ratingComments;
    const viewSuggestions = ev.commentsSuggestions || ev.recommendations || commentsSuggestions;
    const viewOverall = ev.overallRating || (ev.overallScore ? ev.overallScore / 20 : overallRating);
    const viewGrade = ev.grade || grade;
    const viewQuestionnaire = ev.questionnaire || questionnaire;

    return (
      <CHMSUEvaluationSheet
        trainee={selectedEmp}
        companyName={selectedEmp.companyName || 'Host Training Establishment'}
        supervisorName={ev.evaluatorName || ev.evaluatedBy || selectedEmp.supervisorName || 'OJT Supervisor'}
        instructorName={instructorName}
        evaluationDate={ev.evaluatedAt}
        ratings={viewRatings}
        ratingComments={viewComments}
        commentsSuggestions={viewSuggestions}
        overallRating={viewOverall}
        grade={viewGrade}
        questionnaire={viewQuestionnaire}
        isReadOnly={true}
        status={ev.status}
        role="instructor"
        onMarkDoneViewed={() => handleMarkDoneViewed(ev.id)}
        onClose={() => setViewMode('list')}
      />
    );
  }

  // ── List View (Trainees Roster) ──────────────────────────────────────────
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-800">OJT Trainee Performance Evaluations</h2>
          <p className="text-sm text-gray-500">Official evaluation management for OJT trainees and intern performance reports</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-1.5 shadow-sm">
            <span className="text-xs font-semibold text-gray-500">AY:</span>
            <select
              value={selectedAcademicYear}
              onChange={(e) => setSelectedAcademicYear(e.target.value)}
              className="text-xs font-bold text-blue-700 bg-transparent focus:outline-none cursor-pointer"
            >
              <option value="all">All Academic Years</option>
              {settings.academicYears.map((ay) => (
                <option key={ay} value={ay}>
                  A.Y. {ay} {ay === settings.activeAcademicYear ? '(Active)' : ''}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={() => {
              const csvRows = [
                ['Trainee Name', 'Employee ID', 'Company', 'Department', 'Overall Score', 'Grade', 'Evaluated At', 'Status'],
              ];
              activeEmployees.forEach((emp) => {
                const ev = evaluations.find((e) => e.employeeId === emp.id);
                csvRows.push([
                  emp.name,
                  emp.employeeId,
                  emp.companyName,
                  emp.department,
                  ev ? `${ev.overallScore}%` : 'N/A',
                  ev ? ev.grade : 'Not Evaluated',
                  ev ? ev.evaluatedAt : 'N/A',
                  ev ? ev.status : 'Pending',
                ]);
              });
              const csvContent = csvRows.map((e) => e.join(',')).join('\n');
              const url = URL.createObjectURL(new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' }));
              const link = document.createElement('a');
              link.href = url;
              link.download = `OJT_Evaluations_Summary_${new Date().toISOString().split('T')[0]}.csv`;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              URL.revokeObjectURL(url);
              toast.success('Evaluations summary CSV exported!');
            }}
            className="px-3.5 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-all flex items-center gap-1.5 shadow-sm shrink-0"
          >
            <Download size={14} />
            Export All CSV
          </button>
        </div>
      </div>

      <div className="bg-blue-50 rounded-2xl p-4 flex items-start gap-3 border border-blue-100 shadow-sm">
        <AlertCircle size={18} className="text-blue-600 shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800">
          <p className="font-bold mb-0.5">End-of-OJT Performance Evaluation</p>
          <p className="text-xs text-blue-600 leading-relaxed">
            Conduct formal performance evaluations for each trainee upon completion of required OJT hours.
            Finalized evaluation reports generate official university grade sheets printable for student records.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {activeEmployees.map((emp) => {
          const ev = evaluations.find((e) => e.employeeId === emp.id);
          const stats = getEmpStats(emp.id);
          const progress = Math.min((stats.totalHours / emp.requiredHours) * 100, 100);
          const gc = ev ? GRADE_CONFIG[ev.grade] : null;

          return (
            <motion.div
              key={emp.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 hover:border-blue-200 transition-all"
            >
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center shrink-0 overflow-hidden border border-slate-200 shadow-inner">
                  {emp.photo ? (
                    <img
                      src={emp.photo}
                      alt=""
                      className="w-full h-full object-cover"
                      style={{ transform: 'scaleX(-1)' }}
                    />
                  ) : (
                    <span className="text-blue-700 font-bold text-xl">{emp.name.charAt(0)}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-bold text-slate-800 text-base">{emp.name}</p>
                      <p className="text-xs text-slate-500 font-medium">{emp.course} • {emp.schoolName}</p>
                      <p className="text-xs text-blue-600 font-semibold mt-0.5">{emp.companyName || 'Host Training Establishment'}</p>
                    </div>
                    {ev && gc && (
                      <div className="text-right">
                        <span className={`inline-block text-xs font-extrabold px-3 py-1 rounded-full border ${gc.bg} ${gc.color} ${gc.border}`}>
                          {ev.grade} ({ev.overallScore}%)
                        </span>
                        <p className="text-[10px] uppercase font-bold mt-1">
                          {ev.status === 'reviewed_by_instructor' ? (
                            <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                              <CheckCircle2 size={10} /> Done Viewed
                            </span>
                          ) : ev.status === 'final' || ev.status === 'submitted_to_instructor' ? (
                            <span className="text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                              <Clock size={10} /> Passed by HTE
                            </span>
                          ) : (
                            <span className="text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                              Draft
                            </span>
                          )}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    <div className="bg-slate-50 rounded-xl p-2 border border-slate-100 text-center">
                      <p className="font-bold text-slate-800">{stats.totalHours.toFixed(0)} / {emp.requiredHours}h</p>
                      <p className="text-slate-400 text-[10px]">Rendered Hours</p>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-2 border border-slate-100 text-center">
                      <p className="font-bold text-emerald-700">{stats.present} Days</p>
                      <p className="text-slate-400 text-[10px]">Present</p>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-2 border border-slate-100 text-center">
                      <p className="font-bold text-amber-700">{stats.late} Days</p>
                      <p className="text-slate-400 text-[10px]">Late</p>
                    </div>
                  </div>

                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-slate-500 mb-1 font-medium">
                      <span>OJT Required Hours Progress</span>
                      <span className="font-bold text-slate-700">{Math.round(progress)}%</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                      <div className="h-full bg-blue-600 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex gap-2">
                {ev ? (
                  <>
                    <button
                      onClick={() => viewEval(emp)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
                    >
                      <FileText size={14} />
                      View Form
                    </button>
                    <button
                      onClick={() => {
                        setSelectedEmp(emp);
                        setViewMode('view');
                        setTimeout(() => window.print(), 250);
                      }}
                      className="px-3 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 shadow-xs"
                      title="Print Official Hard Copy"
                    >
                      <Printer size={13} />
                      <span>Print</span>
                    </button>
                    {ev.status !== 'reviewed_by_instructor' && (
                      <button
                        onClick={() => handleMarkDoneViewed(ev.id)}
                        className="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 shadow-sm shadow-emerald-600/20"
                        title="Mark as Done Viewed to sync with HTE and Trainee"
                      >
                        <CheckCircle2 size={13} />
                        Done Viewed
                      </button>
                    )}
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs font-bold">
                    <Clock size={14} />
                    Awaiting HTE Evaluation
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function UserCircleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}
