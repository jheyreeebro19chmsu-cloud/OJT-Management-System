-- ============================================================================
-- MIGRATION: REMOVE YZEL B. NORTE AND TRANSFER ALL PRINTING SERVICES TRAINEES
-- TO HTE ACCOUNT: reejhey1@gmail.com (Concentrix / Jhey Ree)
-- Date: 2026-10-07
-- ============================================================================

BEGIN;

-- 1. Remove Yzel B. Norte from host_supervisors
DELETE FROM public.host_supervisors
WHERE id = 'ee755083-2cb1-4788-9be6-b13d4518d158'
   OR email ILIKE '%yzel%'
   OR name ILIKE '%Yzel B. Norte%';

-- 2. Remove Yzel B. Norte from employees (HTE Representative)
DELETE FROM public.employees
WHERE id = 'ee755083-2cb1-4788-9be6-b13d4518d158'
   OR (email = 'yzelnorte@gmail.com' AND position = 'HTE Representative');

-- 3. Remove Yzel B. Norte and Printing Services master geofence zones
DELETE FROM public.geofence_zones
WHERE id = 'ee755083-2cb1-4788-9be6-b13d4518d158'
   OR id = '64078a91-2ec3-4cae-9f74-41edfbd2bed4'
   OR employee_id = 'ee755083-2cb1-4788-9be6-b13d4518d158'
   OR name ILIKE '%Yzel B. Norte%'
   OR name ILIKE '%Printing Services - Talisay%';

-- 4. Transfer all Printing Services trainees in public.employees to reejhey1@gmail.com
UPDATE public.employees
SET
  hte_id = '95558630-499b-4aac-b869-ba64b0694e8c',
  company_name = 'Concentrix',
  supervisor_name = 'Jhey Ree'
WHERE (company_name ILIKE '%Printing%' OR hte_id = 'ee755083-2cb1-4788-9be6-b13d4518d158')
  AND position ILIKE '%Trainee%';

-- 5. Update trainee geofence zones to Concentrix Helix Center
UPDATE public.geofence_zones
SET
  name = REPLACE(REPLACE(name, '(Printing Services)', '(Concentrix)'), 'Printing Services', 'Concentrix'),
  address = 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod',
  lat = 10.694261,
  lng = 122.959987,
  radius = 40
WHERE name ILIKE '%Printing%';

-- 6. Update time_records notes
UPDATE public.time_records
SET notes = REPLACE(notes, 'Printing Services', 'Concentrix')
WHERE notes ILIKE '%Printing Services%';

COMMIT;
