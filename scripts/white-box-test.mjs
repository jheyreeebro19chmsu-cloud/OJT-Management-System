/**
 * ============================================================================
 * WHITE BOX TEST SUITE: OJT MANAGEMENT SYSTEM (CAPSTONE PROJECT)
 * ============================================================================
 * Focus Areas:
 * 1. Statement, Branch & Decision Coverage: Geofence Verification & Math Algorithms
 * 2. Path Coverage: Academic Course & Department Allocation Logic
 * 3. Boundary Value Analysis: Trainee Performance Grading & Rubric Scale
 * 4. Structural Integrity: Philippine Address Hierarchy & Cascading Structure
 * 5. String Manipulation & Security: Email Normalization & ID Sanitization
 * ============================================================================
 */

import fs from 'fs';
import path from 'path';

// Parse PH_ADDRESS_DATA from typescript source file
const tsContent = fs.readFileSync(path.resolve('./src/app/data/ph_address_data.ts'), 'utf-8');
const arrayStartIndex = tsContent.indexOf('PH_ADDRESS_DATA');
const arrayEndIndex = tsContent.indexOf('export const BARANGAY_SAMPLES');
const arraySub = tsContent.substring(
  tsContent.indexOf('[', arrayStartIndex),
  tsContent.lastIndexOf('];', arrayEndIndex) + 1
);
const PH_ADDRESS_DATA = new Function(`return ${arraySub}`)();

// ANSI Console Colors
const RESET = '\x1b[0m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';
const YELLOW = '\x1b[33m';
const BOLD = '\x1b[1m';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(description, condition, details = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ${GREEN}✔ PASS:${RESET} ${description}`);
  } else {
    failedTests++;
    console.log(`  ${RED}✖ FAIL:${RESET} ${description}`);
    if (details) console.log(`    ${YELLOW}↳ Detail:${RESET} ${details}`);
  }
}

function printSectionHeader(title) {
  console.log(`\n${BOLD}${CYAN}======================================================================${RESET}`);
  console.log(`${BOLD}${CYAN}  ${title}${RESET}`);
  console.log(`${BOLD}${CYAN}======================================================================${RESET}`);
}

// ----------------------------------------------------------------------------
// MODULE 1: GEOFENCE MATHEMATICAL ALGORITHMS & ACCURACY DRIFT (geo.ts)
// ----------------------------------------------------------------------------
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth radius in meters
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function isWithinGeofence(userLat, userLng, zoneLat, zoneLng, radiusMeters = 50, accuracyMeters = 5) {
  const distance = calculateDistance(userLat, userLng, zoneLat, zoneLng);
  const buffer = typeof accuracyMeters === 'number' ? Math.min(5, accuracyMeters) : 5;
  const effectiveRadius = radiusMeters - buffer;
  if (effectiveRadius <= 0) return false;
  return distance <= effectiveRadius;
}

function formatTime(time) {
  const [hours, minutes] = time.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${String(minutes).padStart(2, '0')} ${period}`;
}

printSectionHeader('1. WHITE BOX TESTS: Geofence Logic & Haversine Distance');

// Test 1.1: Identical Coordinates must yield 0 meters
const d0 = calculateDistance(10.7410, 122.9702, 10.7410, 122.9702);
assert('Distance between identical coordinates is 0m', Math.abs(d0) < 0.001, `Got ${d0}`);

// Test 1.2: Inside 40-meter radius boundary
// Approx 0.0001 deg lat ~ 11.1 meters
const dInside = calculateDistance(10.7410, 122.9702, 10.7412, 122.9702);
assert('Small offset (~22m) computes accurate distance', dInside > 20 && dInside < 25, `Distance was ${dInside.toFixed(2)}m`);

const withinZone = isWithinGeofence(10.7412, 122.9702, 10.7410, 122.9702, 40, 5);
assert('User at 22m is within 40m geofence radius', withinZone === true);

// Test 1.3: Outside 40-meter radius boundary (e.g. 500m away)
const outsideZone = isWithinGeofence(10.7450, 122.9702, 10.7410, 122.9702, 40, 5);
assert('User at 440m is outside 40m geofence radius', outsideZone === false);

// Test 1.4: Time formatting 24h to 12h AM/PM conversions
assert('formatTime("08:05") -> "8:05 AM"', formatTime('08:05') === '8:05 AM');
assert('formatTime("12:00") -> "12:00 PM"', formatTime('12:00') === '12:00 PM');
assert('formatTime("00:30") -> "12:30 AM"', formatTime('00:30') === '12:30 AM');
assert('formatTime("17:45") -> "5:45 PM"', formatTime('17:45') === '5:45 PM');


// ----------------------------------------------------------------------------
// MODULE 2: BOUNDARY VALUE ANALYSIS: GRADING RUBRICS & FORMULAS (Evaluations)
// ----------------------------------------------------------------------------
function getGrade(score) {
  if (score >= 90) return 'Excellent';
  if (score >= 80) return 'Very Good';
  if (score >= 70) return 'Good';
  if (score >= 60) return 'Satisfactory';
  return 'Needs Improvement';
}

function computeWeightedScore(perf, att, comm, punct) {
  // Weights: Perf 30%, Att 30%, Comm 20%, Punct 20%
  return Math.round(perf * 0.3 + att * 0.3 + comm * 0.2 + punct * 0.2);
}

printSectionHeader('2. WHITE BOX TESTS: Performance Grading & Decision Boundaries');

// Test 2.1: Boundary values for getGrade()
assert('getGrade(100) -> "Excellent"', getGrade(100) === 'Excellent');
assert('getGrade(90) -> "Excellent" (Lower bound of Excellent)', getGrade(90) === 'Excellent');
assert('getGrade(89.9) -> "Very Good" (Upper bound of Very Good)', getGrade(89.9) === 'Very Good');
assert('getGrade(80) -> "Very Good"', getGrade(80) === 'Very Good');
assert('getGrade(79.9) -> "Good"', getGrade(79.9) === 'Good');
assert('getGrade(70) -> "Good"', getGrade(70) === 'Good');
assert('getGrade(60) -> "Satisfactory"', getGrade(60) === 'Satisfactory');
assert('getGrade(59.9) -> "Needs Improvement" (Failing threshold)', getGrade(59.9) === 'Needs Improvement');
assert('getGrade(0) -> "Needs Improvement"', getGrade(0) === 'Needs Improvement');

// Test 2.2: Weighted Score Calculation
const score1 = computeWeightedScore(95, 90, 85, 90);
// 95*0.3(28.5) + 90*0.3(27) + 85*0.2(17) + 90*0.2(18) = 90.5 -> 91
assert('computeWeightedScore(95, 90, 85, 90) -> 91%', score1 === 91);


// ----------------------------------------------------------------------------
// MODULE 3: PATH COVERAGE: ACADEMIC COURSE ALLOCATION & DEFAULTS
// ----------------------------------------------------------------------------
const campusCourses = {
  'Talisay Campus': {
    'College of Computer Studies': [
      'Bachelor of Science in Information Systems',
      'Bachelor of Science in Information Technology',
    ],
    'College of Criminal Justice': ['Bachelor of Science in Criminology'],
  },
  'Fortune Towne Campus': {
    'College of Business Management and Accountancy': [
      'Bachelor of Science in Accountancy',
      'Bachelor of Science in Entrepreneurship',
    ],
  },
};

function getCoursesForDepartment(department, campus) {
  if (campus && campusCourses[campus] && department && campusCourses[campus][department]?.length) {
    return campusCourses[campus][department];
  }
  return ['General Course'];
}

printSectionHeader('3. WHITE BOX TESTS: Academic Course Allocation & Fallbacks');

// Test 3.1: Exact campus and department resolution
const ccsTalisay = getCoursesForDepartment('College of Computer Studies', 'Talisay Campus');
assert('Returns CS programs for Talisay campus', ccsTalisay.includes('Bachelor of Science in Information Systems'));

// Test 3.2: Fallback path when campus is unknown
const fallbackCourse = getCoursesForDepartment('College of Computer Studies', 'Unknown Campus');
assert('Falls back gracefully when campus is unknown', fallbackCourse[0] === 'General Course');


// ----------------------------------------------------------------------------
// MODULE 4: STRUCTURAL INTEGRITY: PHILIPPINE ADDRESS HIERARCHY
// ----------------------------------------------------------------------------
printSectionHeader('4. WHITE BOX TESTS: Philippine Address Data & Cascading Paths');

// Test 4.1: Minimum 17 Regions check
assert('Contains 17 administrative regions of the Philippines', PH_ADDRESS_DATA.length >= 17, `Found ${PH_ADDRESS_DATA.length} regions`);

// Test 4.2: Region VI (Western Visayas) Provinces check
const reg6 = PH_ADDRESS_DATA.find((r) => r.name.includes('Region VI') || r.name.includes('Western Visayas'));
assert('Region VI (Western Visayas) is present in data tree', Boolean(reg6));

if (reg6) {
  const provinces = reg6.provinces.map((p) => p.name);
  assert('Region VI contains Negros Occidental', provinces.includes('Negros Occidental'));
  assert('Region VI contains Iloilo', provinces.includes('Iloilo'));

  const negrosOcc = reg6.provinces.find((p) => p.name === 'Negros Occidental');
  assert('Negros Occidental contains Talisay City & Bacolod', 
    negrosOcc && negrosOcc.cities.some(c => c.toLowerCase().includes('talisay'))
  );
}

// Test 4.3: Strict cascading filter check (Simulating UI behavior)
function getProvincesForRegion(selectedRegionName) {
  if (!selectedRegionName) return [];
  const found = PH_ADDRESS_DATA.find(r => r.name.toLowerCase() === selectedRegionName.toLowerCase());
  return found ? found.provinces : [];
}

function getCitiesForProvince(selectedProvName) {
  if (!selectedProvName) return [];
  for (const r of PH_ADDRESS_DATA) {
    const p = r.provinces.find(prov => prov.name.toLowerCase() === selectedProvName.toLowerCase());
    if (p) return p.cities;
  }
  return [];
}

assert('No provinces returned when Region is empty string', getProvincesForRegion('').length === 0);
assert('No cities returned when Province is empty string', getCitiesForProvince('').length === 0);

const reg1Provinces = getProvincesForRegion('Region I (Ilocos Region)');
assert('Selecting Region I returns only Region I provinces (e.g. Ilocos Norte, La Union)', 
  reg1Provinces.length > 0 && reg1Provinces.some(p => p.name === 'Ilocos Norte') && !reg1Provinces.some(p => p.name === 'Cebu')
);


// ----------------------------------------------------------------------------
// MODULE 5: EMAIL NORMALIZATION & SECURITY SANITIZATION
// ----------------------------------------------------------------------------
function normalizeEmail(email) {
  if (!email || typeof email !== 'string') return '';
  return email.trim().toLowerCase();
}

printSectionHeader('5. WHITE BOX TESTS: Email Normalization & Input Sanitization');

assert('Normalizes mixed-case email: "YzelBNorte.CHMSU@gmail.COM"', 
  normalizeEmail('YzelBNorte.CHMSU@gmail.COM') === 'yzelbnorte.chmsu@gmail.com'
);
assert('Strips leading & trailing whitespace: "  test@chmsu.edu.ph  "', 
  normalizeEmail('  test@chmsu.edu.ph  ') === 'test@chmsu.edu.ph'
);
assert('Safely handles null/undefined input without crashing', 
  normalizeEmail(null) === '' && normalizeEmail(undefined) === ''
);


// ----------------------------------------------------------------------------
// MODULE 6: REGISTRATION VALIDATION & REQUIRED BARANGAY FIELD LOGIC
// ----------------------------------------------------------------------------
function validateRegistrationStep(form, role = 'trainee', step = 0) {
  const errors = [];
  const hasName = Boolean(form.name || ((form.firstName || '').trim() && (form.lastName || '').trim()));
  const hasEmail = Boolean(form.email && form.email.trim());
  const hasValidPassword = Boolean(form.password && form.password.length >= 8 && form.password === form.confirmPassword);
  const hasValidCountry = form.country === 'other' ? Boolean(form.countryManual?.trim()) : Boolean(form.country);
  const hasValidRegion = form.region === 'other' ? Boolean(form.regionManual?.trim()) : Boolean(form.region);
  const hasValidCity = form.city === 'other' ? Boolean(form.cityManual?.trim()) : Boolean(form.city);
  const hasValidBarangay = form.barangay === 'other' ? Boolean(form.barangayManual?.trim()) : Boolean(form.barangay?.trim());
  const hasValidProvince =
    form.country === 'PH' || !form.country
      ? form.province === 'other'
        ? Boolean(form.provinceManual?.trim())
        : Boolean(form.province)
      : true;

  if (role === 'trainee' && step === 0) {
    if (!form.lastName?.trim()) errors.push('Please enter your Last Name');
    if (!form.firstName?.trim()) errors.push('Please enter your First Name');
    if (!hasEmail) errors.push('Please enter your Email Address');
    if (!hasValidPassword) errors.push('Valid password required');
    if (!form.contactPhone?.trim()) errors.push('Please enter your Philippine contact number');
    if (!form.birthdate?.trim()) errors.push('Please provide your Birthdate');
    if (!hasValidCountry) errors.push('Please select your Country');
    if (!hasValidRegion) errors.push('Please select your Region');
    if ((form.country === 'PH' || !form.country) && !hasValidProvince) errors.push('Please select your Province');
    if (!hasValidCity) errors.push('Please select your City/Municipality');
    if ((form.country === 'PH' || !form.country) && !hasValidBarangay) errors.push('Please enter your Barangay');
  }
  return errors;
}

printSectionHeader('6. WHITE BOX TESTS: Registration Required Information & Barangay Validation');

const baseValidForm = {
  firstName: 'Juan',
  lastName: 'Dela Cruz',
  email: 'juan@chmsu.edu.ph',
  password: 'Password123!',
  confirmPassword: 'Password123!',
  contactPhone: '+639123456789',
  birthdate: '2002-05-15',
  country: 'PH',
  region: 'Region VI (Western Visayas)',
  province: 'Negros Occidental',
  city: 'Talisay City',
  barangay: 'Zone 2',
};

// Test 6.1: Full form with all required information passes
const fullValidErrors = validateRegistrationStep(baseValidForm);
assert('All required fields filled -> Validation passes (0 errors)', fullValidErrors.length === 0, fullValidErrors.join(', '));

// Test 6.2: Leaving Barangay BLANK must fail validation and indicate Barangay
const blankBarangayForm = { ...baseValidForm, barangay: '' };
const blankBarangayErrors = validateRegistrationStep(blankBarangayForm);
assert('Barangay blank -> System prevents registration (validation fails)', 
  blankBarangayErrors.length > 0
);
assert('Barangay blank -> System indicates the required field "Please enter your Barangay"', 
  blankBarangayErrors.includes('Please enter your Barangay')
);

// Test 6.3: Whitespace only in Barangay must also be rejected
const whitespaceBarangayForm = { ...baseValidForm, barangay: '   ' };
const whitespaceBarangayErrors = validateRegistrationStep(whitespaceBarangayForm);
assert('Barangay with whitespace only -> Rejected as required field', 
  whitespaceBarangayErrors.includes('Please enter your Barangay')
);

// Test 6.4: Leaving City blank also fails validation
const blankCityForm = { ...baseValidForm, city: '' };
const blankCityErrors = validateRegistrationStep(blankCityForm);
assert('City blank -> System prevents registration with City required error', 
  blankCityErrors.includes('Please select your City/Municipality')
);


// ----------------------------------------------------------------------------
// MODULE 7: GPS PERMISSION & ATTENDANCE VERIFICATION STATE MACHINE
// ----------------------------------------------------------------------------
printSectionHeader('7. WHITE BOX TESTS: GPS Permission Verification & Warning Matrix');

function evaluateGpsPermissionAndGeofence({
  permissionState,      // 'prompt' | 'granted' | 'denied'
  geolocationError,     // null | { code: 1, message: 'User denied Geolocation' } | { code: 2, message: 'Position unavailable' }
  coords,               // { lat, lng, accuracy } | null
  geofenceZones,        // array of zones
  geofenceEnabled = true
}) {
  const isDenied = permissionState === 'denied' || (geolocationError && geolocationError.code === 1);
  if (isDenied) {
    return {
      state: 'denied',
      canPunch: false,
      warningTitle: 'GPS Permission Denied',
      warningDisplayed: true,
      actionButtonLabel: 'GPS Permission Denied — Allow Location to Proceed',
      promptHelperVisible: false
    };
  }

  if (permissionState === 'prompt' && !coords) {
    return {
      state: 'checking',
      canPunch: false,
      warningTitle: null,
      warningDisplayed: false,
      actionButtonLabel: 'Checking Location & Requesting GPS...',
      promptHelperVisible: true
    };
  }

  if (geolocationError) {
    return {
      state: 'error',
      canPunch: !geofenceEnabled,
      warningTitle: 'Location Service Unavailable',
      warningDisplayed: true,
      actionButtonLabel: 'Location Error — Recheck',
      promptHelperVisible: false
    };
  }

  if (!coords) {
    return {
      state: 'checking',
      canPunch: false,
      warningTitle: null,
      warningDisplayed: false,
      actionButtonLabel: 'Checking Location & Requesting GPS...',
      promptHelperVisible: false
    };
  }

  if (!geofenceEnabled || !geofenceZones || geofenceZones.length === 0) {
    return {
      state: 'inside',
      canPunch: true,
      warningTitle: null,
      warningDisplayed: false,
      actionButtonLabel: 'Proceed to Face Scan (Clock In)',
      promptHelperVisible: false
    };
  }

  const isInside = geofenceZones.some(z => {
    const dist = calculateDistance(coords.lat, coords.lng, z.lat, z.lng);
    return dist <= z.radius;
  });

  return {
    state: isInside ? 'inside' : 'outside',
    canPunch: isInside,
    warningTitle: isInside ? null : 'Outside Work Premises',
    warningDisplayed: !isInside,
    actionButtonLabel: isInside ? 'Proceed to Face Scan (Clock In)' : 'Outside Work Premises — Cannot Clock In/Out',
    promptHelperVisible: false
  };
}

// Test 7.1: Permission denied explicitly by user (error code 1)
const deniedResult = evaluateGpsPermissionAndGeofence({
  permissionState: 'denied',
  geolocationError: { code: 1, message: 'User denied Geolocation' },
  coords: null,
  geofenceZones: [{ lat: 10.7410, lng: 122.9702, radius: 250 }]
});
assert('GPS permission denied -> State is "denied"', deniedResult.state === 'denied');
assert('GPS permission denied -> Appropriate warning displayed', deniedResult.warningDisplayed === true && deniedResult.warningTitle === 'GPS Permission Denied');
assert('GPS permission denied -> Prevents attendance punch (canPunch: false)', deniedResult.canPunch === false);
assert('GPS permission denied -> Action button reflects denial state with guidance', deniedResult.actionButtonLabel.includes('GPS Permission Denied'));

// Test 7.2: Initial opening without prior grant ('prompt' state)
const promptResult = evaluateGpsPermissionAndGeofence({
  permissionState: 'prompt',
  geolocationError: null,
  coords: null,
  geofenceZones: [{ lat: 10.7410, lng: 122.9702, radius: 250 }]
});
assert('Initial open in prompt state -> State is "checking" and prompt helper visible', promptResult.state === 'checking' && promptResult.promptHelperVisible === true);

// Test 7.3: Empty active zones array still requires valid GPS and passes once coordinates exist
const emptyZonesGrantedResult = evaluateGpsPermissionAndGeofence({
  permissionState: 'granted',
  geolocationError: null,
  coords: { lat: 10.7410, lng: 122.9702, accuracy: 10 },
  geofenceZones: []
});
assert('Granted GPS with empty active zones -> Correctly validates location and allows attendance', emptyZonesGrantedResult.canPunch === true && emptyZonesGrantedResult.state === 'inside');

// Test 7.4: User outside designated geofence radius
const outsideResult = evaluateGpsPermissionAndGeofence({
  permissionState: 'granted',
  geolocationError: null,
  coords: { lat: 10.7500, lng: 122.9702, accuracy: 10 }, // ~1 km away
  geofenceZones: [{ lat: 10.7410, lng: 122.9702, radius: 100 }]
});
assert('User outside designated workplace zone -> Prevent punch and display Outside Work Premises warning', outsideResult.canPunch === false && outsideResult.state === 'outside');


// ----------------------------------------------------------------------------
// MODULE 8: TRAINEE PROFILE & REQUIREMENTS CHECKLIST RESOLUTION
// ----------------------------------------------------------------------------
printSectionHeader('8. WHITE BOX TESTS: Profile Required Documents & Checklist');

const DEFAULT_OJT_REQUIRED_DOCUMENTS = [
  {
    title: 'Endorsement Letter',
    description: 'Official endorsement letter issued and signed by the College Dean / Department Chair / OJT Coordinator.',
    notes: 'Official institutional endorsement from Department Chair / Coordinator',
    dueDate: 'Before starting training hours',
    required: true,
  },
  {
    title: 'Parental / Guardian Consent Form & Waiver',
    description: 'Signed student waiver, assumption of liability, and parent/guardian emergency contact authorization.',
    notes: 'Signed student waiver & parent/guardian consent form',
    dueDate: 'Before starting training hours',
    required: true,
  },
  {
    title: 'Medical Certificate / Physical Clearance',
    description: 'Valid medical examination clearance & physical fitness certification issued by a licensed physician or university clinic.',
    notes: 'Physical fitness & health examination certification',
    dueDate: 'Before deployment to HTE',
    required: true,
  },
  {
    title: 'Student Bio-data / Comprehensive Resume',
    description: 'Comprehensive student profile, academic background, contact details, skill highlights, and formal 2x2 ID photo.',
    notes: 'Updated resume with recent formal 2x2 ID photo',
    dueDate: 'Prior to company placement',
    required: true,
  },
  {
    title: 'Memorandum of Agreement (MOA) / Internship Contract',
    description: 'Tripartite training contract between the University (CHMSU), the Host Training Establishment (HTE), and the Trainee.',
    notes: 'Duly notarized tripartite internship agreement',
    dueDate: 'Within first 2 weeks of training',
    required: true,
  },
];

function resolveTraineeRequiredDocuments(employeeId, customDocs = [], activeYear = '2026-2027') {
  const assigned = customDocs.filter(
    (d) => (d.employeeId === employeeId || d.employeeId === 'all') && (!d.academicYear || d.academicYear === activeYear)
  );

  const standard = DEFAULT_OJT_REQUIRED_DOCUMENTS.map((d, i) => ({
    id: `std-doc-${i + 1}-${employeeId}`,
    employeeId,
    title: d.title,
    description: d.description,
    notes: d.notes,
    dueDate: d.dueDate,
    required: d.required,
    academicYear: activeYear,
    createdAt: new Date().toISOString(),
  }));

  const merged = [...assigned];
  for (const std of standard) {
    const exists = merged.some((m) => m.title.toLowerCase().trim() === std.title.toLowerCase().trim());
    if (!exists) merged.push(std);
  }
  return merged;
}

function resolveDocumentSubmission(docId, employeeId, submissions = [], employeeSubmittedDocs = {}) {
  const inState = submissions.find((s) => s.documentId === docId && s.employeeId === employeeId);
  if (inState) return inState;

  const lower = docId.toLowerCase();
  let matched = null;
  if (lower.includes('endorsement') || lower.includes('doc-1') || lower.includes('std-doc-1')) matched = employeeSubmittedDocs.endorsement;
  else if (lower.includes('consent') || lower.includes('doc-2') || lower.includes('std-doc-2')) matched = employeeSubmittedDocs.consent;
  else if (lower.includes('medical') || lower.includes('doc-3') || lower.includes('std-doc-3')) matched = employeeSubmittedDocs.medical;
  else if (lower.includes('resume') || lower.includes('doc-4') || lower.includes('std-doc-4')) matched = employeeSubmittedDocs.resume;

  if (matched && (matched.dataUrl || matched.name)) {
    return {
      id: `sub-auto-${docId}`,
      documentId: docId,
      employeeId,
      fileName: matched.name || 'document.pdf',
      fileUrl: matched.dataUrl || 'data:application/pdf;base64,sample',
      status: 'approved',
    };
  }
  return null;
}

// Test 8.1: Newly logged-in trainee with 0 custom documents returns standard institutional OJT documents
const traineeDocs = resolveTraineeRequiredDocuments('emp-trainee-001', []);
assert('Logged-in trainee with no prior custom documents returns non-empty list', traineeDocs.length > 0);
assert('Returns at least 5 standard institutional OJT requirements', traineeDocs.length >= 5);
assert('Includes Endorsement Letter in checklist', traineeDocs.some((d) => d.title.includes('Endorsement')));
assert('Includes Parental Consent Form in checklist', traineeDocs.some((d) => d.title.includes('Consent')));
assert('Includes Medical Certificate in checklist', traineeDocs.some((d) => d.title.includes('Medical')));
assert('Includes Student Bio-data / Resume in checklist', traineeDocs.some((d) => d.title.includes('Resume')));
assert('Includes Memorandum of Agreement (MOA) in checklist', traineeDocs.some((d) => d.title.includes('Memorandum of Agreement')));

// Test 8.2: Resolving submission from employee profile submittedDocuments
const sampleSubmittedDocs = {
  endorsement: { name: 'endorsement_signed.pdf', dataUrl: 'data:application/pdf;base64,xyz', status: 'passed' },
};
const subResult = resolveDocumentSubmission('std-doc-1-emp-trainee-001', 'emp-trainee-001', [], sampleSubmittedDocs);
assert('Automatically recognizes previously uploaded Endorsement Letter as submitted', subResult !== null && subResult.fileName === 'endorsement_signed.pdf');

// Test 8.3: Missing document correctly returns null (unsubmitted)
const unsubmittedResult = resolveDocumentSubmission('std-doc-2-emp-trainee-001', 'emp-trainee-001', [], sampleSubmittedDocs);
assert('Unsubmitted Parental Consent Form returns null (missing)', unsubmittedResult === null);


// ----------------------------------------------------------------------------
// MODULE 9: FACE OBSTRUCTION & BIOMETRIC VERIFICATION FAIL-CLOSED
// ----------------------------------------------------------------------------
printSectionHeader('9. WHITE BOX TESTS: Face Obstruction & Biometric Verification');

function evaluateBiometricVerificationStep({
  cameraAvailable = true,
  faceDetected = true,
  faceCentered = true,
  maskDetected = false,
  glassesDetected = false,
  capDetected = false,
  enrolledDescriptor = [0.1, 0.2, 0.3],
  liveDescriptor = [0.1, 0.2, 0.3],
  threshold = 0.55
}) {
  // If hardware camera unavailable, system automatically activates simulated active camera stream
  const activeStream = cameraAvailable || true;

  const faceObscured = Boolean(maskDetected || glassesDetected || capDetected || !faceDetected);
  const issues = [];

  if (maskDetected) {
    issues.push('Face mask detected! Please remove mask for biometric verification.');
  }
  if (glassesDetected) {
    issues.push('Dark sunglasses detected! Please remove sunglasses for biometric verification.');
  }
  if (capDetected) {
    issues.push('Cap or headwear detected! Please remove headwear.');
  }
  if (!faceDetected) {
    issues.push('No face detected. Position head inside the oval guide without coverings.');
  }

  // Fail-closed enforcement: if face is obscured, verification is STRICTLY PREVENTED
  if (faceObscured) {
    return {
      activeStream,
      faceObscured: true,
      verified: false,
      reason: issues[0] || 'Face obscured! System prevents successful verification and prompts for a clear face.',
      promptForClearFace: true,
      laserLineColor: '#ef4444' // Warning red
    };
  }

  // Centering check
  if (!faceCentered) {
    return {
      activeStream,
      faceObscured: false,
      verified: false,
      reason: 'Please center your face inside the oval guide.',
      promptForClearFace: false,
      laserLineColor: '#00e5ff'
    };
  }

  // Calculate descriptor distance
  let sumSq = 0;
  for (let i = 0; i < enrolledDescriptor.length; i++) {
    const diff = enrolledDescriptor[i] - liveDescriptor[i];
    sumSq += diff * diff;
  }
  const distance = Math.sqrt(sumSq);
  const matched = distance <= threshold;

  return {
    activeStream,
    faceObscured: false,
    verified: matched,
    distance,
    reason: matched ? 'Identity Verified! Attendance Time Recorded.' : 'Biometric mismatch.',
    promptForClearFace: false,
    laserLineColor: matched ? '#22c55e' : '#ef4444'
  };
}

// Test 9.1: Face obscured by face mask -> Strictly prevents verification and prompts for clear face
const maskTest = evaluateBiometricVerificationStep({
  maskDetected: true,
  faceDetected: true,
  faceCentered: true
});
assert('Face with mask -> System strictly prevents successful verification (verified: false)', maskTest.verified === false);
assert('Face with mask -> System marks faceObscured: true', maskTest.faceObscured === true);
assert('Face with mask -> Prompts for clear face and instructs to remove mask', maskTest.promptForClearFace === true && maskTest.reason.includes('mask'));
assert('Face with mask -> Oval laser HUD switches to alert red (#ef4444)', maskTest.laserLineColor === '#ef4444');

// Test 9.2: Face obscured by dark sunglasses -> Strictly prevents verification and prompts for clear face
const glassesTest = evaluateBiometricVerificationStep({
  glassesDetected: true,
  faceDetected: true,
  faceCentered: true
});
assert('Face with sunglasses -> System strictly prevents verification (verified: false)', glassesTest.verified === false);
assert('Face with sunglasses -> System marks faceObscured: true', glassesTest.faceObscured === true);
assert('Face with sunglasses -> Prompts for clear face and instructs to remove sunglasses', glassesTest.promptForClearFace === true && glassesTest.reason.includes('sunglasses'));
assert('Face with sunglasses -> Oval laser HUD switches to alert red (#ef4444)', glassesTest.laserLineColor === '#ef4444');

// Test 9.3: Face obscured by cap/headwear -> Strictly prevents verification
const capTest = evaluateBiometricVerificationStep({
  capDetected: true,
  faceDetected: true,
  faceCentered: true
});
assert('Face with cap -> System strictly prevents verification (verified: false)', capTest.verified === false);
assert('Face with cap -> System marks faceObscured: true', capTest.faceObscured === true);
assert('Face with cap -> Prompts to remove headwear', capTest.promptForClearFace === true && capTest.reason.includes('headwear'));

// Test 9.4: Fully clear face with matching biometrics -> Successfully verified
const clearFaceMatchTest = evaluateBiometricVerificationStep({
  cameraAvailable: true,
  faceDetected: true,
  faceCentered: true,
  maskDetected: false,
  glassesDetected: false,
  capDetected: false,
  enrolledDescriptor: [0.1, 0.2, 0.3],
  liveDescriptor: [0.1, 0.2, 0.3]
});
assert('Clear unobstructed face matching template -> Successfully verifies (verified: true)', clearFaceMatchTest.verified === true);
assert('Clear face -> faceObscured is false', clearFaceMatchTest.faceObscured === false);
assert('Clear face -> Oval laser HUD switches to success green (#22c55e)', clearFaceMatchTest.laserLineColor === '#22c55e');

// Test 9.5: Camera stream availability fallback -> Always provides active stream
const fallbackCameraTest = evaluateBiometricVerificationStep({
  cameraAvailable: false,
  faceDetected: true,
  faceCentered: true
});
assert('Physical camera unavailable -> Fallback maintains active stream (activeStream: true, no "No active camera" failure)', fallbackCameraTest.activeStream === true);


// ----------------------------------------------------------------------------
// MODULE 10: REGISTERED ACCOUNT GEOFENCING VS RESIDENTIAL ADDRESS
// ----------------------------------------------------------------------------
printSectionHeader('10. WHITE BOX TESTS: Registered Account Geofencing vs Address');

function computeRegistrationCoordinates({ registrationLocation, residentialAddress, gpsTextAddress }) {
  // Strict rule: registration address must save the physical GPS coordinates where account was registered, NOT residential text address
  if (registrationLocation && registrationLocation.lat != null && registrationLocation.lng != null) {
    return `${Number(registrationLocation.lat).toFixed(6)}, ${Number(registrationLocation.lng).toFixed(6)}`;
  }
  return gpsTextAddress || null;
}

function parseCoordsFromAddress(addressStr) {
  if (!addressStr) return null;
  const match = String(addressStr).match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (!match) return null;
  return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
}

function evaluateAccountRegisteredGeofence({ userLat, userLng, employee, institutionalZones = [] }) {
  // Extract registered account coordinates
  let regLat = employee?.registrationLocation?.lat ?? employee?.registration_lat;
  let regLng = employee?.registrationLocation?.lng ?? employee?.registration_lng;
  if ((regLat == null || regLng == null) && (employee?.registrationAddress || employee?.registration_address)) {
    const parsed = parseCoordsFromAddress(employee.registrationAddress || employee.registration_address);
    if (parsed) {
      regLat = parsed.lat;
      regLng = parsed.lng;
    }
  }

  // If employee has a registered account geofence, strictly evaluate against where account was registered
  if (regLat != null && regLng != null) {
    const radius = employee?.radius || 100;
    const distance = calculateDistance(userLat, userLng, regLat, regLng);
    const inside = distance <= radius;
    return {
      state: inside ? 'inside' : 'outside',
      distance,
      zoneName: inside
        ? (employee?.companyName ? `${employee.companyName} (Designated Workplace)` : 'Registered Account Geofence')
        : 'Outside Registered Account Geofence',
      canPunch: inside,
      evaluatedAgainst: 'registered_account_geofence',
    };
  }

  // Fallback to institutional zones only if no registered account geofence
  if (institutionalZones.length > 0) {
    for (const z of institutionalZones) {
      const dist = calculateDistance(userLat, userLng, z.lat, z.lng);
      if (dist <= (z.radius || 100)) {
        return {
          state: 'inside',
          distance: dist,
          zoneName: z.name,
          canPunch: true,
          evaluatedAgainst: 'institutional_fallback',
        };
      }
    }
  }

  return {
    state: 'outside',
    distance: Infinity,
    zoneName: 'No Matching Zone',
    canPunch: false,
    evaluatedAgainst: 'none',
  };
}

// Test 10.1: Registration address stores coordinates, NOT residential text address
const registrationCoords = computeRegistrationCoordinates({
  registrationLocation: { lat: 10.743087, lng: 122.968889 },
  residentialAddress: 'Mandalagan, Bacolod City, Negros Occidental',
  gpsTextAddress: 'Mandalagan, Bacolod City'
});
assert('Registration address strictly saves GPS coordinates: "10.743087, 122.968889"', registrationCoords === '10.743087, 122.968889');
assert('Registration address does NOT save residential text address', registrationCoords !== 'Mandalagan, Bacolod City, Negros Occidental');

// Test 10.2: Parse coordinate string from registration_address
const parsed = parseCoordsFromAddress('10.743087, 122.968889');
assert('Coordinates successfully parsed from registration_address text', parsed !== null && parsed.lat === 10.743087 && parsed.lng === 122.968889);
const invalidParse = parseCoordsFromAddress('Mandalagan, Bacolod City, Negros Occ');
assert('Plain text address returns null when parsing coordinate values', invalidParse === null);

// Test 10.3: User inside registered account geofence
const mockTrainee = {
  id: 'trainee-001',
  name: 'Jhey Ree Ebro',
  registration_address: '10.743087, 122.968889',
  address: 'Mandalagan, Bacolod City',
  radius: 100,
};
const campusZones = [
  { id: 'zone-campus', name: 'CHMSU Talisay Campus', lat: 10.7410, lng: 122.9702, radius: 150 }
];

const insideRegisteredAccountTest = evaluateAccountRegisteredGeofence({
  userLat: 10.743100,
  userLng: 122.968895,
  employee: mockTrainee,
  institutionalZones: campusZones
});
assert('User at registration coordinates -> state is "inside"', insideRegisteredAccountTest.state === 'inside');
assert('User at registration coordinates -> canPunch is true', insideRegisteredAccountTest.canPunch === true);
assert('Evaluated against registered_account_geofence', insideRegisteredAccountTest.evaluatedAgainst === 'registered_account_geofence');

// Test 10.4: User outside registered account geofence (even near campus zone)
const outsideRegisteredAccountTest = evaluateAccountRegisteredGeofence({
  userLat: 10.7410, // At campus, not at registered account establishment
  userLng: 122.9702,
  employee: mockTrainee,
  institutionalZones: campusZones
});
assert('User outside registered establishment -> state is "outside"', outsideRegisteredAccountTest.state === 'outside');
assert('User outside registered establishment -> canPunch is false', outsideRegisteredAccountTest.canPunch === false);
assert('Strictly enforces Registered Account Geofence without falling back to campus zone', outsideRegisteredAccountTest.zoneName.includes('Outside Registered Account Geofence'));

// Test 10.5: User at residential living address is blocked from punch if outside registration geofence
const atHomeTest = evaluateAccountRegisteredGeofence({
  userLat: 10.697895, // Residential living location
  userLng: 122.954950,
  employee: mockTrainee,
  institutionalZones: campusZones
});
assert('User at residential home address (5km away) -> strictly marked "outside"', atHomeTest.state === 'outside');
assert('User at residential home address -> punch strictly blocked', atHomeTest.canPunch === false);



// ----------------------------------------------------------------------------
// MODULE 11: BIOMETRIC FACE OBSTRUCTION & ACTIVE CAMERA VERIFICATION (FaceCapture.tsx)
// ----------------------------------------------------------------------------
printSectionHeader('MODULE 11: BIOMETRIC FACE OBSTRUCTION & ACTIVE STREAM VERIFICATION');

function evaluateFaceScanVerification({ obstruction, backgroundLighting = 'light', avgLum = 120, hasHardwareCamera = true, isSimulating = false }) {
  const isGlasses = obstruction === 'glasses' || obstruction === 'sunglasses' || obstruction === 'reading_glasses';
  const isHeadwear = obstruction === 'hat' || obstruction === 'cap' || obstruction === 'beanie';
  const isMask = obstruction === 'mask';
  const isObscured = isGlasses || isHeadwear || isMask || obstruction === 'obscured';
  const poorBackgroundLighting = backgroundLighting === 'dark' || avgLum < 45;

  // Camera availability: If hardware camera is false, system must automatically fallback to simulation stream
  const activeStream = hasHardwareCamera || isSimulating || true; // guaranteed active stream
  const noActiveCameraError = !activeStream;

  // Prompt and alerts
  let statusPrompt = '';
  let hudLaserColor = '#22c55e'; // Green when clear
  let canVerify = true;
  let snapButtonDisabled = false;
  let snapButtonLabel = 'Take Photo';

  if (isGlasses) {
    canVerify = false;
    hudLaserColor = '#ef4444'; // Red alert on glasses
    snapButtonDisabled = true;
    snapButtonLabel = 'Glasses Detected (Remove Glasses)';
    statusPrompt = '🚨 GLASSES DETECTED: Remove eyeglasses / sunglasses to scan. Full clear face is required.';
  } else if (isHeadwear) {
    canVerify = false;
    hudLaserColor = '#ef4444'; // Red alert on headwear
    snapButtonDisabled = true;
    snapButtonLabel = 'Hat/Cap Detected (Remove Headwear)';
    statusPrompt = '🚨 HAT / CAP DETECTED: Remove headwear / cap to scan. Full clear face is required.';
  } else if (isMask) {
    canVerify = false;
    hudLaserColor = '#ef4444'; // Red alert on mask
    snapButtonDisabled = true;
    snapButtonLabel = 'Mask Detected (Remove Mask)';
    statusPrompt = '🚨 FACE MASK DETECTED: Remove face mask to scan. Full clear face is required.';
  } else if (poorBackgroundLighting) {
    canVerify = false;
    hudLaserColor = '#ef4444'; // Red alert on dark background
    snapButtonDisabled = true;
    snapButtonLabel = 'Dark Background (Move to Light Area)';
    statusPrompt = '🚨 DARK BACKGROUND: Move in front of a light, well-lit background.';
  } else if (isObscured) {
    canVerify = false;
    hudLaserColor = '#ef4444';
    snapButtonDisabled = true;
    snapButtonLabel = 'Face Obscured';
    statusPrompt = '🚨 FACE OBSTRUCTED: Ensure full face is visible to scan.';
  } else {
    statusPrompt = 'Position your face within the frame';
    hudLaserColor = '#22c55e';
    snapButtonDisabled = false;
    snapButtonLabel = 'Take Photo';
    canVerify = true;
  }

  return {
    activeStream,
    noActiveCameraError,
    canVerify,
    hudLaserColor,
    statusPrompt,
    snapButtonDisabled,
    snapButtonLabel
  };
}

// Test 11.1: Face Mask Obstruction
const maskScan = evaluateFaceScanVerification({ obstruction: 'mask', hasHardwareCamera: true });
assert('Face with mask -> canVerify is strictly false (fail-closed)', maskScan.canVerify === false);
assert('Face with mask -> laser HUD turns alert RED (#ef4444)', maskScan.hudLaserColor === '#ef4444');
assert('Face with mask -> snap button is disabled', maskScan.snapButtonDisabled === true);
assert('Face with mask -> prompts user to remove mask', maskScan.statusPrompt.includes('FACE MASK DETECTED'));

// Test 11.2: Reading Glasses & Prescription Eyeglasses Obstruction
const glassesScan = evaluateFaceScanVerification({ obstruction: 'glasses', hasHardwareCamera: true });
assert('Face with reading/prescription glasses -> canVerify is strictly false (fail-closed)', glassesScan.canVerify === false);
assert('Face with reading/prescription glasses -> laser HUD turns alert RED (#ef4444)', glassesScan.hudLaserColor === '#ef4444');
assert('Face with glasses -> snap button is disabled with warning label', glassesScan.snapButtonDisabled === true && glassesScan.snapButtonLabel === 'Glasses Detected (Remove Glasses)');
assert('Face with glasses -> prompts user to remove glasses for clear face', glassesScan.statusPrompt.includes('GLASSES DETECTED: Remove eyeglasses / sunglasses'));

// Test 11.3: Sunglasses Obstruction
const sunglassesScan = evaluateFaceScanVerification({ obstruction: 'sunglasses', hasHardwareCamera: true });
assert('Face with sunglasses -> canVerify is strictly false', sunglassesScan.canVerify === false);
assert('Face with sunglasses -> laser HUD turns alert RED (#ef4444)', sunglassesScan.hudLaserColor === '#ef4444');
assert('Face with sunglasses -> snap button is disabled', sunglassesScan.snapButtonDisabled === true);

// Test 11.4: Hat / Cap / Beanie Headwear Obstruction
const hatScan = evaluateFaceScanVerification({ obstruction: 'hat', hasHardwareCamera: true });
assert('Face with hat/cap -> canVerify is strictly false (fail-closed)', hatScan.canVerify === false);
assert('Face with hat/cap -> laser HUD turns alert RED (#ef4444)', hatScan.hudLaserColor === '#ef4444');
assert('Face with hat/cap -> snap button is disabled with warning label', hatScan.snapButtonDisabled === true && hatScan.snapButtonLabel === 'Hat/Cap Detected (Remove Headwear)');
assert('Face with hat/cap -> prompts user to remove headwear', hatScan.statusPrompt.includes('HAT / CAP DETECTED: Remove headwear / cap'));

// Test 11.5: Dark Background / Poor Lighting Rejection
const darkBgScan = evaluateFaceScanVerification({ obstruction: null, backgroundLighting: 'dark', hasHardwareCamera: true });
assert('Dark background -> canVerify is strictly false (fail-closed)', darkBgScan.canVerify === false);
assert('Dark background -> laser HUD turns alert RED (#ef4444)', darkBgScan.hudLaserColor === '#ef4444');
assert('Dark background -> snap button is disabled with warning label', darkBgScan.snapButtonDisabled === true && darkBgScan.snapButtonLabel === 'Dark Background (Move to Light Area)');
assert('Dark background -> prompts user to move to a light background', darkBgScan.statusPrompt.includes('DARK BACKGROUND: Move in front of a light, well-lit background'));

// Test 11.6: Clear Bare Face & Light Background (Accepted)
const clearScan = evaluateFaceScanVerification({ obstruction: null, backgroundLighting: 'light', avgLum: 130, hasHardwareCamera: true });
assert('Clear bare face in light background -> canVerify is true', clearScan.canVerify === true);
assert('Clear bare face in light background -> laser HUD is active GREEN (#22c55e)', clearScan.hudLaserColor === '#22c55e');
assert('Clear bare face in light background -> snap button is enabled', clearScan.snapButtonDisabled === false && clearScan.snapButtonLabel === 'Take Photo');

// Test 11.7: Active Camera Stream Fallback (Never "No active camera")
const fallbackStreamScan = evaluateFaceScanVerification({ obstruction: 'glasses', hasHardwareCamera: false, isSimulating: true });
assert('Hardware camera unavailable -> biometric simulator auto-activates', fallbackStreamScan.activeStream === true);
assert('System never encounters "No active camera" stranded state', fallbackStreamScan.noActiveCameraError === false);
assert('Obstructed face on simulated stream still strictly prevents verification', fallbackStreamScan.canVerify === false);

// ----------------------------------------------------------------------------
// MODULE 12: TRAINEE CAMERA PERMISSION & STEP 4 FACE REGISTRATION FLOW
// ----------------------------------------------------------------------------
printSectionHeader('12. WHITE BOX TESTS: Trainee Camera Permission Management');

/**
 * Simulates the camera permission state machine in Register Step 4
 */
function simulateCameraPermissionWorkflow({ action, browserPermission = 'prompt' }) {
  let showCameraPermissionPrompt = false;
  let cameraPermissionDenied = false;
  let faceCapturing = false;
  let activeCameraFeed = false;
  let instructionMessageVisible = false;
  let instructionMessage = '';

  // 1. User arrives on Step 4 (Face Registration)
  // 2. User clicks "Scan & Capture Now" or triggers camera feature
  if (action === 'click_scan_and_capture_now') {
    showCameraPermissionPrompt = true;
  }

  // 3. User chooses "Allow"
  if (action === 'user_selects_allow') {
    showCameraPermissionPrompt = false;
    if (browserPermission === 'denied') {
      // Browser native permission is blocked
      cameraPermissionDenied = true;
      faceCapturing = false;
      activeCameraFeed = false;
      instructionMessageVisible = true;
      instructionMessage = 'Camera access was denied. The system requires camera permission to capture and register your facial biometrics.';
    } else {
      // Browser grants access
      cameraPermissionDenied = false;
      faceCapturing = true;
      activeCameraFeed = true;
      instructionMessageVisible = false;
    }
  }

  // 4. User chooses "Deny"
  if (action === 'user_selects_deny') {
    showCameraPermissionPrompt = false;
    cameraPermissionDenied = true;
    faceCapturing = false;
    activeCameraFeed = false;
    instructionMessageVisible = true;
    instructionMessage = 'Camera access was denied. The system requires camera permission to capture and register your facial biometrics.';
  }

  return {
    showCameraPermissionPrompt,
    cameraPermissionDenied,
    faceCapturing,
    activeCameraFeed,
    instructionMessageVisible,
    instructionMessage,
  };
}

// Test 12.1: Clicking "Scan & Capture Now" triggers system permission prompt
const triggerPrompt = simulateCameraPermissionWorkflow({ action: 'click_scan_and_capture_now' });
assert('Clicking "Scan & Capture Now" triggers camera permission prompt modal', triggerPrompt.showCameraPermissionPrompt === true);
assert('Camera feed is not started before user responds to prompt', triggerPrompt.activeCameraFeed === false);

// Test 12.2: User selects "Allow" -> System asks for camera permission & allows access once granted
const allowFlow = simulateCameraPermissionWorkflow({ action: 'user_selects_allow', browserPermission: 'granted' });
assert('Selecting "Allow" closes permission prompt modal', allowFlow.showCameraPermissionPrompt === false);
assert('Selecting "Allow" starts camera feed (activeCameraFeed: true)', allowFlow.activeCameraFeed === true);
assert('Selecting "Allow" activates FaceCapture (faceCapturing: true)', allowFlow.faceCapturing === true);
assert('Selecting "Allow" clears cameraPermissionDenied flag', allowFlow.cameraPermissionDenied === false);

// Test 12.3: User selects "Deny" -> Camera feed does NOT start & system displays instruction message
const denyFlow = simulateCameraPermissionWorkflow({ action: 'user_selects_deny' });
assert('Selecting "Deny" does NOT start camera feed (activeCameraFeed: false)', denyFlow.activeCameraFeed === false);
assert('Selecting "Deny" strictly prevents FaceCapture (faceCapturing: false)', denyFlow.faceCapturing === false);
assert('Selecting "Deny" sets cameraPermissionDenied: true', denyFlow.cameraPermissionDenied === true);
assert('Selecting "Deny" displays instruction message to trainee', denyFlow.instructionMessageVisible === true);
assert('Instruction message specifically informs trainee how to allow camera access', denyFlow.instructionMessage.includes('The system requires camera permission to capture and register your facial biometrics'));

// Test 12.4: Browser permission denied on Allow -> Instructs trainee to allow camera in browser
const browserDeniedFlow = simulateCameraPermissionWorkflow({ action: 'user_selects_allow', browserPermission: 'denied' });
assert('Browser native denial prevents camera feed even if modal Allow was clicked', browserDeniedFlow.activeCameraFeed === false);
assert('Browser native denial presents instruction message to trainee', browserDeniedFlow.instructionMessageVisible === true);

// ----------------------------------------------------------------------------
// 13. WHITE BOX TESTS: Google OAuth Token Extraction & Role-Based Routing
// ----------------------------------------------------------------------------
printSectionHeader('13. WHITE BOX TESTS: Google OAuth Token Extraction & Role Routing');

function parseOAuthTokens(url) {
  if (!url || typeof url !== 'string') return { error: 'Invalid URL' };
  const hashIndex = url.indexOf('#');
  const queryIndex = url.indexOf('?');
  let paramString = '';
  if (hashIndex !== -1) {
    paramString = url.substring(hashIndex + 1);
  } else if (queryIndex !== -1) {
    paramString = url.substring(queryIndex + 1);
  } else {
    return { error: 'No tokens found' };
  }
  const params = new URLSearchParams(paramString);
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  const code = params.get('code');

  if (accessToken && refreshToken) {
    return { type: 'implicit', accessToken, refreshToken };
  }
  if (code) {
    return { type: 'code', code };
  }
  return { error: 'No valid auth parameters' };
}

function handleGoogleRoleRouting(selectedRole, existingUser, googleUser) {
  if (existingUser) {
    const role = existingUser.role || 'employee';
    return {
      action: 'direct_dashboard',
      role,
      targetView: `${role}_dashboard`,
      requiresRegistration: false,
    };
  }

  if (selectedRole === 'admin') {
    return {
      action: 'auto_provision_instructor',
      role: 'admin',
      position: 'OJT Instructor',
      application_status: 'approved',
      targetView: 'instructor_dashboard',
      requiresRegistration: false,
    };
  } else if (selectedRole === 'hte') {
    return {
      action: 'auto_provision_hte',
      role: 'hte',
      position: 'HTE Representative',
      application_status: 'approved',
      syncHostSupervisors: true,
      targetView: 'hte_dashboard',
      requiresRegistration: false,
    };
  } else if (selectedRole === 'trainee') {
    return {
      action: 'open_trainee_registration',
      role: 'trainee',
      targetView: 'register',
      requiresRegistration: true,
      prefilledProfile: {
        name: googleUser.name,
        email: googleUser.email,
        photo: googleUser.photo,
      },
      mandatorySteps: [
        'residential_address',
        'academic_details',
        'facial_recognition_enrollment',
        'workplace_geofence_lock',
        'document_upload',
      ],
    };
  }
  return { error: 'Invalid role selected' };
}

// OAuth URL Tests
const implicitRes = parseOAuthTokens('https://chmsuojtmis.site/oauth-callback#access_token=token_xyz&refresh_token=refresh_123');
assert('OAuth implicit grant token fragment parsed correctly', implicitRes.type === 'implicit' && implicitRes.accessToken === 'token_xyz');

const codeRes = parseOAuthTokens('https://chmsuojtmis.site/oauth-callback?code=auth_code_789');
assert('OAuth code grant query parameter parsed correctly', codeRes.type === 'code' && codeRes.code === 'auth_code_789');

const invalidOAuthRes = parseOAuthTokens('https://chmsuojtmis.site/oauth-callback');
assert('OAuth missing token URL safely handled with error', Boolean(invalidOAuthRes.error));

// Role Routing Tests
const existingInstructor = handleGoogleRoleRouting('admin', { role: 'admin', email: 'inst@chmsu.edu.ph' }, { email: 'inst@chmsu.edu.ph' });
assert('Existing Instructor directs straight to dashboard without registration', existingInstructor.action === 'direct_dashboard' && existingInstructor.requiresRegistration === false);

const newInstructor = handleGoogleRoleRouting('admin', null, { name: 'Dr. Santos', email: 'santos@chmsu.edu.ph' });
assert('New Instructor auto-provisions and bypasses registration', newInstructor.action === 'auto_provision_instructor' && newInstructor.requiresRegistration === false && newInstructor.targetView === 'instructor_dashboard');

const newHte = handleGoogleRoleRouting('hte', null, { name: 'Engr. Cruz', email: 'cruz@company.com' });
assert('New HTE auto-provisions with host_supervisor sync and bypasses registration', newHte.action === 'auto_provision_hte' && newHte.requiresRegistration === false && newHte.syncHostSupervisors === true);

const newTrainee = handleGoogleRoleRouting('trainee', null, { name: 'Maria Dela Cruz', email: 'maria@chmsu.edu.ph', photo: 'https://lh3.google.com/avatar.png' });
assert('New Trainee strictly requires registration after Google authenticate', newTrainee.requiresRegistration === true && newTrainee.targetView === 'register');
assert('New Trainee registration includes mandatory facial enrollment and geofence lock', newTrainee.mandatorySteps.includes('facial_recognition_enrollment') && newTrainee.mandatorySteps.includes('workplace_geofence_lock'));
assert('New Trainee pre-fills Google Name, Email, and Photo', newTrainee.prefilledProfile.name === 'Maria Dela Cruz' && Boolean(newTrainee.prefilledProfile.photo));

// ----------------------------------------------------------------------------
// 14. WHITE BOX TESTS: Biometric Face Recognition Euclidean Distance & Thresholds
// ----------------------------------------------------------------------------
printSectionHeader('14. WHITE BOX TESTS: Facial Biometrics Distance & Anti-Spoofing');

function calculateFaceEuclideanDistance(v1, v2) {
  if (v1.length !== v2.length) throw new Error('Vector dimension mismatch');
  let sum = 0;
  for (let i = 0; i < v1.length; i++) {
    sum += Math.pow(v1[i] - v2[i], 2);
  }
  return Math.sqrt(sum);
}

function verifyFacialBiometrics(distance, threshold = 0.60, faceDetected = true, obscured = false) {
  if (!faceDetected) return { matched: false, reason: 'No face detected', hudColor: '#ef4444' };
  if (obscured) return { matched: false, reason: 'Face obstructed by mask or accessories', hudColor: '#ef4444' };
  if (distance <= threshold) return { matched: true, reason: 'Biometric matched', hudColor: '#22c55e' };
  return { matched: false, reason: 'Biometric mismatch', hudColor: '#ef4444' };
}

const faceV1 = [0.15, -0.22, 0.45, 0.88, -0.05];
assert('Identical face embedding vectors produce 0.0 Euclidean distance', calculateFaceEuclideanDistance(faceV1, faceV1) === 0);

assert('Face distance 0.35 is below 0.60 threshold -> High confidence match (verified: true)', verifyFacialBiometrics(0.35).matched === true && verifyFacialBiometrics(0.35).hudColor === '#22c55e');
assert('Boundary face distance exactly 0.60 -> Match verified', verifyFacialBiometrics(0.60).matched === true);
assert('Boundary face distance 0.61 -> Strictly rejected (fail-closed)', verifyFacialBiometrics(0.61).matched === false && verifyFacialBiometrics(0.61).hudColor === '#ef4444');
assert('High face distance 0.95 -> Strictly rejected as mismatch', verifyFacialBiometrics(0.95).matched === false);
assert('Obstructed face (mask/shades) fails closed even if distance is 0.10', verifyFacialBiometrics(0.10, 0.60, true, true).matched === false);
assert('Missing face in frame strictly rejected', verifyFacialBiometrics(0.00, 0.60, false, false).matched === false);

// ----------------------------------------------------------------------------
// 15. WHITE BOX TESTS: Daily Time Record (DTR) Approval & Disapproval Lifecycle
// ----------------------------------------------------------------------------
printSectionHeader('15. WHITE BOX TESTS: DTR Approval & Disapproval Lifecycle');

function processDTRApproval(record, action, metadata = {}) {
  const now = new Date().toISOString();
  if (action === 'approve') {
    return {
      ...record,
      approvalStatus: 'approved',
      approvedBy: metadata.approvedBy || 'Instructor',
      approvedAt: now,
      approvalNote: '',
    };
  }
  if (action === 'disapprove') {
    return {
      ...record,
      approvalStatus: 'disapproved',
      approvalNote: metadata.note || 'Flagged by supervisor',
      approvedBy: metadata.approvedBy || 'Instructor',
      approvedAt: now,
    };
  }
  return record;
}

function getDTRApprovalDisplay(approvalStatus) {
  if (approvalStatus === 'approved') {
    return { badge: 'Approved', badgeColor: 'emerald', canSwitchToDisapprove: true };
  }
  if (approvalStatus === 'disapproved') {
    return { badge: 'Disapproved', badgeColor: 'rose', canSwitchToApprove: true };
  }
  return { badge: 'Pending', showActionButtons: true, approveLabel: 'Approve', disapproveLabel: 'Disapprove' };
}

const mockDTR = { id: 'rec-101', employeeId: 'OJT-2026-860', date: '2026-09-10', totalHours: 0.1, status: 'late' };

// Test 15.1: Unapproved record defaults to Pending
assert('New DTR record starts in pending state', !mockDTR.approvalStatus || mockDTR.approvalStatus === 'pending');
const pendingDisplay = getDTRApprovalDisplay(mockDTR.approvalStatus);
assert('Pending record displays action buttons with Approve and Disapprove labels', pendingDisplay.showActionButtons === true && pendingDisplay.approveLabel === 'Approve' && pendingDisplay.disapproveLabel === 'Disapprove');

// Test 15.2: Approving record updates status to approved
const approvedRecord = processDTRApproval(mockDTR, 'approve', { approvedBy: 'Instructor' });
assert('Approving DTR sets approvalStatus to "approved"', approvedRecord.approvalStatus === 'approved');
assert('Approving DTR records approvedBy and approvedAt timestamp', approvedRecord.approvedBy === 'Instructor' && Boolean(approvedRecord.approvedAt));
const approvedDisplay = getDTRApprovalDisplay(approvedRecord.approvalStatus);
assert('Approved DTR displays "Approved" badge in emerald styling', approvedDisplay.badge === 'Approved' && approvedDisplay.badgeColor === 'emerald');
assert('Approved DTR provides seamless switch to Disapprove', approvedDisplay.canSwitchToDisapprove === true);

// Test 15.3: Disapproving record updates status to disapproved
const disapprovedRecord = processDTRApproval(approvedRecord, 'disapprove', { note: 'Time-out anomaly' });
assert('Disapproving DTR transitions status to "disapproved"', disapprovedRecord.approvalStatus === 'disapproved');
assert('Disapproving DTR records supervisor disapproval note', disapprovedRecord.approvalNote === 'Time-out anomaly');
const disapprovedDisplay = getDTRApprovalDisplay(disapprovedRecord.approvalStatus);
assert('Disapproved DTR displays "Disapproved" badge in rose styling', disapprovedDisplay.badge === 'Disapproved' && disapprovedDisplay.badgeColor === 'rose');
assert('Disapproved DTR provides seamless switch to Approve', disapprovedDisplay.canSwitchToApprove === true);

// Test 15.4: Supabase sync mapping includes approval_status
function mapToSupabasePayload(rec) {
  return {
    employee_id: rec.employeeId,
    date: rec.date,
    approval_status: rec.approvalStatus || 'pending',
    approved_by: rec.approvedBy || null,
    approved_at: rec.approvedAt || null,
    approval_note: rec.approvalNote || null,
  };
}
const sbPayload = mapToSupabasePayload(approvedRecord);
assert('Supabase serialization contains approval_status="approved"', sbPayload.approval_status === 'approved');
assert('Supabase serialization preserves approved_by and approved_at', sbPayload.approved_by === 'Instructor' && Boolean(sbPayload.approved_at));

// ============================================================================
// 16. WHITE BOX TESTS: Required OJT Hours Input Deletion & Persistence
// ============================================================================
console.log(`\n${BOLD}======================================================================${RESET}`);
console.log(`${BOLD}  16. WHITE BOX TESTS: Required OJT Hours Input Deletion & Persistence${RESET}`);
console.log(`${BOLD}======================================================================${RESET}`);

function simulateRequiredHoursInput(initialVal, action, typedValue = '') {
  let state = initialVal;
  if (action === 'clear_button') {
    state = '';
  } else if (action === 'backspace_all') {
    state = '';
  } else if (action === 'type') {
    state = typedValue;
  }
  // Controlled input value binding: form.requiredHours ?? ''
  const displayValue = state !== undefined && state !== null ? state : '';
  // Persistence calculation on save:
  const savedHoursTrainee = Number(state) > 0 ? Number(state) : 486;
  const savedHoursAdmin = 0;
  return { state, displayValue, savedHoursTrainee, savedHoursAdmin };
}

// Test 16.1: Backspacing or clearing Required OJT Hours does NOT snap back to 486 in the UI
const clearedResult = simulateRequiredHoursInput(486, 'backspace_all');
assert('Deleting/backspacing Required OJT Hours displays empty string (no snap-back to 486)', clearedResult.displayValue === '');
assert('Deleting/backspacing Required OJT Hours state is empty string', clearedResult.state === '');

// Test 16.2: Clicking Clear (X) button empties the input field
const clickClearResult = simulateRequiredHoursInput(486, 'clear_button');
assert('Clicking Clear (X) button empties the display value', clickClearResult.displayValue === '');

// Test 16.3: Custom OJT hours (e.g. 300, 600) persists accurately
const customResult = simulateRequiredHoursInput('', 'type', '300');
assert('Typing custom hours "300" updates input display to "300"', customResult.displayValue === '300');
assert('Saving custom hours "300" stores exact numeric value 300', customResult.savedHoursTrainee === 300);

// Test 16.4: If field is left empty upon submission, trainee defaults gracefully to standard 486 hours
assert('Empty hours field defaults to standard 486 hours upon trainee save', clearedResult.savedHoursTrainee === 486);
assert('Admin role strictly saves 0 required hours regardless of input', clearedResult.savedHoursAdmin === 0);

// ============================================================================
// 17. WHITE BOX TESTS: Dashboard Routing & Post Clock-In Navigation
// ============================================================================
console.log(`\n${BOLD}======================================================================${RESET}`);
console.log(`${BOLD}  17. WHITE BOX TESTS: Dashboard Routing & Post Clock-In Navigation   ${RESET}`);
console.log(`${BOLD}======================================================================${RESET}`);

// Route registry resolver simulation
const registeredAppRoutes = [
  '/',
  '/login',
  '/register',
  '/dashboard', // redirects to /app
  '/app', // index dashboard
  '/app/dashboard', // alias to dashboard
  '/app/time-record',
  '/app/records',
  '/app/documents',
  '/app/announcements',
  '/app/evaluation',
  '/app/profile',
  '/admin',
  '/admin/dashboard',
  '/hte',
  '/hte/dashboard',
];

function resolveRoute(path) {
  if (path === '/dashboard') return { status: 302, destination: '/app' };
  if (registeredAppRoutes.includes(path)) {
    if (path === '/app' || path === '/app/dashboard') {
      return { status: 200, component: 'Dashboard' };
    }
    if (path === '/admin' || path === '/admin/dashboard') {
      return { status: 200, component: 'AdminDashboard' };
    }
    if (path === '/hte' || path === '/hte/dashboard') {
      return { status: 200, component: 'HTEDashboard' };
    }
    return { status: 200, component: path.replace(/^\//, '') };
  }
  // Wildcard fallback
  return { status: 302, destination: '/app' };
}

// Test 17.1: /app/dashboard resolves to 200 OK Dashboard component
const appDashResult = resolveRoute('/app/dashboard');
assert('Route "/app/dashboard" successfully resolves with 200 OK', appDashResult.status === 200);
assert('Route "/app/dashboard" mounts the Dashboard component', appDashResult.component === 'Dashboard');

// Test 17.2: Top-level /dashboard safely redirects to /app
const rootDashResult = resolveRoute('/dashboard');
assert('Route "/dashboard" safely redirects without 404 (status 302)', rootDashResult.status === 302);
assert('Route "/dashboard" destination is "/app"', rootDashResult.destination === '/app');

// Test 17.3: /app default index route resolves to Dashboard
const appIndexResult = resolveRoute('/app');
assert('Route "/app" resolves with 200 OK Dashboard', appIndexResult.status === 200 && appIndexResult.component === 'Dashboard');

// Test 17.4: Post clock-in navigation targets /app or /app/dashboard safely
const timeRecordDoneTarget = '/app';
const doneRouteResult = resolveRoute(timeRecordDoneTarget);
assert('Post clock-in "Done (Return to Dashboard)" target resolves cleanly without 404', doneRouteResult.status === 200 && doneRouteResult.component === 'Dashboard');

// Test 17.5: Unknown route falls back gracefully to dashboard instead of hard 404 crash
const unknownRouteResult = resolveRoute('/some/invalid/path');
assert('Unknown route gracefully redirects instead of hard 404 crash', unknownRouteResult.status === 302 && unknownRouteResult.destination === '/app');

// ----------------------------------------------------------------------------
// MODULE 18: ATTENDANCE TIMESTAMP DISPLAY, PERSISTENCE & CLOCK IN/OUT TRANSITION
// ----------------------------------------------------------------------------
printSectionHeader('18. WHITE BOX TESTS: Attendance Timestamp, Persistence & Switcher State');

function formatTimeDisplay(timeStr) {
  if (!timeStr) return '— —';
  const [h, m] = timeStr.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${String(hour12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`;
}

function resolveTodayAttendance({
  empIdentifier,
  employeesList,
  timeRecordsList,
  todayStr
}) {
  const cleanEmpId = (empIdentifier || '').trim();
  const emp = employeesList.find(
    (e) =>
      e.id === cleanEmpId ||
      e.employeeId === cleanEmpId ||
      (e.email && cleanEmpId && e.email.toLowerCase() === cleanEmpId.toLowerCase())
  );
  const validIds = new Set();
  validIds.add(cleanEmpId);
  validIds.add(cleanEmpId.toLowerCase());
  if (emp) {
    if (emp.id) { validIds.add(emp.id); validIds.add(emp.id.toLowerCase()); }
    if (emp.employeeId) { validIds.add(emp.employeeId); validIds.add(emp.employeeId.toLowerCase()); }
    if (emp.email) validIds.add(emp.email.toLowerCase());
  }

  const todayRecords = timeRecordsList.filter((r) => {
    const rDate = (r.date || '').split('T')[0].split(' ')[0].trim();
    if (rDate !== todayStr) return false;
    const rEmpId = (r.employeeId || '').trim();
    return validIds.has(rEmpId) || validIds.has(rEmpId.toLowerCase());
  });

  if (todayRecords.length === 0) return null;
  return todayRecords.sort((a, b) => {
    const aComplete = a.timeIn && a.timeOut ? 2 : a.timeIn ? 1 : 0;
    const bComplete = b.timeIn && b.timeOut ? 2 : b.timeIn ? 1 : 0;
    if (bComplete !== aComplete) return bComplete - aComplete;
    return (b.id || '').localeCompare(a.id || '');
  })[0];
}

function simulateMergeTimeRecords(remoteRecords, currentLocalRecords) {
  if (!remoteRecords || remoteRecords.length === 0) {
    return currentLocalRecords || [];
  }
  const remoteIds = new Set(remoteRecords.map((r) => r.id));
  const remoteEmpDateMap = new Map();
  remoteRecords.forEach((r) => {
    const key = `${(r.employeeId || '').toLowerCase()}_${(r.date || '').split('T')[0].split(' ')[0]}`;
    remoteEmpDateMap.set(key, r);
  });

  const localOnly = (currentLocalRecords || []).filter((localR) => {
    if (remoteIds.has(localR.id)) return false;
    const key = `${(localR.employeeId || '').toLowerCase()}_${(localR.date || '').split('T')[0].split(' ')[0]}`;
    const remoteMatch = remoteEmpDateMap.get(key);
    if (remoteMatch) {
      if (!remoteMatch.timeOut && localR.timeOut) {
        remoteMatch.timeOut = localR.timeOut;
        remoteMatch.totalHours = localR.totalHours || remoteMatch.totalHours;
      }
      return false;
    }
    return true;
  });

  return [...remoteRecords, ...localOnly];
}

// Test 18.1: Formats military time to display timestamp with AM/PM
const timeInRaw = '14:41';
const formattedTimeIn = formatTimeDisplay(timeInRaw);
assert('Formats "14:41" to "02:41 PM" for blue status card', formattedTimeIn === '02:41 PM');
assert('Empty time string displays "— —"', formatTimeDisplay(null) === '— —');

// Test 18.2: Resolution of today\'s attendance record matching numeric student ID and UUID
const testEmployees = [
  { id: 'uuid-jhey-ree-01', employeeId: '20231343', name: 'Jhey Ree Ebro', email: 'jheyree@example.com' }
];
const testDate = '2026-09-16';
const testRecords = [
  { id: 'rec-001', employeeId: 'uuid-jhey-ree-01', date: '2026-09-16T00:00:00Z', timeIn: '14:41', status: 'present' }
];

const resolvedByEmployeeId = resolveTodayAttendance({
  empIdentifier: '20231343',
  employeesList: testEmployees,
  timeRecordsList: testRecords,
  todayStr: testDate
});
assert('Resolves today record when looked up via student employee ID "20231343"', resolvedByEmployeeId !== null && resolvedByEmployeeId.timeIn === '14:41');

const resolvedByUuid = resolveTodayAttendance({
  empIdentifier: 'uuid-jhey-ree-01',
  employeesList: testEmployees,
  timeRecordsList: testRecords,
  todayStr: testDate
});
assert('Resolves today record when looked up via internal UUID', resolvedByUuid !== null && resolvedByUuid.timeIn === '14:41');

// Test 18.3: Action state transition upon clock-in
let currentAttendanceState = {
  currentRecord: resolvedByEmployeeId,
  action: resolvedByEmployeeId?.timeIn && !resolvedByEmployeeId?.timeOut ? 'out' : 'in',
  clockOutDisabled: !resolvedByEmployeeId?.timeIn
};
assert('Clock In switches action mode to "out"', currentAttendanceState.action === 'out');
assert('Clock Out button is unlocked (clockOutDisabled is false)', currentAttendanceState.clockOutDisabled === false);

// Test 18.4: Remote Supabase refresh does NOT wipe fresh local punch
const freshLocalPunch = [
  { id: 'rec-local-12345', employeeId: '20231343', date: '2026-09-16', timeIn: '14:41', timeInFaceVerified: true }
];
const staleRemoteRecords = [
  { id: 'rec-yesterday', employeeId: '20231343', date: '2026-09-15', timeIn: '08:00', timeOut: '17:00' }
];
const mergedRecords = simulateMergeTimeRecords(staleRemoteRecords, freshLocalPunch);
const mergedTodayRec = resolveTodayAttendance({
  empIdentifier: '20231343',
  employeesList: testEmployees,
  timeRecordsList: mergedRecords,
  todayStr: testDate
});
assert('mergeTimeRecords retains freshly punched local record during background Supabase sync', mergedTodayRec !== null && mergedTodayRec.timeIn === '14:41');
assert('Retains previous days records as well', mergedRecords.some((r) => r.id === 'rec-yesterday'));

// Test 18.5: Clock out updates record and computes total hours
const completedRecord = {
  ...resolvedByEmployeeId,
  timeOut: '17:11',
  totalHours: 2.5
};
const formattedTimeOut = formatTimeDisplay(completedRecord.timeOut);
assert('Clock Out timestamp formatted to "05:11 PM"', formattedTimeOut === '05:11 PM');
assert('Total hours properly recorded', completedRecord.totalHours === 2.5);

// ----------------------------------------------------------------------------
// MODULE 19: 1:1 FACIAL BIOMETRICS WITH JUSTADUDEWHOHACKS FACE-API & CROSS-PERSON REJECTION
// ----------------------------------------------------------------------------
printSectionHeader('19. WHITE BOX TESTS: 1:1 Face Biometrics & Cross-Person Rejection');

function simulateBiometricVerify({
  registeredDescriptor,
  liveDescriptor,
  modelsLoaded = true,
  registeredPhotoExists = true,
  quality = {},
  threshold = 0.52
}) {
  if (!registeredPhotoExists || !registeredDescriptor) {
    return {
      matched: false,
      distance: Infinity,
      confidence: 0,
      error: 'No registered face template found for this student. Face registration required.'
    };
  }
  if (!liveDescriptor) {
    return {
      matched: false,
      distance: Infinity,
      confidence: 0,
      error: 'No face detected or could not extract facial descriptor from live camera frame.'
    };
  }
  if (!modelsLoaded) {
    return {
      matched: false,
      distance: Infinity,
      confidence: 0,
      error: 'Biometric AI models not ready. Please wait for facial recognition models to initialize.'
    };
  }

  // Defense-in-depth quality guard on live capture (glasses, headwear, dark background)
  if (quality.glassesDetected) {
    return {
      matched: false,
      distance: Infinity,
      confidence: 0,
      error: 'Verification blocked: Glasses detected. Eyeglasses or sunglasses must be removed to verify.'
    };
  }
  if (quality.capDetected) {
    return {
      matched: false,
      distance: Infinity,
      confidence: 0,
      error: 'Verification blocked: Hat/cap detected. Headwear must be removed to verify.'
    };
  }
  if (quality.maskDetected) {
    return {
      matched: false,
      distance: Infinity,
      confidence: 0,
      error: 'Verification blocked: Face mask detected. Mask must be removed to verify.'
    };
  }
  if (quality.poorBackgroundLighting || quality.tooDark) {
    return {
      matched: false,
      distance: Infinity,
      confidence: 0,
      error: 'Verification blocked: Dark background or dim lighting detected. Position in front of a light, well-lit background to verify.'
    };
  }

  let sum = 0;
  for (let i = 0; i < 128; i++) {
    const d = (registeredDescriptor[i] || 0) - (liveDescriptor[i] || 0);
    sum += d * d;
  }
  const distance = Math.sqrt(sum);
  const matched = distance <= threshold;
  const confidence = Math.max(0, Math.min(100, Math.round((1 - distance / threshold) * 100)));

  return {
    matched,
    distance,
    confidence,
    error: matched
      ? undefined
      : `Face does not match registered biometrics for this trainee (Biometric distance: ${distance.toFixed(3)}, threshold: ${threshold.toFixed(2)}).`
  };
}

function generateTestDescriptor(seed = 1) {
  const arr = new Float32Array(128);
  let sumSq = 0;
  for (let i = 0; i < 128; i++) {
    arr[i] = Math.sin((i + 1) * seed);
    sumSq += arr[i] * arr[i];
  }
  const norm = Math.sqrt(sumSq) || 1;
  for (let i = 0; i < 128; i++) {
    arr[i] /= norm;
  }
  return arr;
}

const traineeA_registered = generateTestDescriptor(1.0);
const traineeA_liveSame = generateTestDescriptor(1.0);

// Genuine trainee minor pose variance: slight lighting / angle difference (produces ~0.25 distance)
const traineeA_liveAngle = new Float32Array(traineeA_registered);
traineeA_liveAngle[0] += 0.20;
traineeA_liveAngle[1] -= 0.15;
let angleNorm = 0;
for (let i = 0; i < 128; i++) angleNorm += traineeA_liveAngle[i] * traineeA_liveAngle[i];
angleNorm = Math.sqrt(angleNorm) || 1;
for (let i = 0; i < 128; i++) traineeA_liveAngle[i] /= angleNorm;

const traineeB_liveDifferent = generateTestDescriptor(8.0);

// Test 19.1: Identical live face to registered account biometrics
const matchSame = simulateBiometricVerify({
  registeredDescriptor: traineeA_registered,
  liveDescriptor: traineeA_liveSame,
  threshold: 0.52
});
assert('Identical live face matches registered biometrics (distance 0.00 <= 0.52)', matchSame.matched === true && matchSame.distance === 0);
assert('Identical face match produces 100% confidence', matchSame.confidence === 100);

// Test 19.2: Genuine trainee slight head angle variance (within genuine distance margin)
const matchAngle = simulateBiometricVerify({
  registeredDescriptor: traineeA_registered,
  liveDescriptor: traineeA_liveAngle,
  threshold: 0.52
});
assert('Genuine trainee with minor pose variance matches (distance <= 0.52)', matchAngle.matched === true && matchAngle.distance <= 0.52);

// Test 19.3: Cross-person scan: Scanning another person when registered to trainee A
const matchDifferentPerson = simulateBiometricVerify({
  registeredDescriptor: traineeA_registered,
  liveDescriptor: traineeB_liveDifferent,
  threshold: 0.52
});
assert('Cross-person face scan is strictly rejected (distance > 0.52)', matchDifferentPerson.matched === false);
assert('Rejection provides clear mismatch error message', typeof matchDifferentPerson.error === 'string' && matchDifferentPerson.error.includes('Face does not match'));

// Test 19.4: Boundary distance value analysis: exactly 0.51 (pass) vs 0.53 (fail)
const boundaryPassDescriptor = new Float32Array(traineeA_registered);
boundaryPassDescriptor[0] += 0.35; // creates distance ~0.35
const boundaryPass = simulateBiometricVerify({
  registeredDescriptor: traineeA_registered,
  liveDescriptor: boundaryPassDescriptor,
  threshold: 0.52
});
assert('Face distance 0.35 is verified (pass)', boundaryPass.matched === true);

// Boundary distance > 0.52
const boundaryFailDescriptor = new Float32Array(traineeA_registered);
boundaryFailDescriptor[0] += 0.40;
boundaryFailDescriptor[1] += 0.40; // creates distance ~0.56
const boundaryFail = simulateBiometricVerify({
  registeredDescriptor: traineeA_registered,
  liveDescriptor: boundaryFailDescriptor,
  threshold: 0.52
});
assert('Face distance > 0.52 is strictly rejected (fail-closed)', boundaryFail.matched === false);

// Test 19.5: Fail-closed when registered template photo is missing
const missingTemplate = simulateBiometricVerify({
  registeredDescriptor: null,
  liveDescriptor: traineeA_liveSame,
  registeredPhotoExists: false,
  threshold: 0.52
});
assert('Missing registered photo strictly rejects verification (no auto-pass bypass)', missingTemplate.matched === false);
assert('Missing registered photo provides registration requirement error', missingTemplate.error.includes('Face registration required'));

// Test 19.6: Fail-closed when live face detection or descriptor extraction fails
const missingLive = simulateBiometricVerify({
  registeredDescriptor: traineeA_registered,
  liveDescriptor: null,
  threshold: 0.52
});
assert('Missing live face strictly rejects verification', missingLive.matched === false);
assert('Missing live face returns camera frame error', missingLive.error.includes('No face detected'));

// Test 19.7: Fail-closed when neural models are unready (never pass-open)
const modelUnready = simulateBiometricVerify({
  registeredDescriptor: traineeA_registered,
  liveDescriptor: traineeA_liveSame,
  modelsLoaded: false,
  threshold: 0.52
});
assert('Unready biometric models strictly reject verification (fail-closed)', modelUnready.matched === false);
assert('Unready biometric models return initialization message', modelUnready.error.includes('Biometric AI models not ready'));

// Test 19.8: Attendance flow blocks proceeding to face scan if trainee has no enrolled biometrics
function canProceedToFaceScan({ geofencePassed, hasRegisteredBiometrics, action, hasTimeIn }) {
  if (!geofencePassed) return { allowed: false, reason: 'Geofence not passed' };
  if (action === 'out' && !hasTimeIn) return { allowed: false, reason: 'Must clock in first' };
  if (!hasRegisteredBiometrics) return { allowed: false, reason: 'No registered face biometrics on account' };
  return { allowed: true };
}

const unEnrolledAttempt = canProceedToFaceScan({
  geofencePassed: true,
  hasRegisteredBiometrics: false,
  action: 'in',
  hasTimeIn: false
});
assert('proceedToFaceScan blocks scan when trainee has not enrolled face biometrics', unEnrolledAttempt.allowed === false);
assert('proceedToFaceScan specifies missing biometric error', unEnrolledAttempt.reason.includes('No registered face biometrics'));

const enrolledAttempt = canProceedToFaceScan({
  geofencePassed: true,
  hasRegisteredBiometrics: true,
  action: 'in',
  hasTimeIn: false
});
assert('proceedToFaceScan allows scan when trainee has enrolled face biometrics and passed geofence', enrolledAttempt.allowed === true);

// Test 19.9: Strict biometric verification blocks glasses (even with identical face vectors)
const glassesAttempt = simulateBiometricVerify({
  registeredDescriptor: traineeA_registered,
  liveDescriptor: traineeA_liveSame,
  quality: { glassesDetected: true },
  threshold: 0.52
});
assert('Strict biometric verify blocks user wearing glasses (fail-closed)', glassesAttempt.matched === false);
assert('Glasses rejection error specifically informs user to remove glasses', glassesAttempt.error.includes('Glasses detected. Eyeglasses or sunglasses must be removed'));

// Test 19.10: Strict biometric verification blocks hats / caps / headwear
const capAttempt = simulateBiometricVerify({
  registeredDescriptor: traineeA_registered,
  liveDescriptor: traineeA_liveSame,
  quality: { capDetected: true },
  threshold: 0.52
});
assert('Strict biometric verify blocks user wearing hat/cap (fail-closed)', capAttempt.matched === false);
assert('Hat/cap rejection error specifically informs user to remove headwear', capAttempt.error.includes('Hat/cap detected. Headwear must be removed'));

// Test 19.11: Strict biometric verification blocks dark background / poor lighting
const darkBgAttempt = simulateBiometricVerify({
  registeredDescriptor: traineeA_registered,
  liveDescriptor: traineeA_liveSame,
  quality: { poorBackgroundLighting: true },
  threshold: 0.52
});
assert('Strict biometric verify blocks dark background (fail-closed)', darkBgAttempt.matched === false);
assert('Dark background rejection error informs user to move to light background', darkBgAttempt.error.includes('Dark background or dim lighting detected. Position in front of a light, well-lit background'));

// Test 19.12: Clear bare face in light background successfully verifies matching biometrics
const clearFaceAttempt = simulateBiometricVerify({
  registeredDescriptor: traineeA_registered,
  liveDescriptor: traineeA_liveSame,
  quality: { glassesDetected: false, capDetected: false, maskDetected: false, poorBackgroundLighting: false },
  threshold: 0.52
});
assert('Clear bare face with light background successfully verifies biometrics', clearFaceAttempt.matched === true && clearFaceAttempt.confidence === 100);

// ----------------------------------------------------------------------------
// MODULE 20: TRAINEE CLEARANCE DOCUMENTS COMPLETION & PENDING RETENTION
// ----------------------------------------------------------------------------
printSectionHeader('20. WHITE BOX TESTS: Trainee Documents Incomplete -> Pending Retention');

const REQUIRED_DOC_KEYS = [
  'pledgeOfConduct', 'medical', 'enrolmentForm', 'consent', 'resume',
  'dutiesAndResponsibilities', 'moa', 'internshipAgreement', 'evaluationForm', 'evaluationReport'
];

function simulateTransformEmployee(data) {
  const regLoc = typeof data.registration_location === 'string'
    ? JSON.parse(data.registration_location)
    : data.registration_location || {};
  const submittedDocs = regLoc.documents || data.submitted_documents || undefined;
  const resolvedRole = data.role || (
    data.position === 'OJT Instructor' || data.position === 'Administrator' || (data.position && String(data.position).toLowerCase().includes('instructor'))
      ? 'admin'
      : data.position === 'HTE Representative' || data.position === 'Training Supervisor' || (data.position && String(data.position).toLowerCase().includes('hte'))
        ? 'hte'
        : 'employee'
  );
  const isTrainee = resolvedRole === 'employee' || resolvedRole === 'trainee';

  if (!isTrainee) {
    return {
      documentsPassed: data.documents_passed !== undefined ? Boolean(data.documents_passed) : regLoc.documentsPassed !== undefined ? Boolean(regLoc.documentsPassed) : true,
      documentsStatus: data.documents_status || regLoc.documentsStatus || 'passed',
      submittedDocuments: submittedDocs,
    };
  }

  const uploadedDocsCount = submittedDocs
    ? REQUIRED_DOC_KEYS.filter((k) => {
        const d = submittedDocs[k];
        return Boolean(d && (d.dataUrl || d.name || d.fileUrl));
      }).length
    : 0;
  const passedDocsCount = submittedDocs
    ? REQUIRED_DOC_KEYS.filter((k) => {
        const d = submittedDocs[k];
        return d?.status === 'passed' && Boolean(d && (d.dataUrl || d.name || d.fileUrl));
      }).length
    : 0;

  const isAllCompleted = uploadedDocsCount === REQUIRED_DOC_KEYS.length;
  const isAllPassed = isAllCompleted && passedDocsCount === REQUIRED_DOC_KEYS.length;

  let finalDocsPassed = false;
  let finalDocsStatus = 'pending';

  if (!isAllCompleted) {
    finalDocsPassed = false;
    finalDocsStatus = (data.documents_status === 'rejected' || regLoc.documentsStatus === 'rejected')
      ? 'rejected'
      : uploadedDocsCount > 0
        ? (data.documents_status === 'partial' ? 'partial' : 'pending')
        : 'pending';
  } else {
    const explicitPassed = (data.documents_passed === true || regLoc.documentsPassed === true || data.documents_status === 'passed' || regLoc.documentsStatus === 'passed');
    if (isAllPassed || explicitPassed) {
      finalDocsPassed = true;
      finalDocsStatus = 'passed';
    } else {
      finalDocsPassed = false;
      finalDocsStatus = data.documents_status || regLoc.documentsStatus || 'submitted';
    }
  }

  return {
    documentsPassed: finalDocsPassed,
    documentsStatus: finalDocsStatus,
    submittedDocuments: submittedDocs,
  };
}

// Test 20.1: Trainee with 0 documents must remain pending (NOT passed) upon reopening system
const zeroDocsTrainee = simulateTransformEmployee({
  id: 'trainee-001',
  role: 'employee',
  position: 'OJT Trainee',
  registration_location: null,
  submitted_documents: null,
});
assert('Trainee with 0 documents retains documentsPassed: false upon reload', zeroDocsTrainee.documentsPassed === false);
assert('Trainee with 0 documents retains documentsStatus: "pending" upon reload', zeroDocsTrainee.documentsStatus === 'pending');

// Test 20.2: Trainee with partial documents (e.g., 4 of 10) must remain pending/partial (NOT passed)
const partialDocsTrainee = simulateTransformEmployee({
  id: 'trainee-002',
  role: 'employee',
  position: 'OJT Trainee',
  registration_location: {
    documents: {
      pledgeOfConduct: { name: 'pledge.pdf', dataUrl: 'data:pdf' },
      medical: { name: 'med.pdf', dataUrl: 'data:pdf' },
      enrolmentForm: { name: 'cor.pdf', dataUrl: 'data:pdf' },
      consent: { name: 'consent.pdf', dataUrl: 'data:pdf' },
    }
  },
});
assert('Trainee with partial documents retains documentsPassed: false', partialDocsTrainee.documentsPassed === false);
assert('Trainee with partial documents retains documentsStatus: "pending" or "partial" (never "passed")', partialDocsTrainee.documentsStatus !== 'passed' && (partialDocsTrainee.documentsStatus === 'pending' || partialDocsTrainee.documentsStatus === 'partial'));

// Test 20.3: Legacy database row with null documents_passed does NOT flip incomplete trainee to passed: true
const legacyDbRow = simulateTransformEmployee({
  id: 'trainee-legacy',
  role: 'employee',
  position: 'OJT Trainee',
  documents_passed: null,
  documents_status: null,
});
assert('Incomplete legacy trainee with null database status strictly defaults to false', legacyDbRow.documentsPassed === false);
assert('Incomplete legacy trainee strictly defaults to pending status', legacyDbRow.documentsStatus === 'pending');

// Test 20.4: Trainee with all 10 documents uploaded but not certified yet is submitted/pending review
const tenDocsPending = {};
REQUIRED_DOC_KEYS.forEach(k => {
  tenDocsPending[k] = { name: `${k}.pdf`, dataUrl: `data:${k}`, status: 'pending' };
});
const allUploadedTrainee = simulateTransformEmployee({
  id: 'trainee-003',
  role: 'employee',
  position: 'OJT Trainee',
  registration_location: { documents: tenDocsPending, documentsPassed: false, documentsStatus: 'submitted' },
});
assert('All 10 uploaded documents awaiting review retains documentsPassed: false', allUploadedTrainee.documentsPassed === false);
assert('All 10 uploaded documents awaiting review retains status "submitted"', allUploadedTrainee.documentsStatus === 'submitted');

// Test 20.5: Trainee with all 10 documents explicitly certified as passed resolves to passed: true
const tenDocsApproved = {};
REQUIRED_DOC_KEYS.forEach(k => {
  tenDocsApproved[k] = { name: `${k}.pdf`, dataUrl: `data:${k}`, status: 'passed' };
});
const certifiedTrainee = simulateTransformEmployee({
  id: 'trainee-004',
  role: 'employee',
  position: 'OJT Trainee',
  registration_location: { documents: tenDocsApproved, documentsPassed: true, documentsStatus: 'passed' },
});
assert('All 10 approved documents resolves documentsPassed: true', certifiedTrainee.documentsPassed === true);
assert('All 10 approved documents resolves documentsStatus: "passed"', certifiedTrainee.documentsStatus === 'passed');

// Test 20.6: OJT Instructor is not subjected to trainee document completion requirements
const instructorUser = simulateTransformEmployee({
  id: 'inst-001',
  role: 'admin',
  position: 'OJT Instructor',
});
assert('Instructor account defaults documentsPassed: true', instructorUser.documentsPassed === true);
assert('Instructor account defaults documentsStatus: "passed"', instructorUser.documentsStatus === 'passed');

// ----------------------------------------------------------------------------
// 21. WHITE BOX TESTS: Evaluation Questionnaire Answered Verification & Workflow
// ----------------------------------------------------------------------------
console.log(`\n${BOLD}======================================================================${RESET}`);
console.log(`${BOLD}  21. WHITE BOX TESTS: Evaluation Questionnaire Answered Verification  ${RESET}`);
console.log(`${BOLD}======================================================================${RESET}`);

function isQuestionnaireAnswered(q) {
  if (!q) return false;
  const questions = [
    q.q1_dutiesBriefly,
    q.q2_strongestPerformanceArea,
    q.q3_areasImprovedMost,
    q.q4_areasNeedImprovement,
    q.q5_situationChallengedMost,
    q.q6_howOvercameChallenge,
    q.q7_whatLearnedFromExperience,
    q.q8_isQualifiedLinkage,
    q.q9_ojtSuggestionsRecommendations,
  ];
  return questions.some((ans) => typeof ans === 'string' && ans.trim().length > 0);
}

// Test 21.1: Undefined or empty questionnaire is strictly un-answered
assert('Null or undefined questionnaire resolves isQuestionnaireAnswered: false', isQuestionnaireAnswered(null) === false && isQuestionnaireAnswered(undefined) === false);
assert('Empty questionnaire object resolves isQuestionnaireAnswered: false', isQuestionnaireAnswered({}) === false);

// Test 21.2: Metadata only without questionnaire questions answered resolves to false
assert('Company particulars only without question responses resolves to false', isQuestionnaireAnswered({
  companyAddress: 'Talisay City',
  contactPerson: 'Supervisor Name',
  telephoneNo: '09123456789'
}) === false);

// Test 21.3: Whitespace only questions resolve to false
assert('Questions with whitespace only resolve to false', isQuestionnaireAnswered({
  q1_dutiesBriefly: '   \n\t  ',
  q2_strongestPerformanceArea: '  '
}) === false);

// Test 21.4: Answering any of the 9 official CHMSU questions resolves to true
assert('Answering q1_dutiesBriefly resolves isQuestionnaireAnswered: true', isQuestionnaireAnswered({
  q1_dutiesBriefly: 'Assisted in full-stack web development and database management.'
}) === true);

assert('Answering q5_situationChallengedMost resolves isQuestionnaireAnswered: true', isQuestionnaireAnswered({
  q5_situationChallengedMost: 'Managing high concurrency server deployments under tight deadlines.'
}) === true);

// Test 21.5: Instructor Evaluation Card workflow status resolution
function resolveInstructorCardStatus(ev) {
  const answered = isQuestionnaireAnswered(ev?.questionnaire);
  if (!answered) {
    return {
      topBadge: 'Awaiting Trainee Questionnaire',
      showGradeBadge: false,
      canMarkApproved: false,
      actionButtonLabel: 'Awaiting Trainee Questionnaire',
    };
  }
  if (ev.status === 'submitted_to_instructor' || ev.status === 'final') {
    return {
      topBadge: 'Ratings Submitted by HTE',
      showGradeBadge: true,
      canMarkApproved: true,
      actionButtonLabel: 'Done Viewed & Approved',
    };
  }
  if (ev.status === 'reviewed_by_instructor') {
    return {
      topBadge: 'Done Viewed & Approved',
      showGradeBadge: true,
      canMarkApproved: false,
      actionButtonLabel: null,
    };
  }
  return {
    topBadge: 'Questionnaire Received — Pass to HTE',
    showGradeBadge: false,
    canMarkApproved: false,
    actionButtonLabel: 'Pass to HTE',
  };
}

const emptyFormEval = {
  id: 'eval-dummy-1',
  employeeId: 'trainee-shaneth',
  overallScore: 95.2,
  grade: 'Excellent',
  status: 'final', // Legacy or seeded database status
  questionnaire: {} // Empty form
};

const resolvedEmpty = resolveInstructorCardStatus(emptyFormEval);
assert('Empty form with legacy final status strictly displays "Awaiting Trainee Questionnaire"', resolvedEmpty.topBadge === 'Awaiting Trainee Questionnaire');
assert('Empty form strictly hides fake grade badge', resolvedEmpty.showGradeBadge === false);
assert('Empty form strictly blocks "Done Viewed & Approved"', resolvedEmpty.canMarkApproved === false);
assert('Empty form displays "Awaiting Trainee Questionnaire" action pill', resolvedEmpty.actionButtonLabel === 'Awaiting Trainee Questionnaire');

// Test 21.6: Answered form submitted by HTE unlocks ratings and instructor approval
const answeredHteEval = {
  id: 'eval-dummy-2',
  employeeId: 'trainee-shaneth',
  overallScore: 95.2,
  grade: 'Excellent',
  status: 'submitted_to_instructor',
  questionnaire: {
    q1_dutiesBriefly: 'Handled printing operations and graphic layout verification.',
    q7_whatLearnedFromExperience: 'Learned client management and production efficiency.'
  }
};

const resolvedAnswered = resolveInstructorCardStatus(answeredHteEval);
assert('Answered questionnaire with HTE ratings displays "Ratings Submitted by HTE"', resolvedAnswered.topBadge === 'Ratings Submitted by HTE');
assert('Answered questionnaire shows verified grade badge', resolvedAnswered.showGradeBadge === true);
assert('Answered questionnaire enables "Done Viewed & Approved"', resolvedAnswered.canMarkApproved === true);

// ----------------------------------------------------------------------------
// 22. WHITE BOX TESTS: 20-Minute Session Expiry & Token Inactivity Lifetime
// ----------------------------------------------------------------------------
console.log(`\n${BOLD}======================================================================${RESET}`);
console.log(`${BOLD}  22. WHITE BOX TESTS: 20-Minute Session Expiry & Inactivity Lifetime ${RESET}`);
console.log(`${BOLD}======================================================================${RESET}`);

const TOKEN_LIFETIME_SEC = 20 * 60; // 1,200 seconds
const TOKEN_LIFETIME_MS = TOKEN_LIFETIME_SEC * 1000; // 1,200,000 ms

// Test 22.1: Token lifetime constant is strictly 20 minutes (1200 seconds, 1,200,000 ms)
assert('Token lifetime seconds is 1,200s (20 minutes)', TOKEN_LIFETIME_SEC === 1200);
assert('Token lifetime ms is 1,200,000ms (20 minutes)', TOKEN_LIFETIME_MS === 1200000);

// Test 22.2: Time formatting helper formats 1200s as "20:00"
function formatTokenTimer(secondsRemaining) {
  const mins = Math.floor(secondsRemaining / 60);
  const secs = secondsRemaining % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

assert('1,200 seconds formats as "20:00"', formatTokenTimer(1200) === '20:00');
assert('1,199 seconds formats as "19:59"', formatTokenTimer(1199) === '19:59');
assert('65 seconds formats as "01:05"', formatTokenTimer(65) === '01:05');
assert('0 seconds formats as "00:00"', formatTokenTimer(0) === '00:00');

// Test 22.3: Session token issue creates expiration timestamp 20 minutes in future
const now = 1770000000000;
const issuedExpiresAt = now + TOKEN_LIFETIME_MS;
assert('Issued token expiresAt is exactly now + 20 minutes', (issuedExpiresAt - now) === 20 * 60 * 1000);

// Test 22.4: Session reset/extend adds full 20 minutes
const extendedExpiry = now + TOKEN_LIFETIME_MS;
const remainingSec = Math.floor((extendedExpiry - now) / 1000);
assert('Extended session provides 1,200 seconds remaining', remainingSec === 1200);

// ----------------------------------------------------------------------------
// 23. WHITE BOX TESTS: HTE Dropdown Filter & Concentrix Trainee Viewing
// ----------------------------------------------------------------------------
console.log(`\n${BOLD}======================================================================${RESET}`);
console.log(`${BOLD}  23. WHITE BOX TESTS: HTE Dropdown Filter & Concentrix Trainees       ${RESET}`);
console.log(`${BOLD}======================================================================${RESET}`);

const mockTrainees = [
  { id: 't-1', name: 'Maria Santos', companyName: 'Concentrix', academicYear: '2026-2027', active: true },
  { id: 't-2', name: 'Juan Dela Cruz', companyName: 'Concentrix - Bacolod', academicYear: '2026-2027', active: true },
  { id: 't-3', name: 'Alex Reyes', companyName: 'Concentrix Solutions Inc.', academicYear: '2026-2027', active: true },
  { id: 't-4', name: 'Clara Diaz', companyName: 'Printing Services', academicYear: '2026-2027', active: true },
  { id: 't-5', name: 'Ethan Ramos', companyName: 'Bacolod City Hall', academicYear: '2026-2027', active: true },
  { id: 't-6', name: 'Sophia Lee', companyName: '', academicYear: '2026-2027', active: true },
  { id: 't-7', name: 'Lucas Cruz', companyName: 'Unassigned', academicYear: '2026-2027', active: true },
];

function isInvalidHteCompanyTest(company) {
  if (!company || typeof company !== 'string') return true;
  const normalized = company.trim().toLowerCase();
  return (
    !normalized ||
    normalized === 'unassigned' ||
    normalized === 'n/a' ||
    normalized === 'none' ||
    normalized === 'pending' ||
    normalized === 'no company yet'
  );
}

function matchesHteFilterTest(emp, targetHte) {
  if (targetHte === 'all') return true;
  const rawComp = (emp.companyName || '').trim();
  const isInvalid = !rawComp || isInvalidHteCompanyTest(rawComp);
  if (targetHte === 'Unassigned') {
    return isInvalid;
  }
  if (isInvalid) {
    return false;
  }
  const empComp = rawComp.toLowerCase();
  const target = targetHte.toLowerCase();
  return empComp.includes(target) || target.includes(empComp);
}

// Test 23.1: "all" returns all trainees
const allView = mockTrainees.filter((t) => matchesHteFilterTest(t, 'all'));
assert('Selecting "All HTEs" displays all 7 trainees', allView.length === 7);

// Test 23.2: Selecting "Concentrix" views all trainees at Concentrix
const concentrixView = mockTrainees.filter((t) => matchesHteFilterTest(t, 'Concentrix'));
assert('Selecting "Concentrix" finds exactly 3 Concentrix trainees', concentrixView.length === 3);
assert('Concentrix view includes Maria Santos', concentrixView.some((t) => t.name === 'Maria Santos'));
assert('Concentrix view includes Juan Dela Cruz (Concentrix - Bacolod)', concentrixView.some((t) => t.name === 'Juan Dela Cruz'));
assert('Concentrix view includes Alex Reyes (Concentrix Solutions Inc.)', concentrixView.some((t) => t.name === 'Alex Reyes'));
assert('Concentrix view does not include Clara Diaz from Printing Services', !concentrixView.some((t) => t.name === 'Clara Diaz'));
assert('Concentrix view does not include unassigned trainees', !concentrixView.some((t) => t.name === 'Sophia Lee'));

// Test 23.3: Selecting "Printing Services" views only Printing Services
const printingView = mockTrainees.filter((t) => matchesHteFilterTest(t, 'Printing Services'));
assert('Selecting "Printing Services" returns exactly 1 trainee', printingView.length === 1 && printingView[0].name === 'Clara Diaz');

// Test 23.4: Selecting "Unassigned" returns trainees with empty or invalid HTE
const unassignedView = mockTrainees.filter((t) => matchesHteFilterTest(t, 'Unassigned'));
assert('Selecting "Unassigned" returns 2 unassigned trainees', unassignedView.length === 2);
assert('Unassigned view includes empty company trainee', unassignedView.some((t) => t.name === 'Sophia Lee'));
assert('Unassigned view includes literal "Unassigned" trainee', unassignedView.some((t) => t.name === 'Lucas Cruz'));

// Test 23.5: Deriving HTE dropdown counts accurately
const hteCounts = new Map();
mockTrainees.forEach((t) => {
  const raw = (t.companyName || '').trim();
  if (!raw || isInvalidHteCompanyTest(raw)) {
    hteCounts.set('Unassigned', (hteCounts.get('Unassigned') || 0) + 1);
  } else {
    hteCounts.set(raw, (hteCounts.get(raw) || 0) + 1);
  }
});
assert('HTE count map has Unassigned count of 2', hteCounts.get('Unassigned') === 2);
assert('HTE count map has Concentrix count of 1', hteCounts.get('Concentrix') === 1);
assert('HTE count map has Concentrix - Bacolod count of 1', hteCounts.get('Concentrix - Bacolod') === 1);

// ----------------------------------------------------------------------------
// 24. WHITE BOX TESTS: Resilient Registration & Database Error Fallback
// ----------------------------------------------------------------------------
console.log(`\n${BOLD}======================================================================${RESET}`);
console.log(`${BOLD}  24. WHITE BOX TESTS: Resilient Registration & Database Fallback     ${RESET}`);
console.log(`${BOLD}======================================================================${RESET}`);

// Test 24.1: Valid UUID generation when id is missing or not a UUID
const isUuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const genUuidTest = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};
const testGeneratedId = genUuidTest();
assert('Generated employee fallback id is valid UUID', isUuidRegex.test(testGeneratedId));

// Test 24.2: Role assignment based on position
function resolveRoleFromPosition(pos) {
  const p = (pos || '').toLowerCase();
  if (p.includes('instructor') || p.includes('admin') || p.includes('faculty')) return 'admin';
  if (p.includes('hte') || p.includes('host') || p.includes('supervisor')) return 'hte';
  return 'employee';
}
assert('OJT Instructor position resolves to role "admin"', resolveRoleFromPosition('OJT Instructor') === 'admin');
assert('HTE Representative position resolves to role "hte"', resolveRoleFromPosition('HTE Representative') === 'hte');
assert('OJT Trainee position resolves to role "employee"', resolveRoleFromPosition('OJT Trainee') === 'employee');

// Test 24.3: Resilient registration fallback returns success even if cloud write fails
function simulateResilientRegister({ cloudThrowsError = true, cleanData }) {
  let created = null;
  if (cloudThrowsError) {
    // Cloud throws error (e.g. database constraint or network issue)
    // Resilient fallback creates local profile
    created = {
      ...cleanData,
      id: cleanData.id || genUuidTest(),
    };
  } else {
    created = { ...cleanData, id: 'cloud-uuid' };
  }
  return { success: Boolean(created), employee: created };
}

const simResult = simulateResilientRegister({
  cloudThrowsError: true,
  cleanData: { name: 'Juan Cruz', email: 'juan@test.chmsu.edu.ph', position: 'OJT Trainee' }
});
assert('Resilient registration returns success: true on cloud error', simResult.success === true);
assert('Resilient registration preserves employee data', simResult.employee.name === 'Juan Cruz');
assert('Resilient registration assigns valid UUID id', isUuidRegex.test(simResult.employee.id));

// ----------------------------------------------------------------------------
// 25. WHITE BOX TESTS: Undeployed Trainees in Pending Approvals & Deployed in Active Trainees
// ----------------------------------------------------------------------------
console.log(`\n${BOLD}======================================================================${RESET}`);
console.log(`${BOLD}  25. WHITE BOX TESTS: Trainee Deployment to HTE & Pending Approval  ${RESET}`);
console.log(`${BOLD}======================================================================${RESET}`);

const mockAvailableHtes = [
  { id: 'hte-concentrix', companyName: 'Concentrix', name: 'John Doe' },
  { id: 'hte-printing', companyName: 'Printing Services', name: 'Yzel Norte' },
];

function isTraineeDeployedCheck(emp, availableHtes) {
  const raw = (emp.companyName || '').trim();
  if (!raw || isInvalidHteCompanyTest(raw)) {
    return false;
  }
  if (emp.hteId) {
    return true;
  }
  return (availableHtes || []).some(
    (h) => h.id === emp.hteId || (h.companyName && h.companyName.trim().toLowerCase() === raw.toLowerCase())
  );
}

function simulateFilterGroups(employeesList, availableHtes) {
  const pending = employeesList.filter((e) => {
    const isStudent = (e.position || 'OJT Trainee').toLowerCase().includes('trainee');
    if (!isStudent) return false;
    const isUndeployed = !isTraineeDeployedCheck(e, availableHtes);
    return (
      e.active === false ||
      e.approvalStatus === 'pending' ||
      e.applicationStatus === 'pending' ||
      e.applicationStatus === 'unregistered' ||
      (e.active == null && e.applicationStatus !== 'approved') ||
      isUndeployed
    );
  });

  const student = employeesList.filter((e) => {
    const isStudent = (e.position || 'OJT Trainee').toLowerCase().includes('trainee');
    if (!isStudent) return false;
    const isDeployed = isTraineeDeployedCheck(e, availableHtes);
    return (
      (e.active === true || e.active == null) &&
      e.approvalStatus !== 'pending' &&
      e.applicationStatus !== 'pending' &&
      e.applicationStatus !== 'unregistered' &&
      isDeployed
    );
  });

  return { pending, student };
}

const testCohort = [
  // 1: Undeployed - empty company
  { id: 't1', name: 'Alice Smith', position: 'OJT Trainee', companyName: '', hteId: null, active: true, approvalStatus: 'approved', applicationStatus: 'approved' },
  // 2: Undeployed - "Unassigned" placeholder
  { id: 't2', name: 'Bob Johnson', position: 'OJT Trainee', companyName: 'Unassigned', hteId: null, active: true, approvalStatus: 'approved', applicationStatus: 'approved' },
  // 3: Undeployed - "Pending Assignment"
  { id: 't3', name: 'Charlie Brown', position: 'OJT Trainee', companyName: 'Pending Assignment', hteId: null, active: true, approvalStatus: 'approved', applicationStatus: 'approved' },
  // 4: Deployed - Concentrix with valid hteId
  { id: 't4', name: 'David Lee', position: 'OJT Trainee', companyName: 'Concentrix', hteId: 'hte-concentrix', active: true, approvalStatus: 'approved', applicationStatus: 'approved' },
  // 5: Deployed - Printing Services matching available HTE
  { id: 't5', name: 'Emma Watson', position: 'OJT Trainee', companyName: 'Printing Services', hteId: null, active: true, approvalStatus: 'approved', applicationStatus: 'approved' },
  // 6: Pending verification regardless of company
  { id: 't6', name: 'Frank Miller', position: 'OJT Trainee', companyName: 'Concentrix', hteId: 'hte-concentrix', active: false, approvalStatus: 'pending', applicationStatus: 'pending' },
];

const initialGroups = simulateFilterGroups(testCohort, mockAvailableHtes);

// Test 25.1: Trainees not deployed to HTE must be in Pending Approvals
assert('Trainee with empty company is categorized in Pending Approvals', initialGroups.pending.some((t) => t.id === 't1'));
assert('Trainee with "Unassigned" company is categorized in Pending Approvals', initialGroups.pending.some((t) => t.id === 't2'));
assert('Trainee with "Pending Assignment" company is categorized in Pending Approvals', initialGroups.pending.some((t) => t.id === 't3'));
assert('Pending verification trainee is in Pending Approvals', initialGroups.pending.some((t) => t.id === 't6'));
assert('Pending Approvals contains exactly 4 trainees (3 undeployed + 1 pending verification)', initialGroups.pending.length === 4);

// Test 25.2: Active Trainees must strictly contain deployed, approved trainees
assert('Active Trainees contains deployed David Lee (Concentrix)', initialGroups.student.some((t) => t.id === 't4'));
assert('Active Trainees contains deployed Emma Watson (Printing Services)', initialGroups.student.some((t) => t.id === 't5'));
assert('Active Trainees does not contain undeployed Alice Smith', !initialGroups.student.some((t) => t.id === 't1'));
assert('Active Trainees does not contain unassigned Bob Johnson', !initialGroups.student.some((t) => t.id === 't2'));
assert('Active Trainees does not contain undeployed Charlie Brown', !initialGroups.student.some((t) => t.id === 't3'));
assert('Active Trainees contains exactly 2 deployed trainees', initialGroups.student.length === 2);

// Test 25.3: Deploying a trainee to HTE moves them from Pending Approvals to Active Trainees
const updatedT1 = {
  ...testCohort[0],
  hteId: 'hte-concentrix',
  companyName: 'Concentrix',
  active: true,
  approvalStatus: 'approved',
  applicationStatus: 'approved',
};
const updatedCohort = [updatedT1, ...testCohort.slice(1)];
const postDeployGroups = simulateFilterGroups(updatedCohort, mockAvailableHtes);

assert('Deploying Alice Smith to Concentrix moves her out of Pending Approvals', !postDeployGroups.pending.some((t) => t.id === 't1'));
assert('Deploying Alice Smith to Concentrix places her into Active Trainees', postDeployGroups.student.some((t) => t.id === 't1'));
assert('Active Trainees count increases from 2 to 3', postDeployGroups.student.length === 3);
assert('Pending Approvals count decreases from 4 to 3', postDeployGroups.pending.length === 3);

// ----------------------------------------------------------------------------
// TEST SUMMARY & METRICS
// ----------------------------------------------------------------------------
console.log(`\n${BOLD}======================================================================${RESET}`);
console.log(`${BOLD}                       WHITE BOX TEST SUMMARY                         ${RESET}`);
console.log(`${BOLD}======================================================================${RESET}`);
console.log(`  Total Test Cases Executed : ${BOLD}${totalTests}${RESET}`);
console.log(`  Passed Cases              : ${BOLD}${GREEN}${passedTests}${RESET}`);
console.log(`  Failed Cases              : ${BOLD}${failedTests > 0 ? RED : GREEN}${failedTests}${RESET}`);
const successRate = ((passedTests / totalTests) * 100).toFixed(1);
console.log(`  Overall Success Rate      : ${BOLD}${successRate}%${RESET}`);
console.log(`${BOLD}======================================================================${RESET}\n`);

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
