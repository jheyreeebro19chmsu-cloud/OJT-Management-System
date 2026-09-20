import React, { useState } from 'react';
import {
  Clock,
  FileSpreadsheet,
  Lock,
  Printer,
  Save,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';

import { useApp } from '../store/AppContext';
import { Evaluation, EvaluationQuestionnaire } from '../types';
import { CHMSUEvaluationSheet } from '../components/CHMSUEvaluationSheet';

export function TraineeEvaluation() {
  const { getCurrentEmployee, evaluations, employees, updateEvaluation, addEvaluation } = useApp();
  const employee = getCurrentEmployee();

  const evaluation: Evaluation | undefined = evaluations.find(
    (e) => e.employeeId === employee?.id || e.employeeId === employee?.employeeId
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
        updateEvaluation(evaluation.id, {
          questionnaire: traineeQuestionnaire,
        });
        toast.success('✓ Questionnaire answers saved successfully!');
      } else {
        // Create draft evaluation entry containing questionnaire
        const draftData: Omit<Evaluation, 'id'> = {
          employeeId: employee.id,
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
          status: 'draft',
          questionnaire: traineeQuestionnaire,
        };
        addEvaluation(draftData);
        toast.success('✓ Questionnaire responses submitted! Waiting for HTE supervisor ratings.');
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
            <h1 className="text-xl font-bold text-gray-900">OJT Performance Evaluation &amp; Questionnaire</h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
              CHMSU CCS Official
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            View supervisor performance ratings (Page 1) and complete your OJT questionnaire &amp; reflections (Page 2)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSaveQuestionnaire}
            disabled={isSavingQuestionnaire}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <Save size={15} />
            <span>{isSavingQuestionnaire ? 'Saving...' : 'Save My Questionnaire Answers'}</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <Printer size={15} />
            <span>Print Official Form</span>
          </button>
        </div>
      </div>

      {/* Trainee Notice Banner */}
      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-4 flex items-start gap-3 no-print">
        <div className="w-9 h-9 rounded-xl bg-emerald-700 text-white flex items-center justify-center shrink-0 shadow-sm">
          <ShieldCheck size={18} />
        </div>
        <div className="text-xs text-slate-700 leading-relaxed">
          <p className="font-bold text-emerald-950 text-sm mb-0.5">Official CHMSU OJT 2-Page Evaluation System</p>
          • <strong>Page 1 (Evaluation Report):</strong> Formally filled and submitted by your Host Training Establishment supervisor according to College of Computer Studies criteria.<br />
          • <strong>Page 2 (Evaluation Form / Questionnaire):</strong> Contains your training station particulars and your 9-question internship feedback &amp; recommendations. You can fill out and update your questionnaire responses below anytime.
        </div>
      </div>

      {/* Case 1: Evaluation exists */}
      {evaluation ? (
        <CHMSUEvaluationSheet
          trainee={employee}
          companyName={employee.companyName || 'Host Training Establishment'}
          supervisorName={
            evaluation.evaluatorName ||
            evaluation.evaluatedBy ||
            employee.supervisorName ||
            'HTE Supervisor'
          }
          instructorName={instructorName}
          evaluationDate={evaluation.evaluatedAt}
          ratings={evaluation.ratings || {}}
          ratingComments={evaluation.ratingComments || {}}
          commentsSuggestions={evaluation.commentsSuggestions || evaluation.recommendations || ''}
          overallRating={
            evaluation.overallRating || (evaluation.overallScore ? evaluation.overallScore / 20 : 4)
          }
          grade={evaluation.grade || 'Good'}
          questionnaire={traineeQuestionnaire}
          isReadOnly={true}
          status={evaluation.status}
          role="trainee"
          initialPageTab="both"
          onQuestionnaireChange={setTraineeQuestionnaire}
          onSaveDraft={handleSaveQuestionnaire}
          onSubmitFinal={handleSaveQuestionnaire}
        />
      ) : (
        /* Case 2: Awaiting HTE Evaluation Report, but Trainee can still fill Page 2 Questionnaire */
        <div className="space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm text-center max-w-xl mx-auto space-y-4 no-print"
          >
            <div className="w-14 h-14 mx-auto rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shadow-inner">
              <Clock size={28} className="animate-pulse" />
            </div>

            <div>
              <h2 className="text-base font-bold text-slate-900">Awaiting HTE Performance Report (Page 1)</h2>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Your HTE supervisor hasn't submitted Page 1 criteria ratings yet, but you can already fill out your <strong>Page 2 Questionnaire</strong> below and click "Save My Questionnaire Answers".
              </p>
            </div>
          </motion.div>

          <CHMSUEvaluationSheet
            trainee={employee}
            companyName={employee.companyName || 'Host Training Establishment'}
            supervisorName={employee.supervisorName || 'HTE Supervisor'}
            instructorName={instructorName}
            ratings={{}}
            ratingComments={{}}
            commentsSuggestions=""
            overallRating={4}
            grade="Good"
            questionnaire={traineeQuestionnaire}
            isReadOnly={false}
            status="draft"
            role="trainee"
            initialPageTab="page2"
            onQuestionnaireChange={setTraineeQuestionnaire}
            onSaveDraft={handleSaveQuestionnaire}
            onSubmitFinal={handleSaveQuestionnaire}
          />
        </div>
      )}
    </div>
  );
}
