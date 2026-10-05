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

async function seedSupabase() {
  console.log('=======================================================');
  console.log('   CHMSU OJT SYSTEM - SUPABASE CLOUD SEEDER            ');
  console.log('=======================================================');

  try {
    // 1. App Settings
    console.log('[*] Seeding app_settings...');
    const { error: settingsErr } = await supabase.from('app_settings').upsert({
      id: 1,
      work_start_time: '08:00:00',
      work_end_time: '17:00:00',
      late_threshold_minutes: 15,
      geofence_enabled: true,
      facial_recognition_enabled: true,
      updated_at: new Date().toISOString()
    });
    if (settingsErr) console.warn('App settings note:', settingsErr.message);
    else console.log('[OK] App settings configured.');

    // 2. Geofence Zones
    console.log('[*] Seeding geofence_zones...');
    const geofences = [
      {
        name: 'CHMSU Talisay Main Campus',
        address: 'Zone 2, Highway Talisay City, Negros Occidental',
        lat: 10.7411,
        lng: 122.9691,
        radius: 200,
        active: true
      },
      {
        name: 'Ayala Capitol Central - NexGen IT Hub',
        address: 'Gatuslao St, Bacolod City, Negros Occidental',
        lat: 10.6765,
        lng: 122.9509,
        radius: 150,
        active: true
      },
      {
        name: 'Provincial Capitol ICT Division',
        address: 'Aguinaldo St, Bacolod City, Negros Occidental',
        lat: 10.6740,
        lng: 122.9515,
        radius: 150,
        active: true
      }
    ];

    for (const g of geofences) {
      const { error } = await supabase.from('geofence_zones').upsert(g, { onConflict: 'name' });
      if (error) {
        // Fallback insert without conflict key
        await supabase.from('geofence_zones').insert(g);
      }
    }
    console.log('[OK] Geofence zones active.');

    // 3. Host Supervisors
    console.log('[*] Seeding host_supervisors...');
    const supervisors = [
      {
        name: 'Engr. Alexander Vance',
        email: 'hte.techcorp@chmsuojtmis.site',
        company_name: 'NexGen Digital Solutions Inc.',
        company_address: '4th Floor, Ayala Capitol Central, Bacolod City',
        department: 'Software Engineering',
        phone: '+63 917 555 1234',
        position: 'Senior Technical Lead',
        active: true
      },
      {
        name: 'Ms. Karen Joy Villamor',
        email: 'hte.cyberhub@chmsuojtmis.site',
        company_name: 'CyberHub IT Innovations & Labs',
        company_address: 'Zone 2, Highway Talisay, Negros Occidental',
        department: 'Systems & Infrastructure',
        phone: '+63 920 888 5678',
        position: 'OJT Mentor / Supervisor',
        active: true
      }
    ];

    for (const s of supervisors) {
      await supabase.from('host_supervisors').upsert(s, { onConflict: 'email' });
    }
    console.log('[OK] Host supervisors populated.');

    // 4. Employees (Students / Trainees)
    console.log('[*] Seeding employees...');
    const employees = [
      {
        employee_id: '2023-00101',
        name: 'Juan Cruz',
        email: 'student.cruz@chmsu.edu.ph',
        department: 'College of Computer Studies',
        position: 'Software Developer Trainee',
        company_name: 'NexGen Digital Solutions Inc.',
        supervisor_name: 'Engr. Alexander Vance',
        school_name: 'Carlos Hilado Memorial State University',
        campus: 'Talisay Main Campus',
        course: 'Bachelor of Science in Information Technology',
        start_date: '2026-02-01',
        end_date: '2026-05-30',
        required_hours: 486,
        face_registered: true,
        active: true,
        registration_lat: 10.7411,
        registration_lng: 122.9691,
        registration_address: 'Zone 2, Highway Talisay City, Negros Occidental'
      },
      {
        employee_id: '2023-00102',
        name: 'Alyssa Reyes',
        email: 'student.reyes@chmsu.edu.ph',
        department: 'College of Computer Studies',
        position: 'QA & Testing Intern',
        company_name: 'CyberHub IT Innovations & Labs',
        supervisor_name: 'Ms. Karen Joy Villamor',
        school_name: 'Carlos Hilado Memorial State University',
        campus: 'Talisay Main Campus',
        course: 'Bachelor of Science in Information Technology',
        start_date: '2026-02-01',
        end_date: '2026-05-30',
        required_hours: 486,
        face_registered: true,
        active: true,
        registration_lat: 10.7411,
        registration_lng: 122.9691,
        registration_address: 'Zone 2, Highway Talisay City, Negros Occidental'
      },
      {
        employee_id: '2023-00103',
        name: 'Mark Anthony Garcia',
        email: 'student.garcia@chmsu.edu.ph',
        department: 'College of Computer Studies',
        position: 'Network Support Trainee',
        company_name: 'Negros Occidental Provincial Capitol - ICTD',
        supervisor_name: 'Dir. Eduardo Ramos',
        school_name: 'Carlos Hilado Memorial State University',
        campus: 'Alijis Campus',
        course: 'Bachelor of Science in Information Technology',
        start_date: '2026-02-01',
        end_date: '2026-05-30',
        required_hours: 486,
        face_registered: true,
        active: true,
        registration_lat: 10.6740,
        registration_lng: 122.9515,
        registration_address: 'Gatuslao Street, Bacolod City'
      },
      {
        employee_id: '2023-00104',
        name: 'Camille Anne Flores',
        email: 'student.flores@chmsu.edu.ph',
        department: 'College of Computer Studies',
        position: 'Business Analyst Intern',
        company_name: 'NexGen Digital Solutions Inc.',
        supervisor_name: 'Engr. Alexander Vance',
        school_name: 'Carlos Hilado Memorial State University',
        campus: 'Talisay Main Campus',
        course: 'Bachelor of Science in Information Systems',
        start_date: '2026-02-01',
        end_date: '2026-05-30',
        required_hours: 486,
        face_registered: true,
        active: true,
        registration_lat: 10.7411,
        registration_lng: 122.9691,
        registration_address: 'Zone 2, Highway Talisay City, Negros Occidental'
      }
    ];

    const insertedEmployees = [];
    for (const emp of employees) {
      // Upsert by employee_id or email
      const { data, error } = await supabase
        .from('employees')
        .upsert(emp, { onConflict: 'employee_id' })
        .select()
        .single();

      if (data) {
        insertedEmployees.push(data);
      } else {
        // Query to get existing ID
        const { data: existing } = await supabase
          .from('employees')
          .select('id, employee_id')
          .eq('employee_id', emp.employee_id)
          .single();
        if (existing) insertedEmployees.push(existing);
      }
    }
    console.log(`[OK] ${insertedEmployees.length} Trainees/Employees registered in Supabase.`);

    // 5. Time Records with Unique Randomized Rendered Hours
    console.log('[*] Seeding time_records with unique randomized rendered hours...');
    const usedHours = new Set();
    const targetBands = [
      [35, 80],    // early stage
      [120, 190],  // mid-early
      [230, 310],  // mid-late
      [360, 460]   // advanced
    ];

    for (let idx = 0; idx < insertedEmployees.length; idx++) {
      const emp = insertedEmployees[idx];
      const band = targetBands[idx % targetBands.length];
      
      // Determine unique target hours
      let targetHours;
      let attempts = 0;
      do {
        const raw = band[0] + Math.random() * (band[1] - band[0]);
        targetHours = Math.round(raw * 4) / 4;
        attempts++;
      } while (usedHours.has(targetHours) && attempts < 100);
      usedHours.add(targetHours);

      // Distribute target hours across realistic workdays
      let hoursLeft = targetHours;
      let dayOffset = 1;
      const now = new Date();

      while (hoursLeft > 0.05 && dayOffset < 90) {
        const d = new Date(now);
        d.setDate(d.getDate() - dayOffset);
        dayOffset++;

        // Skip weekends
        if (d.getDay() === 0 || d.getDay() === 6) continue;

        const dtStr = d.toISOString().split('T')[0];
        
        let dailyShift;
        if (hoursLeft <= 8.5) {
          dailyShift = Math.round(hoursLeft * 4) / 4;
        } else {
          const shiftVariation = [7.25, 7.5, 7.75, 8.0, 8.25, 8.5];
          dailyShift = shiftVariation[Math.floor(Math.random() * shiftVariation.length)];
          dailyShift = Math.min(dailyShift, hoursLeft);
        }

        if (dailyShift < 0.25) break;
        hoursLeft = Math.round((hoursLeft - dailyShift) * 100) / 100;

        // Realistic clock-in between 07:45 and 08:08
        const inMin = Math.floor(Math.random() * 24); // 0..23
        const inTotalMins = 7 * 60 + 45 + inMin; // 07:45 - 08:08
        const inH = Math.floor(inTotalMins / 60);
        const inM = inTotalMins % 60;
        const timeInStr = `${String(inH).padStart(2, '0')}:${String(inM).padStart(2, '0')}:00`;

        // Lunch break of 60 mins: time_out = inTotalMins + (dailyShift * 60) + 60
        const outTotalMins = Math.round(inTotalMins + (dailyShift * 60) + 60);
        const outH = Math.floor(outTotalMins / 60);
        const outM = outTotalMins % 60;
        const timeOutStr = `${String(outH).padStart(2, '0')}:${String(outM).padStart(2, '0')}:00`;

        const tr = {
          employee_id: emp.id,
          date: dtStr,
          time_in: timeInStr,
          time_out: timeOutStr,
          time_in_lat: emp.registration_lat || 10.6765,
          time_in_lng: emp.registration_lng || 122.9509,
          time_out_lat: emp.registration_lat || 10.6765,
          time_out_lng: emp.registration_lng || 122.9509,
          time_in_geofenced: true,
          time_out_geofenced: true,
          time_in_face_verified: true,
          time_out_face_verified: true,
          total_hours: dailyShift,
          status: 'present',
          notes: 'Standard workday shift completed.'
        };
        await supabase.from('time_records').upsert(tr, { onConflict: 'employee_id,date' });
      }
    }
    console.log(`[OK] Time records generated with distinct randomized hours for each trainee.`);

    // 6. Announcements
    console.log('[*] Seeding announcements...');
    const announcements = [
      {
        title: 'Welcome to OJT 2nd Semester 2026-2027',
        content: 'All trainees are reminded to submit their signed MOA and ensure their geofence permissions are enabled on their mobile devices before logging attendance.',
        type: 'info',
        target_role: 'all',
        is_pinned: true,
        created_by: 'OJT Head Coordinator'
      },
      {
        title: 'Midterm Progress Journal Submission Due Date',
        content: 'Please upload your compiled weekly journals and supervisor evaluation forms by end of the month.',
        type: 'warning',
        target_role: 'employee',
        is_pinned: false,
        created_by: 'College of Computer Studies'
      }
    ];

    for (const ann of announcements) {
      await supabase.from('announcements').insert(ann);
    }
    console.log('[OK] Announcements published.');

    // 7. Evaluations
    console.log('[*] Seeding evaluations...');
    if (insertedEmployees.length > 0) {
      const evalItem = {
        employee_id: insertedEmployees[0].id,
        evaluated_by: 'Engr. Alexander Vance',
        attendance_score: 95,
        performance_score: 92,
        attitude_score: 98,
        punctuality_score: 94,
        communication_score: 90,
        overall_score: 93.8,
        grade: 'Excellent',
        strengths: 'Demonstrates exceptional problem-solving skills, quick grasp of tech stack, and reliable team communication.',
        areas_for_improvement: 'Continue deepening knowledge in automated CI/CD deployment pipelines.',
        recommendations: 'Highly recommended for absorption into junior developer role upon graduation.',
        status: 'final'
      };
      await supabase.from('evaluations').insert(evalItem);
      console.log('[OK] Sample student evaluation submitted.');
    }

    console.log('=======================================================');
    console.log('  SUPABASE SEEDING COMPLETED SUCCESSFULLY!             ');
    console.log('=======================================================');
  } catch (err) {
    console.error('Error during Supabase seeding:', err);
  }
}

seedSupabase();
