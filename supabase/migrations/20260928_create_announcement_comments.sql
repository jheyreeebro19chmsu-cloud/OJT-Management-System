-- ============================================================================
-- Migration: Create announcement_comments table and RLS policies
-- ============================================================================
-- Run in Supabase SQL Editor to enable cloud announcement comments
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.announcement_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id TEXT NOT NULL,
  employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  author_id TEXT,
  author_name TEXT NOT NULL DEFAULT 'User',
  author_role TEXT NOT NULL DEFAULT 'employee',
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_announcement_comments_announcement_id 
ON public.announcement_comments(announcement_id);

CREATE INDEX IF NOT EXISTS idx_announcement_comments_created_at 
ON public.announcement_comments(created_at ASC);

-- Enable Row Level Security (RLS)
ALTER TABLE public.announcement_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read announcement_comments" ON public.announcement_comments;
CREATE POLICY "Allow read announcement_comments"
ON public.announcement_comments FOR SELECT
TO authenticated, anon, public
USING (true);

DROP POLICY IF EXISTS "Allow insert announcement_comments" ON public.announcement_comments;
CREATE POLICY "Allow insert announcement_comments"
ON public.announcement_comments FOR INSERT
TO authenticated, anon, public
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow update announcement_comments" ON public.announcement_comments;
CREATE POLICY "Allow update announcement_comments"
ON public.announcement_comments FOR UPDATE
TO authenticated, anon, public
USING (true);

DROP POLICY IF EXISTS "Allow delete announcement_comments" ON public.announcement_comments;
CREATE POLICY "Allow delete announcement_comments"
ON public.announcement_comments FOR DELETE
TO authenticated, anon, public
USING (true);
