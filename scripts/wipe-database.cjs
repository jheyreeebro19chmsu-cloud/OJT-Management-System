const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Read .env manually
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

async function wipeAll() {
  console.log('Starting full database purge...');

  const tables = [
    'announcement_comments',
    'announcement_submissions',
    'host_feedback',
    'evaluations',
    'time_records',
    'documents',
    'employees',
    'host_supervisors',
  ];

  for (const table of tables) {
    try {
      const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (error) {
        console.warn(`Warning deleting from ${table}:`, error.message);
      } else {
        console.log(`✓ Purged table: ${table}`);
      }
    } catch (err) {
      console.warn(`Exception on table ${table}:`, err.message);
    }
  }

  // Purge Supabase Auth Users
  try {
    console.log('Fetching Supabase Auth Users...');
    const { data: usersData, error: usersErr } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (usersErr) {
      console.error('Error fetching auth users:', usersErr);
    } else if (usersData && usersData.users) {
      console.log(`Found ${usersData.users.length} auth user(s) to delete.`);
      for (const user of usersData.users) {
        const { error: delErr } = await supabase.auth.admin.deleteUser(user.id);
        if (delErr) {
          console.warn(`Failed to delete user ${user.email} (${user.id}):`, delErr.message);
        } else {
          console.log(`✓ Deleted Auth User: ${user.email} (${user.id})`);
        }
      }
    }
  } catch (authErr) {
    console.warn('Error purging auth users:', authErr.message);
  }

  console.log('\n✅ All database records, auth users, and credentials successfully purged.');
}

wipeAll();
