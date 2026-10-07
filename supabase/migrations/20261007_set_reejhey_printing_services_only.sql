-- ============================================================================
-- MIGRATION: CONFIGURE reejhey1@gmail.com AS PRINTING SERVICES HTE
-- AND TRANSFER ALL PRINTING SERVICES TRAINEES (144) UNDER THIS ACCOUNT ONLY,
-- KEEPING CONCENTRIX TRAINEES (122) EXCLUSIVELY UNDER CONCENTRIX.
-- Date: 2026-10-07
-- ============================================================================

BEGIN;

-- 1. Ensure reejhey1@gmail.com is configured as Printing Services HTE supervisor
INSERT INTO public.host_supervisors (id, name, company_name, email, position, is_approved, active)
VALUES (
  '95558630-499b-4aac-b869-ba64b0694e8c',
  'Jhey Ree',
  'Printing Services',
  'reejhey1@gmail.com',
  'HTE Representative',
  true,
  true
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  company_name = 'Printing Services',
  position = EXCLUDED.position,
  is_approved = true,
  active = true;

-- 2. Ensure official Concentrix supervisor remains intact
INSERT INTO public.host_supervisors (id, name, company_name, email, position, is_approved, active)
VALUES (
  '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro',
  'Concentrix',
  'jheyree.ebro@chmsu.edu.ph',
  'HTE Representative',
  true,
  true
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  company_name = 'Concentrix',
  position = EXCLUDED.position,
  is_approved = true,
  active = true;

-- 3. Update supervisor entries in public.employees
INSERT INTO public.employees (
  id,
  employee_id,
  name,
  email,
  department,
  position,
  company_name,
  supervisor_name,
  school_name,
  course,
  start_date,
  end_date,
  required_hours,
  active,
  academic_year,
  registration_address,
  registration_lat,
  registration_lng
)
VALUES (
  '95558630-499b-4aac-b869-ba64b0694e8c',
  'HTE-PS-001',
  'Jhey Ree',
  'reejhey1@gmail.com',
  'Printing & Media Services',
  'HTE Representative',
  'Printing Services',
  'Jhey Ree',
  'Carlos Hilado Memorial State University',
  'N/A',
  '2026-10-06',
  '2027-04-30',
  0,
  true,
  '2026-2027',
  'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines',
  10.742858,
  122.970088
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  employee_id = EXCLUDED.employee_id,
  email = EXCLUDED.email,
  department = EXCLUDED.department,
  position = EXCLUDED.position,
  company_name = 'Printing Services',
  supervisor_name = 'Jhey Ree',
  active = true,
  academic_year = '2026-2027',
  registration_address = EXCLUDED.registration_address,
  registration_lat = EXCLUDED.registration_lat,
  registration_lng = EXCLUDED.registration_lng;

INSERT INTO public.employees (
  id,
  employee_id,
  name,
  email,
  department,
  position,
  company_name,
  supervisor_name,
  school_name,
  course,
  start_date,
  end_date,
  required_hours,
  active,
  academic_year,
  registration_address,
  registration_lat,
  registration_lng
)
VALUES (
  '89405c66-015c-407a-937b-71ab37b829d7',
  'HTE-CTX-001',
  'Jhey Ree C Ebro',
  'jheyree.ebro@chmsu.edu.ph',
  'Operations',
  'HTE Representative',
  'Concentrix',
  'Jhey Ree C Ebro',
  'Carlos Hilado Memorial State University',
  'N/A',
  '2026-10-06',
  '2027-04-30',
  0,
  true,
  '2026-2027',
  'Helix Service Center, Santa Clara Avenue, Banago, Bacolod',
  10.694261,
  122.959987
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  employee_id = EXCLUDED.employee_id,
  email = EXCLUDED.email,
  department = EXCLUDED.department,
  position = EXCLUDED.position,
  company_name = 'Concentrix',
  supervisor_name = 'Jhey Ree C Ebro',
  active = true,
  academic_year = '2026-2027',
  registration_address = EXCLUDED.registration_address,
  registration_lat = EXCLUDED.registration_lat,
  registration_lng = EXCLUDED.registration_lng;

-- 4. Assign Concentrix Trainees (122) exclusively to Concentrix HTE
UPDATE public.employees
SET
  hte_id = '89405c66-015c-407a-937b-71ab37b829d7',
  company_name = 'Concentrix',
  supervisor_name = 'Jhey Ree C Ebro',
  registration_address = 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod',
  registration_lat = 10.694261,
  registration_lng = 122.959987
WHERE position = 'OJT Trainee'
  AND (
    employee_id ILIKE '2024-CTX-%'
    OR email ILIKE '%.ctx%@chmsu.edu.ph'
    OR name IN ('Joshua De la Rama', 'Princess Joy Bautista', 'Trix Justin A Aguilar', 'Jhey Ree C Ebro', 'Diana Rose Morales', 'Mae Ann Pascual', 'Charmaine Legaspi')
  );

-- 5. Assign Printing Services Trainees (144) to reejhey1@gmail.com HTE
UPDATE public.employees
SET
  hte_id = '95558630-499b-4aac-b869-ba64b0694e8c',
  company_name = 'Printing Services',
  supervisor_name = 'Jhey Ree',
  registration_address = 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines',
  registration_lat = 10.742858,
  registration_lng = 122.970088
WHERE position = 'OJT Trainee'
  AND NOT (
    employee_id ILIKE '2024-CTX-%'
    OR email ILIKE '%.ctx%@chmsu.edu.ph'
    OR name IN ('Joshua De la Rama', 'Princess Joy Bautista', 'Trix Justin A Aguilar', 'Jhey Ree C Ebro', 'Diana Rose Morales', 'Mae Ann Pascual', 'Charmaine Legaspi')
  );

-- 6. Update master geofence zones
INSERT INTO public.geofence_zones (id, name, address, lat, lng, radius, active, employee_id)
VALUES (
  '95558630-499b-4aac-b869-ba64b0694e8c',
  'Printing Services - Talisay Premises',
  'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines',
  10.742858,
  122.970088,
  40,
  true,
  '95558630-499b-4aac-b869-ba64b0694e8c'
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  address = EXCLUDED.address,
  lat = EXCLUDED.lat,
  lng = EXCLUDED.lng,
  radius = 40,
  active = true;

INSERT INTO public.geofence_zones (id, name, address, lat, lng, radius, active, employee_id)
VALUES (
  '89405c66-015c-407a-937b-71ab37b829d7',
  'Concentrix - Helix Service Center',
  'Helix Service Center, Santa Clara Avenue, Banago, Bacolod',
  10.694261,
  122.959987,
  40,
  true,
  '89405c66-015c-407a-937b-71ab37b829d7'
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  address = EXCLUDED.address,
  lat = EXCLUDED.lat,
  lng = EXCLUDED.lng,
  radius = 40,
  active = true;

-- 7. Update trainee geofence zones
UPDATE public.geofence_zones gz
SET
  name = e.name || ' - Trainee Geofence (Printing Services)',
  address = 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines',
  lat = 10.742858,
  lng = 122.970088,
  radius = 40
FROM public.employees e
WHERE gz.employee_id = e.id
  AND e.company_name = 'Printing Services'
  AND e.position = 'OJT Trainee';

UPDATE public.geofence_zones gz
SET
  name = e.name || ' - Trainee Geofence (Concentrix)',
  address = 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod',
  lat = 10.694261,
  lng = 122.959987,
  radius = 40
FROM public.employees e
WHERE gz.employee_id = e.id
  AND e.company_name = 'Concentrix'
  AND e.position = 'OJT Trainee';

COMMIT;
