# Supabase Setup Guide for OJT DTR System

This guide will help you set up your Supabase database for the OJT Daily Time Record System.

## Prerequisites

1. Create a Supabase account at [https://supabase.com](https://supabase.com)
2. Create a new project in Supabase
3. Get your project URL and anon key from the project settings

## Environment Variables

Create a `.env` file in the root of your project with the following variables:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Replace `your_supabase_project_url` and `your_supabase_anon_key` with your actual Supabase credentials.

## Database Schema

Run the following SQL commands in your Supabase SQL Editor to create the necessary tables:

### 1. Employees Table

```sql
CREATE TABLE employees (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  employee_id TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  department TEXT NOT NULL,
  position TEXT NOT NULL,
  company_name TEXT NOT NULL,
  supervisor_name TEXT NOT NULL,
  school_name TEXT NOT NULL,
  course TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  required_hours INTEGER NOT NULL,
  photo TEXT,
  face_registered BOOLEAN DEFAULT FALSE,
  active BOOLEAN DEFAULT TRUE,
  registration_lat DOUBLE PRECISION,
  registration_lng DOUBLE PRECISION,
  registration_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_employees_email ON employees(email);
CREATE INDEX idx_employees_employee_id ON employees(employee_id);
CREATE INDEX idx_employees_active ON employees(active);
```

### 2. Time Records Table

```sql
CREATE TABLE time_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  time_in TIME,
  time_out TIME,
  time_in_lat DOUBLE PRECISION,
  time_in_lng DOUBLE PRECISION,
  time_out_lat DOUBLE PRECISION,
  time_out_lng DOUBLE PRECISION,
  time_in_geofenced BOOLEAN DEFAULT FALSE,
  time_out_geofenced BOOLEAN DEFAULT FALSE,
  time_in_face_verified BOOLEAN DEFAULT FALSE,
  time_out_face_verified BOOLEAN DEFAULT FALSE,
  time_in_photo TEXT,
  time_out_photo TEXT,
  total_hours DOUBLE PRECISION,
  status TEXT CHECK (status IN ('present', 'late', 'absent', 'half-day', 'overtime')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_time_records_employee_id ON time_records(employee_id);
CREATE INDEX idx_time_records_date ON time_records(date);
CREATE UNIQUE INDEX idx_time_records_employee_date ON time_records(employee_id, date);
```

### 3. Geofence Zones Table

```sql
CREATE TABLE geofence_zones (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  radius INTEGER NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_geofence_zones_active ON geofence_zones(active);
```

### 4. App Settings Table

```sql
CREATE TABLE app_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  work_start_time TIME NOT NULL DEFAULT '08:00',
  work_end_time TIME NOT NULL DEFAULT '17:00',
  late_threshold_minutes INTEGER NOT NULL DEFAULT 15,
  geofence_enabled BOOLEAN DEFAULT TRUE,
  facial_recognition_enabled BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT single_row CHECK (id = 1)
);

-- Insert default settings
INSERT INTO app_settings (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;
```

### 5. Evaluations Table

```sql
CREATE TABLE evaluations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  evaluated_by TEXT NOT NULL,
  attendance_score INTEGER CHECK (attendance_score >= 0 AND attendance_score <= 100),
  performance_score INTEGER CHECK (performance_score >= 0 AND performance_score <= 100),
  attitude_score INTEGER CHECK (attitude_score >= 0 AND attitude_score <= 100),
  punctuality_score INTEGER CHECK (punctuality_score >= 0 AND punctuality_score <= 100),
  communication_score INTEGER CHECK (communication_score >= 0 AND communication_score <= 100),
  overall_score DOUBLE PRECISION,
  grade TEXT CHECK (grade IN ('Excellent', 'Very Good', 'Good', 'Satisfactory', 'Needs Improvement')),
  strengths TEXT,
  areas_for_improvement TEXT,
  recommendations TEXT,
  evaluated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT CHECK (status IN ('draft', 'final')) DEFAULT 'draft'
);

-- Create indexes
CREATE INDEX idx_evaluations_employee_id ON evaluations(employee_id);
CREATE INDEX idx_evaluations_status ON evaluations(status);
```

### 6. Announcements Table

```sql
CREATE TABLE announcements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  type TEXT CHECK (type IN ('info', 'warning', 'success', 'urgent')) DEFAULT 'info',
  target_role TEXT CHECK (target_role IN ('all', 'employee', 'admin')) DEFAULT 'all',
  is_pinned BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  created_by TEXT NOT NULL
);

-- Create indexes
CREATE INDEX idx_announcements_target_role ON announcements(target_role);
CREATE INDEX idx_announcements_created_at ON announcements(created_at);
CREATE INDEX idx_announcements_is_pinned ON announcements(is_pinned);
```

## Row Level Security (RLS)

Enable Row Level Security for all tables:

```sql
-- Enable RLS
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE geofence_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (you can customize these based on your needs)
-- For now, we'll allow all operations for development

-- Employees
CREATE POLICY "Enable read access for all users" ON employees FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON employees FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON employees FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON employees FOR DELETE USING (true);

-- Time Records
CREATE POLICY "Enable read access for all users" ON time_records FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON time_records FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON time_records FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON time_records FOR DELETE USING (true);

-- Geofence Zones
CREATE POLICY "Enable read access for all users" ON geofence_zones FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON geofence_zones FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON geofence_zones FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON geofence_zones FOR DELETE USING (true);

-- App Settings
CREATE POLICY "Enable read access for all users" ON app_settings FOR SELECT USING (true);
CREATE POLICY "Enable update for all users" ON app_settings FOR UPDATE USING (true);

-- Evaluations
CREATE POLICY "Enable read access for all users" ON evaluations FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON evaluations FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON evaluations FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON evaluations FOR DELETE USING (true);

-- Announcements
CREATE POLICY "Enable read access for all users" ON announcements FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON announcements FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON announcements FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON announcements FOR DELETE USING (true);
```

## Optional: Seed Data

You can insert sample data to test your setup:

```sql
-- Insert sample geofence zone
INSERT INTO geofence_zones (name, address, lat, lng, radius, active)
VALUES (
  'Main Training Center',
  'Ayala Avenue, Makati City, Metro Manila',
  14.5547,
  121.0244,
  300,
  true
);

-- Insert sample employee
INSERT INTO employees (
  name, employee_id, email, department, position, company_name,
  supervisor_name, school_name, course, start_date, end_date,
  required_hours, face_registered, active, registration_lat,
  registration_lng, registration_address
)
VALUES (
  'Juan Dela Cruz',
  'OJT-2024-001',
  'juan.delacruz@email.com',
  'Information Technology',
  'OJT Trainee',
  'TechCorp Philippines',
  'Mr. Roberto Santos',
  'Polytechnic University of the Philippines',
  'Bachelor of Science in Information Technology',
  '2024-01-15',
  '2024-04-15',
  486,
  true,
  true,
  14.5547,
  121.0244,
  'Ayala Avenue, Makati City'
);

-- Insert sample announcement
INSERT INTO announcements (title, content, type, target_role, is_pinned, created_by)
VALUES (
  'Welcome to OJT DTR System!',
  'Welcome to the On-the-Job Training Daily Time Record system. Please make sure to clock in and out every working day using facial recognition and location verification.',
  'success',
  'all',
  true,
  'Administrator'
);
```

## Storage Setup (for Face Photos)

If you want to store face photos in Supabase Storage:

1. Go to Storage in your Supabase dashboard
2. Create a new bucket called `face-photos`
3. Set the bucket to public or configure appropriate access policies
4. Update the photo URLs in your code to use Supabase Storage URLs

Example code for uploading to Supabase Storage:

```typescript
import { supabase } from './lib/supabase';

async function uploadFacePhoto(file: File, employeeId: string): Promise<string | null> {
  const fileExt = file.name.split('.').pop();
  const fileName = `${employeeId}-${Date.now()}.${fileExt}`;
  const filePath = `face-photos/${fileName}`;

  const { data, error } = await supabase.storage
    .from('face-photos')
    .upload(filePath, file);

  if (error) {
    console.error('Error uploading photo:', error);
    return null;
  }

  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from('face-photos')
    .getPublicUrl(filePath);

  return publicUrl;
}
```

## Testing the Connection

Once you've set up everything:

1. Add your environment variables to `.env`
2. Restart your development server
3. The app will automatically detect Supabase configuration
4. All data operations will be synced to Supabase
5. Data will be accessible across multiple devices

## Migration from localStorage

If you have existing data in localStorage that you want to migrate to Supabase:

1. The app will continue using localStorage if Supabase is not configured
2. Once configured, new data will be stored in Supabase
3. You can manually copy data from localStorage to Supabase using the browser console
4. Or use the Supabase dashboard to import data

## Troubleshooting

- **Connection Issues**: Check that your environment variables are correct
- **CORS Errors**: Ensure your domain is added to the allowed origins in Supabase settings
- **RLS Issues**: If you see permission errors, check your RLS policies
- **Empty Data**: The app will use mock data if Supabase returns empty results

## Security Considerations

⚠️ **Important**: The current RLS policies allow public access for development. In production:

1. Implement proper authentication using Supabase Auth
2. Create role-based policies (OJT Instructor vs employee)
3. Restrict write operations based on user roles
4. Enable API key restrictions
5. Use environment-specific configurations
