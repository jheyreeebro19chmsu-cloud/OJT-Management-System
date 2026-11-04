-- Migration: Optimize Database Performance, Eliminate Slow Queries, and Save Disk IO
-- Run this in Supabase Dashboard -> SQL Editor

SELECT pg_stat_statements_reset();

CREATE INDEX IF NOT EXISTS idx_employees_email ON public.employees (email);
CREATE INDEX IF NOT EXISTS idx_employees_employee_id ON public.employees (employee_id);
CREATE INDEX IF NOT EXISTS idx_employees_active ON public.employees (active);
CREATE INDEX IF NOT EXISTS idx_employees_created_at ON public.employees (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_time_records_emp_date ON public.time_records (employee_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_time_records_date ON public.time_records (date DESC);
CREATE INDEX IF NOT EXISTS idx_time_records_status ON public.time_records (status);

CREATE INDEX IF NOT EXISTS idx_geofence_zones_active ON public.geofence_zones (active);
CREATE INDEX IF NOT EXISTS idx_announcements_pinned_created ON public.announcements (is_pinned DESC, created_at DESC);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'time_records'
    ) THEN
        ALTER PUBLICATION supabase_realtime DROP TABLE public.time_records;
    END IF;
END $$;

ANALYZE public.employees;
ANALYZE public.time_records;
ANALYZE public.geofence_zones;
ANALYZE public.announcements;
