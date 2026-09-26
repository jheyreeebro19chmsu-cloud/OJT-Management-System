const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envContent = fs.readFileSync('.env', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const [k, ...v] = line.split('=');
  if (k && v.length) env[k.trim()] = v.join('=').trim();
});

const adminClient = createClient(env['VITE_SUPABASE_URL'], env['SUPABASE_SERVICE_ROLE_KEY']);

async function testSql() {
  // Let's test if there are any database functions we can call or if we can see policies
  // Let's also check auth.users to see how users are authenticated
  const { data: users, error: uErr } = await adminClient.auth.admin.listUsers();
  console.log('Auth users count:', users ? users.users.length : 0, 'error:', uErr);
  if (users && users.users.length > 0) {
    users.users.slice(0, 5).forEach(u => {
      console.log('User:', u.id, u.email, u.user_metadata);
    });
  }
}

testSql().catch(console.error);
