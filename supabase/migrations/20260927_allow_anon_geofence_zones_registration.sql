-- ============================================================================
-- Allow Anonymous and Authenticated Registration for Geofence Zones
-- Fix: Prevents "Failed to save geofence zone to cloud" during account registration
-- ============================================================================

-- 1. Ensure employee_id and created_at columns exist on geofence_zones
ALTER TABLE public.geofence_zones 
ADD COLUMN IF NOT EXISTS employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE;

ALTER TABLE public.geofence_zones 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- 2. Ensure RLS allows insertion during user registration (both anon and authenticated)
ALTER TABLE public.geofence_zones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anon and auth insert geofence_zones" ON public.geofence_zones;
CREATE POLICY "Allow anon and auth insert geofence_zones"
ON public.geofence_zones FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- 3. Ensure read access is enabled for everyone
DROP POLICY IF EXISTS "Allow read geofence_zones" ON public.geofence_zones;
CREATE POLICY "Allow read geofence_zones"
ON public.geofence_zones FOR SELECT
TO anon, authenticated
USING (true);
