import React, { useState, useEffect } from 'react';
import {
  Printer,
  ShieldCheck,
  Eye,
  Check,
  Save,
  Clock,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';

import { useApp } from '../store/AppContext';
import { Evaluation, EvaluationQuestionnaire, isQuestionnaireAnswered } from '../types';
import { CHMSUEvaluationSheet } from '../components/CHMSUEvaluationSheet';

export function TraineeEvaluation() {
  const { getCurrentEmployee, evaluations, employees, settings, addEvaluation, updateEvaluation, refreshData } = useApp();
  const employee = getCurrentEmployee();

  const evaluation: Evaluation | undefined = evaluations.find(
    (e) => e.employeeId === employee?.id || (employee?.employeeId && e.employeeId === employee.employeeId)
  );

  const [traineeQuestionnaire, setTraineeQuestionnaire] = useState<EvaluationQuestionnaire>(() => {
    const evalQ = evaluation?.questionnaire;

    const baseDefaults: EvaluationQuestionnaire = {
      companyAddress: employee?.department || '',
      contactPerson: employee?.supervisorName || '',
      trainingDateFrom: '',
      trainingDateTo: '',
      dateOfEvaluation: new Date().toISOString().split('T')[0],
      dateOfLastEvaluation: '',
      employabilityStatus: 'OJT Trainee',
      employedCompanyName: '',
      allowanceSalary: '',
      telephoneNo: employee?.phone || '',
      department: employee?.department || 'IT Department',
      position: 'ON - THE - JOB TRAINEE',
      otherDeptAssigned: 'None',
      q1_dutiesBriefly: '',
      q2_strongestPerformanceArea: '',
      q3_areasImprovedMost: '',
      q4_areasNeedImprovement: '',
      q5_situationChallengedMost: '',
      q6_howOvercameChallenge: '',
      q7_whatLearnedFromExperience: '',
      q8_isQualifiedLinkage: '',
      q9_ojtSuggestionsRecommendations: '',
    };

    return { ...baseDefaults, ...(evalQ || {}) };
  });

  // Sync latest evaluations on mount
  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Sync when evaluation updates
  useEffect(() => {
    if (evaluation?.questionnaire) {
      setTraineeQuestionnaire((prev) => ({
        ...prev,
        ...evaluation.questionnaire,
      }));
    }
  }, [evaluation?.questionnaire]);

  const instructorName = React.useMemo(() => {
    if (employee?.instructorId) {
      const linked = employees.find(
        (e) => e.id === employee.instructorId || e.employeeId === employee.instructorId
      );
      if (linked?.name) return linked.name;
    }
    const anyInst = employees.find(
      (e) =>
        e.position === 'OJT Instructor' ||
        (e.position && e.position.toLowerCase().includes('instructor'))
    );
    if (anyInst?.name) return anyInst.name;
    return 'CHMSU OJT Instructor';
  }, [employee, employees]);

  const isLocked = Boolean(
    evaluation?.status === 'reviewed_by_instructor' ||
    evaluation?.status === 'submitted_to_instructor'
  );

  const hasAnswered = isQuestionnaireAnswered(traineeQuestionnaire);

  const handleSaveQuestionnaire = async (asSubmit: boolean) => {
    if (!employee) return;

    if (asSubmit && !hasAnswered) {
      toast.error('Please answer at least one questionnaire question before submitting to your Instructor.');
      return;
    }

    const newStatus: Evaluation['status'] = asSubmit
      ? 'submitted_by_trainee'
      : (evaluation?.status || 'draft');

    try {
      if (evaluation) {
        updateEvaluation(evaluation.id, {
          questionnaire: traineeQuestionnaire,
          status: newStatus,
        });
      } else {
        addEvaluation({
          employeeId: employee.id,
          evaluatedBy: 'Self (Trainee)',
          attendanceScore: 100,
          performanceScore: 100,
          attitudeScore: 100,
          punctualityScore: 100,
          communicationScore: 100,
          overallScore: 100,
          grade: 'Good',
          strengths: '',
          areasForImprovement: '',
          recommendations: '',
          evaluatedAt: new Date().toISOString(),
          questionnaire: traineeQuestionnaire,
          status: newStatus,
          academicYear: employee.academicYear || settings?.activeAcademicYear || '2026-2027',
        });
      }

      if (asSubmit) {
        toast.success('✓ Questionnaire submitted to Instructor! Your instructor will review and endorse to your HTE.');
      } else {
        toast.success('Draft questionnaire responses saved.');
      }
      await refreshData();
    } catch (err: any) {
      console.error('Save questionnaire error:', err);
      toast.error('Failed to save questionnaire. Please try again.');
    }
  };

  if (!employee) return null;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12 font-sans">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-gray-900">CHMSU OJT Trainee Questionnaire</h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
              CHMSU CCS Official
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
              Trainee Form
            </span>
            {isLocked ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                <Eye size={12} /> View-Only (Locked)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                <Sparkles size={12} /> Editable Form
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Answer the 9-question internship feedback questionnaire and training particulars to submit to your Instructor.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {!isLocked && (
            <>
              <button
                type="button"
                onClick={() => handleSaveQuestionnaire(false)}
                className="px-3 py-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Save size={14} />
                <span>Save Draft</span>
              </button>
              <button
                type="button"
                onClick={() => handleSaveQuestionnaire(true)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 shadow-sm shadow-emerald-600/30 cursor-pointer"
              >
                <Check size={14} />
                <span>Submit to Instructor</span>
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => window.print()}
            className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <Printer size={15} />
            <span>Print</span>
          </button>
        </div>
      </div>

      {/* Trainee Notice Banner & Current Workflow Status */}
      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-4 flex items-start gap-3 no-print shadow-xs">
        <div className="w-9 h-9 rounded-xl bg-emerald-700 text-white flex items-center justify-center shrink-0 shadow-sm">
          <ShieldCheck size={18} />
        </div>
        <div className="text-xs text-slate-700 leading-relaxed flex-1">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
            <p className="font-bold text-emerald-950 text-sm">CHMSU OJT Practicum Feedback Questionnaire</p>
            {evaluation?.status === 'reviewed_by_instructor' ? (
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                ✓ Evaluation Complete &amp; Approved by Instructor
              </span>
            ) : evaluation?.status === 'submitted_to_instructor' ? (
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-300">
                Ratings Done by HTE — In Review by Instructor
              </span>
            ) : evaluation?.status === 'passed_to_hte' ? (
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-100 text-sky-800 border border-sky-300">
                Passed to HTE — Awaiting Supervisor Ratings
              </span>
            ) : evaluation?.status === 'submitted_by_trainee' ? (
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                ✓ Submitted to Instructor — Pending Forwarding to HTE
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-300 flex items-center gap-1">
                <Clock size={11} /> Awaiting Your Questionnaire Answers
              </span>
            )}
          </div>
          {evaluation?.status === 'submitted_by_trainee'
            ? 'Your questionnaire has been submitted to your Instructor. You may update your answers if needed before the evaluation is passed to your HTE.'
            : isLocked
            ? 'This evaluation is completed and approved. Responses and official criteria ratings are preserved below for your records.'
            : 'Please answer the 9 questions below regarding your internship duties, learnings, and suggestions. Once completed, click "Submit to Instructor" so your coordinator can forward the evaluation to your HTE supervisor.'}
        </div>
      </div>

      {/* OJT Questionnaire Sheet */}
      <CHMSUEvaluationSheet
        trainee={employee}
        companyName={employee.companyName || 'Host Training Establishment'}
        supervisorName={
          evaluation?.evaluatorName ||
          evaluation?.evaluatedBy ||
          employee.supervisorName ||
          'HTE Supervisor'
        }
        instructorName={instructorName}
        evaluationDate={evaluation?.evaluatedAt || new Date().toISOString()}
        ratings={evaluation?.ratings || {}}
        ratingComments={evaluation?.ratingComments || {}}
        commentsSuggestions={evaluation?.commentsSuggestions || evaluation?.recommendations || ''}
        overallRating={
          evaluation?.overallRating || (evaluation?.overallScore ? evaluation.overallScore / 20 : 4)
        }
        grade={evaluation?.grade || 'Good'}
        questionnaire={traineeQuestionnaire}
        isReadOnly={isLocked}
        status={evaluation?.status || 'draft'}
        role="trainee"
        initialPageTab="page2"
        onQuestionnaireChange={setTraineeQuestionnaire}
        onSaveDraft={() => handleSaveQuestionnaire(false)}
        onSubmitFinal={() => handleSaveQuestionnaire(true)}
      />
    </div>
  );
}
