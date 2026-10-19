import React, { useState, useEffect } from 'react';
import {
  Printer,
  ShieldCheck,
  Eye,
  Check,
  Save,
  Clock,
  Sparkles,
  FileEdit,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';

import { useApp } from '../store/AppContext';
import { Evaluation, EvaluationQuestionnaire, isQuestionnaireAnswered, countAnsweredQuestions } from '../types';
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

  // Trainee is in edit mode by default so they can answer all questionnaire questions
  const [isEditing, setIsEditing] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);

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

  const answeredCount = countAnsweredQuestions(traineeQuestionnaire);
  const hasAnswered = answeredCount > 0;
  const isAllAnswered = answeredCount >= 9;

  const handleSaveQuestionnaire = async (asSubmit: boolean) => {
    if (!employee) return;

    if (asSubmit && !hasAnswered) {
      toast.error('Please answer at least one questionnaire question before submitting to your Instructor.');
      return;
    }

    setIsSaving(true);
    const currentStatus = evaluation?.status;
    const newStatus: Evaluation['status'] = (() => {
      // Preserve workflow status if already in HTE rating or reviewed
      if (currentStatus === 'reviewed_by_instructor') return 'reviewed_by_instructor';
      if (currentStatus === 'submitted_to_instructor') return 'submitted_to_instructor';
      if (currentStatus === 'passed_to_hte') return 'passed_to_hte';
      if (asSubmit) return 'submitted_by_trainee';
      return currentStatus || 'draft';
    })();

    try {
      if (evaluation) {
        updateEvaluation(evaluation.id, {
          employeeId: employee.id,
          questionnaire: traineeQuestionnaire,
          status: newStatus,
        });
      } else {
        addEvaluation({
          employeeId: employee.id,
          academicYear: employee.academicYear || settings?.activeAcademicYear || '2026-2027',
          evaluatedBy: employee.supervisorName || 'HTE Supervisor',
          evaluatorName: employee.supervisorName || 'HTE Supervisor',
          evaluatorPosition: 'HTE Supervisor',
          date: new Date().toISOString().split('T')[0],
          attendanceScore: 85,
          performanceScore: 85,
          attitudeScore: 85,
          punctualityScore: 85,
          communicationScore: 85,
          overallScore: 85,
          grade: 'Very Good',
          strengths: 'Active trainee participant in OJT program.',
          areasForImprovement: 'Continuous technical enhancement.',
          recommendations: 'Awaiting formal supervisor ratings.',
          evaluatedAt: new Date().toISOString(),
          status: asSubmit ? 'submitted_by_trainee' : 'draft',
          questionnaire: traineeQuestionnaire,
        });
      }

      if (asSubmit) {
        toast.success(
          currentStatus === 'reviewed_by_instructor' || currentStatus === 'submitted_to_instructor'
            ? '✓ Questionnaire responses updated successfully!'
            : '✓ Questionnaire submitted to Instructor! Your coordinator will review and endorse to your HTE.'
        );
      } else {
        toast.success('Draft questionnaire responses saved.');
      }
      await refreshData();
    } catch (err: any) {
      console.error('Save questionnaire error:', err);
      toast.error('Failed to save questionnaire. Please try again.');
    } finally {
      setIsSaving(false);
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
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                isAllAnswered
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                  : answeredCount > 0
                  ? 'bg-amber-100 text-amber-800 border-amber-300'
                  : 'bg-slate-100 text-slate-700 border-slate-300'
              }`}
            >
              {isAllAnswered ? (
                <>
                  <CheckCircle2 size={12} className="text-emerald-700" />
                  All 9 Questions Answered
                </>
              ) : (
                <>
                  <Clock size={12} className="text-amber-700" />
                  {answeredCount} / 9 Questions Answered
                </>
              )}
            </span>
            {isEditing ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                <Sparkles size={12} /> Editing Mode
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                <Eye size={12} /> Preview Mode
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Answer the 9-question internship feedback questionnaire and training particulars to submit to your Instructor.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Toggle between Edit and Preview */}
          <button
            type="button"
            onClick={() => setIsEditing(!isEditing)}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer ${
              isEditing
                ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300'
                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300'
            }`}
          >
            {isEditing ? (
              <>
                <Eye size={14} />
                <span>Preview Document</span>
              </>
            ) : (
              <>
                <FileEdit size={14} />
                <span>Edit Answers</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => handleSaveQuestionnaire(false)}
            disabled={isSaving}
            className="px-3.5 py-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
          >
            <Save size={14} />
            <span>Save Draft</span>
          </button>

          <button
            type="button"
            onClick={() => handleSaveQuestionnaire(true)}
            disabled={isSaving}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 shadow-sm shadow-emerald-600/30 cursor-pointer disabled:opacity-50"
          >
            <Check size={14} />
            <span>
              {evaluation?.status === 'reviewed_by_instructor' || evaluation?.status === 'submitted_to_instructor'
                ? 'Update Questionnaire'
                : 'Submit to Instructor'}
            </span>
          </button>

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
      <div
        className={`border rounded-2xl p-4 flex items-start gap-3 no-print shadow-xs ${
          !isAllAnswered
            ? 'bg-amber-50/90 border-amber-200 text-amber-900'
            : 'bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-200 text-slate-700'
        }`}
      >
        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${
            !isAllAnswered ? 'bg-amber-600 text-white' : 'bg-emerald-700 text-white'
          }`}
        >
          {!isAllAnswered ? <AlertTriangle size={18} /> : <ShieldCheck size={18} />}
        </div>
        <div className="text-xs leading-relaxed flex-1">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
            <p className="font-bold text-sm">CHMSU OJT Practicum Feedback Questionnaire</p>
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
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1">
                <Clock size={11} /> Questionnaire In Progress
              </span>
            )}
          </div>
          {!isAllAnswered ? (
            <p className="font-medium text-amber-950">
              ⚠️ <strong>Action Required:</strong> You have answered <strong>{answeredCount}</strong> of <strong>9</strong> required feedback questions ({9 - answeredCount} remaining). Please fill out questions 3 to 9 below and click "<strong>{evaluation?.status === 'reviewed_by_instructor' || evaluation?.status === 'submitted_to_instructor' ? 'Update Questionnaire' : 'Submit to Instructor'}</strong>" to complete your submission.
            </p>
          ) : (
            <p>
              All 9 practicum reflection questions have been completed! You may update your responses anytime if needed or print your official questionnaire sheet for your records.
            </p>
          )}
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
        isReadOnly={!isEditing}
        status={evaluation?.status || 'draft'}
        role="trainee"
        initialPageTab="page2"
        hideTopBar={true}
        onQuestionnaireChange={setTraineeQuestionnaire}
        onSaveDraft={() => handleSaveQuestionnaire(false)}
        onSubmitFinal={() => handleSaveQuestionnaire(true)}
        onEditToggle={() => setIsEditing(true)}
      />
    </div>
  );
}
