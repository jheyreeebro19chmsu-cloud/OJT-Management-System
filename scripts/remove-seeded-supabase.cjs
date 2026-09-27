const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

let SUPABASE_URL = 'https://wooighmdckuoebsuegzz.supabase.co';
let SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indvb2lnaG1kY2t1b2Vic3VlZ3p6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjY5MTgwNywiZXhwIjoyMDg4MjY3ODA3fQ.isLQcKDpXplyE9YDjgub4UOhnfBorngVvVRALuQ8aJA';

try {
  const envContent = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf-8');
  envContent.split('\n').forEach((line) => {
    const [k, ...v] = line.split('=');
    if (k && v.length) {
      const key = k.trim();
      const val = v.join('=').trim();
      if (key === 'VITE_SUPABASE_URL') SUPABASE_URL = val;
      if (key === 'SUPABASE_SERVICE_ROLE_KEY') SERVICE_ROLE_KEY = val;
    }
  });
} catch (e) {
  console.log('Using default Supabase env variables.');
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function removeSeededData() {
  console.log('Removing seeded records from Supabase...');

  const seededEmployeeIds = ['2023-00101', '2023-00102', '2023-00103', '2023-00104'];

  // 1. Get internal UUIDs of seeded employees
  const { data: emps } = await supabase
    .from('employees')
    .select('id')
    .in('employee_id', seededEmployeeIds);

  const empUuids = (emps || []).map((e) => e.id);

  if (empUuids.length > 0) {
    // Delete time records for seeded employees
    const { error: trErr } = await supabase
      .from('time_records')
      .delete()
      .in('employee_id', empUuids);
    console.log('[OK] Seeded time records removed:', trErr ? trErr.message : 'Success');

    // Delete evaluations for seeded employees
    const { error: evErr } = await supabase
      .from('evaluations')
      .delete()
      .in('employee_id', empUuids);
    console.log('[OK] Seeded evaluations removed:', evErr ? evErr.message : 'Success');

    // Delete seeded employees
    const { error: empErr } = await supabase
      .from('employees')
      .delete()
      .in('id', empUuids);
    console.log('[OK] Seeded employees removed:', empErr ? empErr.message : 'Success');
  }

  // Delete seeded host supervisors
  const seededSupervisors = ['hte.techcorp@chmsuojtmis.site', 'hte.cyberhub@chmsuojtmis.site'];
  const { error: supErr } = await supabase
    .from('host_supervisors')
    .delete()
    .in('email', seededSupervisors);
  console.log('[OK] Seeded supervisors removed:', supErr ? supErr.message : 'Success');

  // Delete seeded announcements
  const seededAnnouncements = [
    'Welcome to OJT 2nd Semester 2026-2027',
    'Midterm Progress Journal Submission Due Date'
  ];
  const { error: annErr } = await supabase
    .from('announcements')
    .delete()
    .in('title', seededAnnouncements);
  console.log('[OK] Seeded announcements removed:', annErr ? annErr.message : 'Success');

  // Delete seeded geofence zones
  const seededZones = [
    'CHMSU Talisay Main Campus',
    'Ayala Capitol Central - NexGen IT Hub',
    'Provincial Capitol ICT Division'
  ];
  const { error: geoErr } = await supabase
    .from('geofence_zones')
    .delete()
    .in('name', seededZones);
  console.log('[OK] Seeded geofence zones removed:', geoErr ? geoErr.message : 'Success');

  console.log('\nAll seeded data removed from Supabase successfully.');
}

removeSeededData();
