-- ============================================================================
-- FULL SECURITY MIGRATION: Role-Aware RLS Policies for Supabase
-- Run in Supabase Dashboard -> SQL Editor
-- ============================================================================

-- 1. Helper Security Functions (Fast, Cached Role & Ownership Checking)
CREATE OR REPLACE FUNCTION public.is_instructor()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.employees 
    WHERE (id = auth.uid() OR email = (auth.jwt() ->> 'email'))
      AND (position ILIKE '%instructor%' OR position ILIKE '%admin%')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_hte_supervisor()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.host_supervisors 
    WHERE (id = auth.uid() OR email = (auth.jwt() ->> 'email'))
  );
$$;

CREATE OR REPLACE FUNCTION public.is_own_employee_record(emp_id text)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.employees
    WHERE (id::text = emp_id OR employee_id = emp_id)
      AND (id = auth.uid() OR email = (auth.jwt() ->> 'email'))
  );
$$;

-- ============================================================================
-- 2. TIME RECORDS (Attendance, Clock-In / Clock-Out)
-- ============================================================================
ALTER TABLE public.time_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read for all" ON public.time_records;
DROP POLICY IF EXISTS "Enable insert for all" ON public.time_records;
DROP POLICY IF EXISTS "Enable update for all" ON public.time_records;
DROP POLICY IF EXISTS "Enable delete for all" ON public.time_records;

-- Trainees view their own records; Instructors & HTE Supervisors view all
CREATE POLICY "Allow read time_records"
ON public.time_records FOR SELECT
TO authenticated
USING (
  public.is_instructor() 
  OR public.is_hte_supervisor() 
  OR public.is_own_employee_record(employee_id)
);

-- Trainees insert their own clock-in; Instructors can add manual logs
CREATE POLICY "Allow insert time_records"
ON public.time_records FOR INSERT
TO authenticated
WITH CHECK (
  public.is_instructor() 
  OR public.is_own_employee_record(employee_id)
);

-- Trainees can update their own clock-out; Instructors/HTE can approve/reject attendance
CREATE POLICY "Allow update time_records"
ON public.time_records FOR UPDATE
TO authenticated
USING (
  public.is_instructor() 
  OR public.is_hte_supervisor() 
  OR public.is_own_employee_record(employee_id)
);

-- Only instructors can delete attendance logs
CREATE POLICY "Allow delete time_records"
ON public.time_records FOR DELETE
TO authenticated
USING (public.is_instructor());

-- ============================================================================
-- 3. EVALUATIONS (Self-Evaluation + Official Grading)
-- ============================================================================
ALTER TABLE public.evaluations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read for all" ON public.evaluations;
DROP POLICY IF EXISTS "Enable insert for all" ON public.evaluations;
DROP POLICY IF EXISTS "Enable update for all" ON public.evaluations;
DROP POLICY IF EXISTS "Enable delete for all" ON public.evaluations;
DROP POLICY IF EXISTS "Allow authenticated read evaluations" ON public.evaluations;
DROP POLICY IF EXISTS "Allow authenticated insert evaluations" ON public.evaluations;
DROP POLICY IF EXISTS "Allow authenticated update evaluations" ON public.evaluations;
DROP POLICY IF EXISTS "Allow delete evaluations" ON public.evaluations;

-- Trainees view their own evaluation; Supervisors and Instructors view all
CREATE POLICY "Allow read evaluations"
ON public.evaluations FOR SELECT
TO authenticated
USING (
  public.is_instructor() 
  OR public.is_hte_supervisor() 
  OR public.is_own_employee_record(employee_id)
);

-- Supervisors & Instructors can grade; Trainees can submit their own questionnaire draft
CREATE POLICY "Allow insert evaluations"
ON public.evaluations FOR INSERT
TO authenticated
WITH CHECK (
  public.is_instructor() 
  OR public.is_hte_supervisor() 
  OR public.is_own_employee_record(employee_id)
);

-- Supervisors & Instructors can score; Trainees can only update their own questionnaire
CREATE POLICY "Allow update evaluations"
ON public.evaluations FOR UPDATE
TO authenticated
USING (
  public.is_instructor() 
  OR public.is_hte_supervisor() 
  OR public.is_own_employee_record(employee_id)
);

-- Only instructors can delete evaluations
CREATE POLICY "Allow delete evaluations"
ON public.evaluations FOR DELETE
TO authenticated
USING (public.is_instructor());

-- ============================================================================
-- 4. GEOFENCE ZONES
-- ============================================================================
ALTER TABLE public.geofence_zones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read for all" ON public.geofence_zones;
DROP POLICY IF EXISTS "Enable insert for all" ON public.geofence_zones;
DROP POLICY IF EXISTS "Enable update for all" ON public.geofence_zones;
DROP POLICY IF EXISTS "Enable delete for all" ON public.geofence_zones;

CREATE POLICY "Allow authenticated read geofences"
ON public.geofence_zones FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow instructors to insert geofences"
ON public.geofence_zones FOR INSERT
TO authenticated
WITH CHECK (public.is_instructor() OR public.is_hte_supervisor());

CREATE POLICY "Allow instructors to update geofences"
ON public.geofence_zones FOR UPDATE
TO authenticated
USING (public.is_instructor() OR public.is_hte_supervisor());

CREATE POLICY "Allow instructors to delete geofences"
ON public.geofence_zones FOR DELETE
TO authenticated
USING (public.is_instructor());

-- ============================================================================
-- 5. HOST FEEDBACK
-- ============================================================================
ALTER TABLE public.host_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read for all" ON public.host_feedback;
DROP POLICY IF EXISTS "Enable insert for all" ON public.host_feedback;
DROP POLICY IF EXISTS "Enable update for all" ON public.host_feedback;
DROP POLICY IF EXISTS "Enable delete for all" ON public.host_feedback;

CREATE POLICY "Allow authenticated read host_feedback"
ON public.host_feedback FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow supervisors and instructors to insert feedback"
ON public.host_feedback FOR INSERT
TO authenticated
WITH CHECK (public.is_hte_supervisor() OR public.is_instructor());

CREATE POLICY "Allow update host_feedback"
ON public.host_feedback FOR UPDATE
TO authenticated
USING (public.is_hte_supervisor() OR public.is_instructor());

CREATE POLICY "Allow delete host_feedback"
ON public.host_feedback FOR DELETE
TO authenticated
USING (public.is_instructor());

-- ============================================================================
-- 6. HOST SUPERVISORS (HTE Accounts)
-- ============================================================================
ALTER TABLE public.host_supervisors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read for all" ON public.host_supervisors;
DROP POLICY IF EXISTS "Enable insert for all" ON public.host_supervisors;
DROP POLICY IF EXISTS "Enable update for all" ON public.host_supervisors;
DROP POLICY IF EXISTS "Enable delete for all" ON public.host_supervisors;

CREATE POLICY "Allow read host_supervisors"
ON public.host_supervisors FOR SELECT
TO public
USING (true);

CREATE POLICY "Allow public insert host_supervisors"
ON public.host_supervisors FOR INSERT
TO public
WITH CHECK (true);

CREATE POLICY "Allow update host_supervisors"
ON public.host_supervisors FOR UPDATE
TO authenticated
USING (id = auth.uid() OR public.is_instructor() OR (email = (auth.jwt() ->> 'email')));

CREATE POLICY "Allow delete host_supervisors"
ON public.host_supervisors FOR DELETE
TO authenticated
USING (public.is_instructor());
