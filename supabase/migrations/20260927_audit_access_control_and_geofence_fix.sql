-- ============================================================================
-- AUDIT FIX MIGRATION: Database Access Control (RLS), Geofence Deduplication,
-- & Location Plausibility Auditing
-- ============================================================================
-- Execute in Supabase Dashboard -> SQL Editor -> Run
-- Target: Fixes all 3 findings in the September 25, 2026 Security & Accuracy Audit
-- ============================================================================

-- ----------------------------------------------------------------------------
-- SECTION 1: HELPER FUNCTIONS FOR ROLE-BASED ACCESS CONTROL
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_instructor()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.employees 
    WHERE (id = auth.uid() OR LOWER(email) = LOWER(auth.jwt() ->> 'email'))
      AND (position ILIKE '%instructor%' OR position ILIKE '%admin%' OR position ILIKE '%faculty%')
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

GRANT EXECUTE ON FUNCTION public.is_instructor() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_hte_supervisor() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_own_employee_record(text) TO authenticated, anon;


-- ----------------------------------------------------------------------------
-- SECTION 2: EMPLOYEES TABLE ACCESS CONTROL
-- Fixes: Trainees should only read own profile + instructor directory
-- ----------------------------------------------------------------------------
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read for all" ON public.employees;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.employees;
DROP POLICY IF EXISTS "Allow read employees" ON public.employees;
DROP POLICY IF EXISTS "Allow authenticated read employees" ON public.employees;
DROP POLICY IF EXISTS "Allow insert employees" ON public.employees;
DROP POLICY IF EXISTS "Allow update employees" ON public.employees;
DROP POLICY IF EXISTS "Allow delete employees" ON public.employees;

-- Instructors read all; HTE supervisors read their assigned trainees;
-- Trainees read their own record + public instructor directory (needed during registration)
CREATE POLICY "Allow read employees"
ON public.employees FOR SELECT
TO authenticated, anon
USING (
  public.is_instructor()
  OR (
    public.is_hte_supervisor() 
    AND (
      hte_id = auth.uid() 
      OR company_name IN (
        SELECT company_name FROM public.host_supervisors 
        WHERE id = auth.uid() OR LOWER(email) = LOWER(auth.jwt() ->> 'email')
      )
    )
  )
  OR id = auth.uid()
  OR LOWER(email) = LOWER(auth.jwt() ->> 'email')
  OR position ILIKE '%instructor%'
  OR position ILIKE '%admin%'
);

-- Registration policy
CREATE POLICY "Allow insert employees"
ON public.employees FOR INSERT
TO authenticated, anon
WITH CHECK (true);

-- Trainees can update only their own profile; Instructors update all; HTE updates assigned trainees
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


-- ----------------------------------------------------------------------------
-- SECTION 3: HOST_FEEDBACK TABLE ACCESS CONTROL
-- Fixes: Blanket auth.uid() IS NOT NULL check -> Strict role & author ownership
-- ----------------------------------------------------------------------------
ALTER TABLE public.host_feedback ADD COLUMN IF NOT EXISTS host_email TEXT;
ALTER TABLE public.host_feedback ADD COLUMN IF NOT EXISTS submitted_by UUID;

ALTER TABLE public.host_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all host_feedback" ON public.host_feedback;
DROP POLICY IF EXISTS "Allow read host_feedback" ON public.host_feedback;
DROP POLICY IF EXISTS "Allow insert host_feedback" ON public.host_feedback;
DROP POLICY IF EXISTS "Allow update host_feedback" ON public.host_feedback;
DROP POLICY IF EXISTS "Allow delete host_feedback" ON public.host_feedback;

-- Instructors read all feedback; HTE read their own submitted feedback; Trainees read feedback for them
CREATE POLICY "Allow read host_feedback"
ON public.host_feedback FOR SELECT
TO authenticated
USING (
  public.is_instructor()
  OR (host_email IS NOT NULL AND LOWER(host_email) = LOWER(auth.jwt() ->> 'email'))
  OR (submitted_by IS NOT NULL AND submitted_by = auth.uid())
  OR employee_id = auth.uid()
  OR public.is_own_employee_record(employee_id::text)
);

-- Only verified HTE supervisors and Instructors can insert feedback
CREATE POLICY "Allow insert host_feedback"
ON public.host_feedback FOR INSERT
TO authenticated
WITH CHECK (
  public.is_instructor()
  OR public.is_hte_supervisor()
);

-- Only authoring supervisor or instructors can update feedback
CREATE POLICY "Allow update host_feedback"
ON public.host_feedback FOR UPDATE
TO authenticated
USING (
  public.is_instructor()
  OR (host_email IS NOT NULL AND LOWER(host_email) = LOWER(auth.jwt() ->> 'email'))
  OR (submitted_by IS NOT NULL AND submitted_by = auth.uid())
);

-- Only instructors can delete feedback
CREATE POLICY "Allow delete host_feedback"
ON public.host_feedback FOR DELETE
TO authenticated
USING (public.is_instructor());


-- ----------------------------------------------------------------------------
-- SECTION 4: HOST_SUPERVISORS TABLE ACCESS CONTROL
-- Fixes: Prevent unverified users from modifying HTE records
-- ----------------------------------------------------------------------------
ALTER TABLE public.host_supervisors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all host_supervisors" ON public.host_supervisors;
DROP POLICY IF EXISTS "Allow read host_supervisors" ON public.host_supervisors;
DROP POLICY IF EXISTS "Allow insert host_supervisors" ON public.host_supervisors;
DROP POLICY IF EXISTS "Allow update host_supervisors" ON public.host_supervisors;
DROP POLICY IF EXISTS "Allow delete host_supervisors" ON public.host_supervisors;

-- Instructors read all; Supervisors read own; Trainees read approved host companies
CREATE POLICY "Allow read host_supervisors"
ON public.host_supervisors FOR SELECT
TO authenticated, anon
USING (
  public.is_instructor()
  OR id = auth.uid()
  OR LOWER(email) = LOWER(auth.jwt() ->> 'email')
  OR is_approved = true
  OR active = true
);

-- Users can self-register their HTE account, or instructors can create
CREATE POLICY "Allow insert host_supervisors"
ON public.host_supervisors FOR INSERT
TO authenticated, anon
WITH CHECK (
  id = auth.uid()
  OR public.is_instructor()
  OR LOWER(email) = LOWER(auth.jwt() ->> 'email')
);

-- Only the supervisor themselves or instructors can update
CREATE POLICY "Allow update host_supervisors"
ON public.host_supervisors FOR UPDATE
TO authenticated
USING (
  id = auth.uid()
  OR LOWER(email) = LOWER(auth.jwt() ->> 'email')
  OR public.is_instructor()
);

-- Only instructors can delete supervisors
CREATE POLICY "Allow delete host_supervisors"
ON public.host_supervisors FOR DELETE
TO authenticated
USING (public.is_instructor());


-- ----------------------------------------------------------------------------
-- SECTION 5: EVALUATIONS TABLE ACCESS CONTROL
-- Fixes: Trainees can ONLY submit self-questionnaires; Supervisors/Instructors grade
-- ----------------------------------------------------------------------------
ALTER TABLE public.evaluations ADD COLUMN IF NOT EXISTS evaluated_by TEXT;
ALTER TABLE public.evaluations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read evaluations" ON public.evaluations;
DROP POLICY IF EXISTS "Allow insert evaluations" ON public.evaluations;
DROP POLICY IF EXISTS "Allow update evaluations" ON public.evaluations;
DROP POLICY IF EXISTS "Allow delete evaluations" ON public.evaluations;

-- Trainees view own evaluation; Instructors & HTE Supervisors view cohort records
CREATE POLICY "Allow read evaluations"
ON public.evaluations FOR SELECT
TO authenticated
USING (
  public.is_instructor()
  OR public.is_hte_supervisor()
  OR employee_id = auth.uid()
  OR public.is_own_employee_record(employee_id::text)
);

-- Trainees can ONLY insert their OWN self-evaluation; Instructors/HTE can insert evaluations
CREATE POLICY "Allow insert evaluations"
ON public.evaluations FOR INSERT
TO authenticated
WITH CHECK (
  public.is_instructor()
  OR public.is_hte_supervisor()
  OR (
    (employee_id = auth.uid() OR public.is_own_employee_record(employee_id::text))
    AND (evaluated_by IS NULL OR evaluated_by ILIKE '%trainee%' OR evaluated_by ILIKE '%self%')
  )
);

-- Trainees can ONLY update their own record; Instructors & Supervisors can update evaluations
CREATE POLICY "Allow update evaluations"
ON public.evaluations FOR UPDATE
TO authenticated
USING (
  public.is_instructor()
  OR public.is_hte_supervisor()
  OR (
    (employee_id = auth.uid() OR public.is_own_employee_record(employee_id::text))
    AND (evaluated_by IS NULL OR evaluated_by ILIKE '%trainee%' OR evaluated_by ILIKE '%self%')
  )
);

-- Only instructors can delete evaluation records
CREATE POLICY "Allow delete evaluations"
ON public.evaluations FOR DELETE
TO authenticated
USING (public.is_instructor());


-- ----------------------------------------------------------------------------
-- SECTION 6: GEOFENCE_ZONES DEDUPLICATION & SCHEMA STRENGTHENING
-- Fixes: Add employee_id, deduplicate multi-row zones, prevent duplicate creation
-- ----------------------------------------------------------------------------
ALTER TABLE public.geofence_zones ADD COLUMN IF NOT EXISTS employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE;
ALTER TABLE public.geofence_zones ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- Backfill employee_id: match directly by employee UUID or by employee name in zone name
UPDATE public.geofence_zones gz
SET employee_id = e.id
FROM public.employees e
WHERE gz.employee_id IS NULL
  AND (
    gz.id::text = e.id::text
    OR (
      e.name IS NOT NULL 
      AND LENGTH(TRIM(e.name)) > 4 
      AND gz.name ILIKE ('%' || TRIM(e.name) || '%')
    )
  );

-- Deduplicate geofence_zones: keep the newest record per employee_id, delete obsolete duplicates
DELETE FROM public.geofence_zones
WHERE id NOT IN (
  SELECT DISTINCT ON (COALESCE(employee_id::text, name)) id
  FROM public.geofence_zones
  ORDER BY COALESCE(employee_id::text, name), ctid DESC
);

-- Add unique constraint on employee_id (one zone per employee)
CREATE UNIQUE INDEX IF NOT EXISTS idx_geofence_zones_employee_id
ON public.geofence_zones(employee_id)
WHERE employee_id IS NOT NULL;

-- Enable RLS on geofence_zones
ALTER TABLE public.geofence_zones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read geofence_zones" ON public.geofence_zones;
DROP POLICY IF EXISTS "Allow manage geofence_zones" ON public.geofence_zones;

CREATE POLICY "Allow read geofence_zones"
ON public.geofence_zones FOR SELECT
TO authenticated, anon
USING (active = true OR public.is_instructor());

CREATE POLICY "Allow manage geofence_zones"
ON public.geofence_zones FOR ALL
TO authenticated
USING (
  public.is_instructor()
  OR public.is_hte_supervisor()
  OR (employee_id IS NOT NULL AND employee_id = auth.uid())
)
WITH CHECK (
  public.is_instructor()
  OR public.is_hte_supervisor()
  OR (employee_id IS NOT NULL AND employee_id = auth.uid())
);


-- ----------------------------------------------------------------------------
-- SECTION 7: AUDIT VIEW FOR OUT-OF-REGION COORDINATES
-- Target: Flag any coordinates located outside Negros Occidental
-- (Lat outside 9.0..11.2 or Lng outside 122.3..123.7)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.vw_out_of_region_trainees AS
SELECT 
  e.id,
  e.name,
  e.email,
  e.department,
  e.course,
  COALESCE((e.registration_location->>'lat')::double precision, e.registration_lat, gz.lat) AS lat,
  COALESCE((e.registration_location->>'lng')::double precision, e.registration_lng, gz.lng) AS lng,
  e.registration_address,
  e.company_name
FROM public.employees e
LEFT JOIN public.geofence_zones gz ON gz.employee_id = e.id
WHERE (
  COALESCE((e.registration_location->>'lat')::double precision, e.registration_lat, gz.lat) IS NOT NULL
  AND (
    COALESCE((e.registration_location->>'lat')::double precision, e.registration_lat, gz.lat) NOT BETWEEN 9.0 AND 11.2
    OR COALESCE((e.registration_location->>'lng')::double precision, e.registration_lng, gz.lng) NOT BETWEEN 122.3 AND 123.7
  )
)
AND (e.position IS NULL OR (e.position NOT ILIKE '%instructor%' AND e.position NOT ILIKE '%admin%'));
