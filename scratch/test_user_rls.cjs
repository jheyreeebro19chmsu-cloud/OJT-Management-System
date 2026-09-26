const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envContent = fs.readFileSync('.env', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const [k, ...v] = line.split('=');
  if (k && v.length) env[k.trim()] = v.join('=').trim();
});

const adminClient = createClient(env['VITE_SUPABASE_URL'], env['SUPABASE_SERVICE_ROLE_KEY']);
const anonClient = createClient(env['VITE_SUPABASE_URL'], env['VITE_SUPABASE_ANON_KEY']);

async function testPolicies() {
  // Let's test reading employees as authenticated user!
  // First, find an instructor user in auth.users:
  const { data: users } = await adminClient.auth.admin.listUsers();
  console.log('Total users:', users?.users.length);

  // Find instructor Jhey Ree C Ebro (jheyreeebro19.chmsu@gmail.com)
  const instructorUser = users?.users.find(u => u.email === 'jheyreeebro19.chmsu@gmail.com');
  console.log('Instructor user:', instructorUser?.id, instructorUser?.email);

  // Find a trainee user
  const traineeUser = users?.users.find(u => u.email === 'jmtrecho.chmsu@gmail.com');
  console.log('Trainee user:', traineeUser?.id, traineeUser?.email);

  // Generate tokens or sign in as them, or check RLS
  // With adminClient, we can generate a session or sign in using admin.generateLink or test with service role
  // Let's test what an instructor sees vs anon vs trainee
  if (instructorUser) {
    const { data: linkData, error: linkErr } = await adminClient.auth.admin.generateLink({
      type: 'magiclink',
      email: instructorUser.email
    });
    console.log('Generated magic link token hash?', !!linkData);

    // Or we can sign in using password or create a client with the user's JWT
    // Let's see if we can create a signed JWT for the user using service key:
  }
}

testPolicies().catch(console.error);
