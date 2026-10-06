-- ============================================================================
-- MIGRATION: SEED 120 TRAINEES FOR CONCENTRIX & 120 TRAINEES FOR PRINTING SERVICES
-- With accurate geofencing coordinates (Helix Center & Talisay Campus)
-- Generated: 2026-10-06
-- ============================================================================

BEGIN;

-- 1. Ensure Concentrix HTE
INSERT INTO public.host_supervisors (id, name, company_name, email, company_address, position, is_approved, active, academic_year)
VALUES (
  '89405c66-015c-407a-937b-71ab37b829d7', 'Jhey Ree C Ebro', 'Concentrix', 'jheyreeebro19@gmail.com',
  'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 'HTE Representative', true, true, '2026-2027'
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  company_name = EXCLUDED.company_name,
  company_address = EXCLUDED.company_address;

-- 2. Ensure Printing Services HTE
INSERT INTO public.host_supervisors (id, name, company_name, email, company_address, position, is_approved, active, academic_year)
VALUES (
  'ee755083-2cb1-4788-9be6-b13d4518d158', 'Yzel B. Norte', 'Printing Services', 'norteyzel@gmail.com',
  'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 'HTE Representative', true, true, '2026-2027'
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  company_name = EXCLUDED.company_name,
  company_address = EXCLUDED.company_address;

-- 3. Upsert Master Geofence Zones
INSERT INTO public.geofence_zones (id, name, address, lat, lng, radius, active, employee_id)
VALUES (
  '89405c66-015c-407a-937b-71ab37b829d7', 'Concentrix - Helix Service Center', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod',
  10.694261, 122.959987, 40, true, '89405c66-015c-407a-937b-71ab37b829d7'
)
ON CONFLICT (id) DO UPDATE SET
  lat = EXCLUDED.lat,
  lng = EXCLUDED.lng,
  radius = EXCLUDED.radius,
  address = EXCLUDED.address;

INSERT INTO public.geofence_zones (id, name, address, lat, lng, radius, active, employee_id)
VALUES (
  'ee755083-2cb1-4788-9be6-b13d4518d158', 'Printing Services - Talisay Premises', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines',
  10.742858, 122.970088, 40, true, 'ee755083-2cb1-4788-9be6-b13d4518d158'
)
ON CONFLICT (id) DO UPDATE SET
  lat = EXCLUDED.lat,
  lng = EXCLUDED.lng,
  radius = EXCLUDED.radius,
  address = EXCLUDED.address;


-- ============================================================================
-- Trainees for CONCENTRIX (120 Students)
-- ============================================================================

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-001', 'Joshua Montelibano', 'joshua.montelibano.ctx1@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100012345"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-002', 'Bea Nicole Guanzon', 'beanicole.guanzon.ctx2@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100020264"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-003', 'John Paul Javellana', 'johnpaul.javellana.ctx3@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100028183"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-004', 'Alyssa Lacson', 'alyssa.lacson.ctx4@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100036102"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-005', 'Angelo Cuenca', 'angelo.cuenca.ctx5@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100044021"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-006', 'Hannah Alcantara', 'hannah.alcantara.ctx6@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100051940"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-007', 'Rafael Gatuslao', 'rafael.gatuslao.ctx7@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100059859"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-008', 'Camille De la Rama', 'camille.delarama.ctx8@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100067778"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-009', 'Christian Sarabia', 'christian.sarabia.ctx9@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100075697"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-010', 'Ella Marie Villanueva', 'ellamarie.villanueva.ctx10@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100083616"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-011', 'Kenneth Severino', 'kenneth.severino.ctx11@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100091535"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-012', 'Sophia Mae Gamboa', 'sophiamae.gamboa.ctx12@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100099454"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-013', 'Mark Lester Lizares', 'marklester.lizares.ctx13@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100107373"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-014', 'Patricia Yanson', 'patricia.yanson.ctx14@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100115292"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-015', 'Daniel Benedicto', 'daniel.benedicto.ctx15@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100123211"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-016', 'Kimberly Locsin', 'kimberly.locsin.ctx16@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100131130"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-017', 'Jerome Hilado', 'jerome.hilado.ctx17@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100139049"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-018', 'Angelica Ledesma', 'angelica.ledesma.ctx18@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100146968"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-019', 'Francis Lopez', 'francis.lopez.ctx19@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100154887"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-020', 'Princess Joy Reyes', 'princessjoy.reyes.ctx20@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100162806"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-021', 'Kevin Torres', 'kevin.torres.ctx21@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100170725"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-022', 'Diana Rose Espina', 'dianarose.espina.ctx22@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100178644"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-023', 'Gabriel Tan', 'gabriel.tan.ctx23@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100186563"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-024', 'Rica Mae Flores', 'ricamae.flores.ctx24@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100194482"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-025', 'Adrian Garcia', 'adrian.garcia.ctx25@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100202401"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-026', 'Catherine Mendoza', 'catherine.mendoza.ctx26@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100210320"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-027', 'Justin Bautista', 'justin.bautista.ctx27@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100218239"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-028', 'Mary Grace Cruz', 'marygrace.cruz.ctx28@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100226158"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-029', 'Kyle Morales', 'kyle.morales.ctx29@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100234077"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-030', 'Stephanie Aquino', 'stephanie.aquino.ctx30@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100241996"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-031', 'Paolo Ramos', 'paolo.ramos.ctx31@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100249915"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-032', 'Rochelle Castillo', 'rochelle.castillo.ctx32@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100257834"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-033', 'Bryan Santos', 'bryan.santos.ctx33@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100265753"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-034', 'Kristine Gonzales', 'kristine.gonzales.ctx34@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100273672"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-035', 'Dominic Navarro', 'dominic.navarro.ctx35@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100281591"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-036', 'Andrea Romero', 'andrea.romero.ctx36@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100289510"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-037', 'Neil Mercado', 'neil.mercado.ctx37@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100297429"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-038', 'Janine Valdez', 'janine.valdez.ctx38@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100305348"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-039', 'Anthony Salazar', 'anthony.salazar.ctx39@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100313267"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-040', 'Clarisse Delos Reyes', 'clarisse.delosreyes.ctx40@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100321186"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-041', 'Gerald Rivera', 'gerald.rivera.ctx41@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100329105"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-042', 'Mae Ann Espiritu', 'maeann.espiritu.ctx42@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100337024"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-043', 'Vincent Pascual', 'vincent.pascual.ctx43@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100344943"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-044', 'Denise Manalo', 'denise.manalo.ctx44@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100352862"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-045', 'Patrick Soriano', 'patrick.soriano.ctx45@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100360781"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-046', 'Althea Geronimo', 'althea.geronimo.ctx46@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100368700"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-047', 'Carlo Santiago', 'carlo.santiago.ctx47@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100376619"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-048', 'Danielle Cortez', 'danielle.cortez.ctx48@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100384538"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-049', 'Jayson Vergara', 'jayson.vergara.ctx49@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100392457"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-050', 'Kyla Marie Ocampo', 'kylamarie.ocampo.ctx50@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100400376"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-051', 'Matthew Dela Cruz', 'matthew.delacruz.ctx51@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100408295"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-052', 'Charmaine Agustin', 'charmaine.agustin.ctx52@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100416214"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-053', 'Arvin Pineda', 'arvin.pineda.ctx53@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100424133"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-054', 'Rowena Tolentino', 'rowena.tolentino.ctx54@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100432052"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-055', 'Miguel Miranda', 'miguel.miranda.ctx55@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100439971"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-056', 'Erika David', 'erika.david.ctx56@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100447890"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-057', 'Nathaniel Mallari', 'nathaniel.mallari.ctx57@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100455809"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-058', 'Giselle Magbanua', 'giselle.magbanua.ctx58@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100463728"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-059', 'Dexter Perez', 'dexter.perez.ctx59@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100471647"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-060', 'Joanna Padilla', 'joanna.padilla.ctx60@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100479566"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-061', 'Ian James Ferrer', 'ianjames.ferrer.ctx61@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100487485"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-062', 'Hazel Balagtas', 'hazel.balagtas.ctx62@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100495404"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-063', 'Tristan Palma', 'tristan.palma.ctx63@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100503323"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-064', 'Eunice Gallego', 'eunice.gallego.ctx64@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100511242"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-065', 'Lester Cordero', 'lester.cordero.ctx65@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100519161"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-066', 'Regine Vargas', 'regine.vargas.ctx66@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100527080"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-067', 'Renz Alvarez', 'renz.alvarez.ctx67@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100534999"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-068', 'Maricar Javier', 'maricar.javier.ctx68@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100542918"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-069', 'Russel Solomon', 'russel.solomon.ctx69@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100550837"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-070', 'Mariel Arroyo', 'mariel.arroyo.ctx70@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100558756"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-071', 'Jomar Molina', 'jomar.molina.ctx71@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100566675"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-072', 'Judy Ann Legaspi', 'judyann.legaspi.ctx72@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100574594"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-073', 'Aldrin Dizon', 'aldrin.dizon.ctx73@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100582513"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-074', 'Sheryl Coronel', 'sheryl.coronel.ctx74@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100590432"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-075', 'Emman Tiongson', 'emman.tiongson.ctx75@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100598351"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-076', 'Carla Serrano', 'carla.serrano.ctx76@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100606270"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-077', 'Benedict Evangelista', 'benedict.evangelista.ctx77@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100614189"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-078', 'Jennie Macaraeg', 'jennie.macaraeg.ctx78@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100622108"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-079', 'Marvin Suarez', 'marvin.suarez.ctx79@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100630027"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-080', 'Fatima Fajardo', 'fatima.fajardo.ctx80@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100637946"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-081', 'Richard Bernardo', 'richard.bernardo.ctx81@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100645865"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-082', 'Aileen Quizon', 'aileen.quizon.ctx82@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100653784"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-083', 'Dennis Salas', 'dennis.salas.ctx83@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100661703"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-084', 'Melanie Caballero', 'melanie.caballero.ctx84@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100669622"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-085', 'Clark Magsaysay', 'clark.magsaysay.ctx85@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100677541"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-086', 'Rhea Samonte', 'rhea.samonte.ctx86@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100685460"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-087', 'Jericho Estrella', 'jericho.estrella.ctx87@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100693379"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-088', 'Karen Valenzuela', 'karen.valenzuela.ctx88@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100701298"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-089', 'Derrick Velasco', 'derrick.velasco.ctx89@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100709217"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-090', 'Joyce Barrientos', 'joyce.barrientos.ctx90@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100717136"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-091', 'Glenn Belmonte', 'glenn.belmonte.ctx91@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100725055"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-092', 'Bernadette Pangilinan', 'bernadette.pangilinan.ctx92@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100732974"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-093', 'Aaron Bocanegra', 'aaron.bocanegra.ctx93@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100740893"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-094', 'Ivy Concepcion', 'ivy.concepcion.ctx94@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100748812"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-095', 'Victor Sarmiento', 'victor.sarmiento.ctx95@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100756731"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-096', 'Rosemarie Austria', 'rosemarie.austria.ctx96@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100764650"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-097', 'Edgar Medina', 'edgar.medina.ctx97@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100772569"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-098', 'Pauline Ricafort', 'pauline.ricafort.ctx98@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100780488"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-099', 'Sean Silverio', 'sean.silverio.ctx99@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100788407"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-100', 'Abigail Quezon', 'abigail.quezon.ctx100@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100796326"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-101', 'Kurt Guevarra', 'kurt.guevarra.ctx101@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100804245"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-102', 'Lyka Arellano', 'lyka.arellano.ctx102@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100812164"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-103', 'Timothy Villamor', 'timothy.villamor.ctx103@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100820083"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-104', 'Kathleen Salcedo', 'kathleen.salcedo.ctx104@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100828002"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-105', 'Joel Cariño', 'joel.cario.ctx105@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100835921"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-106', 'Sarah Teodoro', 'sarah.teodoro.ctx106@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100843840"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-107', 'Norman Roxas', 'norman.roxas.ctx107@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100851759"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-108', 'Nicole Trinidad', 'nicole.trinidad.ctx108@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100859678"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-109', 'Warren Alegre', 'warren.alegre.ctx109@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100867597"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-110', 'Jane Escobar', 'jane.escobar.ctx110@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100875516"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-111', 'Ryan Almario', 'ryan.almario.ctx111@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100883435"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-112', 'Geline Dimaculangan', 'geline.dimaculangan.ctx112@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100891354"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-113', 'Raymond Buenaventura', 'raymond.buenaventura.ctx113@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100899273"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-114', 'Janice Quintos', 'janice.quintos.ctx114@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100907192"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-115', 'Ramon Sison', 'ramon.sison.ctx115@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100915111"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-116', 'Donna Vallejo', 'donna.vallejo.ctx116@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100923030"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-117', 'Ferdinand Alonzo', 'ferdinand.alonzo.ctx117@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100930949"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-118', 'Lianne Tugade', 'lianne.tugade.ctx118@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100938868"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-119', 'Cedric Mercenario', 'cedric.mercenario.ctx119@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100946787"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-CTX-120', 'Jovelyn Zubiri', 'jovelyn.zubiri.ctx120@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Concentrix', '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro', 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod', 10.694261, 122.959987,
  '{"lat":10.694261,"lng":122.959987,"address":"Helix Service Center, Santa Clara Avenue, Banago, Bacolod","phone":"09100954706"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;


-- ============================================================================
-- Trainees for PRINTING SERVICES (120 Students)
-- ============================================================================

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-001', 'Joshua Montelibano', 'joshua.montelibano.ps1@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100012345"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-002', 'Bea Nicole Guanzon', 'beanicole.guanzon.ps2@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100020264"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-003', 'John Paul Javellana', 'johnpaul.javellana.ps3@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100028183"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-004', 'Alyssa Lacson', 'alyssa.lacson.ps4@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100036102"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-005', 'Angelo Cuenca', 'angelo.cuenca.ps5@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100044021"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-006', 'Hannah Alcantara', 'hannah.alcantara.ps6@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100051940"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-007', 'Rafael Gatuslao', 'rafael.gatuslao.ps7@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100059859"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-008', 'Camille De la Rama', 'camille.delarama.ps8@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100067778"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-009', 'Christian Sarabia', 'christian.sarabia.ps9@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100075697"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-010', 'Ella Marie Villanueva', 'ellamarie.villanueva.ps10@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100083616"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-011', 'Kenneth Severino', 'kenneth.severino.ps11@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100091535"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-012', 'Sophia Mae Gamboa', 'sophiamae.gamboa.ps12@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100099454"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-013', 'Mark Lester Lizares', 'marklester.lizares.ps13@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100107373"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-014', 'Patricia Yanson', 'patricia.yanson.ps14@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100115292"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-015', 'Daniel Benedicto', 'daniel.benedicto.ps15@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100123211"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-016', 'Kimberly Locsin', 'kimberly.locsin.ps16@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100131130"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-017', 'Jerome Hilado', 'jerome.hilado.ps17@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100139049"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-018', 'Angelica Ledesma', 'angelica.ledesma.ps18@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100146968"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-019', 'Francis Lopez', 'francis.lopez.ps19@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100154887"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-020', 'Princess Joy Reyes', 'princessjoy.reyes.ps20@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100162806"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-021', 'Kevin Torres', 'kevin.torres.ps21@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100170725"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-022', 'Diana Rose Espina', 'dianarose.espina.ps22@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100178644"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-023', 'Gabriel Tan', 'gabriel.tan.ps23@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100186563"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-024', 'Rica Mae Flores', 'ricamae.flores.ps24@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100194482"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-025', 'Adrian Garcia', 'adrian.garcia.ps25@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100202401"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-026', 'Catherine Mendoza', 'catherine.mendoza.ps26@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100210320"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-027', 'Justin Bautista', 'justin.bautista.ps27@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100218239"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-028', 'Mary Grace Cruz', 'marygrace.cruz.ps28@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100226158"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-029', 'Kyle Morales', 'kyle.morales.ps29@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100234077"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-030', 'Stephanie Aquino', 'stephanie.aquino.ps30@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100241996"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-031', 'Paolo Ramos', 'paolo.ramos.ps31@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100249915"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-032', 'Rochelle Castillo', 'rochelle.castillo.ps32@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100257834"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-033', 'Bryan Santos', 'bryan.santos.ps33@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100265753"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-034', 'Kristine Gonzales', 'kristine.gonzales.ps34@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100273672"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-035', 'Dominic Navarro', 'dominic.navarro.ps35@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100281591"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-036', 'Andrea Romero', 'andrea.romero.ps36@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100289510"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-037', 'Neil Mercado', 'neil.mercado.ps37@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100297429"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-038', 'Janine Valdez', 'janine.valdez.ps38@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100305348"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-039', 'Anthony Salazar', 'anthony.salazar.ps39@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100313267"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-040', 'Clarisse Delos Reyes', 'clarisse.delosreyes.ps40@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100321186"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-041', 'Gerald Rivera', 'gerald.rivera.ps41@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100329105"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-042', 'Mae Ann Espiritu', 'maeann.espiritu.ps42@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100337024"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-043', 'Vincent Pascual', 'vincent.pascual.ps43@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100344943"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-044', 'Denise Manalo', 'denise.manalo.ps44@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100352862"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-045', 'Patrick Soriano', 'patrick.soriano.ps45@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100360781"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-046', 'Althea Geronimo', 'althea.geronimo.ps46@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100368700"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-047', 'Carlo Santiago', 'carlo.santiago.ps47@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100376619"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-048', 'Danielle Cortez', 'danielle.cortez.ps48@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100384538"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-049', 'Jayson Vergara', 'jayson.vergara.ps49@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100392457"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-050', 'Kyla Marie Ocampo', 'kylamarie.ocampo.ps50@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100400376"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-051', 'Matthew Dela Cruz', 'matthew.delacruz.ps51@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100408295"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-052', 'Charmaine Agustin', 'charmaine.agustin.ps52@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100416214"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-053', 'Arvin Pineda', 'arvin.pineda.ps53@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100424133"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-054', 'Rowena Tolentino', 'rowena.tolentino.ps54@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100432052"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-055', 'Miguel Miranda', 'miguel.miranda.ps55@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100439971"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-056', 'Erika David', 'erika.david.ps56@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100447890"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-057', 'Nathaniel Mallari', 'nathaniel.mallari.ps57@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100455809"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-058', 'Giselle Magbanua', 'giselle.magbanua.ps58@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100463728"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-059', 'Dexter Perez', 'dexter.perez.ps59@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100471647"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-060', 'Joanna Padilla', 'joanna.padilla.ps60@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100479566"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-061', 'Ian James Ferrer', 'ianjames.ferrer.ps61@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100487485"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-062', 'Hazel Balagtas', 'hazel.balagtas.ps62@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100495404"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-063', 'Tristan Palma', 'tristan.palma.ps63@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100503323"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-064', 'Eunice Gallego', 'eunice.gallego.ps64@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100511242"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-065', 'Lester Cordero', 'lester.cordero.ps65@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100519161"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-066', 'Regine Vargas', 'regine.vargas.ps66@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100527080"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-067', 'Renz Alvarez', 'renz.alvarez.ps67@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100534999"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-068', 'Maricar Javier', 'maricar.javier.ps68@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100542918"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-069', 'Russel Solomon', 'russel.solomon.ps69@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100550837"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-070', 'Mariel Arroyo', 'mariel.arroyo.ps70@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100558756"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-071', 'Jomar Molina', 'jomar.molina.ps71@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100566675"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-072', 'Judy Ann Legaspi', 'judyann.legaspi.ps72@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100574594"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-073', 'Aldrin Dizon', 'aldrin.dizon.ps73@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100582513"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-074', 'Sheryl Coronel', 'sheryl.coronel.ps74@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100590432"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-075', 'Emman Tiongson', 'emman.tiongson.ps75@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100598351"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-076', 'Carla Serrano', 'carla.serrano.ps76@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100606270"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-077', 'Benedict Evangelista', 'benedict.evangelista.ps77@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100614189"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-078', 'Jennie Macaraeg', 'jennie.macaraeg.ps78@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100622108"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-079', 'Marvin Suarez', 'marvin.suarez.ps79@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100630027"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-080', 'Fatima Fajardo', 'fatima.fajardo.ps80@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100637946"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-081', 'Richard Bernardo', 'richard.bernardo.ps81@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100645865"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-082', 'Aileen Quizon', 'aileen.quizon.ps82@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100653784"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-083', 'Dennis Salas', 'dennis.salas.ps83@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100661703"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-084', 'Melanie Caballero', 'melanie.caballero.ps84@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100669622"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-085', 'Clark Magsaysay', 'clark.magsaysay.ps85@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100677541"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-086', 'Rhea Samonte', 'rhea.samonte.ps86@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100685460"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-087', 'Jericho Estrella', 'jericho.estrella.ps87@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100693379"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-088', 'Karen Valenzuela', 'karen.valenzuela.ps88@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100701298"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-089', 'Derrick Velasco', 'derrick.velasco.ps89@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100709217"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-090', 'Joyce Barrientos', 'joyce.barrientos.ps90@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100717136"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-091', 'Glenn Belmonte', 'glenn.belmonte.ps91@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100725055"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-092', 'Bernadette Pangilinan', 'bernadette.pangilinan.ps92@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100732974"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-093', 'Aaron Bocanegra', 'aaron.bocanegra.ps93@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100740893"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-094', 'Ivy Concepcion', 'ivy.concepcion.ps94@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100748812"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-095', 'Victor Sarmiento', 'victor.sarmiento.ps95@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100756731"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-096', 'Rosemarie Austria', 'rosemarie.austria.ps96@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100764650"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-097', 'Edgar Medina', 'edgar.medina.ps97@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100772569"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-098', 'Pauline Ricafort', 'pauline.ricafort.ps98@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100780488"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-099', 'Sean Silverio', 'sean.silverio.ps99@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100788407"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-100', 'Abigail Quezon', 'abigail.quezon.ps100@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100796326"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-101', 'Kurt Guevarra', 'kurt.guevarra.ps101@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100804245"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-102', 'Lyka Arellano', 'lyka.arellano.ps102@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100812164"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-103', 'Timothy Villamor', 'timothy.villamor.ps103@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100820083"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-104', 'Kathleen Salcedo', 'kathleen.salcedo.ps104@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100828002"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-105', 'Joel Cariño', 'joel.cario.ps105@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100835921"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-106', 'Sarah Teodoro', 'sarah.teodoro.ps106@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100843840"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-107', 'Norman Roxas', 'norman.roxas.ps107@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100851759"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-108', 'Nicole Trinidad', 'nicole.trinidad.ps108@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100859678"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-109', 'Warren Alegre', 'warren.alegre.ps109@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100867597"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-110', 'Jane Escobar', 'jane.escobar.ps110@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100875516"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-111', 'Ryan Almario', 'ryan.almario.ps111@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100883435"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-112', 'Geline Dimaculangan', 'geline.dimaculangan.ps112@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100891354"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-113', 'Raymond Buenaventura', 'raymond.buenaventura.ps113@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100899273"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-114', 'Janice Quintos', 'janice.quintos.ps114@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100907192"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-115', 'Ramon Sison', 'ramon.sison.ps115@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100915111"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-116', 'Donna Vallejo', 'donna.vallejo.ps116@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100923030"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-117', 'Ferdinand Alonzo', 'ferdinand.alonzo.ps117@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100930949"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-118', 'Lianne Tugade', 'lianne.tugade.ps118@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100938868"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-119', 'Cedric Mercenario', 'cedric.mercenario.ps119@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100946787"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

INSERT INTO public.employees (
  employee_id, name, email, department, position, company_name, hte_id,
  supervisor_name, registration_address, registration_lat, registration_lng,
  registration_location, active, application_status, campus,
  instructor_id, academic_year, required_hours, rendered_hours
) VALUES (
  '2024-PS-120', 'Jovelyn Zubiri', 'jovelyn.zubiri.ps120@chmsu.edu.ph', 'Information Technology', 'Intern Trainee', 'Printing Services', 'ee755083-2cb1-4788-9be6-b13d4518d158',
  'Yzel B. Norte', 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines', 10.742858, 122.970088,
  '{"lat":10.742858,"lng":122.970088,"address":"Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines","phone":"09100954706"}', true, 'approved', 'Talisay (Main Campus)',
  '4249e91c-3677-4a40-855d-d2d8b67434f0', '2026-2027', 486, 0
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
  application_status = EXCLUDED.application_status;

COMMIT;
