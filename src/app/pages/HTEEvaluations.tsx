import {
  Star,
  Users,
  X,
  Save,
  ChevronLeft,
  ChevronRight,
  Award,
  Clock,
  Check,
  Edit2,
  Trash2,
  AlertCircle,
  Printer,
  FileText,
  Building,
  GraduationCap,
  Calendar,
  CheckCircle2,
  Download,
  Search,
  User,
  ShieldCheck,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import React, { useState, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { useApp } from '../store/AppContext';
import { CHMSU_EVALUATION_CATEGORIES, Employee, Evaluation, EvaluationQuestionnaire } from '../types';
import { getPhotoUrl } from '../services/config';
import { CHMSUEvaluationSheet } from '../components/CHMSUEvaluationSheet';

const GRADE_CONFIG: Record<
  Evaluation['grade'],
  { color: string; bg: string; border: string; min: number; label: string }
> = {
  Excellent: {
    color: 'text-emerald-700',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    min: 90,
    label: 'Excellent / Outstanding (90-100%)',
  },
  'Very Good': {
    color: 'text-blue-700',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    min: 80,
    label: 'Very Good / Above Average (80-89%)',
  },
  Good: {
    color: 'text-sky-700',
    bg: 'bg-sky-50',
    border: 'border-sky-200',
    min: 70,
    label: 'Good / Average (70-79%)',
  },
  Satisfactory: {
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    min: 60,
    label: 'Satisfactory / Fair (60-69%)',
  },
  'Needs Improvement': {
    color: 'text-rose-700',
    bg: 'bg-rose-50',
    border: 'border-rose-200',
    min: 0,
    label: 'Needs Improvement / Poor (<60%)',
  },
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

export function HTEEvaluations() {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    employees,
    timeRecords,
    evaluations,
    addEvaluation,
    updateEvaluation,
    deleteEvaluation,
    hostFeedback,
    addHostFeedback,
    updateHostFeedback,
    currentUser,
    getCurrentEmployee,
    updateEmployee,
    settings,
  } = useApp();

  const currentEmp = getCurrentEmployee();
  const queryParams = new URLSearchParams(location.search);
  const preselectedStudentId = queryParams.get('studentId');

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
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCourse, setFilterCourse] = useState('all');

  const hteUser = React.useMemo(() => {
    try {
      const stored = localStorage.getItem('ojt_hte_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }, []);

  const supervisorName =
    currentUser?.name ||
    currentEmp?.name ||
    hteUser?.name ||
    'HTE Supervisor';

  const companyName =
    currentEmp?.companyName ||
    hteUser?.companyName ||
    localStorage.getItem('ojt_hte_company') ||
    'Host Training Establishment';

  const instructorName = useMemo(() => {
    if (selectedEmp?.instructorId) {
      const linked = employees.find((e) => e.id === selectedEmp.instructorId || e.employeeId === selectedEmp.instructorId);
      if (linked?.name) return linked.name;
    }
    const anyInst = employees.find((e) => e.position === 'OJT Instructor' || (e.position && e.position.toLowerCase().includes('instructor')));
    if (anyInst?.name) return anyInst.name;
    return 'CHMSU OJT Instructor';
  }, [selectedEmp, employees]);

  // Only trainees linked to the active HTE workflow should appear in evaluation queues.
  const activeTrainees = useMemo(() => {
    const currentHteId = currentUser?.id || currentEmp?.id || hteUser?.id || undefined;
    const currentCompany = (companyName || '').trim().toLowerCase();
    const targetAY = settings?.activeAcademicYear || '2026-2027';
    const defaultAY = settings?.academicYears?.[0] || '2025-2026';

    return employees.filter((e) => {
      if (!e.active || e.position === 'OJT Instructor' || e.position === 'HTE Representative') return false;
      const empAY = e.academicYear || defaultAY;
      if (empAY !== targetAY) return false;

      const isAssignedToCurrentHte = Boolean(e.hteId && currentHteId && e.hteId === currentHteId);
      const isCompanyMatched = Boolean(
        currentCompany &&
        currentCompany !== 'host training establishment' &&
        e.companyName &&
        e.companyName.trim().toLowerCase() === currentCompany
      );
      const isInstructorLinked = Boolean(e.instructorId && currentHteId && e.instructorId !== currentHteId);
      const hasAnyAssignment = Boolean(e.instructorId || e.hteId);
      return isAssignedToCurrentHte || isCompanyMatched || isInstructorLinked || (!hasAnyAssignment && e.companyName !== '');
    });
  }, [employees, currentUser, currentEmp, hteUser, companyName, settings]);

  // Handle preselected student from URL
  React.useEffect(() => {
    if (preselectedStudentId && activeTrainees.length > 0) {
      const found = activeTrainees.find((t) => t.id === preselectedStudentId);
      if (found) {
        openNewEval(found);
      }
    }
  }, [preselectedStudentId, activeTrainees]);

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
      setEditEvalId(existing.id);
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
      setFormStatus(existing.status);
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
        contactPerson: supervisorName,
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

    const overallPercent = Math.round((overallRating / 5) * 100);
    const attendanceScore = Math.round((categoryStats.workHabits / 5) * 100);
    const performanceScore = Math.round((categoryStats.workSkills / 5) * 100);
    const attitudeScore = Math.round((categoryStats.workHabits / 5) * 100);
    const punctualityScore = ratings['wh_1'] ? Math.round((ratings['wh_1'] / 5) * 100) : attendanceScore;
    const communicationScore = Math.round((categoryStats.socialSkills / 5) * 100);

    const resolvedAcademicYear = selectedEmp.academicYear || settings?.activeAcademicYear || '2026-2027';

    const compiledStrengths =
      ratingComments.workSkills ||
      ratingComments.workHabits ||
      'Demonstrates strong work dedication and technical competence.';

    const compiledImprovement =
      ratingComments.socialSkills ||
      'Continue developing advanced domain knowledge and leadership skills.';

    const data: Omit<Evaluation, 'id'> = {
      employeeId: selectedEmp.id,
      evaluatedBy: supervisorName,
      evaluatorName: supervisorName,
      evaluatorPosition: currentEmp?.position || hteUser?.position || 'HTE Supervisor',
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
        (overallRating >= 3.5 ? 'Recommended for completion of OJT program.' : 'For further development.'),
      evaluatedAt: new Date().toISOString(),
      status,
      academicYear: resolvedAcademicYear,
    };

    if (editEvalId) {
      updateEvaluation(editEvalId, data);
      if (status === 'submitted_to_instructor') {
        toast.success('✓ Evaluation completed & passed to Instructor! Trainee will see results after Instructor reviews.');
      } else {
        toast.success('Draft saved.');
      }
    } else {
      addEvaluation(data);
      if (status === 'submitted_to_instructor') {
        toast.success('✓ Evaluation completed & passed to Instructor! Trainee will see results after Instructor reviews.');
      } else {
        toast.success('Draft saved.');
      }
    }

    // Bidirectional sync: ensure trainee is linked to this HTE
    try {
      const currentHteId = currentUser?.id || currentEmp?.id || hteUser?.id;
      if (selectedEmp && currentHteId) {
        updateEmployee(selectedEmp.id, {
          hteId: currentHteId,
          companyName: companyName !== 'Host Training Establishment' ? companyName : selectedEmp.companyName,
          supervisorName: supervisorName !== 'HTE Supervisor' ? supervisorName : selectedEmp.supervisorName,
        });
      }
    } catch {}

    // Also mirror to Host Feedback table for HTE cross-sync
    try {
      const existingHf = hostFeedback.find((f) => f.employeeId === selectedEmp.id);
      const hfEmail =
        currentUser?.email ||
        currentEmp?.email ||
        hteUser?.email ||
        `${(companyName || 'hte').toLowerCase().replace(/[^a-z0-9]/g, '')}@chmsu.edu.ph`;

      const feedbackPayload = {
        employeeId: selectedEmp.id,
        hostName: supervisorName,
        hostCompany: companyName,
        hostPosition: currentEmp?.position || hteUser?.position || 'Supervisor',
        hostEmail: hfEmail,
        attendanceScore,
        performanceScore,
        attitudeScore,
        communicationScore,
        teamworkScore: punctualityScore,
        strengths: compiledStrengths,
        areasForImprovement: compiledImprovement,
        recommendation: (overallPercent >= 75 ? 'Recommended' : 'For Improvement') as 'Recommended' | 'For Improvement',
        academicYear: resolvedAcademicYear,
      };

      if (existingHf) {
        updateHostFeedback(existingHf.id, {
          ...feedbackPayload,
          status: status === 'reviewed_by_instructor' ? 'reviewed' : 'submitted',
        });
      } else {
        addHostFeedback(feedbackPayload);
      }
    } catch (err) {
      console.warn('Mirror to host feedback caught:', err);
    }

    setViewMode('list');
  };

  const handleDelete = (evalId: string) => {
    if (confirm('Are you sure you want to delete this evaluation?')) {
      deleteEvaluation(evalId);
      toast.success('Evaluation deleted.');
    }
  };

  const getEmpStats = (empId: string) => {
    const recs = timeRecords.filter((r) => r.employeeId === empId);
    const totalHours = recs.reduce((s, r) => s + (r.totalHours || 0), 0);
    const present = recs.filter((r) => r.status === 'present' || r.status === 'overtime').length;
    const late = recs.filter((r) => r.status === 'late').length;
    return { totalHours, present, late, totalDays: recs.length };
  };

  const courses = useMemo(() => {
    const set = new Set(activeTrainees.map((e) => e.course).filter(Boolean));
    return Array.from(set);
  }, [activeTrainees]);

  const filteredTrainees = useMemo(() => {
    return activeTrainees.filter((e) => {
      const matchSearch =
        e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (e.employeeId && e.employeeId.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (e.course && e.course.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchCourse = filterCourse === 'all' || e.course === filterCourse;
      return matchSearch && matchCourse;
    });
  }, [activeTrainees, searchTerm, filterCourse]);

  // Pagination state (10 interns per page)
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterCourse]);

  const totalPages = Math.ceil(filteredTrainees.length / ITEMS_PER_PAGE) || 1;

  React.useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [currentPage, totalPages]);

  const paginatedTrainees = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredTrainees.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredTrainees, currentPage]);

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. Official Evaluation Form Screen (Create / Edit)
  // ─────────────────────────────────────────────────────────────────────────────
  if (viewMode === 'form' && selectedEmp) {
    return (
      <CHMSUEvaluationSheet
        trainee={selectedEmp}
        companyName={companyName}
        supervisorName={supervisorName}
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
        role="hte"
        onRatingChange={(id, score) => setRatings((prev) => ({ ...prev, [id]: score }))}
        onRatingCommentChange={(catId, comment) =>
          setRatingComments((prev) => ({ ...prev, [catId]: comment }))
        }
        onCommentsSuggestionsChange={setCommentsSuggestions}
        onQuestionnaireChange={setQuestionnaire}
        onSaveDraft={() => handleSave('draft')}
        onSubmitFinal={() => handleSave('submitted_to_instructor')}
        onClose={() => setViewMode('list')}
      />
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. View Mode (Printable / Certificate Review)
  // ─────────────────────────────────────────────────────────────────────────────
  if (viewMode === 'view' && selectedEmp) {
    const existing = evaluations.find((e) => e.employeeId === selectedEmp.id);
    const viewRatings = existing?.ratings || ratings;
    const viewComments = existing?.ratingComments || ratingComments;
    const viewSuggestions = existing?.commentsSuggestions || existing?.recommendations || commentsSuggestions;
    const viewOverall =
      existing?.overallRating || (existing?.overallScore ? existing.overallScore / 20 : overallRating);
    const viewGrade = existing?.grade || grade;
    const viewQuestionnaire = existing?.questionnaire || questionnaire;

    return (
      <div className="space-y-4 font-sans">
        <div className="flex items-center justify-between no-print max-w-5xl mx-auto">
          <button
            onClick={() => setViewMode('list')}
            className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-slate-700 hover:text-slate-900 bg-white rounded-2xl border border-slate-200 shadow-sm transition-all cursor-pointer"
          >
            <X size={16} />
            Back to Trainees List
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => openNewEval(selectedEmp)}
              className="px-4 py-2 bg-blue-600 text-white rounded-2xl text-xs font-bold hover:bg-blue-700 transition-all flex items-center gap-1.5 shadow-md cursor-pointer"
            >
              <Edit2 size={15} />
              Edit Evaluation
            </button>
          </div>
        </div>

        <CHMSUEvaluationSheet
          trainee={selectedEmp}
          companyName={companyName}
          supervisorName={existing?.evaluatorName || supervisorName}
          instructorName={instructorName}
          evaluationDate={existing?.evaluatedAt}
          ratings={viewRatings}
          ratingComments={viewComments}
          commentsSuggestions={viewSuggestions}
          overallRating={viewOverall}
          grade={viewGrade}
          questionnaire={viewQuestionnaire}
          isReadOnly={true}
          status={existing?.status || 'draft'}
          role="hte"
          onClose={() => setViewMode('list')}
        />
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. Main Trainees List & Evaluator Dashboard View
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <Star className="text-amber-500 fill-amber-500" size={26} />
            <span>Trainee Performance Evaluations</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Official performance evaluation system matching university criteria with real-time coordinator sync
          </p>
        </div>

        <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-800 rounded-2xl border border-blue-200 text-xs font-bold shadow-xs">
          <Building size={16} />
          <span>{companyName}</span>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search student intern by name, ID, or course..."
            className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs"
          />
        </div>

        {courses.length > 0 && (
          <select
            value={filterCourse}
            onChange={(e) => setFilterCourse(e.target.value)}
            className="px-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs cursor-pointer"
          >
            <option value="all">All Programs</option>
            {courses.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Trainees Evaluation Table */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
            <Users size={20} className="text-blue-600" />
            <span>Assigned Interns Roster</span>
          </h2>
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Total: {filteredTrainees.length} Interns
          </span>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-100">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 font-bold">
              <tr>
                <th className="px-4 py-3">Student Intern</th>
                <th className="px-4 py-3">Course / Department</th>
                <th className="px-4 py-3">Rendered Hours</th>
                <th className="px-4 py-3">Evaluation Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedTrainees.map((emp) => {
                const evalData = evaluations.find((e) => e.employeeId === emp.id);
                const stats = getEmpStats(emp.id);
                const gradeInfo = evalData ? GRADE_CONFIG[evalData.grade] : null;

                return (
                  <tr key={emp.id} className="hover:bg-slate-50/60 transition-colors font-medium">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center overflow-hidden shrink-0">
                          {emp.photo ? (
                            <img src={getPhotoUrl(emp.photo)} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <GraduationCap size={20} className="text-blue-600" />
                          )}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900">{emp.name}</div>
                          <div className="text-[11px] text-slate-400 font-mono">ID: {emp.employeeId || emp.id.slice(0, 8)}</div>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <div className="font-bold text-blue-700 text-xs">{emp.course || 'OJT Trainee'}</div>
                      <div className="text-[11px] text-slate-500">{emp.schoolName || 'CHMSU'}</div>
                    </td>

                    <td className="px-4 py-3">
                      <span className="font-mono font-bold text-slate-800 text-xs">
                        {stats.totalHours.toFixed(1)} / {emp.requiredHours || 486} hrs
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      {evalData && gradeInfo ? (
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-extrabold border ${gradeInfo.bg} ${gradeInfo.border} ${gradeInfo.color}`}>
                            <Award size={13} />
                            {evalData.overallScore}% ({evalData.grade})
                          </span>
                          {evalData.status === 'reviewed_by_instructor' ? (
                            <span className="text-[10px] uppercase font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                              ✓ Done Viewed by Instructor
                            </span>
                          ) : evalData.status === 'submitted_to_instructor' || evalData.status === 'final' ? (
                            <span className="text-[10px] uppercase font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                              Passed to Instructor
                            </span>
                          ) : (
                            <span className="text-[10px] uppercase font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                              Draft
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-500">
                          Not Yet Evaluated
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {evalData ? (
                          <>
                            <button
                              onClick={() => viewEval(emp)}
                              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                            >
                              View Sheet
                            </button>
                            <button
                              onClick={() => {
                                setSelectedEmp(emp);
                                setViewMode('view');
                                setTimeout(() => window.print(), 250);
                              }}
                              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors flex items-center gap-1 cursor-pointer"
                              title="Print Evaluation Sheet"
                            >
                              <Printer size={14} />
                              <span className="hidden sm:inline">Print</span>
                            </button>
                            <button
                              onClick={() => openNewEval(emp)}
                              className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                            >
                              Edit
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => openNewEval(emp)}
                            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold rounded-xl shadow-sm transition-all cursor-pointer"
                          >
                            Evaluate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredTrainees.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    No student interns found matching your filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Evaluations Pagination Controls */}
        {filteredTrainees.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
            <div className="text-xs text-slate-500 font-medium">
              Showing <span className="font-bold text-slate-800">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> to{' '}
              <span className="font-bold text-slate-800">
                {Math.min(currentPage * ITEMS_PER_PAGE, filteredTrainees.length)}
              </span>{' '}
              of <span className="font-bold text-slate-800">{filteredTrainees.length}</span> interns
            </div>

            {totalPages > 1 && (
              <div className="flex items-center gap-1.5 self-center sm:self-auto">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
                  title="Previous Page"
                >
                  <ChevronLeft size={16} />
                </button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`min-w-[32px] h-8 px-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        currentPage === page
                          ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                          : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
                  title="Next Page"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
