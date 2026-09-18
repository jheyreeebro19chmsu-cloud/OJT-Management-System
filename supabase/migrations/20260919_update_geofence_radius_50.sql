-- Update all existing geofence zones in the database to 50 meters boundary radius
UPDATE geofence_zones 
SET radius = 50 
WHERE radius IS NULL OR radius != 50;

-- Also ensure employees table has registration_radius column if needed
ALTER TABLE public.employees
ADD COLUMN IF NOT EXISTS registration_radius INTEGER DEFAULT 50;
