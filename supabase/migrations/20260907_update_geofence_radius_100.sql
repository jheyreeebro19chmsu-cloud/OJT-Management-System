-- Update all existing geofence zones in the database to 100 meters boundary radius
UPDATE geofence_zones 
SET radius = 100 
WHERE radius IS NULL OR radius != 100;
