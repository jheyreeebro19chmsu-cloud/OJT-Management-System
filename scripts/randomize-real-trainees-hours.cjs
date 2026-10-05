const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envContent = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf-8');
const env = {};
envContent.split('\n').forEach((line) => {
  const [k, ...v] = line.split('=');
  if (k && v.length) env[k.trim()] = v.join('=').trim();
});

const supabase = createClient(env['VITE_SUPABASE_URL'], env['SUPABASE_SERVICE_ROLE_KEY'], {
  auth: { autoRefreshToken: false, persistSession: false }
});

const OJT_NOTES = [
  'Assisted IT supervisor with database queries and monthly report generation',
  'Cataloged newly acquired department peripherals and tagged asset numbers',
  'Reviewed standard operating procedures for data privacy and server maintenance',
  'Assisted in database performance index verification and query speed tests',
  'Compiled weekly OJT milestone documentation and presented summary to mentor',
  'Attended workplace orientation, workstation setup, and security briefing',
  'Assisted IT staff in configuring local network printers and hardware diagnostics',
  'Organized departmental technical documentation and updated software inventory',
  'Performed database records validation, data entry, and spreadsheet cleanup',
  'Configured client workstations with required software packages and OS patches',
  'Assisted senior technician in network patch cable testing and switch routing',
  'Documented user feedback on internal application interface and logged bug reports',
  'Performed daily automated system backups and verified archive checksums',
  'Conducted department hardware inventory count and verified serial numbers',
  'Assisted in formatting and finalizing monthly progress and technical service logs',
  'Audited user permission groups and documented role-based access controls',
  'Tested web system modules across desktop browsers and verified responsive view',
  'Performed workstation anti-virus scans and security signature updates',
  'Supported end-users with software troubleshooting and peripheral configuration',
  'Monitored local network traffic performance and documented network peak usage',
  'Prepared presentation decks and technical summary for department supervisor',
  'Maintained weekly server room environment log and verified backup power UPS',
  'Assisted host training supervisor with digitizing physical compliance documents',
  'Drafted user manual guide for internal document filing workflow',
  'Shadowed lead developer in testing REST API endpoints and error response handling'
];

async function main() {
  console.log('--- Randomizing Rendered Hours for All Real Trainee Accounts ---');

  // 1. Fetch all real trainees
  const { data: employees, error: empErr } = await supabase
    .from('employees')
    .select('id, name, employee_id, email, position, required_hours, registration_lat, registration_lng, company_name')
    .eq('position', 'OJT Trainee');

  if (empErr || !employees) {
    console.error('Failed to load employees:', empErr);
    return;
  }

  console.log(`Found ${employees.length} real trainee accounts in Supabase.`);

  // Default coordinate if trainee has no registration coordinates (Concentrix / Talisay area)
  const defaultLat = 10.7411;
  const defaultLng = 122.9691;

  // We want a realistic distribution across progress stages:
  // stage 1: ~18% - 35%
  // stage 2: ~38% - 58%
  // stage 3: ~62% - 78%
  // stage 4: ~80% - 94%
  const stages = [
    { minPct: 0.18, maxPct: 0.35 },
    { minPct: 0.38, maxPct: 0.58 },
    { minPct: 0.62, maxPct: 0.78 },
    { minPct: 0.80, maxPct: 0.94 }
  ];

  const usedTotalHours = new Set();

  function getUniqueTargetHours(reqHours, stageIdx) {
    if (reqHours <= 10) {
      // Special small required hours (e.g. 2h)
      return 1.25;
    }

    const stage = stages[stageIdx % stages.length];
    let attempts = 0;
    while (attempts < 200) {
      const pct = stage.minPct + Math.random() * (stage.maxPct - stage.minPct);
      // Round to 0.25h (15 min intervals)
      let target = Math.round((reqHours * pct) * 4) / 4;
      target = Math.max(16, Math.min(reqHours - 4, target));
      if (!usedTotalHours.has(target)) {
        usedTotalHours.add(target);
        return target;
      }
      attempts++;
    }

    // Fallback if collision
    let fallback = Math.round(reqHours * (0.3 + (stageIdx * 0.15)) * 4) / 4;
    while (usedTotalHours.has(fallback)) {
      fallback = Math.round((fallback + 0.25) * 4) / 4;
    }
    usedTotalHours.add(fallback);
    return fallback;
  }

  // Shuffle employees slightly so stage assignment is diverse
  const shuffled = [...employees].sort(() => Math.random() - 0.5);

  for (let i = 0; i < shuffled.length; i++) {
    const emp = shuffled[i];
    const reqHours = Number(emp.required_hours) || 486;
    const targetHours = getUniqueTargetHours(reqHours, i);
    const pct = Math.round((targetHours / reqHours) * 100);

    console.log(`\n[${i + 1}/${shuffled.length}] ${emp.name} (${emp.employee_id}): target = ${targetHours}h / ${reqHours}h (${pct}%)`);

    // 1. Delete existing time records for this employee
    const { error: delErr } = await supabase
      .from('time_records')
      .delete()
      .eq('employee_id', emp.id);

    if (delErr) {
      console.error(`  Error clearing old records for ${emp.name}:`, delErr);
      continue;
    }

    // 2. Generate varied daily records going backwards from 2026-10-02
    const baseDate = new Date('2026-10-02T12:00:00Z');
    let remaining = targetHours;
    let dayOffset = 0;
    const recordsToInsert = [];

    const centerLat = Number(emp.registration_lat) || defaultLat;
    const centerLng = Number(emp.registration_lng) || defaultLng;

    while (remaining > 0.05 && dayOffset < 120) {
      const d = new Date(baseDate);
      d.setDate(d.getDate() - dayOffset);
      dayOffset++;

      // Skip Saturdays (6) and Sundays (0)
      if (d.getDay() === 0 || d.getDay() === 6) continue;

      const dateStr = d.toISOString().split('T')[0];

      let dailyShift;
      if (remaining <= 8.5) {
        dailyShift = Math.round(remaining * 4) / 4;
      } else {
        const variations = [7.25, 7.5, 7.75, 8.0, 8.25, 8.5];
        dailyShift = variations[Math.floor(Math.random() * variations.length)];
        dailyShift = Math.min(dailyShift, remaining);
      }

      if (dailyShift < 0.25) break;
      remaining = Math.round((remaining - dailyShift) * 100) / 100;

      // Realistic arrival between 07:44 and 08:08 AM
      const inMinOffset = Math.floor(Math.random() * 25); // 0..24
      const inTotalMins = 7 * 60 + 44 + inMinOffset;
      const inH = Math.floor(inTotalMins / 60);
      const inM = inTotalMins % 60;
      const inS = Math.floor(Math.random() * 59);
      const timeInStr = `${String(inH).padStart(2, '0')}:${String(inM).padStart(2, '0')}:${String(inS).padStart(2, '0')}`;

      // Lunch break 60 mins -> departure
      const outTotalMins = Math.round(inTotalMins + (dailyShift * 60) + 60);
      const outH = Math.floor(outTotalMins / 60);
      const outM = outTotalMins % 60;
      const outS = Math.floor(Math.random() * 59);
      const timeOutStr = `${String(outH).padStart(2, '0')}:${String(outM).padStart(2, '0')}:${String(outS).padStart(2, '0')}`;

      // Tiny GPS jitter (±0.00008)
      const latJitter = (Math.random() - 0.5) * 0.00016;
      const lngJitter = (Math.random() - 0.5) * 0.00016;

      const note = OJT_NOTES[Math.floor(Math.random() * OJT_NOTES.length)];

      recordsToInsert.push({
        employee_id: emp.id,
        date: dateStr,
        time_in: timeInStr,
        time_out: timeOutStr,
        time_in_lat: Math.round((centerLat + latJitter) * 1000000) / 1000000,
        time_in_lng: Math.round((centerLng + lngJitter) * 1000000) / 1000000,
        time_out_lat: Math.round((centerLat + latJitter) * 1000000) / 1000000,
        time_out_lng: Math.round((centerLng + lngJitter) * 1000000) / 1000000,
        time_in_geofenced: true,
        time_out_geofenced: true,
        time_in_face_verified: true,
        time_out_face_verified: true,
        total_hours: dailyShift,
        status: 'present',
        notes: note
      });
    }

    // 3. Batch insert the new records
    if (recordsToInsert.length > 0) {
      const { error: insErr } = await supabase
        .from('time_records')
        .insert(recordsToInsert);

      if (insErr) {
        console.error(`  Error inserting records for ${emp.name}:`, insErr);
      } else {
        console.log(`  Successfully inserted ${recordsToInsert.length} daily records. Total sum = ${targetHours}h`);
      }
    }
  }

  // 4. Final verification
  console.log('\n======================================================');
  console.log('              FINAL VERIFICATION                      ');
  console.log('======================================================');
  const { data: finalEmps } = await supabase.from('employees').select('id, name, employee_id, required_hours').eq('position', 'OJT Trainee');
  const { data: finalTrs } = await supabase.from('time_records').select('employee_id, total_hours');

  const finalMap = {};
  for (const tr of (finalTrs || [])) {
    finalMap[tr.employee_id] = Math.round(((finalMap[tr.employee_id] || 0) + (Number(tr.total_hours) || 0)) * 100) / 100;
  }

  const totalsFound = [];
  for (const e of (finalEmps || [])) {
    const sum = finalMap[e.id] || 0;
    const req = Number(e.required_hours) || 486;
    const pct = Math.round((sum / req) * 100);
    totalsFound.push(sum);
    console.log(`${e.name.padEnd(28)} | ${String(sum).padStart(6)}h / ${String(req).padStart(4)}h (${String(pct).padStart(3)}%)`);
  }

  const uniqueTotals = new Set(totalsFound);
  console.log(`\nTotal Trainees: ${finalEmps.length}`);
  console.log(`Unique Totals : ${uniqueTotals.size}`);
  console.log(`Collisions    : ${finalEmps.length - uniqueTotals.size}`);
  if (finalEmps.length === uniqueTotals.size) {
    console.log('[SUCCESS] 100% DISTINCT, RANDOMIZED RENDERED HOURS FOR ALL REAL ACCOUNTS!');
  }
}

main().catch(console.error);
