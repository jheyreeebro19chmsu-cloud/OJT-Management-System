// Script to generate supabase/migrations/20261003_seed_120_realistic_trainees.sql
const fs = require('fs');
const path = require('path');

// HTE 3: Printing Services (Yzel Norte)
const HTE_3 = {
  id: 'b3171b8e-5912-4b09-8468-e1084ca97ccd',
  employeeId: 'HTE-DEMO-003',
  name: 'Printing Services',
  contactPerson: 'Yzel Norte',
  email: 'norteyzel@gmail.com',
  position: 'HTE Representative',
  department: 'Printing & Media Services',
  address: 'Printing Services, Negros Occidental',
  phone: '0918-420-1192',
  lat: 10.822655,
  lng: 123.033082,
  radius: 100,
};

const FIRST_NAMES_MALE = [
  'Joshua', 'Christian', 'John Paul', 'Mark Vincent', 'Angelo', 'Gabriel', 'Rafael', 'Daniel', 'Michael',
  'Kevin', 'Carl', 'Anthony', 'Adrian', 'Kenneth', 'Francis', 'Justin', 'Jerome', 'Dominic', 'Patrick',
  'Bryan', 'Paolo', 'Renz', 'Kyle', 'Ian', 'Neil', 'Matthew', 'Nathaniel', 'Sean', 'Leo', 'Alvin'
];

const FIRST_NAMES_FEMALE = [
  'Mary Grace', 'Bea Nicole', 'Angelica', 'Alyssa', 'Christine', 'Hannah', 'Patricia', 'Camille',
  'Kathleen', 'Rochelle', 'Danielle', 'Erika', 'Sophia', 'Jasmine', 'Mariel', 'Kyla', 'Andrea',
  'Princess', 'Chloe', 'Bianca', 'Janelle', 'Maureen', 'Althea', 'Clarisse', 'Trisha', 'Rhea',
  'Samantha', 'Denise', 'Kristine', 'Joy'
];

const LAST_NAMES = [
  'Montelibano', 'Guanzon', 'Javellana', 'Lacson', 'Cuenca', 'Alcantara', 'Gatuslao', 'De la Rama',
  'Torres', 'Yanson', 'Gonzaga', 'Ledesma', 'Bautista', 'Villanueva', 'Fernandez', 'Santos', 'Reyes',
  'Cruz', 'Tan', 'Lim', 'Castillo', 'Mendoza', 'Aquino', 'Delgado', 'Sarmiento', 'Ebro', 'Lopez',
  'Medina', 'Ramos', 'Navarro', 'Mercado', 'Valdez', 'Salazar', 'Chua', 'Sy', 'Garcia', 'Perez',
  'Flores', 'Tolentino', 'Morales'
];

const COURSES = [
  'Bachelor of Science in Information Technology',
  'Bachelor of Science in Information Systems',
];

const TALISAY_CAMPUS = 'Talisay (Main Campus)';

function escapeSql(str) {
  if (!str) return 'NULL';
  return `'${String(str).replace(/'/g, "''")}'`;
}

let sql = `-- ============================================================================
-- SEED SCRIPT: 120 REALISTIC DEMO TRAINEES FOR HTE 3 (PRINTING SERVICES)
-- Campus: Talisay (Main Campus) • College of Computer Studies (2026-2027)
-- ============================================================================
-- Execute in Supabase Dashboard -> SQL Editor
-- Safely tags all demo users with 'CHMSU-2024-D%' for easy identification & rollback.
-- ============================================================================

BEGIN;

-- 1. Ensure HTE 3 (Printing Services) Record Exists in host_supervisors
INSERT INTO public.host_supervisors (id, employee_id, name, email, company_name, company_address, contact_person, phone, academic_year, is_approved, active)
VALUES (
  '${HTE_3.id}', '${HTE_3.employeeId}', ${escapeSql(HTE_3.contactPerson)}, ${escapeSql(HTE_3.email)},
  ${escapeSql(HTE_3.name)}, ${escapeSql(HTE_3.address)}, ${escapeSql(HTE_3.contactPerson)},
  ${escapeSql(HTE_3.phone)}, '2026-2027', true, true
)
ON CONFLICT (id) DO UPDATE SET 
  name = EXCLUDED.name,
  company_name = EXCLUDED.company_name,
  email = EXCLUDED.email;

-- 2. Ensure Geofence Zone for Printing Services Exists
INSERT INTO public.geofence_zones (id, name, address, lat, lng, radius, active, employee_id)
VALUES (
  'zone-demo-printing-services', 'Yzel Norte - Printing Services', ${escapeSql(HTE_3.address)},
  ${HTE_3.lat}, ${HTE_3.lng}, ${HTE_3.radius}, true, '${HTE_3.id}'
)
ON CONFLICT (id) DO UPDATE SET
  lat = EXCLUDED.lat,
  lng = EXCLUDED.lng,
  radius = EXCLUDED.radius;
`;

// Distribution stages with completely unique, randomized rendered hours for every trainee
const usedTotalHours = new Set();

function getUniqueTarget(min, max, usedSet) {
  let attempts = 0;
  while (attempts < 2000) {
    const steps = Math.floor(Math.random() * Math.max(1, (max - min) * 4));
    const val = Math.round((min + steps * 0.25) * 100) / 100;
    if (!usedSet.has(val)) {
      usedSet.add(val);
      return val;
    }
    attempts++;
  }
  let fallback = Math.round(min * 100) / 100;
  while (usedSet.has(fallback)) {
    fallback = Math.round((fallback + 0.25) * 100) / 100;
  }
  usedSet.add(fallback);
  return fallback;
}

const stages = [];
// 24 newly started trainees: 16.0h to 88.0h (randomized, unique)
for (let i = 0; i < 24; i++) {
  const target = getUniqueTarget(16, 88, usedTotalHours);
  stages.push({ stage: 1, targetHours: target });
}
// 54 mid-OJT trainees: 185.0h to 395.0h (randomized, unique)
for (let i = 0; i < 54; i++) {
  const target = getUniqueTarget(185, 395, usedTotalHours);
  stages.push({ stage: 2, targetHours: target });
}
// 30 advanced trainees: 420.0h to 585.0h (randomized, unique)
for (let i = 0; i < 30; i++) {
  const target = getUniqueTarget(420, 585, usedTotalHours);
  stages.push({ stage: 3, targetHours: target });
}
// 6 completed trainees: 600.0h to 615.0h (randomized, unique)
for (let i = 0; i < 6; i++) {
  const target = getUniqueTarget(600, 615, usedTotalHours);
  stages.push({ stage: 4, targetHours: target });
}
// 6 at-risk / sporadic trainees: 35.0h to 140.0h (randomized, unique)
for (let i = 0; i < 6; i++) {
  const target = getUniqueTarget(35, 140, usedTotalHours);
  stages.push({ stage: 5, targetHours: target });
}

// Shuffle stages so trainees in the list have organic, non-sequential progress
for (let i = stages.length - 1; i > 0; i--) {
  const j = Math.floor(Math.random() * (i + 1));
  [stages[i], stages[j]] = [stages[j], stages[i]];
}

sql += `\n-- 3. Insert 120 Trainee Accounts Assigned to Printing Services (Talisay Campus)\n`;

const trainees = [];

for (let i = 0; i < 120; i++) {
  const num = i + 1;
  const numStr = String(num).padStart(3, '0');
  const isMale = i % 2 === 0;
  const firstName = isMale ? FIRST_NAMES_MALE[i % FIRST_NAMES_MALE.length] : FIRST_NAMES_FEMALE[i % FIRST_NAMES_FEMALE.length];
  const lastName = LAST_NAMES[i % LAST_NAMES.length];
  const middleInitial = String.fromCharCode(65 + (i % 26)) + '.';
  const fullName = `${firstName} ${middleInitial} ${lastName}`;
  const empId = `OJT-2024-D${numStr}`;
  const uuid = `00000000-0000-4000-a000-${String(num).padStart(12, '0')}`;
  const email = `trainee.demo${numStr}@demo.chmsu.edu.ph`;
  const course = COURSES[i % COURSES.length];
  const photo = `https://api.dicebear.com/7.x/avataaars/svg?seed=${firstName}-${lastName}`;
  const phone = `0917${String(1000000 + i).slice(0, 7)}`;
  const stageCfg = stages[i];

  trainees.push({ empId, uuid, stageCfg, fullName });

  sql += `
INSERT INTO public.employees (
  id, name, employee_id, username, email, phone, role, department, position,
  company_name, supervisor_name, school_name, campus, course, start_date, end_date,
  required_hours, photo, face_registered, active, hte_id, academic_year,
  approval_status, application_status, registration_lat, registration_lng, registration_address
) VALUES (
  '${uuid}', ${escapeSql(fullName)}, '${empId}', 'demo${numStr}', '${email}', '${phone}', 'employee',
  ${escapeSql(HTE_3.department)}, 'OJT Intern', ${escapeSql(HTE_3.name)}, ${escapeSql(HTE_3.contactPerson)},
  'Carlos Hilado Memorial State University', '${TALISAY_CAMPUS}', ${escapeSql(course)},
  '2026-06-15', '2026-11-20', 600, '${photo}', true, true, '${HTE_3.id}', '2026-2027',
  'approved', 'approved', ${HTE_3.lat}, ${HTE_3.lng}, ${escapeSql(HTE_3.address)}
) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email, company_name = EXCLUDED.company_name;
`;
}

sql += `\n-- 4. Insert Realistic Daily Time Records (DTR) for Printing Services\n`;

const baseDate = new Date('2026-06-16T08:00:00Z');

trainees.forEach((t) => {
  let accHours = 0;
  const d = new Date(baseDate);
  let dayIdx = 0;

  while (accHours < t.stageCfg.targetHours && dayIdx < 95) {
    dayIdx++;
    d.setDate(d.getDate() + 1);
    if (d.getDay() === 0) d.setDate(d.getDate() + 1); // skip Sun
    if (d.getDay() === 6) d.setDate(d.getDate() + 2); // skip Sat

    if (t.stageCfg.stage === 5 && Math.random() < 0.25) {
      continue;
    }

    const remaining = Math.round((t.stageCfg.targetHours - accHours) * 100) / 100;
    if (remaining <= 0) break;

    let dayHours;
    if (remaining <= 8.75) {
      dayHours = remaining;
    } else {
      const dailyOptions = [7.25, 7.5, 7.75, 8.0, 8.0, 8.25, 8.5, 8.75];
      dayHours = dailyOptions[Math.floor(Math.random() * dailyOptions.length)];
      if (dayHours > remaining) {
        dayHours = remaining;
      }
    }

    dayHours = Math.round(dayHours * 100) / 100;
    accHours = Math.round((accHours + dayHours) * 100) / 100;

    const dateStr = d.toISOString().split('T')[0];

    // Compute realistic clock-in and clock-out times
    const startMinute = Math.floor(Math.random() * 25);
    const startSecond = Math.floor(Math.random() * 60);
    let inH = 7;
    let inM = 45 + startMinute;
    if (inM >= 60) {
      inH = 8;
      inM -= 60;
    }
    const inTotalSec = (inH * 3600) + (inM * 60) + startSecond;
    const timeInStr = `${String(inH).padStart(2, '0')}:${String(inM).padStart(2, '0')}:${String(startSecond).padStart(2, '0')}`;

    const outTotalSec = Math.round(inTotalSec + ((dayHours + 1.0) * 3600));
    const outH = Math.floor(outTotalSec / 3600) % 24;
    const outM = Math.floor((outTotalSec % 3600) / 60);
    const outS = outTotalSec % 60;
    const timeOutStr = `${String(outH).padStart(2, '0')}:${String(outM).padStart(2, '0')}:${String(outS).padStart(2, '0')}`;

    const isLate = (inH === 8 && inM > 15) || inH > 8;
    const status = isLate ? 'late' : (dayHours > 8.0 ? 'overtime' : 'present');
    const recId = `dtr-demo-${t.empId.slice(-3)}-${dayIdx}`;

    sql += `
INSERT INTO public.time_records (
  id, employee_id, date, time_in, time_out, total_hours, status, notes,
  time_in_lat, time_in_lng, time_out_lat, time_out_lng, time_in_geofenced, time_out_geofenced,
  time_in_face_verified, time_out_face_verified
) VALUES (
  '${recId}', '${t.empId}', '${dateStr}', '${timeInStr}', '${timeOutStr}', ${dayHours}, '${status}', 'Duty rendered at Printing Services',
  ${HTE_3.lat}, ${HTE_3.lng}, ${HTE_3.lat}, ${HTE_3.lng}, true, true, true, true
) ON CONFLICT (id) DO NOTHING;`;
  }

  // Supervisor Evaluations by Yzel Norte
  if (t.stageCfg.stage >= 2) {
    const score = t.stageCfg.stage === 4 ? 95 : t.stageCfg.stage === 3 ? 91 : t.stageCfg.stage === 5 ? 73 : 86;
    const evalId = `eval-demo-${t.empId.slice(-3)}-mid`;
    sql += `
INSERT INTO public.evaluations (id, employee_id, supervisor_name, evaluator_position, company_name, evaluation_date, academic_year, total_score, remarks)
VALUES ('${evalId}', '${t.empId}', ${escapeSql(HTE_3.contactPerson)}, ${escapeSql(HTE_3.position)}, ${escapeSql(HTE_3.name)}, '2026-08-30', '2026-2027', ${score}, 'Performance evaluation recorded for Printing Services intern.')
ON CONFLICT (id) DO NOTHING;`;
  }
});

sql += `\nCOMMIT;\n`;

const outPath = path.resolve('supabase/migrations/20261003_seed_120_realistic_trainees.sql');
fs.writeFileSync(outPath, sql, 'utf8');
console.log(`Generated SQL seed script at: ${outPath} (${(sql.length / 1024).toFixed(1)} KB)`);
