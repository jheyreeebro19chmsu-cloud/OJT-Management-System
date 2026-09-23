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
  hideTopBar?: boolean;
  onRatingChange?: (criterionId: string, score: number) => void;
  onRatingCommentChange?: (categoryId: string, comment: string) => void;
  onCommentsSuggestionsChange?: (text: string) => void;
  onQuestionnaireChange?: (questionnaire: EvaluationQuestionnaire) => void;
  onSaveDraft?: () => void;
  onSubmitFinal?: () => void;
  onClose?: () => void;
  onMarkDoneViewed?: () => void;
  onPassToHte?: () => void;
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
    placeholder: 'Describe complex technical bottlenecks, time constraints, or unexpected tasks...',
    suggestions: [
      'Meeting strict deadlines while diagnosing and fixing critical legacy database bugs.',
      'Learning and adopting a completely new backend framework within the first two weeks.',
      'Managing multiple concurrent assignments while maintaining high quality standards.',
      'Adapting to sudden changes in client specifications and urgent project requirements.',
    ],
  },
  {
    key: 'q6_howOvercameChallenge',
    number: 6,
    prompt: 'How did you overcome this challenge or situation?',
    placeholder: 'Steps taken, problem solving strategies, seeking mentorship...',
    suggestions: [
      'Consulted with senior team members and conducted thorough technical research.',
      'Broke down complex problem statements into structured, manageable sprints.',
      'Applied systematic debugging and documented findings to resolve bottlenecks.',
      'Practiced disciplined time management and prioritized critical system components.',
    ],
  },
  {
    key: 'q7_whatLearnedFromExperience',
    number: 7,
    prompt: 'What did you learn from your overall training experience?',
    placeholder: 'Key takeaways, technical mastery, professional development...',
    suggestions: [
      'Mastered practical full-stack deployment, debugging, and database management.',
      'Developed confidence in communicating technical concepts and corporate workflows.',
      'Learned the importance of clean code, automated testing, and team documentation.',
      'Gained deep appreciation for workplace ethics, agility, and client collaboration.',
    ],
  },
  {
    key: 'q8_isQualifiedLinkage',
    number: 8,
    prompt: 'Is this training establishment well-qualified for student OJT placement?',
    placeholder: 'Assessment of facilities, supervision quality, and learning environment...',
    suggestions: [
      'Yes, highly recommended for exceptional mentorship and real industry technology stack.',
      'Yes, provided excellent hands-on projects, supportive staff, and modern infrastructure.',
      'Yes, provided a safe, encouraging, and highly productive learning environment.',
      'Yes, recommended as a premier Host Training Establishment for CHMSU students.',
    ],
  },
  {
    key: 'q9_ojtSuggestionsRecommendations',
    number: 9,
    prompt: 'Other comments, suggestions, and recommendations:',
    placeholder: 'Any final remarks, gratitude to university/HTE, or concluding insights...',
    suggestions: [
      'Sincere gratitude to the management, supervisors, and colleagues for their warm guidance.',
      'Thankful to CHMSU CCS faculty for preparing us with strong foundational principles.',
      'Highly recommend this Host Training Establishment to future batches of CHMSU OJT students.',
      'Grateful for the opportunity to contribute meaningfully to production projects.',
    ],
  },
];

export function CHMSUEvaluationSheet({
  trainee,
  companyName,
  supervisorName,
  instructorName = 'CHMSU OJT Coordinator',
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
  hideTopBar = false,
  onRatingChange,
  onRatingCommentChange,
  onCommentsSuggestionsChange,
  onQuestionnaireChange,
  onSaveDraft,
  onSubmitFinal,
  onClose,
  onMarkDoneViewed,
  onPassToHte,
}: CHMSUEvaluationSheetProps) {
  const [activeTab, setActiveTab] = useState<'page1' | 'page2' | 'both'>(
    role === 'trainee' ? 'page2' : initialPageTab
  );
  const [activePresetCategory, setActivePresetCategory] = useState<string | null>(null);
  const [activeQuestionPreset, setActiveQuestionPreset] = useState<string | null>(null);
  const [showPrintMenu, setShowPrintMenu] = useState(false);

  // Sync tab if role is trainee
  useEffect(() => {
    if (role === 'trainee') {
      setActiveTab('page2');
    }
  }, [role]);

  // Local state for questionnaire fields
  const [localQuestionnaire, setLocalQuestionnaire] = useState<EvaluationQuestionnaire>(() => {
    return (
      questionnaire || {
        companyAddress: '',
        contactPerson: supervisorName || '',
        trainingDateFrom: '',
        trainingDateTo: '',
        dateOfEvaluation: evaluationDate || new Date().toISOString().split('T')[0],
        dateOfLastEvaluation: '',
        employabilityStatus: 'OJT Trainee',
        employedCompanyName: '',
        allowanceSalary: '',
        telephoneNo: trainee.phone || '',
        department: trainee.department || 'IT Department',
        position: 'ON - THE - JOB TRAINEE',
        otherDeptAssigned: '',
      }
    );
  });

  useEffect(() => {
    if (questionnaire) {
      setLocalQuestionnaire(questionnaire);
    }
  }, [questionnaire]);

  const updateQuestionnaireField = (field: keyof EvaluationQuestionnaire, value: any) => {
    const updated = { ...localQuestionnaire, [field]: value };
    setLocalQuestionnaire(updated);
    if (onQuestionnaireChange) {
      onQuestionnaireChange(updated);
    }
  };

  const displayDate = evaluationDate
    ? new Date(evaluationDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

  // Page 1 Criteria & Ratings:
  // ONLY editable by HTE when not in read-only mode. Trainees & Instructors can NEVER edit Page 1 scores.
  const isCriteriaReadOnly = role === 'trainee' || role === 'instructor' || isReadOnly;

  // Page 2 Questionnaire (Student Practicum Feedback):
  // ONLY editable by Trainee so student's own reflection words cannot be overridden.
  // Read-only for Instructor and HTE to view trainee answers.
  const isQuestionnaireReadOnly = role === 'trainee' ? false : true;

  // Calculate Subtotals per Category
  const categoryStats = React.useMemo(() => {
    const stats: Record<string, { avg: number; total: number; count: number }> = {};
    CHMSU_EVALUATION_CATEGORIES.forEach((category) => {
      let sum = 0;
      let validCount = 0;
      category.items.forEach((item) => {
        const score = ratings[item.id] ?? 4;
        if (score > 0) {
          sum += score;
        }
      });
      const avg = validCount > 0 ? sum / validCount : 0;
      stats[category.id] = { avg, total: sum, count: validCount };
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

  const executePrint = (tab: 'page1' | 'page2' | 'both') => {
    setActiveTab(tab);
    setShowPrintMenu(false);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  return (
    <div className="eval-sheet-container space-y-6 max-w-5xl mx-auto pb-12 font-sans text-slate-800">
      {/* Top Action Bar (Hidden when printing or when hideTopBar is true) */}
      {!hideTopBar && (
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
                  Reviewed &amp; Approved by Instructor
                </span>
              ) : status === 'submitted_to_instructor' ? (
                <span className="px-2.5 py-1 rounded-full text-xs font-extrabold bg-indigo-100 text-indigo-800 border border-indigo-200 flex items-center gap-1">
                  <Award size={13} />
                  Ratings Submitted by HTE (Ready to Review)
                </span>
              ) : status === 'passed_to_hte' ? (
                <span className="px-2.5 py-1 rounded-full text-xs font-extrabold bg-sky-100 text-sky-800 border border-sky-200 flex items-center gap-1">
                  <Building2 size={13} />
                  Passed to HTE (Awaiting Ratings)
                </span>
              ) : status === 'submitted_by_trainee' ? (
                <span className="px-2.5 py-1 rounded-full text-xs font-extrabold bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
                  <Sparkles size={13} />
                  Questionnaire Submitted by Trainee
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded-full text-xs font-extrabold bg-slate-100 text-slate-700 border border-slate-200">
                  Draft Mode
                </span>
              )}
            </div>
          </div>

          {/* Tab Navigation Buttons - Only for HTE & Instructor; Trainees are locked to Questionnaire */}
          {role !== 'trainee' ? (
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
          ) : (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-900 border border-emerald-200 rounded-xl text-xs font-bold shadow-xs">
              <FileSpreadsheet size={15} className="text-emerald-700" />
              <span>OJT Trainee Questionnaire Form</span>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {role === 'instructor' && (status === 'submitted_by_trainee' || status === 'draft' || !status) && onPassToHte && (
              <button
                type="button"
                onClick={onPassToHte}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
                title="Pass trainee questionnaire to HTE Supervisor for performance rating"
              >
                <Building2 size={15} />
                <span>Pass to HTE for Ratings</span>
              </button>
            )}

            {role === 'instructor' && (status === 'submitted_to_instructor' || status === 'final') && onMarkDoneViewed && (
              <button
                type="button"
                onClick={onMarkDoneViewed}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
                title="Acknowledge and mark evaluation as Done Viewed"
              >
                <CheckCircle2 size={15} />
                <span>Done Viewed &amp; Approved</span>
              </button>
            )}

            {/* Quick Print: Trainees print questionnaire directly; HTE/Instructors get menu */}
            {role === 'trainee' ? (
              <button
                type="button"
                onClick={() => executePrint('page2')}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
                title="Print Official Questionnaire"
              >
                <Printer size={15} />
                <span>Print Questionnaire</span>
              </button>
            ) : (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowPrintMenu(!showPrintMenu)}
                  className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
                  title="Print Official Document"
                >
                  <Printer size={15} />
                  <span>Print Official Form</span>
                  <ChevronDown size={14} className={`transition-transform ${showPrintMenu ? 'rotate-180' : ''}`} />
                </button>

                {showPrintMenu && (
                  <div className="absolute right-0 top-full mt-1 w-60 bg-white rounded-2xl shadow-xl border border-slate-200 p-2 z-50 space-y-1 text-xs">
                    <button
                      type="button"
                      onClick={() => executePrint('both')}
                      className="w-full text-left px-3 py-2 hover:bg-emerald-50 rounded-xl font-bold text-slate-800 hover:text-emerald-900 flex items-center gap-2 transition-colors cursor-pointer"
                    >
                      <Layers size={15} className="text-emerald-700" />
                      <div>
                        <div>Print Full Document</div>
                        <span className="text-[10px] text-slate-400 font-normal">Page 1 &amp; Page 2 (2 Sheets)</span>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => executePrint('page1')}
                      className="w-full text-left px-3 py-2 hover:bg-slate-100 rounded-xl font-bold text-slate-800 flex items-center gap-2 transition-colors cursor-pointer"
                    >
                      <FileText size={15} className="text-slate-600" />
                      <div>
                        <div>Print Page 1 Only</div>
                        <span className="text-[10px] text-slate-400 font-normal">Criteria Evaluation Report (1 Sheet)</span>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => executePrint('page2')}
                      className="w-full text-left px-3 py-2 hover:bg-slate-100 rounded-xl font-bold text-slate-800 flex items-center gap-2 transition-colors cursor-pointer"
                    >
                      <FileSpreadsheet size={15} className="text-slate-600" />
                      <div>
                        <div>Print Page 2 Only</div>
                        <span className="text-[10px] text-slate-400 font-normal">9-Question Questionnaire (1 Sheet)</span>
                      </div>
                    </button>
                  </div>
                )}
              </div>
            )}

            {role === 'trainee' && onSaveDraft && (
              <button
                type="button"
                onClick={onSaveDraft}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Save size={15} />
                <span>Save Questionnaire Answers</span>
              </button>
            )}

            {role !== 'trainee' && !isReadOnly && onSaveDraft && (
              <button
                type="button"
                onClick={onSaveDraft}
                className="px-4 py-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Save size={15} />
                <span>Save Draft</span>
              </button>
            )}

            {role !== 'trainee' && !isReadOnly && onSubmitFinal && (
              <button
                type="button"
                onClick={onSubmitFinal}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 shadow-md shadow-blue-600/30 cursor-pointer"
              >
                <Check size={15} />
                <span>{role === 'hte' ? 'Submit Ratings & Pass to Instructor' : 'Finalize Evaluation'}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          PAGE 1: ON-THE-JOB TRAINING EVALUATION REPORT
          (Strictly for HTE & Instructor; Trainees are questionnaire-only)
          ───────────────────────────────────────────────────────────────────────────── */}
      {role !== 'trainee' && (activeTab === 'page1' || activeTab === 'both') && (
        <div
          id="chmsu-evaluation-page-1"
          className={`eval-page eval-page-1 bg-white rounded-2xl shadow-xl border border-slate-300 overflow-hidden print:border-none print:shadow-none print:m-0 print:p-0 ${
            activeTab === 'both' ? 'print:page-break-after-always' : ''
          }`}
        >
          <div className="p-6 sm:p-8 space-y-4 print:p-0 print:space-y-1">
            {/* Institutional Header matching official CHMSU document */}
            <div className="border-b-2 border-emerald-800 pb-3 print:pb-1 text-center relative">
              <div className="flex items-center justify-between gap-3">
                {/* Left Logo */}
                <div className="w-16 h-16 shrink-0 flex items-center justify-center print:w-10 print:h-10">
                  <img
                    src="/chmsu-logo.png"
                    alt="Carlos Hilado Memorial State University Logo"
                    className="w-16 h-16 object-contain print:w-10 print:h-10"
                    onError={(e) => {
                      (e.currentTarget as HTMLElement).style.display = 'none';
                    }}
                  />
                </div>

                {/* Center Text Header */}
                <div className="flex-1 px-1 text-center">
                  <p className="text-[9px] uppercase tracking-widest text-slate-500 font-bold hidden print:block print:text-[6.5pt] print:leading-tight">
                    Republic of the Philippines
                  </p>
                  <h1 className="font-serif font-black text-emerald-950 text-base sm:text-xl print:text-[11pt] tracking-wide uppercase leading-tight">
                    Carlos Hilado Memorial State University
                  </h1>
                  <p className="text-[10px] sm:text-xs print:text-[7pt] font-semibold text-slate-600 tracking-tight mt-0.5 print:mt-0 print:leading-tight">
                    Alijis Campus • Binalbagan Campus • Fortune Towne Campus • Talisay (Main) Campus
                  </p>
                  <p className="text-[9px] sm:text-[10px] print:text-[6.5pt] italic font-medium text-emerald-800 mt-0.5 print:mt-0 print:leading-tight">
                    A leading GREEN institution of higher learning in the global community by 2030
                  </p>

                  <div className="mt-1.5 pt-1 border-t border-slate-300 print:mt-0.5 print:pt-0.5">
                    <h2 className="font-sans font-black text-slate-900 text-xs sm:text-sm print:text-[8pt] tracking-wide uppercase print:leading-tight">
                      College of Computer Studies
                    </h2>
                    <h3 className="font-sans font-black text-emerald-950 text-sm sm:text-base print:text-[9.5pt] tracking-wider uppercase mt-0.5 print:mt-0 print:leading-tight">
                      ON-THE-JOB TRAINING EVALUATION REPORT
                    </h3>
                  </div>
                </div>

                {/* Right Seal / Badge */}
                <div className="w-16 h-16 shrink-0 flex flex-col items-center justify-center text-center print:w-10 print:h-10">
                  <div className="w-14 h-14 rounded-full border-2 border-emerald-700 bg-emerald-50/50 flex flex-col items-center justify-center p-1 text-emerald-900 print:w-10 print:h-10 print:p-0.5">
                    <span className="text-[8px] print:text-[6.5pt] font-black uppercase leading-tight">GREEN</span>
                    <span className="text-[8px] print:text-[6.5pt] font-black uppercase leading-tight text-amber-700">CHMSU</span>
                    <span className="text-[7.5px] print:text-[6pt] font-bold text-emerald-800">CCS</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Student & HTE Details Table */}
            <div className="border border-slate-300 rounded-xl p-3 bg-slate-50/70 print:bg-white print:border-slate-800 print:p-1 print:rounded-none text-xs print:text-[7.5pt]">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-1.5 print:gap-y-0.5 gap-x-6">
                <div className="flex items-baseline gap-2">
                  <span className="font-black text-slate-800 w-32 shrink-0 print:w-26">Name of Trainee:</span>
                  <span className="font-black text-slate-950 border-b border-dotted border-slate-600 flex-1 pb-0.5 uppercase tracking-wide">
                    {trainee.name}
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="font-black text-slate-800 w-32 shrink-0 print:w-26">Company Name:</span>
                  <span className="font-bold text-slate-900 border-b border-dotted border-slate-600 flex-1 pb-0.5">
                    {companyName || trainee.companyName || 'Host Training Establishment'}
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="font-black text-slate-800 w-32 shrink-0 print:w-26">Course &amp; Section:</span>
                  <span className="font-bold text-slate-900 border-b border-dotted border-slate-600 flex-1 pb-0.5">
                    {trainee.course || 'BSIS 4A'}
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="font-black text-slate-800 w-32 shrink-0 print:w-26">Academic Year:</span>
                  <span className="font-semibold text-slate-900 border-b border-dotted border-slate-600 flex-1 pb-0.5">
                    AY {trainee.academicYear || '2026-2027'}
                  </span>
                </div>
              </div>
            </div>

            {/* Rating Scale Instructions Box */}
            <div className="border border-slate-300 rounded-xl p-2.5 bg-white text-xs print:text-[6.8pt] print:p-0.5 print:border-slate-400 print:rounded-none space-y-1 print:space-y-0">
              <p className="font-bold text-slate-900 print:text-[7pt] print:leading-tight">
                Please rate the Student's overall practicum performance according to the rating scale below:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-0.5 print:gap-y-0 text-[10.5px] print:text-[6.5pt] text-slate-700">
                {CHMSU_RATING_SCALE.map((scale) => (
                  <div key={scale.value} className="flex items-center gap-1.5 leading-tight">
                    <span className="w-5 h-4 print:w-4 print:h-3.5 flex items-center justify-center font-black rounded bg-emerald-100 text-emerald-900 border border-emerald-300 shrink-0 text-[9px] print:text-[6.5pt] print:bg-white print:border-slate-800">
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
            <div className="border-2 border-slate-900 rounded-xl overflow-hidden shadow-xs print:rounded-none">
              <table className="w-full text-xs print:text-[7pt] border-collapse eval-table">
                <thead>
                  <tr className="bg-slate-900 text-white font-extrabold uppercase text-center border-b-2 border-slate-900">
                    <th className="py-2 px-3 print:py-0.5 print:px-1.5 text-left w-[64%] print:w-[70%]">Criteria / Rating</th>
                    <th className="py-2 px-1 print:py-0.5 w-[6%] border-l border-slate-700 print:border-slate-800 text-center">1</th>
                    <th className="py-2 px-1 print:py-0.5 w-[6%] border-l border-slate-700 print:border-slate-800 text-center">2</th>
                    <th className="py-2 px-1 print:py-0.5 w-[6%] border-l border-slate-700 print:border-slate-800 text-center">3</th>
                    <th className="py-2 px-1 print:py-0.5 w-[6%] border-l border-slate-700 print:border-slate-800 text-center">4</th>
                    <th className="py-2 px-1 print:py-0.5 w-[6%] border-l border-slate-700 print:border-slate-800 text-center">5</th>
                    <th className="py-2 px-1 print:py-0.5 w-[6%] border-l border-slate-700 print:border-slate-800 text-center">NA</th>
                  </tr>
                </thead>
                <tbody>
                  {CHMSU_EVALUATION_CATEGORIES.map((category) => {
                    const catStat = categoryStats[category.id] || { avg: 4, total: 20, count: 5 };
                    const currentCategoryComment = ratingComments[category.id] || '';

                    return (
                      <React.Fragment key={category.id}>
                        {/* Category Header Row */}
                        <tr className="bg-emerald-50 print:bg-slate-100 border-t-2 border-b border-emerald-800 print:border-slate-900">
                          <td
                            colSpan={7}
                            className="py-1 px-3 print:py-0.5 print:px-1.5 font-black uppercase tracking-wider text-emerald-950 print:text-slate-900 text-xs print:text-[7pt]"
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
                              className="border-b border-slate-200 print:border-slate-400 hover:bg-slate-50 transition-colors"
                            >
                              <td className="py-1 px-3 print:py-0.5 print:px-1.5 text-slate-800 text-xs print:text-[7pt]">
                                <span className="font-bold text-slate-900 mr-1.5">{item.number}.</span>
                                <span>{item.text}</span>
                              </td>

                              {/* 1, 2, 3, 4, 5, NA Cells */}
                              {[1, 2, 3, 4, 5, 0].map((val) => {
                                const isChecked = currentScore === val;

                                return (
                                  <td
                                    key={val}
                                    className="py-1 px-1 print:py-0.5 text-center border-l border-slate-200 print:border-slate-400 align-middle"
                                  >
                                    {/* Screen View */}
                                    <div className="no-print flex items-center justify-center">
                                      {isCriteriaReadOnly ? (
                                        isChecked ? (
                                          <span className="w-5 h-5 rounded-full bg-emerald-700 text-white flex items-center justify-center font-bold text-[11px]">
                                            ✓
                                          </span>
                                        ) : (
                                          <span className="text-slate-300 text-xs">•</span>
                                        )
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => onRatingChange && onRatingChange(item.id, val)}
                                          className={`w-6 h-6 rounded-lg font-bold text-xs transition-all flex items-center justify-center cursor-pointer ${
                                            isChecked
                                              ? 'bg-emerald-600 text-white shadow-xs ring-2 ring-emerald-400 scale-105'
                                              : 'hover:bg-slate-100 text-slate-600 hover:text-slate-900'
                                          }`}
                                          title={`Rate ${val === 0 ? 'NA' : val}`}
                                        >
                                          {isChecked ? '✓' : val === 0 ? 'NA' : val}
                                        </button>
                                      )}
                                    </div>

                                    {/* Dedicated Print View Cell */}
                                    <div className="hidden print:flex items-center justify-center font-black text-[7.5pt] text-slate-950">
                                      {isChecked ? '✓' : ''}
                                    </div>
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}

                        {/* Category Subtotal Row */}
                        <tr className="bg-slate-100 print:bg-slate-50 font-bold border-b border-slate-300 print:border-slate-800">
                          <td className="py-1 px-3 print:py-0.5 print:px-1.5 text-right uppercase text-slate-800 text-xs print:text-[6.8pt]">
                            Total Rating ({category.title}):
                          </td>
                          <td colSpan={6} className="py-1 px-3 print:py-0.5 print:px-1.5 border-l border-slate-300 print:border-slate-800 text-left">
                            <span className="font-black text-emerald-950 print:text-slate-950 text-xs print:text-[7pt]">
                              {catStat.avg.toFixed(2)} / 5.00
                            </span>
                            <span className="text-[10.5px] print:text-[6.5pt] text-slate-600 ml-2 font-medium">
                              (Subtotal Sum: {catStat.total})
                            </span>
                          </td>
                        </tr>

                        {/* Category Comments Inside the Evaluation Table */}
                        <tr className="border-b-2 border-slate-300 print:border-slate-800 bg-white">
                          <td colSpan={7} className="p-2 sm:p-3 print:p-0.5 bg-slate-50/50 print:bg-white">
                            <div className="space-y-1">
                              {/* Screen View */}
                              <div className="no-print space-y-1">
                                <div className="flex items-center justify-between">
                                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                    <MessageSquare size={13} className="text-emerald-700" />
                                    <span>Rating Remarks &amp; Observations for {category.title}:</span>
                                  </label>

                                  {!isCriteriaReadOnly && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setActivePresetCategory(
                                          activePresetCategory === category.id ? null : category.id
                                        )
                                      }
                                      className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-1 cursor-pointer"
                                    >
                                      <Sparkles size={12} />
                                      <span>Quick Suggestions</span>
                                    </button>
                                  )}
                                </div>

                                {!isCriteriaReadOnly && activePresetCategory === category.id && (
                                  <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1">
                                    <div className="flex flex-wrap gap-1">
                                      {RATING_COMMENT_PRESETS[category.id]?.map((preset, idx) => (
                                        <button
                                          key={idx}
                                          type="button"
                                          onClick={() => appendCommentPreset(category.id, preset)}
                                          className="px-2 py-0.5 bg-white hover:bg-emerald-100 text-emerald-900 border border-emerald-300 rounded text-[10.5px] text-left transition-colors cursor-pointer"
                                        >
                                          + {preset}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {isCriteriaReadOnly ? (
                                  <div className="p-2 bg-white border border-slate-200 rounded text-xs text-slate-700 italic">
                                    {currentCategoryComment || 'No specific rating remarks recorded for this category.'}
                                  </div>
                                ) : (
                                  <textarea
                                    value={currentCategoryComment}
                                    onChange={(e) =>
                                      onRatingCommentChange &&
                                      onRatingCommentChange(category.id, e.target.value)
                                    }
                                    rows={1}
                                    placeholder={`Enter remarks or specific observations for ${category.title}...`}
                                    className="w-full p-1.5 border border-slate-300 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-emerald-600 outline-none bg-white resize-y"
                                  />
                                )}
                              </div>

                              {/* Dedicated Print View Line (Crisp, zero empty space) */}
                              <div className="hidden print:block text-[6.8pt] text-slate-800 leading-tight">
                                <strong className="text-slate-950 font-bold uppercase text-[6.5pt] mr-1">
                                  Remarks ({category.title}):
                                </strong>
                                <span className="italic">
                                  {currentCategoryComment || 'Satisfactory performance manifested across all indicators.'}
                                </span>
                              </div>
                            </div>
                          </td>
                        </tr>
                      </React.Fragment>
                    );
                  })}

                  {/* Overall Rating Row */}
                  <tr className="bg-emerald-950 print:bg-slate-900 text-white font-black text-xs sm:text-sm print:text-[8pt] border-t-2 border-slate-900">
                    <td className="py-2.5 px-3 print:py-0.5 print:px-1.5 text-right uppercase tracking-wider">
                      OVERALL RATING:
                    </td>
                    <td colSpan={6} className="py-2.5 px-3 print:py-0.5 print:px-1.5 text-left border-l border-emerald-800 print:border-slate-800">
                      <div className="flex flex-wrap items-center gap-2 print:gap-2">
                        <span className="text-base sm:text-lg print:text-[9.5pt] font-black text-amber-300 print:text-white font-mono">
                          {overallRating.toFixed(2)} / 5.00
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full text-[10.5px] print:text-[7pt] font-black uppercase tracking-wider bg-white/10 text-white border border-white/20 print:border-none print:p-0">
                          {Math.round((overallRating / 5) * 100)}% • {grade}
                        </span>
                        <span className="text-[10px] print:text-[6.5pt] font-normal text-emerald-200 print:text-slate-300">
                          ({gradeInfo.label})
                        </span>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Comments/Suggestions Box matching official document */}
            <div className="border border-slate-300 print:border-slate-800 rounded-xl p-3 print:p-1 print:rounded-none bg-white space-y-1">
              <h4 className="font-black text-slate-900 text-xs print:text-[7pt] uppercase tracking-wide">
                Comments / Suggestions:
              </h4>
              {/* Screen Mode */}
              <div className="no-print">
                {isCriteriaReadOnly ? (
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 min-h-[50px] whitespace-pre-wrap">
                    {commentsSuggestions || 'No general comments or suggestions recorded.'}
                  </div>
                ) : (
                  <textarea
                    value={commentsSuggestions}
                    onChange={(e) =>
                      onCommentsSuggestionsChange && onCommentsSuggestionsChange(e.target.value)
                    }
                    rows={2}
                    placeholder="Enter overall comments, recommendations for improvement, professional growth, or employment readiness..."
                    className="w-full p-2 border border-slate-300 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-emerald-600 outline-none bg-slate-50/50 resize-y"
                  />
                )}
              </div>

              {/* Dedicated Print Mode Box */}
              <div className="hidden print:block text-[7pt] text-slate-900 min-h-[16px] italic leading-tight">
                {commentsSuggestions ||
                  'The trainee performed assigned responsibilities diligently with commendable technical competence and professionalism.'}
              </div>
            </div>

            {/* Official Signatures Section */}
            <div className="pt-4 pb-1 print:pt-1 print:pb-0 grid grid-cols-1 sm:grid-cols-2 gap-6 print:gap-4 text-xs print:text-[7.5pt] print-avoid-break">
              {/* 1. HTE Supervisor */}
              <div className="text-center">
                <div className="h-10 print:h-5 border-b-2 border-slate-900 flex items-end justify-center pb-0.5">
                  <span className="font-black text-slate-900 uppercase text-xs sm:text-sm print:text-[8pt] tracking-wider">
                    {supervisorName}
                  </span>
                </div>
                <p className="font-black text-slate-900 mt-0.5 uppercase text-[10.5px] print:text-[7pt]">
                  Supervisor's Signature over Printed Name
                </p>
                <p className="text-slate-600 text-[10px] print:text-[6.5pt]">Date: {displayDate}</p>
              </div>

              {/* 2. CHMSU OJT Instructor / Coordinator */}
              <div className="text-center">
                <div className="h-10 print:h-5 border-b-2 border-slate-900 flex items-end justify-center pb-0.5">
                  <span className="font-black text-slate-900 uppercase text-xs sm:text-sm print:text-[8pt] tracking-wider">
                    {instructorName}
                  </span>
                </div>
                <p className="font-black text-slate-900 mt-0.5 uppercase text-[10.5px] print:text-[7pt]">
                  CHMSU OJT Coordinator / Instructor
                </p>
                <p className="text-slate-600 text-[10px] print:text-[6.5pt]">
                  {status === 'reviewed_by_instructor' ? 'Verified & Endorsed' : 'Noted by Office of OJT'}
                </p>
              </div>
            </div>

            {/* Official University Footer */}
            <div className="border-t border-emerald-800/60 print:border-slate-900 pt-2 print:pt-0.5 text-center space-y-0.5 print:space-y-0 text-[9.5px] print:text-[6pt] text-slate-600 print-avoid-break">
              <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-0.5 font-semibold">
                <span>college.computerstudies@chmsu.edu.ph</span>
                <span>•</span>
                <span>(034) 434 8148</span>
                <span>•</span>
                <span>chmsu.edu.ph</span>
              </div>
              <div className="font-black text-emerald-900 uppercase tracking-widest text-[10px] print:text-[6.5pt]">
                GREEN CHMSU EXCELSIOR!
              </div>
              <div className="text-[8.5px] print:text-[5.5pt] text-slate-500 tracking-tight">
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
          className={`eval-page eval-page-2 bg-white rounded-2xl shadow-xl border border-slate-300 overflow-hidden print:border-none print:shadow-none print:m-0 print:p-0 ${
            activeTab === 'both' ? 'print:page-break-before-always' : ''
          }`}
        >
          <div className="p-6 sm:p-8 space-y-4 print:p-0 print:space-y-1">
            {/* Page 2 Institutional Header */}
            <div className="border-b-2 border-emerald-800 pb-3 print:pb-1 text-center relative">
              <div className="flex items-center justify-between gap-3">
                {/* Left Logo */}
                <div className="w-16 h-16 shrink-0 flex items-center justify-center print:w-10 print:h-10">
                  <img
                    src="/chmsu-logo.png"
                    alt="Carlos Hilado Memorial State University Logo"
                    className="w-16 h-16 object-contain print:w-10 print:h-10"
                    onError={(e) => {
                      (e.currentTarget as HTMLElement).style.display = 'none';
                    }}
                  />
                </div>

                {/* Center Text Header */}
                <div className="flex-1 px-1 text-center">
                  <p className="text-[9px] uppercase tracking-widest text-slate-500 font-bold hidden print:block print:text-[6.5pt] print:leading-tight">
                    Republic of the Philippines
                  </p>
                  <h1 className="font-serif font-black text-emerald-950 text-base sm:text-xl print:text-[11pt] tracking-wide uppercase leading-tight">
                    Carlos Hilado Memorial State University
                  </h1>
                  <p className="text-[10px] sm:text-xs print:text-[7pt] font-semibold text-slate-600 tracking-tight mt-0.5 print:mt-0 print:leading-tight">
                    Alijis Campus • Binalbagan Campus • Fortune Towne Campus • Talisay (Main) Campus
                  </p>
                  <p className="text-[9px] sm:text-[10px] print:text-[6.5pt] italic font-medium text-emerald-800 mt-0.5 print:mt-0 print:leading-tight">
                    A leading GREEN institution of higher learning in the global community by 2030
                  </p>

                  <div className="mt-1.5 pt-1 border-t border-slate-300 print:mt-0.5 print:pt-0.5">
                    <h2 className="font-sans font-black text-slate-900 text-xs sm:text-sm print:text-[8pt] tracking-wide uppercase print:leading-tight">
                      College of Computer Studies
                    </h2>
                    <h3 className="font-sans font-black text-emerald-950 text-sm sm:text-base print:text-[9.5pt] tracking-wider uppercase mt-0.5 print:mt-0 print:leading-tight">
                      ON-THE-JOB TRAINING EVALUATION FORM
                    </h3>
                  </div>
                </div>

                {/* Right Seal / Badge */}
                <div className="w-16 h-16 shrink-0 flex flex-col items-center justify-center text-center print:w-10 print:h-10">
                  <div className="w-14 h-14 rounded-full border-2 border-emerald-700 bg-emerald-50/50 flex flex-col items-center justify-center p-1 text-emerald-900 print:w-10 print:h-10 print:p-0.5">
                    <span className="text-[8px] print:text-[6.5pt] font-black uppercase leading-tight">GREEN</span>
                    <span className="text-[8px] print:text-[6.5pt] font-black uppercase leading-tight text-amber-700">CHMSU</span>
                    <span className="text-[7.5px] print:text-[6pt] font-bold text-emerald-800">CCS</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Trainee & Training Details Upper Box */}
            <div className="border border-slate-300 print:border-slate-800 rounded-xl p-3 print:p-1 print:rounded-none bg-slate-50/70 print:bg-white text-xs print:text-[7.5pt]">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-1.5 print:gap-y-0.5 gap-x-4">
                {/* Row 1: Name of Trainee & Training Company */}
                <div className="flex items-baseline gap-1.5 min-w-0">
                  <span className="font-black text-slate-800 w-32 print:w-26 shrink-0">Name of Trainee:</span>
                  <span className="font-black text-slate-950 border-b border-dotted border-slate-600 flex-1 pb-0.5 uppercase tracking-wide">
                    {trainee.name}
                  </span>
                </div>

                <div className="flex items-baseline gap-1.5 min-w-0">
                  <span className="font-black text-slate-800 w-32 print:w-26 shrink-0">Training Company:</span>
                  <span className="font-bold text-slate-900 border-b border-dotted border-slate-600 flex-1 pb-0.5">
                    {companyName || trainee.companyName || 'Host Training Establishment'}
                  </span>
                </div>

                {/* Row 2: Company Address (full span) */}
                <div className="flex items-baseline gap-1.5 sm:col-span-2 min-w-0">
                  <span className="font-black text-slate-800 w-32 print:w-26 shrink-0">Company Address:</span>
                  {isQuestionnaireReadOnly ? (
                    <span className="text-slate-900 border-b border-dotted border-slate-600 flex-1 pb-0.5">
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

                {/* Row 3: Contact Person & Inclusive Date of Training */}
                <div className="flex items-baseline gap-1.5 min-w-0">
                  <span className="font-black text-slate-800 w-32 print:w-26 shrink-0">Contact Person:</span>
                  {isQuestionnaireReadOnly ? (
                    <span className="text-slate-900 border-b border-dotted border-slate-600 flex-1 pb-0.5">
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

                <div className="flex items-baseline gap-1.5 min-w-0">
                  <span className="font-black text-slate-800 w-32 print:w-28 shrink-0">Inclusive Dates:</span>
                  <div className="flex items-center gap-1 flex-1 border-b border-dotted border-slate-600 pb-0.5 whitespace-nowrap">
                    <span className="text-slate-600 text-xs print:text-[7pt]">From:</span>
                    {isQuestionnaireReadOnly ? (
                      <span className="font-semibold text-slate-900 print:text-[7.5pt]">
                        {localQuestionnaire.trainingDateFrom || 'Start of OJT'}
                      </span>
                    ) : (
                      <input
                        type="text"
                        value={localQuestionnaire.trainingDateFrom || ''}
                        onChange={(e) => updateQuestionnaireField('trainingDateFrom', e.target.value)}
                        placeholder="e.g. Jan 15, 2026"
                        className="w-20 sm:w-24 text-xs border-b border-slate-300 focus:border-emerald-600 outline-none bg-transparent"
                      />
                    )}
                    <span className="text-slate-600 text-xs print:text-[7pt] ml-1">to:</span>
                    {isQuestionnaireReadOnly ? (
                      <span className="font-semibold text-slate-900 print:text-[7.5pt]">
                        {localQuestionnaire.trainingDateTo || 'End of OJT'}
                      </span>
                    ) : (
                      <input
                        type="text"
                        value={localQuestionnaire.trainingDateTo || ''}
                        onChange={(e) => updateQuestionnaireField('trainingDateTo', e.target.value)}
                        placeholder="e.g. May 30, 2026"
                        className="w-20 sm:w-24 text-xs border-b border-slate-300 focus:border-emerald-600 outline-none bg-transparent"
                      />
                    )}
                  </div>
                </div>

                {/* Row 4: Date of Evaluation & Date of Last Evaluation */}
                <div className="flex items-baseline gap-1.5 min-w-0">
                  <span className="font-black text-slate-800 w-32 print:w-26 shrink-0">Date of Evaluation:</span>
                  {isQuestionnaireReadOnly ? (
                    <span className="text-slate-900 border-b border-dotted border-slate-600 flex-1 pb-0.5 whitespace-nowrap print:text-[7.5pt]">
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

                <div className="flex items-baseline gap-1.5 min-w-0">
                  <span className="font-black text-slate-800 w-32 print:w-28 shrink-0">Date of Last Eval:</span>
                  {isQuestionnaireReadOnly ? (
                    <span className="text-slate-900 border-b border-dotted border-slate-600 flex-1 pb-0.5 whitespace-nowrap print:text-[7.5pt]">
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

            {/* Employability & Compensation Box */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 border border-slate-300 print:border-slate-800 rounded-xl p-3 print:p-1 print:rounded-none bg-white text-xs print:text-[7.5pt]">
              {/* Left Column: Employability Checkboxes */}
              <div className="space-y-1.5 print:space-y-0.5 border-b md:border-b-0 md:border-r border-slate-200 print:border-slate-400 pb-2 md:pb-0 md:pr-3 print:pr-1">
                <span className="font-black text-slate-900 block uppercase tracking-wide print:text-[7.5pt]">
                  Employability:
                </span>
                <div className="grid grid-cols-3 gap-1.5 print:gap-0.5 text-xs print:text-[7pt]">
                  {EMPLOYABILITY_OPTIONS.map((opt) => {
                    const isSelected = (localQuestionnaire.employabilityStatus || 'OJT Trainee') === opt;
                    return (
                      <label
                        key={opt}
                        className={`flex items-center gap-1.5 print:gap-1 p-1 print:p-0 rounded transition-colors select-none ${
                          isSelected ? 'font-bold text-slate-950' : 'text-slate-700'
                        } ${isQuestionnaireReadOnly ? '' : 'cursor-pointer hover:bg-slate-50'}`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={isQuestionnaireReadOnly}
                          onChange={() => !isQuestionnaireReadOnly && updateQuestionnaireField('employabilityStatus', opt)}
                          className="w-3.5 h-3.5 print:w-3 print:h-3 text-emerald-600 rounded border-slate-300 cursor-pointer print:text-black"
                        />
                        <span className="print:text-[7pt]">{opt}</span>
                      </label>
                    );
                  })}
                </div>

                <div className="pt-1 print:pt-0.5 flex items-baseline gap-2">
                  <span className="text-[10px] print:text-[7pt] font-semibold text-slate-600 shrink-0">
                    If employed, company name:
                  </span>
                  {isQuestionnaireReadOnly ? (
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
              <div className="space-y-2 print:space-y-1 pl-0 md:pl-2 print:pl-1 flex flex-col justify-center">
                <div className="flex items-baseline gap-2">
                  <span className="font-black text-slate-800 w-28 shrink-0 print:w-22">Allowance/Salary:</span>
                  <span className="font-bold text-slate-600">Php</span>
                  {isQuestionnaireReadOnly ? (
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
                  <span className="font-black text-slate-800 w-28 shrink-0 print:w-22">Telephone No:</span>
                  {isQuestionnaireReadOnly ? (
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
            <div className="border border-slate-300 print:border-slate-800 rounded-xl p-2.5 print:p-0.5 print:rounded-none bg-slate-50/50 print:bg-white space-y-1 print:space-y-0 text-xs print:text-[7.5pt]">
              <h4 className="font-black text-slate-900 uppercase tracking-wide text-xs print:text-[7pt]">ASSIGNMENT</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 print:gap-1.5">
                <div className="flex items-baseline gap-1.5">
                  <span className="font-black text-slate-700 shrink-0">DEPARTMENT:</span>
                  {isQuestionnaireReadOnly ? (
                    <span className="border-b border-dotted border-slate-400 flex-1 font-semibold text-slate-900 pb-0.5 uppercase">
                      {localQuestionnaire.department || trainee.department || 'IT Department'}
                    </span>
                  ) : (
                    <input
                      type="text"
                      value={localQuestionnaire.department || ''}
                      onChange={(e) => updateQuestionnaireField('department', e.target.value)}
                      placeholder={trainee.department || 'e.g. IT Department'}
                      className="border-b border-slate-300 focus:border-emerald-600 outline-none flex-1 pb-0.5 font-medium text-slate-900 bg-transparent uppercase"
                    />
                  )}
                </div>

                <div className="flex items-baseline gap-1.5">
                  <span className="font-black text-slate-700 shrink-0">POSITION:</span>
                  <span className="font-black text-emerald-950 print:text-slate-950 border-b border-dotted border-slate-400 flex-1 pb-0.5 uppercase">
                    {localQuestionnaire.position || 'ON - THE - JOB TRAINEE'}
                  </span>
                </div>

                <div className="flex items-baseline gap-1.5">
                  <span className="font-black text-slate-700 shrink-0">OTHER DEPT:</span>
                  {isQuestionnaireReadOnly ? (
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
            <div className="space-y-1.5 print:space-y-0.5">
              <div className="flex items-center justify-between no-print">
                <h3 className="font-black text-slate-900 uppercase tracking-wider text-xs sm:text-sm border-l-4 border-emerald-700 pl-2">
                  QUESTIONNAIRE (STUDENT PRACTICUM FEEDBACK)
                </h3>
                {!isQuestionnaireReadOnly && (
                  <span className="text-xs text-slate-500 italic">
                    Click 'Suggestions' to insert helpful responses quickly
                  </span>
                )}
              </div>

              <div className="border-2 border-slate-900 rounded-xl overflow-hidden shadow-xs print:rounded-none">
                <table className="w-full text-xs print:text-[7pt] border-collapse eval-table">
                  <tbody>
                    {QUESTIONNAIRE_PROMPTS.map((q) => {
                      const currentAnswer = (localQuestionnaire[q.key] as string) || '';
                      const isOpenPresets = activeQuestionPreset === q.key;

                      return (
                        <tr
                          key={q.key}
                          className="border-b border-slate-300 print:border-slate-800 hover:bg-slate-50/50 transition-colors"
                        >
                          {/* Question column */}
                          <td className="w-[38%] print:w-[35%] py-2 px-2.5 print:py-0.5 print:px-1.5 align-top bg-slate-50/70 print:bg-white border-r border-slate-300 print:border-slate-800 font-bold text-slate-900">
                            <div className="flex items-start gap-1 leading-tight">
                              <span className="text-emerald-900 print:text-slate-950 font-black shrink-0">{q.number}.</span>
                              <span className="print:text-[6.8pt]">{q.prompt}</span>
                            </div>
                            {!isQuestionnaireReadOnly && (
                              <button
                                type="button"
                                onClick={() => setActiveQuestionPreset(isOpenPresets ? null : q.key)}
                                className="mt-1 text-[10.5px] font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-1 cursor-pointer no-print"
                              >
                                <Sparkles size={11} />
                                <span>Suggestions</span>
                              </button>
                            )}
                          </td>

                          {/* Answer column */}
                          <td className="py-1.5 px-2.5 print:py-0.5 print:px-1.5 align-top bg-white">
                            {!isQuestionnaireReadOnly && isOpenPresets && (
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
                                      className="w-full text-left text-[10.5px] p-1 bg-white hover:bg-emerald-100 rounded border border-emerald-200 text-slate-800 transition-colors cursor-pointer"
                                    >
                                      + {sug}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Screen View */}
                            <div className="no-print">
                              {isQuestionnaireReadOnly ? (
                                <div className="min-h-[30px] py-0.5 text-slate-800 whitespace-pre-wrap leading-relaxed italic text-xs">
                                  {currentAnswer || (
                                    <span className="text-slate-400 not-italic">No response recorded</span>
                                  )}
                                </div>
                              ) : (
                                <textarea
                                  rows={1}
                                  value={currentAnswer}
                                  onChange={(e) => updateQuestionnaireField(q.key, e.target.value)}
                                  placeholder={q.placeholder}
                                  className="w-full p-1.5 border border-slate-300 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-emerald-600 outline-none bg-slate-50/30 resize-y"
                                />
                              )}
                            </div>

                            {/* Dedicated Print View (Crisp text fit) */}
                            <div className="hidden print:block text-[6.8pt] text-slate-900 leading-tight italic">
                              {currentAnswer || 'Completed satisfactorily as required by the host establishment.'}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Page 2 Official Signatures Section */}
            <div className="pt-3 pb-1 print:pt-1 print:pb-0 grid grid-cols-1 sm:grid-cols-2 gap-6 print:gap-4 text-xs print:text-[7.5pt] print-avoid-break">
              <div className="text-center">
                <div className="h-9 print:h-5 border-b-2 border-slate-900 flex items-end justify-center pb-0.5">
                  <span className="font-black text-slate-900 uppercase text-xs sm:text-sm print:text-[8pt] tracking-wider">
                    {trainee.name}
                  </span>
                </div>
                <p className="font-black text-slate-900 mt-0.5 uppercase text-[10.5px] print:text-[7pt]">
                  OJT Trainee's Signature over Printed Name
                </p>
                <p className="text-slate-600 text-[10px] print:text-[6.5pt]">Date: {displayDate}</p>
              </div>

              <div className="text-center">
                <div className="h-9 print:h-5 border-b-2 border-slate-900 flex items-end justify-center pb-0.5">
                  <span className="font-black text-slate-900 uppercase text-xs sm:text-sm print:text-[8pt] tracking-wider">
                    {supervisorName}
                  </span>
                </div>
                <p className="font-black text-slate-900 mt-0.5 uppercase text-[10.5px] print:text-[7pt]">
                  Immediate Supervisor / HTE Representative
                </p>
                <p className="text-slate-600 text-[10px] print:text-[6.5pt]">Date: {displayDate}</p>
              </div>
            </div>

            {/* Page 2 University Footer */}
            <div className="border-t border-emerald-800/60 print:border-slate-900 pt-2 print:pt-0.5 text-center space-y-0.5 print:space-y-0 text-[9.5px] print:text-[6pt] text-slate-600 print-avoid-break">
              <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-0.5 font-semibold">
                <span>college.computerstudies@chmsu.edu.ph</span>
                <span>•</span>
                <span>(034) 434 8148</span>
                <span>•</span>
                <span>chmsu.edu.ph</span>
              </div>
              <div className="font-black text-emerald-900 uppercase tracking-widest text-[10px] print:text-[6.5pt]">
                GREEN CHMSU EXCELSIOR!
              </div>
              <div className="text-[8.5px] print:text-[5.5pt] text-slate-500 tracking-tight">
                Excellence • Compassion • Environmentalism • Love of Country • Social Responsibility • Integrity • Openness • Resilience
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
