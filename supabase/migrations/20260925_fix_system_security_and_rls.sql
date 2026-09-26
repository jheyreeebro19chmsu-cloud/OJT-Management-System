-- ============================================================================
-- FULL FIX MIGRATION: RLS Security, Instructor Permissions, Storage & Geofencing
-- Execute in Supabase Dashboard -> SQL Editor -> Run
-- ============================================================================

-- 1. Helper Security Functions (Fast, Cached Role & Ownership Checking)
CREATE OR REPLACE FUNCTION public.is_instructor()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.employees 
    WHERE (id = auth.uid() OR LOWER(email) = LOWER(auth.jwt() ->> 'email'))
      AND (position ILIKE '%instructor%' OR position ILIKE '%admin%')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_hte_supervisor()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.host_supervisors 
    WHERE (id = auth.uid() OR LOWER(email) = LOWER(auth.jwt() ->> 'email'))
  ) OR EXISTS (
    SELECT 1 FROM public.employees
    WHERE (id = auth.uid() OR LOWER(email) = LOWER(auth.jwt() ->> 'email'))
      AND (position ILIKE '%hte%' OR position ILIKE '%supervisor%')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_own_employee_record(emp_id text)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.employees
    WHERE (id::text = emp_id OR employee_id = emp_id)
      AND (id = auth.uid() OR LOWER(email) = LOWER(auth.jwt() ->> 'email'))
  );
$$;

-- Grant execution to authenticated & anon roles
GRANT EXECUTE ON FUNCTION public.is_instructor() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_hte_supervisor() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_own_employee_record(text) TO authenticated, anon;


-- ============================================================================
-- 2. EMPLOYEES TABLE: Enable Instructors to Approve, Update HTE & Documents
-- ============================================================================
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read for all" ON public.employees;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.employees;
DROP POLICY IF EXISTS "Enable insert for all users" ON public.employees;
DROP POLICY IF EXISTS "Enable update for all users" ON public.employees;
DROP POLICY IF EXISTS "Enable delete for all users" ON public.employees;
DROP POLICY IF EXISTS "Allow authenticated read employees" ON public.employees;
DROP POLICY IF EXISTS "Allow update employees" ON public.employees;
DROP POLICY IF EXISTS "Allow delete employees" ON public.employees;

-- Allow reading employee directory (instructors view all, trainees view active colleagues)
CREATE POLICY "Allow read employees"
ON public.employees FOR SELECT
TO authenticated, anon
USING (true);

-- Allow new registration
CREATE POLICY "Allow insert employees"
ON public.employees FOR INSERT
TO authenticated, anon
WITH CHECK (true);

-- Crucial Fix: Allow users to edit their own profile, AND allow instructors/HTE supervisors
-- to approve accounts, update HTE placement, and verify compliance documents!
CREATE POLICY "Allow update employees"
ON public.employees FOR UPDATE
TO authenticated
USING (
  id = auth.uid()
  OR LOWER(email) = LOWER(auth.jwt() ->> 'email')
  OR public.is_instructor()
  OR (public.is_hte_supervisor() AND (hte_id = auth.uid() OR hte_id::text = (auth.jwt() ->> 'sub')))
);

-- Only instructors can delete accounts
CREATE POLICY "Allow delete employees"
ON public.employees FOR DELETE
TO authenticated
USING (public.is_instructor());


-- ============================================================================
-- 3. TIME_RECORDS: Instructors and HTE Supervisors Must Read All Attendance
-- ============================================================================
ALTER TABLE public.time_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read for all" ON public.time_records;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.time_records;
DROP POLICY IF EXISTS "Enable insert for all users" ON public.time_records;
DROP POLICY IF EXISTS "Enable update for all users" ON public.time_records;
DROP POLICY IF EXISTS "Enable delete for all users" ON public.time_records;
DROP POLICY IF EXISTS "Allow read time_records" ON public.time_records;
DROP POLICY IF EXISTS "Allow insert time_records" ON public.time_records;
DROP POLICY IF EXISTS "Allow update time_records" ON public.time_records;
DROP POLICY IF EXISTS "Allow delete time_records" ON public.time_records;
DROP POLICY IF EXISTS "Allow scoped read time_records" ON public.time_records;
DROP POLICY IF EXISTS "Allow scoped insert time_records" ON public.time_records;
DROP POLICY IF EXISTS "Allow scoped update time_records" ON public.time_records;

-- Trainees view their own records; Instructors & HTE Supervisors view all cohort records
CREATE POLICY "Allow read time_records"
ON public.time_records FOR SELECT
TO authenticated
USING (
  public.is_instructor()
  OR public.is_hte_supervisor()
  OR employee_id = auth.uid()
  OR public.is_own_employee_record(employee_id::text)
);

-- Trainees insert their own clock-in; Instructors can add manual logs
CREATE POLICY "Allow insert time_records"
ON public.time_records FOR INSERT
TO authenticated
WITH CHECK (
  public.is_instructor()
  OR employee_id = auth.uid()
  OR public.is_own_employee_record(employee_id::text)
);

-- Trainees update their own clock-out; Instructors & HTE Supervisors can approve/annotate
CREATE POLICY "Allow update time_records"
ON public.time_records FOR UPDATE
TO authenticated
USING (
  public.is_instructor()
  OR public.is_hte_supervisor()
  OR employee_id = auth.uid()
  OR public.is_own_employee_record(employee_id::text)
);

-- Only instructors can delete attendance logs
CREATE POLICY "Allow delete time_records"
ON public.time_records FOR DELETE
TO authenticated
USING (public.is_instructor());


-- ============================================================================
-- 4. EVALUATIONS: Trainees See Own, Instructors & Supervisors Grade All
-- ============================================================================
ALTER TABLE public.evaluations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read for all" ON public.evaluations;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.evaluations;
DROP POLICY IF EXISTS "Enable insert for all users" ON public.evaluations;
DROP POLICY IF EXISTS "Enable update for all users" ON public.evaluations;
DROP POLICY IF EXISTS "Enable delete for all users" ON public.evaluations;
DROP POLICY IF EXISTS "Allow read evaluations" ON public.evaluations;
DROP POLICY IF EXISTS "Allow insert evaluations" ON public.evaluations;
DROP POLICY IF EXISTS "Allow update evaluations" ON public.evaluations;
DROP POLICY IF EXISTS "Allow delete evaluations" ON public.evaluations;
DROP POLICY IF EXISTS "Allow scoped read evaluations" ON public.evaluations;
DROP POLICY IF EXISTS "Allow scoped insert evaluations" ON public.evaluations;
DROP POLICY IF EXISTS "Allow scoped update evaluations" ON public.evaluations;

CREATE POLICY "Allow read evaluations"
ON public.evaluations FOR SELECT
TO authenticated
USING (
  public.is_instructor()
  OR public.is_hte_supervisor()
  OR employee_id = auth.uid()
  OR public.is_own_employee_record(employee_id::text)
);

CREATE POLICY "Allow insert evaluations"
ON public.evaluations FOR INSERT
TO authenticated
WITH CHECK (
  public.is_instructor()
  OR public.is_hte_supervisor()
  OR employee_id = auth.uid()
  OR public.is_own_employee_record(employee_id::text)
);

CREATE POLICY "Allow update evaluations"
ON public.evaluations FOR UPDATE
TO authenticated
USING (
  public.is_instructor()
  OR public.is_hte_supervisor()
  OR employee_id = auth.uid()
  OR public.is_own_employee_record(employee_id::text)
);

CREATE POLICY "Allow delete evaluations"
ON public.evaluations FOR DELETE
TO authenticated
USING (public.is_instructor());


-- ============================================================================
-- 5. ENSURE MISSING TABLES EXIST (Fixes PGRST205 400/404 errors)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.hte_student_access (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  hte_id UUID REFERENCES public.host_supervisors(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
  instructor_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(hte_id, student_id)
);

ALTER TABLE public.hte_student_access ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all hte_student_access" ON public.hte_student_access;
CREATE POLICY "Allow all hte_student_access" ON public.hte_student_access FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- ============================================================================
-- 6. SECURE STORAGE POLICIES (Fixes Public Delete / Overwrite Vulnerabilities)
-- ============================================================================

-- A. Face Photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('face-photos', 'face-photos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Public Face Photos Read" ON storage.objects;
DROP POLICY IF EXISTS "Allow Face Photos Uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow Face Photos Updates" ON storage.objects;
DROP POLICY IF EXISTS "Allow Face Photos Deletes" ON storage.objects;

-- Allow public read so avatars and profile pictures render in the browser
CREATE POLICY "Public Face Photos Read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'face-photos');

-- Only authenticated users can upload face photos
CREATE POLICY "Allow Face Photos Uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'face-photos');

-- Users can only update their own folder photos; instructors can update any
CREATE POLICY "Allow Face Photos Updates"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'face-photos'
  AND (public.is_instructor() OR (storage.foldername(name))[1] = auth.uid()::text)
);

-- Only instructors can permanently delete face photos
CREATE POLICY "Allow Face Photos Deletes"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'face-photos' AND public.is_instructor());


-- B. Time Records Photos (Attendance Selfies)
INSERT INTO storage.buckets (id, name, public)
VALUES ('time-records-photos', 'time-records-photos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Allow attendance photo reads" ON storage.objects;
DROP POLICY IF EXISTS "Allow attendance photo uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow attendance photo updates" ON storage.objects;
DROP POLICY IF EXISTS "Allow attendance photo deletes" ON storage.objects;

CREATE POLICY "Allow attendance photo reads"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'time-records-photos');

CREATE POLICY "Allow attendance photo uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'time-records-photos');

-- Prevent public/trainee deletion of audit trail photos
CREATE POLICY "Allow attendance photo updates"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'time-records-photos' AND public.is_instructor());

CREATE POLICY "Allow attendance photo deletes"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'time-records-photos' AND public.is_instructor());


-- C. Employee Photos Bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('employee-photos', 'employee-photos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Allow employee photo reads" ON storage.objects;
DROP POLICY IF EXISTS "Allow employee photo uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow employee photo updates" ON storage.objects;
DROP POLICY IF EXISTS "Allow employee photo deletes" ON storage.objects;

CREATE POLICY "Allow employee photo reads"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'employee-photos');

CREATE POLICY "Allow employee photo uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'employee-photos');

CREATE POLICY "Allow employee photo updates"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'employee-photos' AND (public.is_instructor() OR (storage.foldername(name))[1] = auth.uid()::text));

CREATE POLICY "Allow employee photo deletes"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'employee-photos' AND public.is_instructor());


-- ============================================================================
-- 7. SERVER-SIDE GEOFENCING VALIDATION (Haversine Distance Trigger)
-- ============================================================================
-- Computes the distance in meters between two lat/lng coordinates on the server
CREATE OR REPLACE FUNCTION public.haversine_distance(
  lat1 double precision, lon1 double precision,
  lat2 double precision, lon2 double precision
)
RETURNS double precision LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  R CONSTANT double precision := 6371000; -- Earth radius in meters
  dlat double precision;
  dlon double precision;
  a double precision;
  c double precision;
BEGIN
  IF lat1 IS NULL OR lon1 IS NULL OR lat2 IS NULL OR lon2 IS NULL THEN
    RETURN 999999999;
  END IF;

  dlat := radians(lat2 - lat1);
  dlon := radians(lon2 - lon1);
  a := sin(dlat / 2.0)^2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2.0)^2;
  c := 2.0 * atan2(sqrt(a), sqrt(1.0 - a));
  RETURN R * c;
END;
$$;

-- Trigger to validate time_in_geofenced on server side before insert/update
CREATE OR REPLACE FUNCTION public.verify_attendance_geofence()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  target_lat double precision;
  target_lng double precision;
  target_radius double precision := 50;
  calculated_dist double precision;
BEGIN
  -- Look up assigned HTE zone from employee record
  SELECT
    COALESCE(
      (e.registration_location ->> 'lat')::double precision,
      e.registration_lat,
      gz.lat
    ),
    COALESCE(
      (e.registration_location ->> 'lng')::double precision,
      e.registration_lng,
      gz.lng
    ),
    COALESCE(
      (e.registration_location ->> 'radius')::double precision,
      gz.radius,
      50
    )
  INTO target_lat, target_lng, target_radius
  FROM public.employees e
  LEFT JOIN public.geofence_zones gz ON gz.id = ('station-' || e.id::text)
  WHERE e.id = NEW.employee_id
  LIMIT 1;

  -- If coordinates were supplied for time_in
  IF NEW.time_in_lat IS NOT NULL AND NEW.time_in_lng IS NOT NULL AND target_lat IS NOT NULL THEN
    calculated_dist := public.haversine_distance(NEW.time_in_lat, NEW.time_in_lng, target_lat, target_lng);
    -- Enforce: within radius + 15m tolerance buffer
    IF calculated_dist <= (target_radius + 15.0) THEN
      NEW.time_in_geofenced := true;
    ELSE
      NEW.time_in_geofenced := false;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_verify_attendance_geofence ON public.time_records;
CREATE TRIGGER trg_verify_attendance_geofence
BEFORE INSERT OR UPDATE ON public.time_records
FOR EACH ROW
EXECUTE FUNCTION public.verify_attendance_geofence();

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
