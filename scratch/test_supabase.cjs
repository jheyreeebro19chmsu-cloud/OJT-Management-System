const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envContent = fs.readFileSync('.env', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const [k, ...v] = line.split('=');
  if (k && v.length) env[k.trim()] = v.join('=').trim();
});

const supabaseUrl = env['VITE_SUPABASE_URL'];
const supabaseAnon = env['VITE_SUPABASE_ANON_KEY'];
const supabaseService = env['SUPABASE_SERVICE_ROLE_KEY'];

console.log('Testing Supabase Connection...');
console.log('URL:', supabaseUrl);

const anonClient = createClient(supabaseUrl, supabaseAnon);
const adminClient = createClient(supabaseUrl, supabaseService);

async function test() {
  console.log('\n--- 1. Testing employees query with anonClient ---');
  const { data: anonData, error: anonError, status: anonStatus } = await anonClient
    .from('employees')
    .select('*')
    .limit(3);
  console.log('Anon employees select * status:', anonStatus, 'error:', anonError ? anonError.message : 'none', 'count:', anonData ? anonData.length : 0);

  console.log('\n--- 2. Testing employees query with adminClient ---');
  const { data: adminData, error: adminError } = await adminClient
    .from('employees')
    .select('*')
    .limit(3);
  if (adminError) {
    console.error('Admin select * error:', adminError);
  } else {
    console.log('Admin select count:', adminData.length);
    if (adminData.length > 0) {
      console.log('Sample employee keys:', Object.keys(adminData[0]));
      console.log('Sample employee photo:', adminData[0].photo ? adminData[0].photo.substring(0, 80) : null);
      console.log('Sample employee position:', adminData[0].position);
    }
  }

  console.log('\n--- 3. Testing specific query from supabaseService.ts (EMPLOYEE_CORE_COLUMNS) with anonClient ---');
  const EMPLOYEE_CORE_COLUMNS = [
    'id', 'name', 'employee_id', 'email', 'department', 'position', 'company_name',
    'supervisor_name', 'school_name', 'campus', 'course', 'start_date', 'end_date',
    'required_hours', 'photo', 'face_registered', 'active', 'academic_year',
    'registration_lat', 'registration_lng', 'registration_address',
    'instructor_id', 'hte_id', 'application_status', 'registration_location', 'created_at',
  ].join(',');

  const { data: coreData, error: coreError, status: coreStatus } = await anonClient
    .from('employees')
    .select(EMPLOYEE_CORE_COLUMNS)
    .limit(3);
  console.log('Core columns select status:', coreStatus, 'error:', coreError ? coreError.message : 'none');

  console.log('\n--- 4. Checking buckets with adminClient ---');
  const { data: buckets, error: bErr } = await adminClient.storage.listBuckets();
  if (bErr) console.error('Bucket list error:', bErr);
  else console.log('Buckets:', buckets.map(b => ({ id: b.id, name: b.name, public: b.public })));

  console.log('\n--- 5. Checking sample time_records with adminClient and anonClient ---');
  const { data: trAnon, error: trAnonErr } = await anonClient.from('time_records').select('*').limit(3);
  console.log('Anon time_records select:', trAnonErr ? trAnonErr.message : (trAnon ? trAnon.length : 0));

  const { data: trAdmin, error: trAdminErr } = await adminClient.from('time_records').select('*').limit(3);
  console.log('Admin time_records count:', trAdmin ? trAdmin.length : 0);
  if (trAdmin && trAdmin.length > 0) {
    console.log('Sample time_record keys:', Object.keys(trAdmin[0]));
  }

  console.log('\n--- 6. Checking sample evaluations ---');
  const { data: evAnon, error: evAnonErr } = await anonClient.from('evaluations').select('*').limit(3);
  console.log('Anon evaluations select:', evAnonErr ? evAnonErr.message : (evAnon ? evAnon.length : 0));
  const { data: evAdmin, error: evAdminErr } = await adminClient.from('evaluations').select('*').limit(3);
  console.log('Admin evaluations count:', evAdmin ? evAdmin.length : 0);

  console.log('\n--- 7. Querying employee positions in DB ---');
  const { data: allEmps } = await adminClient.from('employees').select('id, name, email, position, photo, face_descriptor');
  console.log('All employees count:', allEmps ? allEmps.length : 0);
  if (allEmps) {
    allEmps.forEach(e => {
      console.log(`- ${e.name} (${e.email}): pos="${e.position}", photo=${e.photo ? 'YES ('+e.photo.substring(0, 50)+'..)' : 'NO'}, face_desc=${e.face_descriptor ? 'YES' : 'NO'}`);
    });
  }
}

test().catch(console.error);
