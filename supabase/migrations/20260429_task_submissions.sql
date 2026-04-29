-- 1. Create the Task Submissions Storage Bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('task-submissions', 'task-submissions', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Set up Storage Policies for Task Submissions
-- Allow anyone to view (Public)
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'task-submissions');

-- Allow authenticated users to upload
CREATE POLICY "Authenticated Upload" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'task-submissions' AND auth.role() = 'authenticated'
);

-- 3. Update Employees Table with new OJT Application fields
ALTER TABLE employees 
ADD COLUMN IF NOT EXISTS application_status TEXT DEFAULT 'unregistered' CHECK (application_status IN ('unregistered', 'pending', 'approved', 'rejected')),
ADD COLUMN IF NOT EXISTS year_section TEXT,
ADD COLUMN IF NOT EXISTS instructor_id UUID REFERENCES employees(id),
ADD COLUMN IF NOT EXISTS registration_location JSONB,
ADD COLUMN IF NOT EXISTS registration_address TEXT;

-- 4. Create Announcement Submissions Table (for Tasks)
CREATE TABLE IF NOT EXISTS announcement_submissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  announcement_id UUID REFERENCES announcements(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  message TEXT,
  photo TEXT,
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Enable RLS and Policies for Submissions
ALTER TABLE announcement_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read for all" ON announcement_submissions FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated" ON announcement_submissions FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 6. Add instructor_id index for performance
CREATE INDEX IF NOT EXISTS idx_employees_instructor ON employees(instructor_id);
