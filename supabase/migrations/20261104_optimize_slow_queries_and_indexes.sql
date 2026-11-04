-- Migration: Optimize Database Performance, Eliminate Slow Queries, and Save Disk IO
-- Execute this script directly in Supabase Dashboard -> SQL Editor

-- 1. Employees Indexing (Fast login, OAuth lookup, and trainee lists)
CREATE INDEX IF NOT EXISTS idx_employees_email_lower ON public.employees (LOWER(TRIM(email)));
CREATE INDEX IF NOT EXISTS idx_employees_employee_id ON public.employees (employee_id);
CREATE INDEX IF NOT EXISTS idx_employees_role ON public.employees (role);
CREATE INDEX IF NOT EXISTS idx_employees_active ON public.employees (active);
CREATE INDEX IF NOT EXISTS idx_employees_created_at ON public.employees (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_employees_instructor_id ON public.employees (instructor_id);

-- 2. Time Records Indexing (Eliminates the 4.5s - 7.2s table scan warning)
CREATE INDEX IF NOT EXISTS idx_time_records_emp_date ON public.time_records (employee_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_time_records_date ON public.time_records (date DESC);
CREATE INDEX IF NOT EXISTS idx_time_records_status ON public.time_records (status);

-- 3. Geofence Zones Indexing (Resolves geofence slow queries shown in Index Advisor)
CREATE INDEX IF NOT EXISTS idx_geofence_zones_active ON public.geofence_zones (active);
CREATE INDEX IF NOT EXISTS idx_geofence_zones_created_at ON public.geofence_zones (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_geofence_zones_employee_id ON public.geofence_zones (employee_id);

-- 4. Announcements Indexing (Fast retrieval sorted by pinned and created_at)
CREATE INDEX IF NOT EXISTS idx_announcements_pinned_created ON public.announcements (is_pinned DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_announcements_created_at ON public.announcements (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_announcements_author_id ON public.announcements (author_id);

-- 5. Host Supervisors Indexing
CREATE INDEX IF NOT EXISTS idx_host_supervisors_email_lower ON public.host_supervisors (LOWER(TRIM(email)));
CREATE INDEX IF NOT EXISTS idx_host_supervisors_employee_id ON public.host_supervisors (employee_id);
CREATE INDEX IF NOT EXISTS idx_host_supervisors_active ON public.host_supervisors (active);

-- 6. Evaluations Indexing
CREATE INDEX IF NOT EXISTS idx_evaluations_employee_id ON public.evaluations (employee_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_evaluator_role ON public.evaluations (evaluator_role);

-- 7. Document Submissions & Audit Logs Indexing (if tables exist)
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'announcement_comments') THEN
        CREATE INDEX IF NOT EXISTS idx_announcement_comments_announcement_id ON public.announcement_comments (announcement_id, created_at ASC);
    END IF;
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'announcement_submissions') THEN
        CREATE INDEX IF NOT EXISTS idx_announcement_submissions_announcement_id ON public.announcement_submissions (announcement_id, student_id);
    END IF;
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'documents') THEN
        CREATE INDEX IF NOT EXISTS idx_documents_employee_id ON public.documents (employee_id);
    END IF;
END $$;

-- 8. Re-compute table statistics so the Postgres Query Planner immediately uses the new indexes
ANALYZE public.employees;
ANALYZE public.time_records;
ANALYZE public.geofence_zones;
ANALYZE public.announcements;
ANALYZE public.host_supervisors;
ANALYZE public.evaluations;
