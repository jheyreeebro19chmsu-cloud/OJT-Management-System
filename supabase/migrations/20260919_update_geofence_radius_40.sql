-- Update all existing geofence zones in the database to 40 meters boundary radius (minimum)
UPDATE geofence_zones 
SET radius = 40 
WHERE radius IS NULL OR radius < 40;

-- Also ensure employees table has registration_radius column with default 40
ALTER TABLE public.employees
ADD COLUMN IF NOT EXISTS registration_radius INTEGER DEFAULT 40;
