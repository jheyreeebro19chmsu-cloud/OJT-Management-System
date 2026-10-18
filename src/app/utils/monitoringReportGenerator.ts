import { Employee, MonitoringReport } from '../types';

/**
 * Builds a complete set of CHMSU Monitoring Reports for a student intern trainee account.
 * Covers:
 *  - Mid-Term (0-300h): Weekly (Week 4), Monthly (Month 1), Evaluation (300h)
 *  - End-Term (301-600h): Weekly (Week 12), Monthly (Month 3), Completion (600h)
 * Each report contains the full 9-questionnaire responses which can be edited by the trainee.
 */
export function buildDefaultReportsForTrainee(trainee: Partial<Employee>): MonitoringReport[] {
  const traineeId = trainee.id || 'trainee-unknown';
  const studentId = trainee.employeeId || trainee.id || '2023-XXXX';
  const cleanCode = (studentId || traineeId).replace(/[^a-zA-Z0-9]/g, '').slice(-6).toUpperCase();
  const name = trainee.name || 'OJT Student Intern';
  const course = trainee.course || 'Bachelor of Science in Information Technology';
  const department = trainee.department || 'College of Computer Studies';
  const campus = trainee.campus || 'Talisay (Main Campus)';
  const academicYear = '2026-2027';
  const hteCompanyName = trainee.companyName || 'Host Training Establishment';
  const hteAddress = trainee.address || trainee.residentialAddress || 'Official Training Station';
  const supervisorName = trainee.supervisorName || 'Department Mentor';
  const supervisorContact = trainee.contactPhone || trainee.phone || '+63 917 555 4321';
  const instructorName = 'Prof. Ma. Cristina Ramos, MIT';
  const requiredHours = trainee.requiredHours || 600;

  return [
    // 1. Mid-Term Weekly
    {
      id: `mr-${traineeId}-mid-w04`,
      reportNumber: `CHMSU-MR-2026-${cleanCode}-W04`,
      reportType: 'weekly',
      term: 'midterm',
      frequency: 'weekly',
      traineeId,
      traineeName: name,
      studentId,
      course,
      department,
      campus,
      academicYear,
      hteCompanyName,
      hteAddress,
      supervisorName,
      supervisorContact,
      supervisorDesignation: 'OJT Mentor / Supervisor',
      instructorName,
      periodCovered: 'Mid-Term Week 4 (October 12 – October 16, 2026)',
      dateSubmitted: '2026-10-16',
      hoursRenderedThisPeriod: 40,
      totalCumulativeHours: 160,
      requiredHours,
      remainingHours: Math.max(0, requiredHours - 160),
      tasksAccomplished:
        'Conducted structured system diagnostics, hardware verification, database backup audits, and assisted IT mentors with client workstation provisioning.',
      skillsApplied:
        'Local Area Network troubleshooting, workstation maintenance, operating system configuration, technical support protocols.',
      challengesEncountered:
        'Adapting to customized host organization directory permissions and ticketing management workflows.',
      questionnaire: {
        employabilityStatus: 'OJT Trainee',
        employedCompanyName: '-',
        allowanceSalary: 'None / Stipend',
        telephoneNo: supervisorContact,
        department: 'COLLEGE OF COMPUTER STUDIES',
        position: 'ON - THE - JOB TRAINEE',
        otherDeptAssigned: 'None',
        q1_dutiesBriefly:
          'Conducted structured system diagnostics, hardware verification, database backup audits, and assisted IT mentors with client workstation provisioning.',
        q2_strongestPerformanceArea:
          'Hardware diagnostics, fast comprehension of networking protocols, and orderly workstation troubleshooting.',
        q3_areasImprovedMost:
          'Professional workplace communication, systematic bug identification, and structured technical documentation.',
        q4_areasNeedImprovement:
          'Enterprise active directory architecture and large-scale server security configurations.',
        q5_situationChallengedMost:
          'Encountered intermittent network drops across department switches during peak operating hours.',
        q6_howOvercameChallenge:
          'Traced physical connections with mentor, isolated the oxidized RJ45 keystone, and re-terminated to restore gigabit throughput.',
        q7_whatLearnedFromExperience:
          'Hands-on system maintenance demands methodical physical layer checks before attributing faults to software layers.',
        q8_isQualifiedLinkage:
          'Yes, highly qualified environment with dedicated technical mentors and enterprise-grade infrastructure.',
        q9_ojtSuggestionsRecommendations:
          'Keep reinforcing real-time hands-on labs in earlier college semesters for seamless company onboarding.',
        attendanceScore: 5,
        performanceScore: 5,
        attitudeScore: 5,
        communicationScore: 5,
        teamworkScore: 5,
        overallScore: 98,
        strengths: 'Eager learner, attentive to technical protocols, and punctual in attendance.',
        areasForImprovement: 'Continue mastering command-line server diagnostics.',
        recommendation: 'Highly Recommended',
      },
      status: 'reviewed',
      instructorRemarks:
        `Commendable Mid-Term weekly monitoring submission ${name}! Your structured technical documentation and proactive troubleshooting reflect high professionalism.`,
      reviewedByInstructorAt: '2026-10-17T09:30:00Z',
      createdAt: '2026-10-16T17:00:00Z',
    },

    // 2. Mid-Term Monthly
    {
      id: `mr-${traineeId}-mid-m01`,
      reportNumber: `CHMSU-MR-2026-${cleanCode}-M01`,
      reportType: 'monthly',
      term: 'midterm',
      frequency: 'monthly',
      traineeId,
      traineeName: name,
      studentId,
      course,
      department,
      campus,
      academicYear,
      hteCompanyName,
      hteAddress,
      supervisorName,
      supervisorContact,
      supervisorDesignation: 'OJT Mentor / Supervisor',
      instructorName,
      periodCovered: 'Mid-Term Month 1 Assessment (September 15 – October 15, 2026)',
      dateSubmitted: '2026-10-15',
      hoursRenderedThisPeriod: 160,
      totalCumulativeHours: 160,
      requiredHours,
      remainingHours: Math.max(0, requiredHours - 160),
      tasksAccomplished:
        'Completed Month 1 practicum objectives encompassing network maintenance, user account administration, software asset tracking, and initial system architecture review.',
      skillsApplied:
        'LAN switching, IT ticketing systems, database querying, relational modeling, and user support.',
      challengesEncountered:
        'Managing concurrent user service requests while executing scheduled batch system updates.',
      questionnaire: {
        employabilityStatus: 'OJT Trainee',
        employedCompanyName: '-',
        allowanceSalary: 'None / Stipend',
        telephoneNo: supervisorContact,
        department: 'COLLEGE OF COMPUTER STUDIES',
        position: 'ON - THE - JOB TRAINEE',
        otherDeptAssigned: 'None',
        q1_dutiesBriefly:
          'Completed Month 1 practicum objectives encompassing network maintenance, user account administration, software asset tracking, and initial system architecture review.',
        q2_strongestPerformanceArea:
          'Quick turnaround on software troubleshooting tickets and meticulous asset documentation.',
        q3_areasImprovedMost:
          'Time management, task prioritization, and structured progress reporting.',
        q4_areasNeedImprovement:
          'Automated scripting for routine batch system health monitoring.',
        q5_situationChallengedMost:
          'Synchronizing database tables without interrupting daily employee data entry workflows.',
        q6_howOvercameChallenge:
          'Scheduled database batch procedures during low-traffic afternoon breaks under mentor guidance.',
        q7_whatLearnedFromExperience:
          'Clear communication with end users reduces operational friction just as much as technical accuracy.',
        q8_isQualifiedLinkage:
          'Yes, excellent industry training facility with modern equipment and patient senior supervisors.',
        q9_ojtSuggestionsRecommendations:
          'Continue fostering student intern partnerships between CHMSU and our host establishment.',
        attendanceScore: 5,
        performanceScore: 5,
        attitudeScore: 5,
        communicationScore: 5,
        teamworkScore: 5,
        overallScore: 97,
        strengths: 'Strong work ethic, courteous demeanour, and reliable technical outputs.',
        areasForImprovement: 'Explore automated bash/PowerShell scripts for recurring tasks.',
        recommendation: 'Highly Recommended',
      },
      status: 'reviewed',
      instructorRemarks:
        `Great first month ${name}! Your milestone submission demonstrates steady professional and technical maturity.`,
      reviewedByInstructorAt: '2026-10-16T14:00:00Z',
      createdAt: '2026-10-15T18:00:00Z',
    },

    // 3. Mid-Term 300h Evaluation Milestone
    {
      id: `mr-${traineeId}-mid-eval`,
      reportNumber: `CHMSU-MR-2026-${cleanCode}-EVAL`,
      reportType: 'midterm',
      term: 'midterm',
      frequency: 'evaluation',
      traineeId,
      traineeName: name,
      studentId,
      course,
      department,
      campus,
      academicYear,
      hteCompanyName,
      hteAddress,
      supervisorName,
      supervisorContact,
      supervisorDesignation: 'OJT Mentor / Supervisor',
      instructorName,
      periodCovered: 'Mid-Term Evaluation (300 Hours Milestone)',
      dateSubmitted: '2026-10-17',
      hoursRenderedThisPeriod: 140,
      totalCumulativeHours: 300,
      requiredHours,
      remainingHours: Math.max(0, requiredHours - 300),
      tasksAccomplished:
        'Achieved official 300-hour midpoint milestone. Finalized first half practicum deliverables including complete system documentation, server room patch panel re-organization, and database health audit.',
      skillsApplied:
        'Full-stack system review, structured cabling standards, relational schema normalization, client requirements elicitation.',
      challengesEncountered:
        'Consolidating disparate departmental requirements into a cohesive milestone technical report.',
      questionnaire: {
        employabilityStatus: 'OJT Trainee',
        employedCompanyName: '-',
        allowanceSalary: 'None / Stipend',
        telephoneNo: supervisorContact,
        department: 'COLLEGE OF COMPUTER STUDIES',
        position: 'ON - THE - JOB TRAINEE',
        otherDeptAssigned: 'None',
        q1_dutiesBriefly:
          'Achieved official 300-hour midpoint milestone. Finalized first half practicum deliverables including complete system documentation, server room patch panel re-organization, and database health audit.',
        q2_strongestPerformanceArea:
          'Reliable technical execution, rapid problem-solving, and cross-departmental coordination.',
        q3_areasImprovedMost:
          'Critical thinking in live IT environments, independent initiative, and formal technical writing.',
        q4_areasNeedImprovement:
          'Advanced cloud infrastructure management and automated deployment pipelines.',
        q5_situationChallengedMost:
          'Coordinating server maintenance without disrupting ongoing departmental transactions.',
        q6_howOvercameChallenge:
          'Prepared an exact phased rollout plan with supervisor approval and completed configuration ahead of deadline.',
        q7_whatLearnedFromExperience:
          'Enterprise computing success is built on rigorous preparation, thorough testing, and respectful collaboration.',
        q8_isQualifiedLinkage:
          'Yes, premier host organization providing real-world professional development for CHMSU students.',
        q9_ojtSuggestionsRecommendations:
          'Provide succeeding trainee cohorts with early orientation on host system schemas.',
        attendanceScore: 5,
        performanceScore: 5,
        attitudeScore: 5,
        communicationScore: 5,
        teamworkScore: 5,
        overallScore: 99,
        strengths: 'Outstanding progress, high initiative, and consistent positive feedback from department heads.',
        areasForImprovement: 'Focus on cloud service orchestration during the 2nd half.',
        recommendation: 'Highly Recommended',
      },
      status: 'reviewed',
      instructorRemarks:
        `Congratulations ${name} on successfully reaching the 300-hour midpoint milestone! Your technical outputs and workplace discipline are exemplary.`,
      reviewedByInstructorAt: '2026-10-17T16:45:00Z',
      createdAt: '2026-10-17T12:00:00Z',
    },

    // 4. End-Term Weekly
    {
      id: `mr-${traineeId}-end-w12`,
      reportNumber: `CHMSU-MR-2026-${cleanCode}-W12`,
      reportType: 'weekly',
      term: 'endterm',
      frequency: 'weekly',
      traineeId,
      traineeName: name,
      studentId,
      course,
      department,
      campus,
      academicYear,
      hteCompanyName,
      hteAddress,
      supervisorName,
      supervisorContact,
      supervisorDesignation: 'OJT Mentor / Supervisor',
      instructorName,
      periodCovered: 'End-Term Week 12 (November 09 – November 13, 2026)',
      dateSubmitted: '2026-11-13',
      hoursRenderedThisPeriod: 40,
      totalCumulativeHours: 480,
      requiredHours,
      remainingHours: Math.max(0, requiredHours - 480),
      tasksAccomplished:
        'Led API integration tests, authored unit test suites, optimized response caching, and verified database indexes for high-throughput reporting queries.',
      skillsApplied:
        'RESTful API testing, TypeScript, SQL index tuning, and performance profiling.',
      challengesEncountered:
        'Debugging edge cases in asynchronous state synchronization under unstable network simulation.',
      questionnaire: {
        employabilityStatus: 'OJT Trainee',
        employedCompanyName: '-',
        allowanceSalary: 'None / Stipend',
        telephoneNo: supervisorContact,
        department: 'COLLEGE OF COMPUTER STUDIES',
        position: 'ON - THE - JOB TRAINEE',
        otherDeptAssigned: 'None',
        q1_dutiesBriefly:
          'Led API integration tests, authored unit test suites, optimized response caching, and verified database indexes for high-throughput reporting queries.',
        q2_strongestPerformanceArea:
          'Software debugging, database query optimization, and structured unit testing.',
        q3_areasImprovedMost:
          'Architectural thinking, defensive programming, and code documentation.',
        q4_areasNeedImprovement:
          'CI/CD pipeline configuration and containerization with Docker.',
        q5_situationChallengedMost:
          'Pinpointing race condition in multi-client data submission.',
        q6_howOvercameChallenge:
          'Implemented optimistic locking and validated transactions with mentor guidance.',
        q7_whatLearnedFromExperience:
          'Performance optimization requires systematic benchmarking before and after code changes.',
        q8_isQualifiedLinkage:
          'Yes, top-tier engineering practices and dedicated supervisor mentoring.',
        q9_ojtSuggestionsRecommendations:
          'Maintain deep university-industry technical collaborations.',
        attendanceScore: 5,
        performanceScore: 5,
        attitudeScore: 5,
        communicationScore: 5,
        teamworkScore: 5,
        overallScore: 98,
        strengths: 'Deep technical aptitude and meticulous attention to code quality.',
        areasForImprovement: 'Expand exposure to cloud native deployment tools.',
        recommendation: 'Highly Recommended',
      },
      status: 'reviewed',
      instructorRemarks:
        `Superb second-half performance ${name}! Your database optimization and API testing demonstrate senior-level diligence.`,
      reviewedByInstructorAt: '2026-11-14T10:00:00Z',
      createdAt: '2026-11-13T17:00:00Z',
    },

    // 5. End-Term Monthly
    {
      id: `mr-${traineeId}-end-m03`,
      reportNumber: `CHMSU-MR-2026-${cleanCode}-M03`,
      reportType: 'monthly',
      term: 'endterm',
      frequency: 'monthly',
      traineeId,
      traineeName: name,
      studentId,
      course,
      department,
      campus,
      academicYear,
      hteCompanyName,
      hteAddress,
      supervisorName,
      supervisorContact,
      supervisorDesignation: 'OJT Mentor / Supervisor',
      instructorName,
      periodCovered: 'End-Term Month 3 Assessment (November 01 – November 30, 2026)',
      dateSubmitted: '2026-11-30',
      hoursRenderedThisPeriod: 160,
      totalCumulativeHours: 480,
      requiredHours,
      remainingHours: Math.max(0, requiredHours - 480),
      tasksAccomplished:
        'Finalized advanced system modules, compiled comprehensive user operating manuals, conducted staff user acceptance training, and executed data migration scripts.',
      skillsApplied:
        'Software deployment, technical documentation, end-user training, and data migration.',
      challengesEncountered:
        'Accommodating non-technical users during user acceptance testing and translating technical jargon into clear steps.',
      questionnaire: {
        employabilityStatus: 'OJT Trainee',
        employedCompanyName: '-',
        allowanceSalary: 'None / Stipend',
        telephoneNo: supervisorContact,
        department: 'COLLEGE OF COMPUTER STUDIES',
        position: 'ON - THE - JOB TRAINEE',
        otherDeptAssigned: 'None',
        q1_dutiesBriefly:
          'Finalized advanced system modules, compiled comprehensive user operating manuals, conducted staff user acceptance training, and executed data migration scripts.',
        q2_strongestPerformanceArea:
          'Translating technical procedures into user-friendly documentation and clear verbal guidance.',
        q3_areasImprovedMost:
          'Patience, pedagogical communication, and user-centered system design.',
        q4_areasNeedImprovement:
          'Automated user analytics and error tracking instrumentation.',
        q5_situationChallengedMost:
          'Conducting live training sessions across multiple departments with different skill levels.',
        q6_howOvercameChallenge:
          'Designed illustrated quick-start reference guides and walked through common user workflows step-by-step.',
        q7_whatLearnedFromExperience:
          'A system is only as effective as the users who operate it; user training is vital to project success.',
        q8_isQualifiedLinkage:
          'Yes, provides comprehensive exposure to both software engineering and organizational change management.',
        q9_ojtSuggestionsRecommendations:
          'Continue encouraging trainees to engage in end-user training sessions.',
        attendanceScore: 5,
        performanceScore: 5,
        attitudeScore: 5,
        communicationScore: 5,
        teamworkScore: 5,
        overallScore: 99,
        strengths: 'Versatile skill set bridging technical implementation and empathetic user support.',
        areasForImprovement: 'Keep expanding knowledge of cloud DevOps tooling.',
        recommendation: 'Highly Recommended',
      },
      status: 'reviewed',
      instructorRemarks:
        `Outstanding End-Term Month 3 milestone ${name}! 480 hours verified with impressive deliverables.`,
      reviewedByInstructorAt: '2026-12-01T11:30:00Z',
      createdAt: '2026-11-30T18:00:00Z',
    },

    // 6. End-Term 600h Final Completion Milestone
    {
      id: `mr-${traineeId}-end-eval`,
      reportNumber: `CHMSU-MR-2026-${cleanCode}-FINAL`,
      reportType: 'endterm',
      term: 'endterm',
      frequency: 'evaluation',
      traineeId,
      traineeName: name,
      studentId,
      course,
      department,
      campus,
      academicYear,
      hteCompanyName,
      hteAddress,
      supervisorName,
      supervisorContact,
      supervisorDesignation: 'OJT Mentor / Supervisor',
      instructorName,
      periodCovered: 'End-Term Final Completion (600 Hours Milestone)',
      dateSubmitted: '2026-12-15',
      hoursRenderedThisPeriod: 120,
      totalCumulativeHours: 600,
      requiredHours,
      remainingHours: 0,
      tasksAccomplished:
        'Completed full 600-hour practicum! Finalized all project modules, delivered official handover artifacts, completed trainee exit interview, and verified all OJT compliance documents.',
      skillsApplied:
        'Full-lifecycle software engineering, project documentation, stakeholder presentations, database administration, and institutional deployment.',
      challengesEncountered:
        'Synthesizing a semester-long body of work into concise practicum portfolio artifacts.',
      questionnaire: {
        employabilityStatus: 'OJT Trainee',
        employedCompanyName: '-',
        allowanceSalary: 'None / Stipend',
        telephoneNo: supervisorContact,
        department: 'COLLEGE OF COMPUTER STUDIES',
        position: 'ON - THE - JOB TRAINEE',
        otherDeptAssigned: 'None',
        q1_dutiesBriefly:
          'Completed full 600-hour practicum! Finalized all project modules, delivered official handover artifacts, completed trainee exit interview, and verified all OJT compliance documents.',
        q2_strongestPerformanceArea:
          'Comprehensive technical execution, problem solving under deadlines, and strong team leadership.',
        q3_areasImprovedMost:
          'Professional adaptability, end-to-end project management, and cross-functional technical communication.',
        q4_areasNeedImprovement:
          'Continuous learning in cloud distributed systems and microservices design patterns.',
        q5_situationChallengedMost:
          'Managing high-priority deliverables while ensuring rigorous security and compliance standards.',
        q6_howOvercameChallenge:
          'Applied structured task decomposition, sought timely feedback from senior mentor, and worked methodically.',
        q7_whatLearnedFromExperience:
          'Real-world software engineering is a craft of continuous learning, team collaboration, and user empathy.',
        q8_isQualifiedLinkage:
          'Yes, exceptionally qualified institution with world-class mentorship and supportive leadership.',
        q9_ojtSuggestionsRecommendations:
          'Express deep gratitude to CHMSU College of Computer Studies and our host establishment for this invaluable journey.',
        attendanceScore: 5,
        performanceScore: 5,
        attitudeScore: 5,
        communicationScore: 5,
        teamworkScore: 5,
        overallScore: 100,
        strengths: 'Exemplary intern ready for full-time professional career in the technology industry.',
        areasForImprovement: 'Maintain current passion for excellence.',
        recommendation: 'Highly Recommended',
      },
      status: 'submitted',
      instructorRemarks: '',
      createdAt: '2026-12-15T18:00:00Z',
    },
  ];
}
