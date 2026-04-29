-- Add approval status to host supervisors
ALTER TABLE host_supervisors 
ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES employees(id);

-- Create HTE Student Access table
CREATE TABLE IF NOT EXISTS hte_student_access (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  hte_id UUID REFERENCES host_supervisors(id) ON DELETE CASCADE,
  student_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  approved_at TIMESTAMP WITH TIME ZONE,
  
  UNIQUE(hte_id, student_id)
);

-- RLS Policies
ALTER TABLE hte_student_access ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read for all" ON hte_student_access FOR SELECT USING (true);
CREATE POLICY "Enable insert for HTE" ON hte_student_access FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Enable update for Admin" ON hte_student_access FOR UPDATE USING (true);
