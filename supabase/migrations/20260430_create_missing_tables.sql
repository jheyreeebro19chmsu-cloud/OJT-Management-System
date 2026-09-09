-- Migration: Create announcement_comments and hte_student_access tables
-- Execute this script in Supabase Dashboard -> SQL Editor

-- 1. Ensure host_supervisors has approval columns
ALTER TABLE public.host_supervisors 
ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.employees(id);

-- 2. Create hte_student_access table
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
DROP POLICY IF EXISTS "Enable read for all" ON public.hte_student_access;
CREATE POLICY "Enable read for all" ON public.hte_student_access FOR SELECT USING (true);
DROP POLICY IF EXISTS "Enable insert for all" ON public.hte_student_access;
CREATE POLICY "Enable insert for all" ON public.hte_student_access FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Enable update for all" ON public.hte_student_access;
CREATE POLICY "Enable update for all" ON public.hte_student_access FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Enable delete for all" ON public.hte_student_access;
CREATE POLICY "Enable delete for all" ON public.hte_student_access FOR DELETE USING (true);

-- 3. Create announcement_comments table
CREATE TABLE IF NOT EXISTS public.announcement_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  announcement_id TEXT NOT NULL,
  employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  author_name TEXT NOT NULL DEFAULT 'User',
  author_role TEXT NOT NULL DEFAULT 'employee',
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.announcement_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read for all announcement_comments" ON public.announcement_comments;
CREATE POLICY "Enable read for all announcement_comments" ON public.announcement_comments FOR SELECT USING (true);
DROP POLICY IF EXISTS "Enable insert for all announcement_comments" ON public.announcement_comments;
CREATE POLICY "Enable insert for all announcement_comments" ON public.announcement_comments FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Enable update for all announcement_comments" ON public.announcement_comments;
CREATE POLICY "Enable update for all announcement_comments" ON public.announcement_comments FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Enable delete for all announcement_comments" ON public.announcement_comments;
CREATE POLICY "Enable delete for all announcement_comments" ON public.announcement_comments FOR DELETE USING (true);
