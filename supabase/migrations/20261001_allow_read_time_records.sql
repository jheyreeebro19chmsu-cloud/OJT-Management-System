-- ============================================================================
-- FIX: Enable Read Access for Attendance Time Records
-- Run this in Supabase Dashboard -> SQL Editor -> Run
-- ============================================================================

ALTER TABLE public.time_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read time_records" ON public.time_records;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.time_records;
DROP POLICY IF EXISTS "Enable read for all" ON public.time_records;

-- Allow authenticated users and coordinators to view cohort attendance records
CREATE POLICY "Allow read time_records"
ON public.time_records FOR SELECT
TO authenticated, anon
USING (true);
