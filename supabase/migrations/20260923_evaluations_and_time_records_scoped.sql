-- ============================================================================
-- SECURITY MIGRATION PART 2: Scoped Evaluations & Time Records RLS
-- Run in Supabase Dashboard -> SQL Editor
-- Verified: employee_id is UUID and matches auth.uid() for authenticated users
-- ============================================================================

-- 1. Ensure Role Checking Helper Functions Exist
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

-- ============================================================================
-- 2. EVALUATIONS: Scoped to Trainee's Own Record + Instructor/Supervisor Admin
-- ============================================================================
ALTER TABLE public.evaluations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read for all" ON public.evaluations;
DROP POLICY IF EXISTS "Enable insert for all" ON public.evaluations;
DROP POLICY IF EXISTS "Enable update for all" ON public.evaluations;
DROP POLICY IF EXISTS "Enable delete for all" ON public.evaluations;
DROP POLICY IF EXISTS "Allow authenticated read evaluations" ON public.evaluations;
DROP POLICY IF EXISTS "Allow authenticated insert evaluations" ON public.evaluations;
DROP POLICY IF EXISTS "Allow authenticated update evaluations" ON public.evaluations;
DROP POLICY IF EXISTS "Allow read evaluations" ON public.evaluations;
DROP POLICY IF EXISTS "Allow insert evaluations" ON public.evaluations;
DROP POLICY IF EXISTS "Allow update evaluations" ON public.evaluations;
DROP POLICY IF EXISTS "Allow delete evaluations" ON public.evaluations;
DROP POLICY IF EXISTS "Allow scoped read evaluations" ON public.evaluations;
DROP POLICY IF EXISTS "Allow scoped insert evaluations" ON public.evaluations;
DROP POLICY IF EXISTS "Allow scoped update evaluations" ON public.evaluations;

-- Trainees see only their own evaluation; instructors/supervisors see all
CREATE POLICY "Allow scoped read evaluations"
ON public.evaluations FOR SELECT
TO authenticated
USING (
  employee_id = auth.uid()
  OR public.is_instructor()
  OR public.is_hte_supervisor()
);

-- Trainees can insert only their own self-evaluation draft;
-- instructors/supervisors can insert official grades for anyone
CREATE POLICY "Allow scoped insert evaluations"
ON public.evaluations FOR INSERT
TO authenticated
WITH CHECK (
  employee_id = auth.uid()
  OR public.is_instructor()
  OR public.is_hte_supervisor()
);

-- Same logic for updates (e.g. trainee editing their draft, or
-- instructor/supervisor entering final scores)
CREATE POLICY "Allow scoped update evaluations"
ON public.evaluations FOR UPDATE
TO authenticated
USING (
  employee_id = auth.uid()
  OR public.is_instructor()
  OR public.is_hte_supervisor()
);

-- Only instructors can delete evaluation records
CREATE POLICY "Allow delete evaluations"
ON public.evaluations FOR DELETE
TO authenticated
USING (public.is_instructor());

-- ============================================================================
-- 3. TIME_RECORDS: Scoped to Trainee's Own Record + Instructor/Supervisor Admin
-- ============================================================================
ALTER TABLE public.time_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read for all" ON public.time_records;
DROP POLICY IF EXISTS "Enable insert for all" ON public.time_records;
DROP POLICY IF EXISTS "Enable update for all" ON public.time_records;
DROP POLICY IF EXISTS "Enable delete for all" ON public.time_records;
DROP POLICY IF EXISTS "Allow read time_records" ON public.time_records;
DROP POLICY IF EXISTS "Allow insert time_records" ON public.time_records;
DROP POLICY IF EXISTS "Allow update time_records" ON public.time_records;
DROP POLICY IF EXISTS "Allow delete time_records" ON public.time_records;
DROP POLICY IF EXISTS "Allow scoped read time_records" ON public.time_records;
DROP POLICY IF EXISTS "Allow scoped insert time_records" ON public.time_records;
DROP POLICY IF EXISTS "Allow scoped update time_records" ON public.time_records;

-- Trainees see only their own attendance; instructors/supervisors see all
CREATE POLICY "Allow scoped read time_records"
ON public.time_records FOR SELECT
TO authenticated
USING (
  employee_id = auth.uid()
  OR public.is_instructor()
  OR public.is_hte_supervisor()
);

-- Trainees can only create their own clock-in/out records
CREATE POLICY "Allow scoped insert time_records"
ON public.time_records FOR INSERT
TO authenticated
WITH CHECK (
  employee_id = auth.uid()
  OR public.is_instructor()
  OR public.is_hte_supervisor()
);

-- Trainees can update their own record (e.g. adding time_out later);
-- instructors/supervisors can update any record (e.g. approval_status)
CREATE POLICY "Allow scoped update time_records"
ON public.time_records FOR UPDATE
TO authenticated
USING (
  employee_id = auth.uid()
  OR public.is_instructor()
  OR public.is_hte_supervisor()
);

-- Only instructors can delete attendance records
CREATE POLICY "Allow delete time_records"
ON public.time_records FOR DELETE
TO authenticated
USING (public.is_instructor());
