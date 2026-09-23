import React, { useState } from 'react';
import {
  Clock,
  FileSpreadsheet,
  Lock,
  Printer,
  Save,
  ShieldCheck,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';

import { useApp } from '../store/AppContext';
import { Evaluation, EvaluationQuestionnaire } from '../types';
import { CHMSUEvaluationSheet } from '../components/CHMSUEvaluationSheet';

export function TraineeEvaluation() {
  const { getCurrentEmployee, evaluations, employees, updateEvaluation, addEvaluation, refreshData } = useApp();
  const employee = getCurrentEmployee();

  const evaluation: Evaluation | undefined = evaluations.find(
    (e) => e.employeeId === employee?.id || (employee?.employeeId && e.employeeId === employee.employeeId)
  );

  const [traineeQuestionnaire, setTraineeQuestionnaire] = useState<EvaluationQuestionnaire>(() => {
    return evaluation?.questionnaire || {
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
  });

  const [isSavingQuestionnaire, setIsSavingQuestionnaire] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Sync latest evaluations on mount
  React.useEffect(() => {
    refreshData();
  }, [refreshData]);

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      await refreshData();
      toast.success('Questionnaire and evaluation synchronized with cloud.');
    } catch {
      toast.error('Sync failed. Please check network.');
    } finally {
      setIsSyncing(false);
    }
  };

  // Sync when evaluation loads
  React.useEffect(() => {
    if (evaluation?.questionnaire) {
      setTraineeQuestionnaire(evaluation.questionnaire);
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

  if (!employee) return null;

  const handleSaveQuestionnaire = () => {
    if (!employee) return;
    setIsSavingQuestionnaire(true);

    try {
      if (evaluation) {
        const nextStatus =
          !evaluation.status || evaluation.status === 'draft' || evaluation.status === 'submitted_by_trainee'
            ? 'submitted_by_trainee'
            : evaluation.status;

        updateEvaluation(evaluation.id, {
          questionnaire: traineeQuestionnaire,
          status: nextStatus,
        });
        toast.success('✓ Questionnaire answers submitted to Instructor! Your coordinator will review and pass to your HTE.');
      } else {
        // Create draft evaluation entry containing questionnaire and submitted_by_trainee status
        const draftData: Omit<Evaluation, 'id'> = {
          employeeId: employee.id,
          academicYear: employee.academicYear || '2026-2027',
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
          status: 'submitted_by_trainee',
          questionnaire: traineeQuestionnaire,
        };
        addEvaluation(draftData);
        toast.success('✓ Questionnaire responses submitted to Instructor! Your coordinator will review and pass to your HTE.');
      }
    } catch (e: any) {
      toast.error('Failed to save questionnaire responses: ' + (e.message || 'Unknown error'));
    } finally {
      setIsSavingQuestionnaire(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12 font-sans">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-gray-900">CHMSU OJT Trainee Questionnaire</h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
              CHMSU CCS Official
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
              Trainee Form
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Complete your training station particulars and your 9-question internship feedback &amp; recommendations questionnaire.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleManualSync}
            disabled={isSyncing}
            className="px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-bold border border-blue-200 transition-all flex items-center gap-1.5 shadow-xs disabled:opacity-60 cursor-pointer"
            title="Synchronize latest questionnaire and ratings from cloud"
          >
            <RefreshCw size={14} className={isSyncing ? 'animate-spin text-blue-600' : 'text-blue-600'} />
            <span>{isSyncing ? 'Syncing...' : 'Sync Cloud'}</span>
          </button>

          <button
            type="button"
            onClick={handleSaveQuestionnaire}
            disabled={isSavingQuestionnaire}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <Save size={15} />
            <span>{isSavingQuestionnaire ? 'Submitting...' : 'Submit Questionnaire to Instructor'}</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <Printer size={15} />
            <span>Print Questionnaire</span>
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
                Submitted to Instructor — Awaiting Pass to HTE
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-300">
                Questionnaire Pending Submission
              </span>
            )}
          </div>
          Fill out your training establishment details, dates, and the 9 required reflection questions below. When submitted, your instructor immediately sees your questionnaire and passes it to your HTE supervisor to complete your performance ratings.
        </div>
      </div>

      {/* OJT Questionnaire Sheet (Only questionnaire is permitted in trainee's account) */}
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
        isReadOnly={false}
        status={evaluation?.status || 'draft'}
        role="trainee"
        initialPageTab="page2"
        onQuestionnaireChange={setTraineeQuestionnaire}
        onSaveDraft={handleSaveQuestionnaire}
        onSubmitFinal={handleSaveQuestionnaire}
      />
    </div>
  );
}
