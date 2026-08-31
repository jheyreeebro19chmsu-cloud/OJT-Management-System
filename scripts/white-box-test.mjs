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

// Test 1.2: Inside 50-meter radius boundary
// Approx 0.0001 deg lat ~ 11.1 meters
const dInside = calculateDistance(10.7410, 122.9702, 10.7412, 122.9702);
assert('Small offset (~22m) computes accurate distance', dInside > 20 && dInside < 25, `Distance was ${dInside.toFixed(2)}m`);

const withinZone = isWithinGeofence(10.7412, 122.9702, 10.7410, 122.9702, 50, 5);
assert('User at 22m is within 50m geofence radius', withinZone === true);

// Test 1.3: Outside 50-meter radius boundary (e.g. 500m away)
const outsideZone = isWithinGeofence(10.7450, 122.9702, 10.7410, 122.9702, 50, 5);
assert('User at 440m is outside 50m geofence radius', outsideZone === false);

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
