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

// Accurate Coordinates & Metadata
const CONCENTRIX = {
  id: '89405c66-015c-407a-937b-71ab37b829d7',
  companyName: 'Concentrix',
  supervisorName: 'Jhey Ree C Ebro',
  address: 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod',
  lat: 10.694261,
  lng: 122.959987,
  radius: 40,
  codePrefix: 'CTX',
  idPrefix: '2024-CTX-',
};

const PRINTING_SERVICES = {
  id: 'ee755083-2cb1-4788-9be6-b13d4518d158',
  companyName: 'Printing Services',
  supervisorName: 'Yzel B. Norte',
  address: 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines',
  lat: 10.742858,
  lng: 122.970088,
  radius: 40,
  codePrefix: 'PS',
  idPrefix: '2024-PS-',
};

const INSTRUCTOR_ID = '4249e91c-3677-4a40-855d-d2d8b67434f0';

const FIRST_NAMES = [
  'Joshua', 'Bea Nicole', 'John Paul', 'Alyssa', 'Angelo', 'Hannah', 'Rafael', 'Camille',
  'Christian', 'Ella Marie', 'Kenneth', 'Sophia Mae', 'Mark Lester', 'Patricia', 'Daniel', 'Kimberly',
  'Jerome', 'Angelica', 'Francis', 'Princess Joy', 'Kevin', 'Diana Rose', 'Gabriel', 'Rica Mae',
  'Adrian', 'Catherine', 'Justin', 'Mary Grace', 'Kyle', 'Stephanie', 'Paolo', 'Rochelle',
  'Bryan', 'Kristine', 'Dominic', 'Andrea', 'Neil', 'Janine', 'Anthony', 'Clarisse',
  'Gerald', 'Mae Ann', 'Vincent', 'Denise', 'Patrick', 'Althea', 'Carlo', 'Danielle',
  'Jayson', 'Kyla Marie', 'Matthew', 'Charmaine', 'Arvin', 'Rowena', 'Miguel', 'Erika',
  'Nathaniel', 'Giselle', 'Dexter', 'Joanna', 'Ian James', 'Hazel', 'Tristan', 'Eunice',
  'Lester', 'Regine', 'Renz', 'Maricar', 'Russel', 'Mariel', 'Jomar', 'Judy Ann',
  'Aldrin', 'Sheryl', 'Emman', 'Carla', 'Benedict', 'Jennie', 'Marvin', 'Fatima',
  'Richard', 'Aileen', 'Dennis', 'Melanie', 'Clark', 'Rhea', 'Jericho', 'Karen',
  'Derrick', 'Joyce', 'Glenn', 'Bernadette', 'Aaron', 'Ivy', 'Victor', 'Rosemarie',
  'Edgar', 'Pauline', 'Sean', 'Abigail', 'Kurt', 'Lyka', 'Timothy', 'Kathleen',
  'Joel', 'Sarah', 'Norman', 'Nicole', 'Warren', 'Jane', 'Ryan', 'Geline',
  'Raymond', 'Janice', 'Ramon', 'Donna', 'Ferdinand', 'Lianne', 'Cedric', 'Jovelyn'
];

const LAST_NAMES = [
  'Montelibano', 'Guanzon', 'Javellana', 'Lacson', 'Cuenca', 'Alcantara', 'Gatuslao', 'De la Rama',
  'Sarabia', 'Villanueva', 'Severino', 'Gamboa', 'Lizares', 'Yanson', 'Benedicto', 'Locsin',
  'Hilado', 'Ledesma', 'Lopez', 'Reyes', 'Torres', 'Espina', 'Tan', 'Flores',
  'Garcia', 'Mendoza', 'Bautista', 'Cruz', 'Morales', 'Aquino', 'Ramos', 'Castillo',
  'Santos', 'Gonzales', 'Navarro', 'Romero', 'Mercado', 'Valdez', 'Salazar', 'Delos Reyes',
  'Fernandez', 'Perez', 'Soriano', 'Villamor', 'Vergara', 'Padilla', 'Ocampo', 'Tolentino',
  'Pascual', 'Gutierrez', 'Concepcion', 'Custodio', 'Dela Cruz', 'Dizon', 'Estrada', 'Ferrer',
  'Guerrero', 'Ignacio', 'Legaspi', 'Magbanua', 'Natividad', 'Palma', 'Quizon', 'Rosales',
  'Samson', 'Tuazon', 'Valenzuela', 'Zubiri', 'Arguelles', 'Baltazar', 'Cabrera', 'Domingo',
  'Enriquez', 'Fajardo', 'Gallardo', 'Henson', 'Ilagan', 'Jimenez', 'Katigbak', 'Lagman',
  'Malabanan', 'Noriega', 'Ordonez', 'Pineda', 'Quirino', 'Robles', 'Santiago', 'Tiongson',
  'Umali', 'Velasco', 'Zamora', 'Alonzo', 'Barrameda', 'Carreon', 'Dimaano', 'Escobar',
  'Francisco', 'Galang', 'Hermoso', 'Imperial', 'Javier', 'Labrador', 'Madriaga', 'Nolasco',
  'Olivares', 'Pastrana', 'Quintana', 'Resurreccion', 'Soliman', 'Teodoro', 'Ursua', 'Villafuerte',
  'Villareal', 'Yambao', 'Alba', 'Beltran', 'Cordero', 'Del Rosario', 'Esteban', 'Fabian'
];

const COURSES = [
  'Bachelor of Science in Information Technology',
  'Bachelor of Science in Information Systems',
  'Bachelor of Science in Computer Science',
];

function generateUuid(prefixNum, index) {
  const p1 = String(prefixNum).padStart(8, '0');
  const p2 = '0000';
  const p3 = '4000';
  const p4 = 'a000';
  const p5 = String(index).padStart(12, '0');
  return `${p1}-${p2}-${p3}-${p4}-${p5}`;
}

async function seedCompanyTrainees(config, prefixNum, count = 120) {
  console.log(`\n=== Seeding ${count} Trainees for ${config.companyName} ===`);
  const employeesToUpsert = [];
  const geofencesToUpsert = [];

  for (let i = 0; i < count; i++) {
    const num = i + 1;
    const fName = FIRST_NAMES[i % FIRST_NAMES.length];
    const lName = LAST_NAMES[(i + (prefixNum * 7)) % LAST_NAMES.length];
    const fullName = `${fName} ${lName}`;
    const cleanNameSlug = `${fName.toLowerCase().replace(/[^a-z]/g, '')}.${lName.toLowerCase().replace(/[^a-z]/g, '')}`;
    const studentId = `${config.idPrefix}${String(num).padStart(3, '0')}`;
    const email = `${cleanNameSlug}.${config.codePrefix.toLowerCase()}${num}@chmsu.edu.ph`;
    const course = COURSES[(i + prefixNum) % COURSES.length];
    const uuid = generateUuid(prefixNum, num);

    const empRecord = {
      id: uuid,
      name: fullName,
      employee_id: studentId,
      email: email,
      department: 'College of Computer Studies',
      position: 'OJT Trainee',
      company_name: config.companyName,
      supervisor_name: config.supervisorName,
      school_name: 'Carlos Hilado Memorial State University',
      campus: 'Talisay Campus',
      course: course,
      start_date: '2026-06-15',
      end_date: '2026-11-20',
      required_hours: 486,
      photo: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(fullName)}`,
      face_registered: true,
      active: true,
      hte_id: config.id,
      instructor_id: INSTRUCTOR_ID,
      academic_year: '2026-2027',
      application_status: 'approved',
      registration_lat: config.lat,
      registration_lng: config.lng,
      registration_address: config.address,
      registration_location: {
        lat: config.lat,
        lng: config.lng,
        radius: config.radius,
        address: config.address,
        phone: `0917${String(prefixNum).padStart(2, '0')}${String(num).padStart(5, '0')}`,
        contactPhone: `0917${String(prefixNum).padStart(2, '0')}${String(num).padStart(5, '0')}`,
        documentsPassed: true,
        documentsStatus: 'passed',
      },
    };

    employeesToUpsert.push(empRecord);

    const geofenceRecord = {
      id: generateUuid(prefixNum + 10, num),
      name: `${fullName} - Trainee Geofence (${config.companyName})`,
      address: config.address,
      lat: config.lat,
      lng: config.lng,
      radius: config.radius,
      active: true,
      employee_id: uuid,
    };

    geofencesToUpsert.push(geofenceRecord);
  }

  // Upsert in batches of 40
  const BATCH_SIZE = 40;
  for (let b = 0; b < employeesToUpsert.length; b += BATCH_SIZE) {
    const empBatch = employeesToUpsert.slice(b, b + BATCH_SIZE);
    const geoBatch = geofencesToUpsert.slice(b, b + BATCH_SIZE);

    const { error: empError } = await supabase
      .from('employees')
      .upsert(empBatch, { onConflict: 'id' });

    if (empError) {
      console.error(`Error upserting employees batch ${b / BATCH_SIZE + 1}:`, empError);
      throw empError;
    }

    const { error: geoError } = await supabase
      .from('geofence_zones')
      .upsert(geoBatch, { onConflict: 'id' });

    if (geoError) {
      console.warn(`Note on geofences batch ${b / BATCH_SIZE + 1}:`, geoError.message);
    }

    console.log(`✓ Processed batch ${b + empBatch.length}/${employeesToUpsert.length} for ${config.companyName}`);
  }

  console.log(`✓ Successfully seeded ${employeesToUpsert.length} trainees for ${config.companyName}!`);
}

async function main() {
  try {
    // 1. Ensure Master HTE records exist
    console.log('Ensuring Master HTE records...');
    await supabase.from('host_supervisors').upsert([
      {
        id: CONCENTRIX.id,
        name: CONCENTRIX.supervisorName,
        company_name: CONCENTRIX.companyName,
        company_address: CONCENTRIX.address,
        position: 'HTE Representative',
        active: true,
        is_approved: true,
        academic_year: '2026-2027',
      },
      {
        id: PRINTING_SERVICES.id,
        name: PRINTING_SERVICES.supervisorName,
        company_name: PRINTING_SERVICES.companyName,
        company_address: PRINTING_SERVICES.address,
        position: 'HTE Representative',
        active: true,
        is_approved: true,
        academic_year: '2026-2027',
      },
    ], { onConflict: 'id' });

    // 2. Ensure master workplace geofences
    await supabase.from('geofence_zones').upsert([
      {
        id: '00000000-0000-4000-a000-000000000010',
        name: 'Concentrix - Official Workplace Premises',
        address: CONCENTRIX.address,
        lat: CONCENTRIX.lat,
        lng: CONCENTRIX.lng,
        radius: CONCENTRIX.radius,
        active: true,
        employee_id: CONCENTRIX.id,
      },
      {
        id: '00000000-0000-4000-a000-000000000020',
        name: 'Printing Services - Official Workplace Premises',
        address: PRINTING_SERVICES.address,
        lat: PRINTING_SERVICES.lat,
        lng: PRINTING_SERVICES.lng,
        radius: PRINTING_SERVICES.radius,
        active: true,
        employee_id: PRINTING_SERVICES.id,
      },
    ], { onConflict: 'id' });

    // 3. Seed 120 Trainees for Concentrix (prefixNum 1)
    await seedCompanyTrainees(CONCENTRIX, 1, 120);

    // 4. Seed 120 Trainees for Printing Services (prefixNum 2)
    await seedCompanyTrainees(PRINTING_SERVICES, 2, 120);

    // 5. Verification counts
    const [{ count: ctxCount }, { count: psCount }, { count: totalCount }, { count: zoneCount }] = await Promise.all([
      supabase.from('employees').select('*', { count: 'exact', head: true }).eq('company_name', 'Concentrix'),
      supabase.from('employees').select('*', { count: 'exact', head: true }).eq('company_name', 'Printing Services'),
      supabase.from('employees').select('*', { count: 'exact', head: true }),
      supabase.from('geofence_zones').select('*', { count: 'exact', head: true }),
    ]);

    console.log('\n=============================================');
    console.log(`TOTAL EMPLOYEES: ${totalCount}`);
    console.log(`CONCENTRIX TRAINEES: ${ctxCount}`);
    console.log(`PRINTING SERVICES TRAINEES: ${psCount}`);
    console.log(`TOTAL GEOFENCE ZONES: ${zoneCount}`);
    console.log('=============================================\n');

  } catch (err) {
    console.error('Fatal seed error:', err);
    process.exit(1);
  }
}

main();
