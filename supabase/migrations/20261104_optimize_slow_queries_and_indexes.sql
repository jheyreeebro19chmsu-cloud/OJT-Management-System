-- Migration: Optimize Database Performance, Eliminate Slow Queries, and Save Disk IO
-- Execute this script directly in Supabase Dashboard -> SQL Editor

DO $$
BEGIN
    -- 1. Employees Indexing (Fast login & OAuth user lookup)
    IF EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'email') THEN
        CREATE INDEX IF NOT EXISTS idx_employees_email_lower ON public.employees (LOWER(TRIM(email)));
    END IF;
    IF EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'employee_id') THEN
        CREATE INDEX IF NOT EXISTS idx_employees_employee_id ON public.employees (employee_id);
    END IF;
    IF EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'active') THEN
        CREATE INDEX IF NOT EXISTS idx_employees_active ON public.employees (active);
    END IF;
    IF EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'created_at') THEN
        CREATE INDEX IF NOT EXISTS idx_employees_created_at ON public.employees (created_at DESC);
    END IF;

    -- 2. Time Records Indexing (Eliminates the 4.5s - 7.2s table scan warning)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'time_records') THEN
        CREATE INDEX IF NOT EXISTS idx_time_records_emp_date ON public.time_records (employee_id, date DESC);
        CREATE INDEX IF NOT EXISTS idx_time_records_date ON public.time_records (date DESC);
        CREATE INDEX IF NOT EXISTS idx_time_records_status ON public.time_records (status);
    END IF;

    -- 3. Geofence Zones Indexing
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'geofence_zones') THEN
        CREATE INDEX IF NOT EXISTS idx_geofence_zones_active ON public.geofence_zones (active);
    END IF;

    -- 4. Announcements Indexing
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'announcements') THEN
        CREATE INDEX IF NOT EXISTS idx_announcements_pinned_created ON public.announcements (is_pinned DESC, created_at DESC);
    END IF;

    -- 5. Host Supervisors Indexing
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'host_supervisors') THEN
        CREATE INDEX IF NOT EXISTS idx_host_supervisors_email_lower ON public.host_supervisors (LOWER(TRIM(email)));
        CREATE INDEX IF NOT EXISTS idx_host_supervisors_active ON public.host_supervisors (active);
    END IF;

    -- 6. Evaluations Indexing
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'evaluations') THEN
        CREATE INDEX IF NOT EXISTS idx_evaluations_employee_id ON public.evaluations (employee_id);
    END IF;
END $$;

-- 7. Reset historical query statistics to clear the old slow queries
SELECT pg_stat_statements_reset();

-- 8. Mitigate the #1 slow query (SELECT wal->...) by removing heavy write tables from Realtime WAL
ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS public.time_records;
ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS public.documents;

-- 9. Refresh Postgres Query Planner Statistics
ANALYZE public.employees;
ANALYZE public.time_records;
ANALYZE public.geofence_zones;
ANALYZE public.announcements;
ANALYZE public.host_supervisors;
