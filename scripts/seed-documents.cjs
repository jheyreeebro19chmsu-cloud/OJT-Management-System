const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const envPath = path.resolve(__dirname, '..', '.env');
const env = fs.readFileSync(envPath, 'utf8');
const url = env.match(/VITE_SUPABASE_URL\s*=\s*(.*)/)?.[1]?.trim();
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY\s*=\s*(.*)/)?.[1]?.trim();

if (!url || !key) {
  console.error('Missing Supabase URL or SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(url, key);

const REQUIRED_DOCS = [
  { key: 'pledgeOfConduct', num: '1', title: 'Pledge of Conduct', fileSuffix: 'Pledge_of_Conduct_signed.pdf' },
  { key: 'medical', num: '2', title: 'Medical Certificate', fileSuffix: 'Medical_Clearance_CHMSU_Clinic.pdf' },
  { key: 'enrolmentForm', num: '3', title: 'Enrolment Form', fileSuffix: 'Certificate_of_Registration_COR.pdf' },
  { key: 'consent', num: '4', title: 'Parental Consent for Student Internship', fileSuffix: 'Parental_Consent_Waiver.pdf' },
  { key: 'resume', num: '5', title: 'Resume', fileSuffix: 'BSIS_Comprehensive_Resume.pdf' },
  { key: 'dutiesAndResponsibilities', num: '6', title: 'Duties and Responsibilities of BSIS Trainees', fileSuffix: 'Duties_and_Responsibilities_BSIS.pdf' },
  { key: 'moa', num: '7', title: 'Memorandum of Agreement', fileSuffix: 'CHMSU_HTE_Memorandum_of_Agreement.pdf' },
  { key: 'internshipAgreement', num: '8', title: 'Internship Agreement', fileSuffix: 'Workplace_Internship_Agreement.pdf' },
  { key: 'evaluationForm', num: '9', title: 'On The Job Training Evaluation Form', fileSuffix: 'HTE_OJT_Evaluation_Form.pdf' },
  { key: 'evaluationReport', num: '10', title: 'Evaluation Report', fileSuffix: 'Final_Evaluation_Report_HTE.pdf' }
];

function createDocDataUrl(title, studentName, studentId, docNum) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1100" viewBox="0 0 800 1100">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#ffffff"/>
        <stop offset="100%" stop-color="#f8fafc"/>
      </linearGradient>
      <linearGradient id="header" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#1e3a8a"/>
        <stop offset="100%" stop-color="#1d4ed8"/>
      </linearGradient>
    </defs>
    <rect width="800" height="1100" fill="url(#bg)"/>
    <rect x="25" y="25" width="750" height="1050" fill="none" stroke="#e2e8f0" stroke-width="2" rx="16"/>
    <rect x="35" y="35" width="730" height="1030" fill="none" stroke="#2563eb" stroke-width="1" stroke-dasharray="6,4" rx="12"/>
    <rect x="35" y="35" width="730" height="120" fill="url(#header)" rx="12"/>
    <text x="400" y="75" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="#93c5fd" text-anchor="middle" letter-spacing="1">CARLOS HILADO MEMORIAL STATE UNIVERSITY</text>
    <text x="400" y="100" font-family="Arial, sans-serif" font-size="20" font-weight="bold" fill="#ffffff" text-anchor="middle">OFFICE OF ON-THE-JOB TRAINING &amp; PRACTICUM</text>
    <text x="400" y="125" font-family="Arial, sans-serif" font-size="12" fill="#bfdbfe" text-anchor="middle">College of Computer Studies • Bachelor of Science in Information Systems</text>
    <rect x="60" y="190" width="680" height="60" fill="#f1f5f9" rx="8"/>
    <text x="85" y="225" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="#475569">DOCUMENT COMPLIANCE CERTIFICATION</text>
    <text x="700" y="225" font-family="Arial, sans-serif" font-size="12" font-weight="bold" fill="#2563eb" text-anchor="end">DOC #${docNum}</text>
    <text x="400" y="310" font-family="Arial, sans-serif" font-size="24" font-weight="bold" fill="#0f172a" text-anchor="middle">${title}</text>
    <line x1="200" y1="330" x2="600" y2="330" stroke="#2563eb" stroke-width="2"/>
    <text x="400" y="380" font-family="Arial, sans-serif" font-size="14" fill="#334155" text-anchor="middle">This officially certifies that the documentary requirement below has been submitted, verified,</text>
    <text x="400" y="405" font-family="Arial, sans-serif" font-size="14" fill="#334155" text-anchor="middle">and approved by the CHMSU OJT Directorate and HTE Partner Establishment.</text>
    <rect x="80" y="440" width="640" height="230" fill="#ffffff" stroke="#cbd5e1" stroke-width="1" rx="12"/>
    <text x="110" y="480" font-family="Arial, sans-serif" font-size="13" font-weight="bold" fill="#64748b">STUDENT TRAINEE</text>
    <text x="110" y="508" font-family="Arial, sans-serif" font-size="18" font-weight="bold" fill="#0f172a">${studentName}</text>
    <text x="110" y="555" font-family="Arial, sans-serif" font-size="13" font-weight="bold" fill="#64748b">STUDENT IDENTIFICATION</text>
    <text x="110" y="583" font-family="Arial, sans-serif" font-size="16" font-weight="bold" fill="#1e40af">${studentId}</text>
    <text x="430" y="480" font-family="Arial, sans-serif" font-size="13" font-weight="bold" fill="#64748b">ACADEMIC YEAR</text>
    <text x="430" y="508" font-family="Arial, sans-serif" font-size="16" font-weight="bold" fill="#0f172a">AY 2026–2027</text>
    <text x="430" y="555" font-family="Arial, sans-serif" font-size="13" font-weight="bold" fill="#64748b">COMPLIANCE STATUS</text>
    <text x="430" y="583" font-family="Arial, sans-serif" font-size="16" font-weight="bold" fill="#16a34a">✓ PASSED &amp; CERTIFIED</text>
    <rect x="80" y="700" width="640" height="110" fill="#f0fdf4" stroke="#86efac" stroke-width="1" rx="12"/>
    <text x="110" y="735" font-family="Arial, sans-serif" font-size="13" font-weight="bold" fill="#166534">OFFICIAL VERIFICATION NOTICE</text>
    <text x="110" y="765" font-family="Arial, sans-serif" font-size="13" fill="#15803d">Document verified on August 10, 2026 by CHMSU OJT Office. Meets institutional guidelines</text>
    <text x="110" y="788" font-family="Arial, sans-serif" font-size="13" fill="#15803d">under CHED Memorandum Order for Student Internship Program in the Philippines (SIPP).</text>
    <line x1="120" y1="940" x2="330" y2="940" stroke="#0f172a" stroke-width="1.5"/>
    <text x="225" y="965" font-family="Arial, sans-serif" font-size="13" font-weight="bold" fill="#0f172a" text-anchor="middle">Jhey Ree C Ebro</text>
    <text x="225" y="985" font-family="Arial, sans-serif" font-size="11" fill="#64748b" text-anchor="middle">BSIS OJT Coordinator</text>
    <line x1="470" y1="940" x2="680" y2="940" stroke="#0f172a" stroke-width="1.5"/>
    <text x="575" y="965" font-family="Arial, sans-serif" font-size="13" font-weight="bold" fill="#0f172a" text-anchor="middle">HTE Supervisor / Manager</text>
    <text x="575" y="985" font-family="Arial, sans-serif" font-size="11" fill="#64748b" text-anchor="middle">Host Training Establishment</text>
  </svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

async function run() {
  const { data: emps, error } = await supabase.from('employees').select('*');
  if (error) { console.error('Fetch error:', error); return; }
  
  const trainees = emps.filter(e => 
    e.position !== 'OJT Instructor' && 
    e.position !== 'HTE Representative' && 
    e.position !== 'Administrator' &&
    e.employee_id && !e.employee_id.startsWith('ADM-') && !e.employee_id.startsWith('HTE-')
  );
  console.log(`Found ${trainees.length} trainees to seed documents for.`);

  let updated = 0;
  for (const t of trainees) {
    const studentName = t.name || 'Trainee';
    const studentId = t.employee_id || 'OJT-2026';
    const cleanName = studentName.replace(/[^a-zA-Z0-9]/g, '_');
    const existingRegLoc = t.registration_location || {};

    const docsObj = {};
    for (const req of REQUIRED_DOCS) {
      docsObj[req.key] = {
        name: `${cleanName}_${req.fileSuffix}`,
        size: 245800 + Math.floor(Math.random() * 50000),
        fileType: 'application/pdf',
        dataUrl: createDocDataUrl(req.title, studentName, studentId, req.num),
        uploadedAt: '2026-08-10T08:30:00.000Z',
        status: 'passed',
        description: `Official verified compliance submission for ${req.title}`,
        notes: 'Duly reviewed, verified, and approved by CHMSU OJT Coordinator'
      };
    }
    // Also include legacy aliases for safety
    docsObj['endorsement'] = docsObj['moa'];
    docsObj['parent_consent'] = docsObj['consent'];
    docsObj['clearance'] = docsObj['medical'];

    const newRegLoc = {
      ...existingRegLoc,
      documents: docsObj,
      documentsPassed: true,
      documentsStatus: 'passed'
    };

    const { error: upErr } = await supabase.from('employees').update({
      registration_location: newRegLoc,
    }).eq('id', t.id);

    if (upErr) {
      console.error(`Failed for ${t.name}:`, upErr);
    } else {
      updated++;
      console.log(`[${updated}/${trainees.length}] Seeded 10 verified docs for ${t.name} (${t.employee_id})`);
    }
  }
  console.log(`\n🎉 Successfully seeded all 10 verified documents for ${updated} trainees in Supabase!`);
}

run();
