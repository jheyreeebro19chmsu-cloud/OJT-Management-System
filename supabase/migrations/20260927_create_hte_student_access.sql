-- Migration: Create and configure hte_student_access table
-- Run this in your Supabase Project (SQL Editor) to resolve 404 on /rest/v1/hte_student_access

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

-- Enable RLS
ALTER TABLE public.hte_student_access ENABLE ROW LEVEL SECURITY;

-- Permissive policies for authenticated users and instructors
DROP POLICY IF EXISTS "Enable read for all" ON public.hte_student_access;
CREATE POLICY "Enable read for all" ON public.hte_student_access FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable insert for all" ON public.hte_student_access;
CREATE POLICY "Enable insert for all" ON public.hte_student_access FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Enable update for all" ON public.hte_student_access;
CREATE POLICY "Enable update for all" ON public.hte_student_access FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Enable delete for all" ON public.hte_student_access;
CREATE POLICY "Enable delete for all" ON public.hte_student_access FOR DELETE USING (true);

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
