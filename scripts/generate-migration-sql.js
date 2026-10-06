import fs from 'fs';
import path from 'path';

// Let's generate supabase/migrations/20261006_seed_120_concentrix_120_printing_services.sql
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
  'Rivera', 'Espiritu', 'Pascual', 'Manalo', 'Soriano', 'Geronimo', 'Santiago', 'Cortez',
  'Vergara', 'Ocampo', 'Dela Cruz', 'Agustin', 'Pineda', 'Tolentino', 'Miranda', 'David',
  'Mallari', 'Magbanua', 'Perez', 'Padilla', 'Ferrer', 'Balagtas', 'Palma', 'Gallego',
  'Cordero', 'Vargas', 'Alvarez', 'Javier', 'Solomon', 'Arroyo', 'Molina', 'Legaspi',
  'Dizon', 'Coronel', 'Tiongson', 'Serrano', 'Evangelista', 'Macaraeg', 'Suarez', 'Fajardo',
  'Bernardo', 'Quizon', 'Salas', 'Caballero', 'Magsaysay', 'Samonte', 'Estrella', 'Valenzuela',
  'Velasco', 'Barrientos', 'Belmonte', 'Pangilinan', 'Bocanegra', 'Concepcion', 'Sarmiento', 'Austria',
  'Medina', 'Ricafort', 'Silverio', 'Quezon', 'Guevarra', 'Arellano', 'Villamor', 'Salcedo',
  'Cariño', 'Teodoro', 'Roxas', 'Trinidad', 'Alegre', 'Escobar', 'Almario', 'Dimaculangan',
  'Buenaventura', 'Quintos', 'Sison', 'Vallejo', 'Alonzo', 'Tugade', 'Mercenario', 'Zubiri'
];

function generateSQL() {
  let out = `-- ============================================================================
-- MIGRATION: SEED 120 TRAINEES FOR CONCENTRIX & 120 TRAINEES FOR PRINTING SERVICES
-- With accurate geofencing coordinates (Helix Center & Talisay Campus)
-- Generated: 2026-10-06
-- ============================================================================

BEGIN;

-- 1. Ensure Concentrix HTE
INSERT INTO public.host_supervisors (id, name, company_name, email, company_address, position, is_approved, active, academic_year)
VALUES (
  '${CONCENTRIX.id}', '${CONCENTRIX.supervisorName}', '${CONCENTRIX.companyName}', 'jheyreeebro19@gmail.com',
  '${CONCENTRIX.address}', 'HTE Representative', true, true, '2026-2027'
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  company_name = EXCLUDED.company_name,
  company_address = EXCLUDED.company_address;

-- 2. Ensure Printing Services HTE
INSERT INTO public.host_supervisors (id, name, company_name, email, company_address, position, is_approved, active, academic_year)
VALUES (
  '${PRINTING_SERVICES.id}', '${PRINTING_SERVICES.supervisorName}', '${PRINTING_SERVICES.companyName}', 'norteyzel@gmail.com',
  '${PRINTING_SERVICES.address}', 'HTE Representative', true, true, '2026-2027'
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  company_name = EXCLUDED.company_name,
  company_address = EXCLUDED.company_address;

-- 3. Upsert Master Geofence Zones
INSERT INTO public.geofence_zones (id, name, address, lat, lng, radius, active, employee_id)
VALUES (
  '${CONCENTRIX.id}', '${CONCENTRIX.companyName} - Helix Service Center', '${CONCENTRIX.address}',
  ${CONCENTRIX.lat}, ${CONCENTRIX.lng}, ${CONCENTRIX.radius}, true, '${CONCENTRIX.id}'
)
ON CONFLICT (id) DO UPDATE SET
  lat = EXCLUDED.lat,
  lng = EXCLUDED.lng,
  radius = EXCLUDED.radius,
  address = EXCLUDED.address;

INSERT INTO public.geofence_zones (id, name, address, lat, lng, radius, active, employee_id)
VALUES (
  '${PRINTING_SERVICES.id}', '${PRINTING_SERVICES.companyName} - Talisay Premises', '${PRINTING_SERVICES.address}',
  ${PRINTING_SERVICES.lat}, ${PRINTING_SERVICES.lng}, ${PRINTING_SERVICES.radius}, true, '${PRINTING_SERVICES.id}'
)
ON CONFLICT (id) DO UPDATE SET
  lat = EXCLUDED.lat,
  lng = EXCLUDED.lng,
  radius = EXCLUDED.radius,
  address = EXCLUDED.address;

`;

  const sections = [
    { label: 'CONCENTRIX', config: CONCENTRIX },
    { label: 'PRINTING SERVICES', config: PRINTING_SERVICES }
  ];

  for (const { label, config } of sections) {
    out += `\n-- ============================================================================\n`;
    out += `-- Trainees for ${label} (120 Students)\n`;
    out += `-- ============================================================================\n\n`;

    for (let i = 1; i <= 120; i++) {
      const idx = i - 1;
      const firstName = FIRST_NAMES[idx % FIRST_NAMES.length];
      const lastName = LAST_NAMES[idx % LAST_NAMES.length];
      const fullName = `${firstName} ${lastName}`;
      const numStr = String(i).padStart(3, '0');
      const employeeId = `${config.idPrefix}${numStr}`;
      const email = `${firstName.toLowerCase().replace(/[^a-z0-9]/g, '')}.${lastName.toLowerCase().replace(/[^a-z0-9]/g, '')}.${config.codePrefix.toLowerCase()}${i}@chmsu.edu.ph`;
      const phone = `09${Math.floor(100000000 + (idx * 7919 + 12345) % 900000000)}`;
      const regLoc = JSON.stringify({
        lat: config.lat,
        lng: config.lng,
        address: config.address,
        phone: phone,
      }).replace(/'/g, "''");

      const course = 'Bachelor of Science in Information Systems';
      const requiredHours = 486 + ((idx * 17 + (label === 'CONCENTRIX' ? 1 : 2) * 31) % (600 - 486 + 1));
      const firstLetter = firstName.trim().charAt(0).toUpperCase();
      const avatarColors = [
        '2563eb', '4f46e5', '7c3aed', '0284c7', '0891b2',
        '059669', '16a34a', 'd97706', 'ea580c', 'dc2626',
        'db2777', '9333ea'
      ];
      const bgCol = avatarColors[(firstLetter.charCodeAt(0) + idx) % avatarColors.length];
      const photoUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(firstLetter)}&background=${bgCol}&color=fff&size=128&bold=true`;

      out += `INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus, course,
  photo, instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '${employeeId}', '${fullName.replace(/'/g, "''")}', '${email}', 'College of Computer Studies', 'OJT Trainee', '${config.companyName}', '${config.id}',
  '${config.supervisorName}', '${config.address.replace(/'/g, "''")}', ${config.lat}, ${config.lng},
  '${regLoc}', true, 'approved', 'Talisay (Main Campus)', '${course}',
  '${photoUrl}', '${INSTRUCTOR_ID}', '2026-2027', ${requiredHours}, 0
)
ON CONFLICT (employee_id) DO UPDATE SET
  name = EXCLUDED.name,
  email = EXCLUDED.email,
  company_name = EXCLUDED.company_name,
  hte_id = EXCLUDED.hte_id,
  supervisor_name = EXCLUDED.supervisor_name,
  registration_address = EXCLUDED.registration_address,
  registration_lat = EXCLUDED.registration_lat,
  registration_lng = EXCLUDED.registration_lng,
  registration_location = EXCLUDED.registration_location,
  active = EXCLUDED.active,
  application_status = EXCLUDED.application_status,
  course = EXCLUDED.course,
  photo = EXCLUDED.photo,
  required_hours = EXCLUDED.required_hours;\n\n`;
    }
  }

  out += `COMMIT;\n`;
  return out;
}

const sql = generateSQL();
const outPath = path.resolve('supabase/migrations/20261006_seed_120_concentrix_120_printing_services.sql');
fs.writeFileSync(outPath, sql, 'utf8');
console.log(`Generated SQL migration file at: ${outPath} (${sql.length} bytes)`);
