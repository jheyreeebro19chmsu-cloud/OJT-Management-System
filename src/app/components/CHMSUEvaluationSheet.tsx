import React, { useState, useEffect } from 'react';
import {
  Award,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  FileSpreadsheet,
  FileText,
  Layers,
  MessageSquare,
  Printer,
  Save,
  Sparkles,
  UserCheck,
  X,
} from 'lucide-react';

import {
  CHMSU_EVALUATION_CATEGORIES,
  CHMSU_RATING_SCALE,
  EmployabilityStatus,
  Employee,
  Evaluation,
  EvaluationQuestionnaire,
} from '../types';

export interface CHMSUEvaluationSheetProps {
  trainee: Employee;
  companyName: string;
  supervisorName: string;
  instructorName?: string;
  evaluationDate?: string;
  ratings: Record<string, number>;
  ratingComments: Record<string, string>;
  commentsSuggestions: string;
  overallRating: number;
  grade: Evaluation['grade'];
  questionnaire?: EvaluationQuestionnaire;
  isReadOnly?: boolean;
  status?: Evaluation['status'];
  role?: 'hte' | 'instructor' | 'trainee';
  initialPageTab?: 'page1' | 'page2' | 'both';
  onRatingChange?: (criterionId: string, score: number) => void;
  onRatingCommentChange?: (categoryId: string, comment: string) => void;
  onCommentsSuggestionsChange?: (text: string) => void;
  onQuestionnaireChange?: (questionnaire: EvaluationQuestionnaire) => void;
  onSaveDraft?: () => void;
  onSubmitFinal?: () => void;
  onClose?: () => void;
  onMarkDoneViewed?: () => void;
}

const RATING_COMMENT_PRESETS: Record<string, string[]> = {
  workHabits: [
    'Consistently punctual and maintains excellent daily attendance.',
    'Works independently and requires minimal direct supervision.',
    'Demonstrates high self-discipline, dedication, and reliability in all duties.',
    'Quickly adapts to work schedules and completes assignments ahead of deadlines.',
  ],
  workSkills: [
    'Demonstrates proficient ability to operate technical systems and tools.',
    'Handles assigned project details with impressive precision and quality.',
    'Manifests great flexibility and problem-solving initiative under pressure.',
    'Consistently contributes sound, practical suggestions to technical tasks.',
  ],
  socialSkills: [
    'Maintains exceptional courtesy, tact, and professionalism with peers and leaders.',
    'Active listener and dependable team player who assists others willingly.',
    'Demonstrates emotional maturity, receptiveness to feedback, and respect.',
    'Always well-groomed, poised, and conducts themselves with high integrity.',
  ],
};

const GRADE_LABELS: Record<Evaluation['grade'], { label: string; badge: string }> = {
  Excellent: { label: 'Excellent / Outstanding (4.50 – 5.00)', badge: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  'Very Good': { label: 'Very Good / Above Average (3.50 – 4.49)', badge: 'bg-blue-100 text-blue-800 border-blue-300' },
  Good: { label: 'Good / Average (2.50 – 3.49)', badge: 'bg-sky-100 text-sky-800 border-sky-300' },
  Satisfactory: { label: 'Satisfactory / Passing (1.50 – 2.49)', badge: 'bg-amber-100 text-amber-800 border-amber-300' },
  'Needs Improvement': { label: 'Needs Improvement / Urgent Attention (< 1.50)', badge: 'bg-rose-100 text-rose-800 border-rose-300' },
};

const EMPLOYABILITY_OPTIONS: EmployabilityStatus[] = [
  'OJT Trainee',
  'Contractual',
  'Regular',
  'Probationary',
  'Casual',
  'Applicant',
];

const QUESTIONNAIRE_PROMPTS: {
  key: keyof EvaluationQuestionnaire;
  number: number;
  prompt: string;
  placeholder: string;
  suggestions: string[];
}[] = [
  {
    key: 'q1_dutiesBriefly',
    number: 1,
    prompt: 'Describe your duties briefly:',
    placeholder: 'State primary tasks, technical duties, software systems handled, and daily operations...',
    suggestions: [
      'Assisted in web development, database maintenance, UI design, and technical troubleshooting.',
      'Managed IT support, hardware maintenance, network troubleshooting, and user assistance.',
      'Handled data entry, database verification, technical report preparation, and system documentation.',
      'Supported network setup, security checks, software installation, and workstation configuration.',
    ],
  },
  {
    key: 'q2_strongestPerformanceArea',
    number: 2,
    prompt: 'What do you consider your strongest area of performance?',
    placeholder: 'Identify key skills, strengths, work habits, or achievements...',
    suggestions: [
      'Fast learner with strong technical troubleshooting and programming capabilities.',
      'Reliable, punctual, and maintains high accuracy and attention to detail in every assigned task.',
      'Exceptional interpersonal skills, adaptability, and eager collaboration with team members.',
      'Ability to remain calm under pressure and deliver quality work before deadlines.',
    ],
  },
  {
    key: 'q3_areasImprovedMost',
    number: 3,
    prompt: 'In what areas do you feel you have improved the most?',
    placeholder: 'Highlight technical competencies, communication skills, or industry habits developed...',
    suggestions: [
      'Significantly improved real-world technical skills, debugging, and practical system development.',
      'Enhanced workplace communication, professional confidence, and collaboration with senior colleagues.',
      'Better time management, task prioritization, and ability to work with minimal supervision.',
      'Developed deep understanding of organizational workflows and corporate standard operating procedures.',
    ],
  },
  {
    key: 'q4_areasNeedImprovement',
    number: 4,
    prompt: 'In what areas do you feel need the most improvement?',
    placeholder: 'Areas for future growth, skill refinement, or further learning...',
    suggestions: [
      'Mastery of advanced enterprise frameworks and complex database optimization techniques.',
      'Speaking up more proactively in technical design discussions and stakeholder meetings.',
      'Handling very large multi-layered system architectures independently.',
      'Gaining further certifications in cybersecurity, cloud infrastructure, and project management.',
    ],
  },
  {
    key: 'q5_situationChallengedMost',
    number: 5,
    prompt: 'What situation challenged you the most?',
    placeholder: 'Specific complex incident, tight deadline, or technical hurdle faced...',
    suggestions: [
      'Troubleshooting an unexpected critical bug right before a major deployment deadline.',
      'Adjusting quickly to legacy company codebases and unfamiliar specialized internal tools.',
      'Balancing high-priority ad-hoc requests while keeping main deliverables on schedule.',
      'Overcoming communication barriers with cross-functional non-technical stakeholders.',
    ],
  },
  {
    key: 'q6_howOvercameChallenge',
    number: 6,
    prompt: 'How did you overcome the challenge?',
    placeholder: 'Actions taken, research done, consultations made to resolve the challenge...',
    suggestions: [
      'Consulted senior colleagues, thoroughly reviewed official documentation, and tested solutions methodically.',
      'Broke down the problem into smaller manageable components and tackled them systematically.',
      'Organized daily schedules with priority checklists and kept supervisors updated on progress.',
      'Maintained patience, calm composure, and actively asked clarifying questions when uncertain.',
    ],
  },
  {
    key: 'q7_whatLearnedFromExperience',
    number: 7,
    prompt: 'What did you learn from your experience?',
    placeholder: 'Core takeaways, industry principles, and professional lessons learned...',
    suggestions: [
      'Learned that clear communication and accountability are just as critical as technical proficiency.',
      'Gained first-hand understanding of industry software life cycles and enterprise teamwork.',
      'Realized the value of proactive initiative, continuous learning, and resilience in a professional setting.',
      'Understood the importance of standard operating procedures, documentation, and data integrity.',
    ],
  },
  {
    key: 'q8_isQualifiedLinkage',
    number: 8,
    prompt: 'Do you think your training station is qualified to be one of our university linkages?',
    placeholder: 'State your evaluation of the company as an official CHMSU CCS internship linkage partner...',
    suggestions: [
      'Yes, highly qualified. The company provides hands-on mentorship, relevant IT projects, and a very supportive learning culture.',
      'Yes, definitely. The training station exposes students to modern industry technologies and fosters genuine professional growth.',
      'Yes, qualified. The workplace maintains high professional standards, ethical leadership, and excellent guidance for students.',
      'Yes, strongly recommended for future CHMSU College of Computer Studies OJT batches.',
    ],
  },
  {
    key: 'q9_ojtSuggestionsRecommendations',
    number: 9,
    prompt: 'OJTs suggestions/recommendation:',
    placeholder: 'Provide your recommendations for future interns, university preparation, or training station...',
    suggestions: [
      'Maintain and expand this industry linkage partnership for future CCS graduating batches.',
      'Provide interns with a structured orientation checklist during the first week of deployment.',
      'Continue encouraging students to explore hands-on enterprise tools and participate in live team standups.',
      'Conduct regular mid-internship check-ins between university coordinators and host supervisors.',
    ],
  },
];

export function CHMSUEvaluationSheet({
  trainee,
  companyName,
  supervisorName,
  instructorName = 'CHMSU OJT Instructor',
  evaluationDate,
  ratings,
  ratingComments,
  commentsSuggestions,
  overallRating,
  grade,
  questionnaire,
  isReadOnly = false,
  status = 'draft',
  role = 'hte',
  initialPageTab = 'both',
  onRatingChange,
  onRatingCommentChange,
  onCommentsSuggestionsChange,
  onQuestionnaireChange,
  onSaveDraft,
  onSubmitFinal,
  onClose,
  onMarkDoneViewed,
}: CHMSUEvaluationSheetProps) {
  const [activeTab, setActiveTab] = useState<'page1' | 'page2' | 'both'>(initialPageTab);
  const [activePresetCategory, setActivePresetCategory] = useState<string | null>(null);
  const [activeQuestionPreset, setActiveQuestionPreset] = useState<string | null>(null);

  // Local copy of questionnaire state to guarantee reactive editing
  const [localQuestionnaire, setLocalQuestionnaire] = useState<EvaluationQuestionnaire>(() => ({
    companyAddress: questionnaire?.companyAddress || trainee.department || '',
    contactPerson: questionnaire?.contactPerson || supervisorName || '',
    trainingDateFrom: questionnaire?.trainingDateFrom || '',
    trainingDateTo: questionnaire?.trainingDateTo || '',
    dateOfEvaluation: questionnaire?.dateOfEvaluation || '',
    dateOfLastEvaluation: questionnaire?.dateOfLastEvaluation || '',
    employabilityStatus: questionnaire?.employabilityStatus || 'OJT Trainee',
    employedCompanyName: questionnaire?.employedCompanyName || '',
    allowanceSalary: questionnaire?.allowanceSalary || '',
    telephoneNo: questionnaire?.telephoneNo || trainee.phone || '',
    department: questionnaire?.department || trainee.department || 'IT Department',
    position: questionnaire?.position || 'ON - THE - JOB TRAINEE',
    otherDeptAssigned: questionnaire?.otherDeptAssigned || 'None',
    q1_dutiesBriefly: questionnaire?.q1_dutiesBriefly || '',
    q2_strongestPerformanceArea: questionnaire?.q2_strongestPerformanceArea || '',
    q3_areasImprovedMost: questionnaire?.q3_areasImprovedMost || '',
    q4_areasNeedImprovement: questionnaire?.q4_areasNeedImprovement || '',
    q5_situationChallengedMost: questionnaire?.q5_situationChallengedMost || '',
    q6_howOvercameChallenge: questionnaire?.q6_howOvercameChallenge || '',
    q7_whatLearnedFromExperience: questionnaire?.q7_whatLearnedFromExperience || '',
    q8_isQualifiedLinkage: questionnaire?.q8_isQualifiedLinkage || '',
    q9_ojtSuggestionsRecommendations: questionnaire?.q9_ojtSuggestionsRecommendations || '',
    ...(questionnaire || {}),
  }));

  useEffect(() => {
    if (questionnaire) {
      setLocalQuestionnaire((prev) => ({
        ...prev,
        ...questionnaire,
      }));
    }
  }, [questionnaire]);

  const updateQuestionnaireField = (field: keyof EvaluationQuestionnaire, val: any) => {
    setLocalQuestionnaire((prev) => {
      const next = { ...prev, [field]: val };
      if (onQuestionnaireChange) {
        onQuestionnaireChange(next);
      }
      return next;
    });
  };

  // Formatted date
  const displayDate = evaluationDate
    ? new Date(evaluationDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  // Calculate category averages
  const categoryStats = React.useMemo(() => {
    const stats: Record<string, { avg: number; total: number; count: number }> = {};
    CHMSU_EVALUATION_CATEGORIES.forEach((cat) => {
      const valid = cat.items
        .map((item) => ratings[item.id] ?? 4)
        .filter((score) => score > 0);
      const total = valid.reduce((a, b) => a + b, 0);
      const avg = valid.length > 0 ? total / valid.length : 4;
      stats[cat.id] = { avg: Number(avg.toFixed(2)), total, count: valid.length };
    });
    return stats;
  }, [ratings]);

  const gradeInfo = GRADE_LABELS[grade] || GRADE_LABELS['Good'];

  const appendCommentPreset = (catId: string, text: string) => {
    if (!onRatingCommentChange) return;
    const current = (ratingComments[catId] || '').trim();
    if (!current) {
      onRatingCommentChange(catId, text);
    } else if (!current.includes(text)) {
      onRatingCommentChange(catId, `${current} ${text}`);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12 font-sans text-slate-800">
      {/* Top Action Bar (Hidden when printing) */}
      <div className="flex flex-wrap items-center justify-between gap-3 no-print bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              <X size={15} />
              <span>Return to List</span>
            </button>
          )}

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 uppercase">Status:</span>
            {status === 'reviewed_by_instructor' ? (
              <span className="px-2.5 py-1 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                <CheckCircle2 size={13} />
                Reviewed by Instructor
              </span>
            ) : status === 'submitted_to_instructor' || status === 'final' ? (
              <span className="px-2.5 py-1 rounded-full text-xs font-extrabold bg-blue-100 text-blue-800 border border-blue-200">
                Submitted to Instructor
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-full text-xs font-extrabold bg-amber-100 text-amber-800 border border-amber-200">
                Draft Mode
              </span>
            )}
          </div>
        </div>

        {/* Tab Navigation Buttons */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('page1')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'page1'
                ? 'bg-white text-emerald-900 shadow-xs font-black'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText size={14} />
            <span>Page 1: Report</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('page2')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'page2'
                ? 'bg-white text-emerald-900 shadow-xs font-black'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileSpreadsheet size={14} />
            <span>Page 2: Questionnaire</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('both')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'both'
                ? 'bg-white text-emerald-900 shadow-xs font-black'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers size={14} />
            <span>Both Pages (Full)</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {role === 'instructor' && status !== 'reviewed_by_instructor' && onMarkDoneViewed && (
            <button
              type="button"
              onClick={onMarkDoneViewed}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <CheckCircle2 size={15} />
              <span>Done Viewed</span>
            </button>
          )}

          <button
            type="button"
            onClick={handlePrint}
            className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
            title="Print Official 2-Page Hard Copy"
          >
            <Printer size={15} />
            <span>Print Official Form</span>
          </button>

          {!isReadOnly && onSaveDraft && (
            <button
              type="button"
              onClick={onSaveDraft}
              className="px-4 py-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Save size={15} />
              <span>Save Draft</span>
            </button>
          )}

          {!isReadOnly && onSubmitFinal && (
            <button
              type="button"
              onClick={onSubmitFinal}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 shadow-md shadow-blue-600/30 cursor-pointer"
            >
              <Check size={15} />
              <span>{role === 'hte' ? 'Submit & Pass to Instructor' : 'Finalize Evaluation'}</span>
            </button>
          )}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────────────
          PAGE 1: ON-THE-JOB TRAINING EVALUATION REPORT
          ───────────────────────────────────────────────────────────────────────────── */}
      {(activeTab === 'page1' || activeTab === 'both') && (
        <div
          id="chmsu-evaluation-page-1"
          className="bg-white rounded-2xl shadow-xl border border-slate-300 overflow-hidden print:border-0 print:shadow-none print:m-0 print:p-0 print:page-break-after-always"
          style={{ breakAfter: 'page', pageBreakAfter: 'always' }}
        >
          <div className="p-6 sm:p-10 space-y-6 print:p-4 print:space-y-4">
            {/* Institutional Header matching official document */}
            <div className="border-b-2 border-emerald-800/80 pb-5 text-center relative">
              <div className="flex items-center justify-between gap-4">
                {/* Left Logo */}
                <div className="w-20 h-20 shrink-0 flex items-center justify-center">
                  <img
                    src="/chmsu-logo.png"
                    alt="Carlos Hilado Memorial State University Logo"
                    className="w-20 h-20 object-contain drop-shadow-xs"
                    onError={(e) => {
                      (e.currentTarget as HTMLElement).style.display = 'none';
                    }}
                  />
                </div>

                {/* Center Text Header */}
                <div className="flex-1 px-2">
                  <h1 className="font-serif font-black text-emerald-900 text-xl sm:text-2xl tracking-wide uppercase leading-tight">
                    Carlos Hilado Memorial State University
                  </h1>
                  <p className="text-[11px] sm:text-xs font-semibold text-slate-600 tracking-tight mt-0.5">
                    Alijis Campus • Binalbagan Campus • Fortune Towne Campus • Talisay (Main) Campus
                  </p>
                  <p className="text-[10px] sm:text-[11px] italic font-medium text-emerald-800 mt-0.5">
                    A leading GREEN institution of higher learning in the global community by 2030
                  </p>
                  <p className="text-[9px] sm:text-[10px] text-slate-500 font-medium">
                    (Good governance, Research-oriented, Extension-driven, Education for Sustainable Development, and Nation-building)
                  </p>

                  <div className="mt-3 pt-2 border-t border-slate-200">
                    <h2 className="font-sans font-extrabold text-slate-800 text-sm sm:text-base tracking-wide uppercase">
                      College of Computer Studies
                    </h2>
                    <h3 className="font-sans font-black text-emerald-950 text-base sm:text-lg tracking-wider uppercase mt-0.5">
                      ON-THE-JOB TRAINING EVALUATION REPORT
                    </h3>
                  </div>
                </div>

                {/* Right Seal / Badge */}
                <div className="w-20 h-20 shrink-0 flex flex-col items-center justify-center text-center">
                  <div className="w-16 h-16 rounded-full border-2 border-emerald-700 bg-emerald-50/50 flex flex-col items-center justify-center p-1 text-emerald-900">
                    <span className="text-[9px] font-black uppercase leading-tight">GREEN</span>
                    <span className="text-[9px] font-black uppercase leading-tight text-amber-700">CHMSU</span>
                    <span className="text-[8px] font-bold text-emerald-800">CCS</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Student & HTE Details Table */}
            <div className="border border-slate-300 rounded-xl p-4 bg-slate-50/70 print:bg-white text-xs sm:text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2.5 gap-x-8">
                <div className="flex items-baseline gap-2">
                  <span className="font-extrabold text-slate-700 w-36 shrink-0">Name of Trainee:</span>
                  <span className="font-black text-slate-950 border-b border-dotted border-slate-500 flex-1 pb-0.5 uppercase tracking-wide">
                    {trainee.name}
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="font-extrabold text-slate-700 w-36 shrink-0">Company Name:</span>
                  <span className="font-bold text-slate-900 border-b border-dotted border-slate-500 flex-1 pb-0.5">
                    {companyName || trainee.companyName || 'Host Training Establishment'}
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="font-extrabold text-slate-700 w-36 shrink-0">Course &amp; Section:</span>
                  <span className="font-bold text-slate-900 border-b border-dotted border-slate-500 flex-1 pb-0.5">
                    {trainee.course || 'BSIS 4A'}
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="font-extrabold text-slate-700 w-36 shrink-0">Academic Year:</span>
                  <span className="font-semibold text-slate-800 border-b border-dotted border-slate-500 flex-1 pb-0.5">
                    AY {trainee.academicYear || '2026-2027'}
                  </span>
                </div>
              </div>
            </div>

            {/* Rating Scale Instructions Box */}
            <div className="border border-slate-300 rounded-xl p-3.5 bg-white text-xs space-y-2">
              <p className="font-bold text-slate-900">
                Please rate the Student's overall practicum performance according to the rating scale below:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1 text-[11px] text-slate-700">
                {CHMSU_RATING_SCALE.map((scale) => (
                  <div key={scale.value} className="flex items-start gap-2">
                    <span className="w-7 h-5 flex items-center justify-center font-black rounded bg-emerald-100 text-emerald-900 border border-emerald-300 shrink-0 text-[10px]">
                      {scale.value === 0 ? 'NA' : scale.value}
                    </span>
                    <span>
                      <strong className="text-slate-900">{scale.label}</strong> — {scale.description}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Official Evaluation Table */}
            <div className="border-2 border-slate-800 rounded-xl overflow-hidden shadow-xs">
              <table className="w-full text-xs sm:text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-white font-extrabold uppercase text-center border-b-2 border-slate-800">
                    <th className="py-2.5 px-4 text-left w-[62%] sm:w-[68%]">Criteria / Rating</th>
                    <th className="py-2.5 px-2 w-[6%] border-l border-slate-700 text-center">1</th>
                    <th className="py-2.5 px-2 w-[6%] border-l border-slate-700 text-center">2</th>
                    <th className="py-2.5 px-2 w-[6%] border-l border-slate-700 text-center">3</th>
                    <th className="py-2.5 px-2 w-[6%] border-l border-slate-700 text-center">4</th>
                    <th className="py-2.5 px-2 w-[6%] border-l border-slate-700 text-center">5</th>
                    <th className="py-2.5 px-2 w-[8%] border-l border-slate-700 text-center">NA</th>
                  </tr>
                </thead>
                <tbody>
                  {CHMSU_EVALUATION_CATEGORIES.map((category) => {
                    const catStat = categoryStats[category.id] || { avg: 4, total: 20, count: 5 };
                    const currentCategoryComment = ratingComments[category.id] || '';

                    return (
                      <React.Fragment key={category.id}>
                        {/* Category Header Row */}
                        <tr className="bg-emerald-50 border-t-2 border-b border-emerald-800">
                          <td
                            colSpan={7}
                            className="py-2 px-4 font-black uppercase tracking-wider text-emerald-950 text-xs sm:text-sm flex-1"
                          >
                            {category.title}
                          </td>
                        </tr>

                        {/* Criteria Items */}
                        {category.items.map((item) => {
                          const currentScore = ratings[item.id] ?? 4;

                          return (
                            <tr
                              key={item.id}
                              className="border-b border-slate-200 hover:bg-slate-50 transition-colors"
                            >
                              <td className="py-2 px-4 text-slate-800 text-xs sm:text-sm">
                                <span className="font-bold text-slate-900 mr-2">{item.number}.</span>
                                <span>{item.text}</span>
                              </td>

                              {/* 1, 2, 3, 4, 5, NA Cells */}
                              {[1, 2, 3, 4, 5, 0].map((val) => {
                                const isChecked = currentScore === val;

                                return (
                                  <td
                                    key={val}
                                    className="py-2 px-1 text-center border-l border-slate-200 align-middle"
                                  >
                                    {isReadOnly ? (
                                      <div className="flex items-center justify-center">
                                        {isChecked ? (
                                          <span className="w-5 h-5 rounded-full bg-emerald-700 text-white flex items-center justify-center font-bold text-[11px] shadow-xs print:text-black print:bg-transparent print:border print:border-black">
                                            ✓
                                          </span>
                                        ) : (
                                          <span className="text-slate-300 text-xs">•</span>
                                        )}
                                      </div>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => onRatingChange && onRatingChange(item.id, val)}
                                        className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg font-bold text-xs transition-all flex items-center justify-center mx-auto cursor-pointer ${
                                          isChecked
                                            ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-400 scale-105'
                                            : 'hover:bg-slate-100 text-slate-600 hover:text-slate-900'
                                        }`}
                                        title={`Rate ${val === 0 ? 'NA' : val}`}
                                      >
                                        {isChecked ? '✓' : val === 0 ? 'NA' : val}
                                      </button>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}

                        {/* Category Subtotal Row */}
                        <tr className="bg-slate-100/90 font-bold border-b border-slate-300">
                          <td className="py-2.5 px-4 text-right uppercase text-slate-700 text-xs">
                            Total Rating ({category.title}):
                          </td>
                          <td colSpan={6} className="py-2.5 px-4 border-l border-slate-300 text-left">
                            <span className="font-extrabold text-emerald-900 text-sm">
                              {catStat.avg.toFixed(2)} / 5.00
                            </span>
                            <span className="text-xs text-slate-500 ml-2 font-normal">
                              (Subtotal Sum: {catStat.total})
                            </span>
                          </td>
                        </tr>

                        {/* Rating Type Comments Inside the Evaluation Table */}
                        <tr className="border-b-2 border-slate-300 bg-white">
                          <td colSpan={7} className="p-3 sm:p-4 bg-slate-50/50">
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                  <MessageSquare size={14} className="text-emerald-700" />
                                  <span>Rating Comments &amp; Observations for {category.title}:</span>
                                </label>

                                {!isReadOnly && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setActivePresetCategory(
                                        activePresetCategory === category.id ? null : category.id
                                      )
                                    }
                                    className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-1 cursor-pointer no-print"
                                  >
                                    <Sparkles size={13} />
                                    <span>Quick Suggestions</span>
                                  </button>
                                )}
                              </div>

                              {/* Preset chips for fast evaluation comments */}
                              {!isReadOnly && activePresetCategory === category.id && (
                                <div className="p-2.5 bg-emerald-50/80 border border-emerald-200 rounded-xl space-y-1.5 no-print">
                                  <p className="text-[11px] font-semibold text-emerald-900">
                                    Click a quick comment to insert into {category.title}:
                                  </p>
                                  <div className="flex flex-wrap gap-1.5">
                                    {RATING_COMMENT_PRESETS[category.id]?.map((preset, idx) => (
                                      <button
                                        key={idx}
                                        type="button"
                                        onClick={() => appendCommentPreset(category.id, preset)}
                                        className="px-2.5 py-1 bg-white hover:bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-lg text-[11px] font-medium text-left transition-colors cursor-pointer"
                                      >
                                        + {preset}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {isReadOnly ? (
                                <div className="p-2.5 bg-white border border-slate-200 rounded-lg text-xs sm:text-sm text-slate-700 italic">
                                  {currentCategoryComment || 'No specific rating remarks recorded for this category.'}
                                </div>
                              ) : (
                                <textarea
                                  value={currentCategoryComment}
                                  onChange={(e) =>
                                    onRatingCommentChange &&
                                    onRatingCommentChange(category.id, e.target.value)
                                  }
                                  rows={2}
                                  placeholder={`Enter rating remarks, accomplishments, or specific observations for ${category.title}...`}
                                  className="w-full p-2.5 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:ring-2 focus:ring-emerald-600 outline-none bg-white resize-y"
                                />
                              )}
                            </div>
                          </td>
                        </tr>
                      </React.Fragment>
                    );
                  })}

                  {/* Overall Rating Row */}
                  <tr className="bg-emerald-900 text-white font-black text-sm sm:text-base border-t-2 border-emerald-950">
                    <td className="py-3.5 px-4 text-right uppercase tracking-wider">
                      Total Rating OVERALL RATING:
                    </td>
                    <td colSpan={6} className="py-3.5 px-4 text-left border-l border-emerald-800">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="text-xl sm:text-2xl font-black text-amber-300 font-mono">
                          {overallRating.toFixed(2)} / 5.00
                        </span>
                        <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-white/10 text-white border border-white/20">
                          {Math.round((overallRating / 5) * 100)}% • {grade}
                        </span>
                        <span className="text-xs font-normal text-emerald-200">
                          ({gradeInfo.label})
                        </span>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Comments/Suggestions Box matching official document */}
            <div className="border border-slate-300 rounded-xl p-4 bg-white space-y-2">
              <h4 className="font-extrabold text-slate-900 text-xs sm:text-sm uppercase tracking-wide">
                Comments / Suggestions:
              </h4>
              {isReadOnly ? (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs sm:text-sm text-slate-800 min-h-[70px] whitespace-pre-wrap">
                  {commentsSuggestions || 'No general comments or suggestions recorded.'}
                </div>
              ) : (
                <textarea
                  value={commentsSuggestions}
                  onChange={(e) =>
                    onCommentsSuggestionsChange && onCommentsSuggestionsChange(e.target.value)
                  }
                  rows={3}
                  placeholder="Enter overall comments, recommendations for improvement, professional growth, or employment readiness..."
                  className="w-full p-3 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:ring-2 focus:ring-emerald-600 outline-none bg-slate-50/50 resize-y"
                />
              )}
            </div>

            {/* Official Signatures Section */}
            <div className="pt-8 pb-4 grid grid-cols-1 sm:grid-cols-2 gap-10 text-xs sm:text-sm">
              {/* 1. HTE Supervisor */}
              <div className="text-center">
                <div className="h-14 border-b-2 border-slate-900 flex items-end justify-center pb-1">
                  <span className="font-black text-slate-900 uppercase text-sm sm:text-base tracking-wider">
                    {supervisorName}
                  </span>
                </div>
                <p className="font-extrabold text-slate-900 mt-1 uppercase text-xs">
                  Supervisor's Signature over Printed Name
                </p>
                <p className="text-slate-500 text-[11px]">Date: {displayDate}</p>
              </div>

              {/* 2. CHMSU OJT Instructor / Coordinator */}
              <div className="text-center">
                <div className="h-14 border-b-2 border-slate-900 flex items-end justify-center pb-1">
                  <span className="font-black text-slate-900 uppercase text-sm sm:text-base tracking-wider">
                    {instructorName}
                  </span>
                </div>
                <p className="font-extrabold text-slate-900 mt-1 uppercase text-xs">
                  CHMSU OJT Coordinator / Instructor
                </p>
                <p className="text-slate-500 text-[11px]">
                  {status === 'reviewed_by_instructor' ? 'Verified & Endorsed' : 'Noted by Office of OJT'}
                </p>
              </div>
            </div>

            {/* Official University Footer */}
            <div className="border-t-2 border-emerald-800/60 pt-4 text-center space-y-1 text-[10px] sm:text-[11px] text-slate-600">
              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 font-semibold">
                <span>college.computerstudies@chmsu.edu.ph</span>
                <span>•</span>
                <span>(034) 434 8148</span>
                <span>•</span>
                <span>chmsu.edu.ph</span>
              </div>
              <div className="font-black text-emerald-800 uppercase tracking-widest text-xs">
                GREEN CHMSU EXCELSIOR!
              </div>
              <div className="text-[9px] text-slate-500 tracking-tight">
                Excellence • Compassion • Environmentalism • Love of Country • Social Responsibility • Integrity • Openness • Resilience
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          PAGE 2: ON-THE-JOB TRAINING EVALUATION FORM (QUESTIONNAIRE & DETAILS)
          ───────────────────────────────────────────────────────────────────────────── */}
      {(activeTab === 'page2' || activeTab === 'both') && (
        <div
          id="chmsu-evaluation-page-2"
          className="bg-white rounded-2xl shadow-xl border border-slate-300 overflow-hidden print:border-0 print:shadow-none print:m-0 print:p-0"
        >
          <div className="p-6 sm:p-10 space-y-6 print:p-4 print:space-y-4">
            {/* Page 2 Institutional Header matching official document */}
            <div className="border-b-2 border-emerald-800/80 pb-5 text-center relative">
              <div className="flex items-center justify-between gap-4">
                {/* Left Logo */}
                <div className="w-20 h-20 shrink-0 flex items-center justify-center">
                  <img
                    src="/chmsu-logo.png"
                    alt="Carlos Hilado Memorial State University Logo"
                    className="w-20 h-20 object-contain drop-shadow-xs"
                    onError={(e) => {
                      (e.currentTarget as HTMLElement).style.display = 'none';
                    }}
                  />
                </div>

                {/* Center Text Header */}
                <div className="flex-1 px-2">
                  <h1 className="font-serif font-black text-emerald-900 text-xl sm:text-2xl tracking-wide uppercase leading-tight">
                    Carlos Hilado Memorial State University
                  </h1>
                  <p className="text-[11px] sm:text-xs font-semibold text-slate-600 tracking-tight mt-0.5">
                    Alijis Campus • Binalbagan Campus • Fortune Towne Campus • Talisay (Main) Campus
                  </p>
                  <p className="text-[10px] sm:text-[11px] italic font-medium text-emerald-800 mt-0.5">
                    A leading GREEN institution of higher learning in the global community by 2030
                  </p>
                  <p className="text-[9px] sm:text-[10px] text-slate-500 font-medium">
                    (Good governance, Research-oriented, Extension-driven, Education for Sustainable Development, and Nation-building)
                  </p>

                  <div className="mt-3 pt-2 border-t border-slate-200">
                    <h2 className="font-sans font-extrabold text-slate-800 text-sm sm:text-base tracking-wide uppercase">
                      College of Computer Studies
                    </h2>
                    <h3 className="font-sans font-black text-emerald-950 text-base sm:text-lg tracking-wider uppercase mt-0.5">
                      ON-THE-JOB TRAINING EVALUATION FORM
                    </h3>
                  </div>
                </div>

                {/* Right Seal / Badge */}
                <div className="w-20 h-20 shrink-0 flex flex-col items-center justify-center text-center">
                  <div className="w-16 h-16 rounded-full border-2 border-emerald-700 bg-emerald-50/50 flex flex-col items-center justify-center p-1 text-emerald-900">
                    <span className="text-[9px] font-black uppercase leading-tight">GREEN</span>
                    <span className="text-[9px] font-black uppercase leading-tight text-amber-700">CHMSU</span>
                    <span className="text-[8px] font-bold text-emerald-800">CCS</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Trainee & Training Details Upper Box */}
            <div className="border border-slate-300 rounded-xl p-4 bg-slate-50/70 print:bg-white text-xs sm:text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-8">
                {/* Name of Trainee */}
                <div className="flex items-baseline gap-2">
                  <span className="font-extrabold text-slate-700 w-36 shrink-0">Name of Trainee:</span>
                  <span className="font-black text-slate-950 border-b border-dotted border-slate-500 flex-1 pb-0.5 uppercase tracking-wide">
                    {trainee.name}
                  </span>
                </div>

                {/* Training Company */}
                <div className="flex items-baseline gap-2">
                  <span className="font-extrabold text-slate-700 w-36 shrink-0">Training Company:</span>
                  <span className="font-bold text-slate-900 border-b border-dotted border-slate-500 flex-1 pb-0.5">
                    {companyName || trainee.companyName || 'Host Training Establishment'}
                  </span>
                </div>

                {/* Company Address */}
                <div className="flex items-baseline gap-2 sm:col-span-2">
                  <span className="font-extrabold text-slate-700 w-36 shrink-0">Company Address:</span>
                  {isReadOnly ? (
                    <span className="text-slate-900 border-b border-dotted border-slate-500 flex-1 pb-0.5">
                      {localQuestionnaire.companyAddress || trainee.department || 'Talisay / Bacolod, Negros Occidental'}
                    </span>
                  ) : (
                    <input
                      type="text"
                      value={localQuestionnaire.companyAddress || ''}
                      onChange={(e) => updateQuestionnaireField('companyAddress', e.target.value)}
                      placeholder="e.g. Talisay City, Negros Occidental"
                      className="border-b border-slate-400 focus:border-emerald-600 outline-none flex-1 pb-0.5 bg-transparent font-medium text-slate-900"
                    />
                  )}
                </div>

                {/* Contact Person */}
                <div className="flex items-baseline gap-2">
                  <span className="font-extrabold text-slate-700 w-36 shrink-0">Contact Person:</span>
                  {isReadOnly ? (
                    <span className="text-slate-900 border-b border-dotted border-slate-500 flex-1 pb-0.5">
                      {localQuestionnaire.contactPerson || supervisorName || 'HTE Supervisor'}
                    </span>
                  ) : (
                    <input
                      type="text"
                      value={localQuestionnaire.contactPerson || ''}
                      onChange={(e) => updateQuestionnaireField('contactPerson', e.target.value)}
                      placeholder={supervisorName || 'Contact person / Supervisor'}
                      className="border-b border-slate-400 focus:border-emerald-600 outline-none flex-1 pb-0.5 bg-transparent font-medium text-slate-900"
                    />
                  )}
                </div>

                {/* Inclusive Date of Training */}
                <div className="flex items-baseline gap-2">
                  <span className="font-extrabold text-slate-700 w-44 shrink-0">Inclusive Date of Training:</span>
                  <div className="flex items-center gap-1.5 flex-1 border-b border-dotted border-slate-500 pb-0.5">
                    <span className="text-slate-500 text-xs">From:</span>
                    {isReadOnly ? (
                      <span className="font-semibold text-slate-900">
                        {localQuestionnaire.trainingDateFrom || 'Start of OJT'}
                      </span>
                    ) : (
                      <input
                        type="text"
                        value={localQuestionnaire.trainingDateFrom || ''}
                        onChange={(e) => updateQuestionnaireField('trainingDateFrom', e.target.value)}
                        placeholder="e.g. Jan 15, 2026"
                        className="w-24 sm:w-28 text-xs border-b border-slate-300 focus:border-emerald-600 outline-none bg-transparent"
                      />
                    )}
                    <span className="text-slate-500 text-xs ml-1">to:</span>
                    {isReadOnly ? (
                      <span className="font-semibold text-slate-900">
                        {localQuestionnaire.trainingDateTo || 'End of OJT'}
                      </span>
                    ) : (
                      <input
                        type="text"
                        value={localQuestionnaire.trainingDateTo || ''}
                        onChange={(e) => updateQuestionnaireField('trainingDateTo', e.target.value)}
                        placeholder="e.g. May 30, 2026"
                        className="w-24 sm:w-28 text-xs border-b border-slate-300 focus:border-emerald-600 outline-none bg-transparent"
                      />
                    )}
                  </div>
                </div>

                {/* Date of Evaluation */}
                <div className="flex items-baseline gap-2">
                  <span className="font-extrabold text-slate-700 w-36 shrink-0">Date of Evaluation:</span>
                  {isReadOnly ? (
                    <span className="text-slate-900 border-b border-dotted border-slate-500 flex-1 pb-0.5">
                      {localQuestionnaire.dateOfEvaluation || displayDate}
                    </span>
                  ) : (
                    <input
                      type="text"
                      value={localQuestionnaire.dateOfEvaluation || ''}
                      onChange={(e) => updateQuestionnaireField('dateOfEvaluation', e.target.value)}
                      placeholder={displayDate}
                      className="border-b border-slate-400 focus:border-emerald-600 outline-none flex-1 pb-0.5 bg-transparent font-medium text-slate-900"
                    />
                  )}
                </div>

                {/* Date of Last Evaluation */}
                <div className="flex items-baseline gap-2">
                  <span className="font-extrabold text-slate-700 w-44 shrink-0">Date of Last Evaluation:</span>
                  {isReadOnly ? (
                    <span className="text-slate-900 border-b border-dotted border-slate-500 flex-1 pb-0.5">
                      {localQuestionnaire.dateOfLastEvaluation || 'N/A'}
                    </span>
                  ) : (
                    <input
                      type="text"
                      value={localQuestionnaire.dateOfLastEvaluation || ''}
                      onChange={(e) => updateQuestionnaireField('dateOfLastEvaluation', e.target.value)}
                      placeholder="e.g. April 12, 2026"
                      className="border-b border-slate-400 focus:border-emerald-600 outline-none flex-1 pb-0.5 bg-transparent font-medium text-slate-900"
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Employability & Compensation Box matching official document */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border border-slate-300 rounded-xl p-4 bg-white text-xs sm:text-sm">
              {/* Left Column: Employability Checkboxes */}
              <div className="space-y-2.5 border-b md:border-b-0 md:border-r border-slate-200 pb-3 md:pb-0 md:pr-4">
                <span className="font-extrabold text-slate-900 block uppercase tracking-wide">
                  Employability:
                </span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {EMPLOYABILITY_OPTIONS.map((opt) => {
                    const isSelected = (localQuestionnaire.employabilityStatus || 'OJT Trainee') === opt;
                    return (
                      <label
                        key={opt}
                        className={`flex items-center gap-2 p-1.5 rounded-lg transition-colors select-none ${
                          isSelected ? 'bg-emerald-50 text-emerald-950 font-bold' : 'text-slate-700'
                        } ${isReadOnly ? '' : 'cursor-pointer hover:bg-slate-50'}`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={isReadOnly}
                          onChange={() => !isReadOnly && updateQuestionnaireField('employabilityStatus', opt)}
                          className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                        />
                        <span>{opt}</span>
                      </label>
                    );
                  })}
                </div>

                <div className="pt-2 flex items-baseline gap-2">
                  <span className="text-[11px] font-semibold text-slate-600 shrink-0">
                    If employed, specify the name of the company:
                  </span>
                  {isReadOnly ? (
                    <span className="border-b border-dotted border-slate-400 flex-1 font-semibold text-slate-800 pb-0.5">
                      {localQuestionnaire.employedCompanyName || '—'}
                    </span>
                  ) : (
                    <input
                      type="text"
                      value={localQuestionnaire.employedCompanyName || ''}
                      onChange={(e) => updateQuestionnaireField('employedCompanyName', e.target.value)}
                      placeholder="Specify company name if absorbed"
                      className="border-b border-slate-300 focus:border-emerald-600 outline-none flex-1 pb-0.5 text-xs bg-transparent text-slate-900 font-medium"
                    />
                  )}
                </div>
              </div>

              {/* Right Column: Allowance/Salary & Telephone */}
              <div className="space-y-4 pl-0 md:pl-2 flex flex-col justify-center">
                <div className="flex items-baseline gap-2">
                  <span className="font-extrabold text-slate-800 w-32 shrink-0">Allowance/Salary:</span>
                  <span className="font-bold text-slate-600">Php</span>
                  {isReadOnly ? (
                    <span className="border-b border-dotted border-slate-400 flex-1 font-semibold text-slate-900 pb-0.5">
                      {localQuestionnaire.allowanceSalary || 'None / Stipend'}
                    </span>
                  ) : (
                    <input
                      type="text"
                      value={localQuestionnaire.allowanceSalary || ''}
                      onChange={(e) => updateQuestionnaireField('allowanceSalary', e.target.value)}
                      placeholder="e.g. 5,000 / month or None"
                      className="border-b border-slate-300 focus:border-emerald-600 outline-none flex-1 pb-0.5 font-medium text-slate-900 bg-transparent"
                    />
                  )}
                </div>

                <div className="flex items-baseline gap-2">
                  <span className="font-extrabold text-slate-800 w-32 shrink-0">Telephone No:</span>
                  {isReadOnly ? (
                    <span className="border-b border-dotted border-slate-400 flex-1 font-semibold text-slate-900 pb-0.5">
                      {localQuestionnaire.telephoneNo || trainee.phone || 'N/A'}
                    </span>
                  ) : (
                    <input
                      type="text"
                      value={localQuestionnaire.telephoneNo || ''}
                      onChange={(e) => updateQuestionnaireField('telephoneNo', e.target.value)}
                      placeholder={trainee.phone || 'e.g. (034) 434-8148'}
                      className="border-b border-slate-300 focus:border-emerald-600 outline-none flex-1 pb-0.5 font-medium text-slate-900 bg-transparent"
                    />
                  )}
                </div>
              </div>
            </div>

            {/* ASSIGNMENT Section */}
            <div className="border border-slate-300 rounded-xl p-4 bg-slate-50/50 space-y-2 text-xs sm:text-sm">
              <h4 className="font-black text-slate-900 uppercase tracking-wide text-xs">ASSIGNMENT</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="flex items-baseline gap-2">
                  <span className="font-extrabold text-slate-700 shrink-0">DEPARTMENT:</span>
                  {isReadOnly ? (
                    <span className="border-b border-dotted border-slate-400 flex-1 font-semibold text-slate-900 pb-0.5 uppercase">
                      {localQuestionnaire.department || trainee.department || 'IT Department'}
                    </span>
                  ) : (
                    <input
                      type="text"
                      value={localQuestionnaire.department || ''}
                      onChange={(e) => updateQuestionnaireField('department', e.target.value)}
                      placeholder={trainee.department || 'e.g. IT Department / MIS'}
                      className="border-b border-slate-300 focus:border-emerald-600 outline-none flex-1 pb-0.5 font-medium text-slate-900 bg-transparent uppercase"
                    />
                  )}
                </div>

                <div className="flex items-baseline gap-2">
                  <span className="font-extrabold text-slate-700 shrink-0">POSITION:</span>
                  <span className="font-black text-emerald-950 border-b border-dotted border-slate-400 flex-1 pb-0.5 uppercase">
                    {localQuestionnaire.position || 'ON - THE - JOB TRAINEE'}
                  </span>
                </div>

                <div className="flex items-baseline gap-2">
                  <span className="font-extrabold text-slate-700 shrink-0">OTHER DEPT. ASSIGNED:</span>
                  {isReadOnly ? (
                    <span className="border-b border-dotted border-slate-400 flex-1 font-semibold text-slate-900 pb-0.5">
                      {localQuestionnaire.otherDeptAssigned || 'None'}
                    </span>
                  ) : (
                    <input
                      type="text"
                      value={localQuestionnaire.otherDeptAssigned || ''}
                      onChange={(e) => updateQuestionnaireField('otherDeptAssigned', e.target.value)}
                      placeholder="None / specify"
                      className="border-b border-slate-300 focus:border-emerald-600 outline-none flex-1 pb-0.5 font-medium text-slate-900 bg-transparent"
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Official 9-Question Questionnaire Table */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-black text-slate-900 uppercase tracking-wider text-sm sm:text-base border-l-4 border-emerald-700 pl-3">
                  QUESTIONNAIRE
                </h3>
                {!isReadOnly && (
                  <span className="text-xs text-slate-500 italic no-print">
                    Click 'Suggestions' to insert helpful responses quickly
                  </span>
                )}
              </div>

              <div className="border-2 border-slate-800 rounded-xl overflow-hidden shadow-xs">
                <table className="w-full text-xs sm:text-sm border-collapse">
                  <tbody>
                    {QUESTIONNAIRE_PROMPTS.map((q) => {
                      const currentAnswer = (localQuestionnaire[q.key] as string) || '';
                      const isOpenPresets = activeQuestionPreset === q.key;

                      return (
                        <tr
                          key={q.key}
                          className="border-b border-slate-300 hover:bg-slate-50/50 transition-colors"
                        >
                          {/* Question column */}
                          <td className="w-[36%] sm:w-[32%] py-3 px-3.5 align-top bg-slate-50/70 border-r border-slate-300 font-bold text-slate-800">
                            <div className="flex items-start gap-1.5">
                              <span className="text-emerald-800 font-black shrink-0">{q.number}.</span>
                              <span>{q.prompt}</span>
                            </div>
                            {!isReadOnly && (
                              <button
                                type="button"
                                onClick={() => setActiveQuestionPreset(isOpenPresets ? null : q.key)}
                                className="mt-2 text-[11px] font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-1 cursor-pointer no-print"
                              >
                                <Sparkles size={12} />
                                <span>Suggestions</span>
                              </button>
                            )}
                          </td>

                          {/* Answer column */}
                          <td className="py-2.5 px-3.5 align-top bg-white">
                            {!isReadOnly && isOpenPresets && (
                              <div className="mb-2 p-2 bg-emerald-50 border border-emerald-200 rounded-lg space-y-1 no-print">
                                <p className="text-[10px] font-bold text-emerald-900 uppercase">
                                  Insert response suggestion:
                                </p>
                                <div className="space-y-1">
                                  {q.suggestions.map((sug, sIdx) => (
                                    <button
                                      key={sIdx}
                                      type="button"
                                      onClick={() => {
                                        const cur = currentAnswer.trim();
                                        const next = cur ? `${cur} ${sug}` : sug;
                                        updateQuestionnaireField(q.key, next);
                                      }}
                                      className="w-full text-left text-[11px] p-1.5 bg-white hover:bg-emerald-100 rounded border border-emerald-200 text-slate-800 transition-colors cursor-pointer"
                                    >
                                      + {sug}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}

                            {isReadOnly ? (
                              <div className="min-h-[42px] py-1 text-slate-800 whitespace-pre-wrap leading-relaxed italic text-xs sm:text-sm">
                                {currentAnswer || (
                                  <span className="text-slate-400 not-italic">No response recorded</span>
                                )}
                              </div>
                            ) : (
                              <textarea
                                rows={2}
                                value={currentAnswer}
                                onChange={(e) => updateQuestionnaireField(q.key, e.target.value)}
                                placeholder={q.placeholder}
                                className="w-full p-2 border border-slate-300 rounded-lg text-xs sm:text-sm text-slate-900 focus:ring-2 focus:ring-emerald-600 outline-none bg-slate-50/30 resize-y"
                              />
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Page 2 Official Signatures Section */}
            <div className="pt-6 pb-2 grid grid-cols-1 sm:grid-cols-2 gap-8 text-xs sm:text-sm">
              <div className="text-center">
                <div className="h-12 border-b-2 border-slate-900 flex items-end justify-center pb-1">
                  <span className="font-black text-slate-900 uppercase text-sm tracking-wider">
                    {trainee.name}
                  </span>
                </div>
                <p className="font-extrabold text-slate-900 mt-1 uppercase text-xs">
                  OJT Trainee's Signature over Printed Name
                </p>
                <p className="text-slate-500 text-[11px]">Date: {displayDate}</p>
              </div>

              <div className="text-center">
                <div className="h-12 border-b-2 border-slate-900 flex items-end justify-center pb-1">
                  <span className="font-black text-slate-900 uppercase text-sm tracking-wider">
                    {supervisorName}
                  </span>
                </div>
                <p className="font-extrabold text-slate-900 mt-1 uppercase text-xs">
                  Immediate Supervisor / HTE Representative
                </p>
                <p className="text-slate-500 text-[11px]">Date: {displayDate}</p>
              </div>
            </div>

            {/* Page 2 University Footer */}
            <div className="border-t-2 border-emerald-800/60 pt-4 text-center space-y-1 text-[10px] sm:text-[11px] text-slate-600">
              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 font-semibold">
                <span>college.computerstudies@chmsu.edu.ph</span>
                <span>•</span>
                <span>(034) 434 8148</span>
                <span>•</span>
                <span>chmsu.edu.ph</span>
              </div>
              <div className="font-black text-emerald-800 uppercase tracking-widest text-xs">
                GREEN CHMSU EXCELSIOR!
              </div>
              <div className="text-[9px] text-slate-500 tracking-tight">
                Excellence • Compassion • Environmentalism • Love of Country • Social Responsibility • Integrity • Openness • Resilience
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
