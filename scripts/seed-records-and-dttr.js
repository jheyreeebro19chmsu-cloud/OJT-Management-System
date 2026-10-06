import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Read .env if available
let envFile = {};
try {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        envFile[match[1]] = match[2] ? match[2].trim() : '';
      }
    }
  }
} catch (e) {
  // ignore
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || envFile.VITE_SUPABASE_URL || 'https://wooighmdckuoebsuegzz.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || envFile.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const CONCENTRIX_TASKS = [
  'Assisted in database management and client technical documentation',
  'Conducted system QA testing on customer service portal modules',
  'Configured network workstations and verified terminal connectivity',
  'Monitored helpdesk queue and resolved tier-1 application tickets',
  'Participated in daily tech standup and documented sprint backlog items',
  'Performed data validation routines and audited customer log entries',
  'Drafted technical user guides and system operation procedures',
  'Assisted senior engineers in API integration tests and error logging',
  'Audited database backup snapshots and reported integrity checksums',
  'Reviewed access permission roles and validated SSO credentials',
  'Tested cross-browser UI responsiveness for client portal update',
  'Compiled weekly OJT milestone documentation and presented summary to mentor',
  'Investigated network packet drops and logged switch interface stats',
  'Configured local development environments and verified dependencies',
  'Executed automated smoke test scripts and reviewed log reports'
];

const PRINTING_TASKS = [
  'Maintained digital pre-press workflow system and verified printer queues',
  'Organized and archived production media database records',
  'Configured local print server workstations and network drivers',
  'Conducted inventory data entry for printing supplies and equipment',
  'Reviewed layout rendering quality and documented output specifications',
  'Monitored production order queues and logged job turnaround times',
  'Troubleshot workstation connectivity issues and updated utility software',
  'Assisted in batch scanning and digital document indexing operations',
  'Performed routine maintenance on design workstations and backup servers',
  'Verified client print job metadata and logged completed shipments',
  'Calibrated large-format printer network interfaces and spoolers',
  'Documented customer work order specifications and tracked deliverables',
  'Assisted in digital asset cataloging and cloud storage reorganization',
  'Audited weekly materials utilization data and prepared digital report',
  'Updated device firmware on network printers and verified test pages'
];

function generateUuid(prefix, num, sub = 0) {
  const p1 = String(prefix).padStart(8, '0');
  const p2 = String(num % 10000).padStart(4, '0');
  const p3 = '4000';
  const p4 = '8000';
  const p5 = String(sub).padStart(12, '0');
  return `${p1}-${p2}-${p3}-${p4}-${p5}`;
}

function generateEvalUuid(prefix, num) {
  const p1 = String(prefix).padStart(8, '0');
  const p2 = String(num % 10000).padStart(4, '0');
  const p3 = '4000';
  const p4 = '9000';
  const p5 = '000000000001';
  return `${p1}-${p2}-${p3}-${p4}-${p5}`;
}

async function run() {
  console.log('Fetching seeded trainees from Supabase...');
  const { data: trainees, error: fetchErr } = await supabase
    .from('employees')
    .select('*')
    .or('employee_id.like.2024-CTX-%,employee_id.like.2024-PS-%')
    .order('employee_id', { ascending: true });

  if (fetchErr) {
    console.error('Error fetching trainees:', fetchErr);
    process.exit(1);
  }

  console.log(`Found ${trainees.length} seeded trainees to populate.`);

  const allTimeRecords = [];
  const allEvaluations = [];
  const employeeUpdates = [];

  const baseStartDate = new Date('2026-06-15T08:00:00Z');

  for (let i = 0; i < trainees.length; i++) {
    const t = trainees[i];
    const isConcentrix = (t.company_name || '').toLowerCase().includes('concentrix');
    const companyPrefix = isConcentrix ? 1 : 2;
    const match = (t.employee_id || '').match(/(\d+)$/);
    const studentNum = match ? parseInt(match[1], 10) : (i + 1);

    const lat = t.registration_lat || (isConcentrix ? 10.694261 : 10.742858);
    const lng = t.registration_lng || (isConcentrix ? 122.959987 : 122.970088);
    const address = t.registration_address || (isConcentrix
      ? 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod'
      : 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines');
    const tasksPool = isConcentrix ? CONCENTRIX_TASKS : PRINTING_TASKS;
    const supervisorName = isConcentrix ? 'Jhey Ree C Ebro' : 'Yzel B. Norte';

    const reqHours = Number(t.required_hours) || 486;

    // Realistic target rendered hours distribution:
    // Some trainees are near completion (75-92%), many midway (45-75%), some early (25-45%), few just starting (10-25%)
    let targetRatio;
    const tier = (studentNum * 7 + (isConcentrix ? 13 : 29)) % 100;
    if (tier < 30) {
      targetRatio = 0.75 + ((tier % 18) * 0.01); // 75% to 92%
    } else if (tier < 75) {
      targetRatio = 0.45 + ((tier % 30) * 0.01); // 45% to 74%
    } else if (tier < 95) {
      targetRatio = 0.25 + ((tier % 20) * 0.01); // 25% to 44%
    } else {
      targetRatio = 0.10 + ((tier % 15) * 0.01); // 10% to 24%
    }

    const targetRendered = Math.round(reqHours * targetRatio);

    let accumulatedHours = 0;
    const curDate = new Date(baseStartDate);
    let dayCount = 0;

    while (accumulatedHours < targetRendered && dayCount < 75) {
      dayCount++;
      // Move to next business day
      curDate.setDate(curDate.getDate() + 1);
      if (curDate.getDay() === 0) curDate.setDate(curDate.getDate() + 1); // skip Sun
      if (curDate.getDay() === 6) curDate.setDate(curDate.getDate() + 2); // skip Sat

      const remaining = Math.round((targetRendered - accumulatedHours) * 100) / 100;
      if (remaining <= 0) break;

      let dayHours;
      if (remaining <= 8.5) {
        dayHours = remaining;
      } else {
        const hourOptions = [7.25, 7.5, 7.75, 8.0, 8.0, 8.25, 8.5];
        dayHours = hourOptions[(dayCount + studentNum) % hourOptions.length];
        if (dayHours > remaining) dayHours = remaining;
      }

      dayHours = Math.round(dayHours * 100) / 100;
      accumulatedHours = Math.round((accumulatedHours + dayHours) * 100) / 100;

      const dateStr = curDate.toISOString().split('T')[0];

      // Jitter location slightly within geofence radius (approx 10-20 meters)
      const latJitter = (Math.sin(dayCount * 1.5 + studentNum) * 0.00015);
      const lngJitter = (Math.cos(dayCount * 1.5 + studentNum) * 0.00015);

      // Check-in between 07:45 and 08:20
      const minuteSpread = (studentNum * 7 + dayCount * 13) % 36;
      let inHour = 7;
      let inMinute = 45 + minuteSpread;
      if (inMinute >= 60) {
        inHour = 8;
        inMinute -= 60;
      }
      const inSecond = (dayCount * 17 + studentNum) % 60;

      const timeInStr = `${String(inHour).padStart(2, '0')}:${String(inMinute).padStart(2, '0')}:${String(inSecond).padStart(2, '0')}`;

      // Check out after dayHours + 1 hr lunch
      const inSec = inHour * 3600 + inMinute * 60 + inSecond;
      const totalWorkSec = Math.round((dayHours + 1.0) * 3600);
      const outSec = inSec + totalWorkSec;
      const outH = Math.floor(outSec / 3600) % 24;
      const outM = Math.floor((outSec % 3600) / 60);
      const outS = outSec % 60;
      const timeOutStr = `${String(outH).padStart(2, '0')}:${String(outM).padStart(2, '0')}:${String(outS).padStart(2, '0')}`;

      const isLate = inHour > 8 || (inHour === 8 && inMinute > 15);
      const status = isLate ? 'late' : (dayHours > 8.0 ? 'overtime' : 'present');
      const note = tasksPool[(dayCount + studentNum) % tasksPool.length];

      allTimeRecords.push({
        id: generateUuid(companyPrefix, studentNum, dayCount),
        employee_id: t.id,
        date: dateStr,
        time_in: timeInStr,
        time_out: timeOutStr,
        time_in_lat: Number((lat + latJitter).toFixed(6)),
        time_in_lng: Number((lng + lngJitter).toFixed(6)),
        time_out_lat: Number((lat + latJitter).toFixed(6)),
        time_out_lng: Number((lng + lngJitter).toFixed(6)),
        time_in_geofenced: true,
        time_out_geofenced: true,
        time_in_face_verified: true,
        time_out_face_verified: true,
        total_hours: dayHours,
        status: status,
        notes: note,
        created_at: `${dateStr}T17:00:00Z`
      });
    }

    // Evaluations for trainees with >= 150 hours rendered
    if (accumulatedHours >= 150) {
      const baseScore = accumulatedHours > 350 ? 94 : 88;
      const scoreJitter = (studentNum % 7) - 3;
      const att = Math.min(100, Math.max(86, baseScore + scoreJitter + 2));
      const perf = Math.min(100, Math.max(85, baseScore + scoreJitter + 1));
      const atti = Math.min(100, Math.max(88, baseScore + scoreJitter + 3));
      const punc = Math.min(100, Math.max(84, baseScore + scoreJitter));
      const comm = Math.min(100, Math.max(86, baseScore + scoreJitter + 1));
      const overall = Number(((att + perf + atti + punc + comm) / 5).toFixed(1));
      const grade = overall >= 93 ? 'Excellent' : 'Very Good';

      allEvaluations.push({
        id: generateEvalUuid(companyPrefix, studentNum),
        employee_id: t.id,
        evaluated_by: supervisorName,
        attendance_score: att,
        performance_score: perf,
        attitude_score: atti,
        punctuality_score: punc,
        communication_score: comm,
        overall_score: overall,
        grade: grade,
        strengths: isConcentrix
          ? 'Demonstrates high diligence in system workflows, disciplined attendance, and excellent team cooperation.'
          : 'High attention to detail in digital pre-press operations, reliable task execution, and great technical initiative.',
        areas_for_improvement: 'Continue taking proactive lead on enterprise-scale architectural tasks.',
        recommendations: 'Highly recommended for company absorption upon completion of degree.',
        evaluated_at: '2026-09-30T10:00:00Z',
        status: 'final'
      });
    }

    // Clean documents status as requested: "BUT NOT THE DOCUMENTS"
    const regLoc = t.registration_location || {};
    regLoc.documentsPassed = false;
    regLoc.documentsStatus = 'pending';

    employeeUpdates.push({
      id: t.id,
      rendered_hours: accumulatedHours,
      registration_location: regLoc
    });
  }

  console.log(`\nGenerated:`);
  console.log(`- ${allTimeRecords.length} Daily Time Records (DTTR)`);
  console.log(`- ${allEvaluations.length} Supervisor Evaluations`);
  console.log(`- ${employeeUpdates.length} Trainee Rendered Hours updates`);

  // 1. Upsert time records in chunks of 250
  console.log('\nUpserting time_records into Supabase...');
  const CHUNK_SIZE = 250;
  for (let c = 0; c < allTimeRecords.length; c += CHUNK_SIZE) {
    const chunk = allTimeRecords.slice(c, c + CHUNK_SIZE);
    const { error: trErr } = await supabase
      .from('time_records')
      .upsert(chunk, { onConflict: 'id' });

    if (trErr) {
      console.error(`Error upserting time_records batch ${c}:`, trErr);
      throw trErr;
    }
    console.log(`✓ Processed time_records batch ${c + chunk.length}/${allTimeRecords.length}`);
  }

  // 2. Upsert evaluations
  console.log('\nUpserting evaluations into Supabase...');
  for (let c = 0; c < allEvaluations.length; c += CHUNK_SIZE) {
    const chunk = allEvaluations.slice(c, c + CHUNK_SIZE);
    const { error: evErr } = await supabase
      .from('evaluations')
      .upsert(chunk, { onConflict: 'id' });

    if (evErr) {
      console.error(`Error upserting evaluations batch ${c}:`, evErr);
      throw evErr;
    }
    console.log(`✓ Processed evaluations batch ${c + chunk.length}/${allEvaluations.length}`);
  }

  // 3. Update employees rendered_hours and clean documents status
  console.log('\nUpdating employees rendered_hours and document status...');
  for (let c = 0; c < employeeUpdates.length; c += 50) {
    const chunk = employeeUpdates.slice(c, c + 50);
    for (const item of chunk) {
      const { error: upErr } = await supabase
        .from('employees')
        .update({
          rendered_hours: item.rendered_hours,
          registration_location: item.registration_location
        })
        .eq('id', item.id);

      if (upErr) {
        console.warn(`Warn updating employee ${item.id}:`, upErr.message);
      }
    }
    console.log(`✓ Updated employees ${c + chunk.length}/${employeeUpdates.length}`);
  }

  console.log('\n=============================================');
  console.log('SEEDING COMPLETE!');
  console.log(`Total DTTR Time Records: ${allTimeRecords.length}`);
  console.log(`Total Evaluations: ${allEvaluations.length}`);
  console.log(`Documents explicitly set to pending/unpassed as requested.`);
  console.log('=============================================');
}

run().catch((e) => {
  console.error('Fatal error:', e);
  process.exit(1);
});
