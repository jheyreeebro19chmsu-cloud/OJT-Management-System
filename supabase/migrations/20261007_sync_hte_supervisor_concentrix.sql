-- ============================================================================
-- MIGRATION: ENSURE HTE ACCOUNT IN EMPLOYEES & HOST_SUPERVISORS & SYNC CONCENTRIX
-- Date: 2026-10-07
-- ============================================================================

BEGIN;

-- 1. Ensure Jhey Ree (Concentrix HTE) exists in public.host_supervisors
INSERT INTO public.host_supervisors (id, name, company_name, email, position, is_approved, active, academic_year)
VALUES (
  '95558630-499b-4aac-b869-ba64b0694e8c',
  'Jhey Ree',
  'Concentrix',
  'reejhey1@gmail.com',
  'HTE Representative',
  true,
  true,
  '2026-2027'
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  company_name = 'Concentrix',
  email = EXCLUDED.email,
  position = EXCLUDED.position,
  is_approved = true,
  active = true;

-- Also keep the seeded host_supervisor record in sync
INSERT INTO public.host_supervisors (id, name, company_name, email, position, is_approved, active, academic_year)
VALUES (
  '89405c66-015c-407a-937b-71ab37b829d7',
  'Jhey Ree C Ebro',
  'Concentrix',
  'jheyree.ebro@chmsu.edu.ph',
  'HTE Representative',
  true,
  true,
  '2026-2027'
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  company_name = 'Concentrix',
  position = EXCLUDED.position,
  is_approved = true,
  active = true;

-- 2. Ensure Jhey Ree exists in public.employees table so they appear in Table Editor
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
  academic_year
)
VALUES (
  '95558630-499b-4aac-b869-ba64b0694e8c',
  'HTE-CTX-001',
  'Jhey Ree',
  'reejhey1@gmail.com',
  'Operations',
  'HTE Representative',
  'Concentrix',
  'Jhey Ree',
  'Carlos Hilado Memorial State University',
  'N/A',
  '2026-10-06',
  '2027-04-30',
  0,
  true,
  '2026-2027'
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  employee_id = EXCLUDED.employee_id,
  email = EXCLUDED.email,
  department = EXCLUDED.department,
  position = EXCLUDED.position,
  company_name = 'Concentrix',
  supervisor_name = EXCLUDED.supervisor_name,
  active = true,
  academic_year = '2026-2027';

-- 3. Link all Concentrix trainees in public.employees to Jhey Ree (HTE ID: 95558630-499b-4aac-b869-ba64b0694e8c)
UPDATE public.employees
SET hte_id = '95558630-499b-4aac-b869-ba64b0694e8c'
WHERE company_name ILIKE '%Concentrix%'
  AND position ILIKE '%Trainee%';

-- 4. Ensure master Concentrix geofence zone is registered for this HTE supervisor
INSERT INTO public.geofence_zones (id, name, address, lat, lng, radius, active, employee_id)
VALUES (
  '95558630-499b-4aac-b869-ba64b0694e8c',
  'Concentrix - Helix Service Center',
  'Helix Service Center, Santa Clara Avenue, Banago, Bacolod',
  10.694261,
  122.959987,
  40,
  true,
  '95558630-499b-4aac-b869-ba64b0694e8c'
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  address = EXCLUDED.address,
  lat = EXCLUDED.lat,
  lng = EXCLUDED.lng,
  radius = EXCLUDED.radius,
  active = true;

COMMIT;
