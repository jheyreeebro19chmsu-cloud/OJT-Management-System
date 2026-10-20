-- Migration: 20261020_fix_time_records_approval_and_storage.sql
-- Fixes missing approval columns in time_records and storage RLS for attendance photos

-- 1. Add approval columns to time_records table if not present
ALTER TABLE public.time_records 
  ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS approved_by UUID,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS approval_note TEXT;

-- 2. Ensure time-records-photos bucket exists and is public
INSERT INTO storage.buckets (id, name, public)
VALUES ('time-records-photos', 'time-records-photos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 3. Configure storage policies for time-records-photos (allow public/anon insert, select, and update)
DROP POLICY IF EXISTS "Allow attendance photo uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow attendance photo reads" ON storage.objects;
DROP POLICY IF EXISTS "Allow attendance photo updates" ON storage.objects;
DROP POLICY IF EXISTS "Allow attendance photo public insert" ON storage.objects;

CREATE POLICY "Allow attendance photo public insert"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'time-records-photos');

CREATE POLICY "Allow attendance photo reads"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'time-records-photos');

CREATE POLICY "Allow attendance photo updates"
ON storage.objects FOR UPDATE
TO public
USING (bucket_id = 'time-records-photos');

-- 4. Reload PostgREST schema cache so approval_note and other columns are recognized immediately
NOTIFY pgrst, 'reload schema';
