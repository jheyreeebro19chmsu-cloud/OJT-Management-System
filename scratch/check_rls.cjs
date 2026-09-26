const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envContent = fs.readFileSync('.env', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const [k, ...v] = line.split('=');
  if (k && v.length) env[k.trim()] = v.join('=').trim();
});

const adminClient = createClient(env['VITE_SUPABASE_URL'], env['SUPABASE_SERVICE_ROLE_KEY']);

async function checkRLS() {
  // Let's inspect pg_tables and pg_policies
  // We can query pg_policies using an RPC or if postgres functions exist, or check information_schema
  // Since we have service_role, let's see what tables exist
  const tables = ['employees', 'time_records', 'evaluations', 'geofence_zones', 'documents', 'announcements', 'announcement_submissions'];
  for (const t of tables) {
    const { count, error } = await adminClient.from(t).select('*', { count: 'exact', head: true });
    console.log(`Table ${t}: count=${count}, err=${error ? error.message : 'none'}`);
  }
}

checkRLS().catch(console.error);
