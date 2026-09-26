const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envContent = fs.readFileSync('.env', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const [k, ...v] = line.split('=');
  if (k && v.length) env[k.trim()] = v.join('=').trim();
});

const adminClient = createClient(env['VITE_SUPABASE_URL'], env['SUPABASE_SERVICE_ROLE_KEY']);

async function testAuthRole() {
  // Let's test calling employees with an authenticated JWT!
  // Find instructor user
  const { data: users } = await adminClient.auth.admin.listUsers();
  const instructor = users.users.find(u => u.email === 'jheyreeebro19.chmsu@gmail.com');
  const trainee = users.users.find(u => u.email === 'jmtrecho.chmsu@gmail.com');

  console.log('Instructor user ID:', instructor?.id);
  console.log('Trainee user ID:', trainee?.id);

  // We can generate a token or sign in for testing
  // Supabase admin can generate an access token for any user with admin.generateLink or we can verify how RLS behaves
  // Let's test with a generated magic link
  if (instructor) {
    const { data: link, error } = await adminClient.auth.admin.generateLink({
      type: 'magiclink',
      email: instructor.email
    });
    if (link?.properties?.hashed_token) {
      console.log('Got hashed token for instructor');
      // Let's exchange using anon client
      const anon = createClient(env['VITE_SUPABASE_URL'], env['VITE_SUPABASE_ANON_KEY']);
      const { data: sessionData, error: sErr } = await anon.auth.verifyOtp({
        token_hash: link.properties.hashed_token,
        type: 'magiclink'
      });
      if (sErr) console.error('verifyOtp error:', sErr);
      else {
        console.log('Successfully logged in as instructor!');
        // Now test reading employees, time_records, evaluations, documents as instructor!
        const { data: emps, error: eErr } = await anon.from('employees').select('id, name, email, position, photo');
        console.log('Instructor reading employees:', eErr ? eErr.message : `Found ${emps.length} employees`);
        if (emps && emps.length > 0) {
          console.log('Instructor saw:', emps.map(e => `${e.name} (${e.position}) photo=${!!e.photo}`));
        }

        const { data: trs, error: trErr } = await anon.from('time_records').select('*');
        console.log('Instructor reading time_records:', trErr ? trErr.message : `Found ${trs.length} records`);

        const { data: evs, error: evErr } = await anon.from('evaluations').select('*');
        console.log('Instructor reading evaluations:', evErr ? evErr.message : `Found ${evs.length} evaluations`);

        // Test updating an employee as instructor!
        const sampleTraineeId = emps.find(e => e.position === 'OJT Trainee')?.id;
        if (sampleTraineeId) {
          const { error: upErr } = await anon.from('employees').update({ application_status: 'approved' }).eq('id', sampleTraineeId);
          console.log('Instructor updating trainee employee row:', upErr ? upErr.message : 'SUCCESS!');
        }
      }
    }
  }

  // Now test as trainee!
  if (trainee) {
    const { data: link } = await adminClient.auth.admin.generateLink({
      type: 'magiclink',
      email: trainee.email
    });
    if (link?.properties?.hashed_token) {
      const anon = createClient(env['VITE_SUPABASE_URL'], env['VITE_SUPABASE_ANON_KEY']);
      const { data: sessionData, error: sErr } = await anon.auth.verifyOtp({
        token_hash: link.properties.hashed_token,
        type: 'magiclink'
      });
      if (!sErr) {
        console.log('\nSuccessfully logged in as trainee!');
        const { data: emps, error: eErr } = await anon.from('employees').select('id, name, email, position, photo');
        console.log('Trainee reading employees:', eErr ? eErr.message : `Found ${emps.length} employees`);
        const { data: trs, error: trErr } = await anon.from('time_records').select('*');
        console.log('Trainee reading time_records:', trErr ? trErr.message : `Found ${trs.length} records`);
      }
    }
  }
}

testAuthRole().catch(console.error);
