-- ⚠️  IMPORTANT: Tables with std_ prefix for Student Attendance System
-- DO NOT modify production tables (profiles, departments, notifications, etc.)

-- Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Service Points (ศูนย์/จุดบริการ)
CREATE TABLE IF NOT EXISTS std_service_points (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  location TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- 2. Students (นักเรียน + Face Embeddings)
CREATE TABLE IF NOT EXISTS std_students (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  nickname TEXT,
  date_of_birth DATE,
  service_point_id UUID REFERENCES std_service_points(id) ON DELETE SET NULL,

  -- Face Recognition Data (store up to 20 embeddings)
  face_embeddings JSONB DEFAULT '[]'::jsonb,

  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),

  -- Limit embeddings to max 20
  CONSTRAINT max_20_embeddings CHECK (jsonb_array_length(face_embeddings) <= 20)
);

-- 3. Attendance (การเช็คชื่อเข้า/ออก)
CREATE TABLE IF NOT EXISTS std_attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID REFERENCES std_students(id) ON DELETE CASCADE,
  teacher_id UUID REFERENCES profiles(id) ON DELETE SET NULL, -- Use existing profiles table
  date DATE NOT NULL,

  -- Check In
  check_in TIMESTAMP WITH TIME ZONE,
  confidence_in FLOAT, -- Face recognition confidence (0-1)
  method_in TEXT CHECK (method_in IN ('auto', 'manual', 'suggestion')),

  -- Check Out
  check_out TIMESTAMP WITH TIME ZONE,
  confidence_out FLOAT,
  method_out TEXT CHECK (method_out IN ('auto', 'manual', 'suggestion')),

  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),

  -- One attendance record per student per day
  UNIQUE(student_id, date)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_std_students_service_point ON std_students(service_point_id);
CREATE INDEX IF NOT EXISTS idx_std_students_active ON std_students(is_active);
CREATE INDEX IF NOT EXISTS idx_std_attendance_student ON std_attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_std_attendance_teacher ON std_attendance(teacher_id);
CREATE INDEX IF NOT EXISTS idx_std_attendance_date ON std_attendance(date);
CREATE INDEX IF NOT EXISTS idx_std_attendance_student_date ON std_attendance(student_id, date);

-- Enable Row Level Security
ALTER TABLE std_service_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE std_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE std_attendance ENABLE ROW LEVEL SECURITY;

-- RLS Policies (Allow all for now)
DROP POLICY IF EXISTS "Allow all on std_service_points" ON std_service_points;
CREATE POLICY "Allow all on std_service_points" ON std_service_points FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on std_students" ON std_students;
CREATE POLICY "Allow all on std_students" ON std_students FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on std_attendance" ON std_attendance;
CREATE POLICY "Allow all on std_attendance" ON std_attendance FOR ALL USING (true) WITH CHECK (true);

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION std_update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc', NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers
DROP TRIGGER IF EXISTS std_service_points_updated_at ON std_service_points;
CREATE TRIGGER std_service_points_updated_at
  BEFORE UPDATE ON std_service_points
  FOR EACH ROW EXECUTE FUNCTION std_update_updated_at();

DROP TRIGGER IF EXISTS std_students_updated_at ON std_students;
CREATE TRIGGER std_students_updated_at
  BEFORE UPDATE ON std_students
  FOR EACH ROW EXECUTE FUNCTION std_update_updated_at();

DROP TRIGGER IF EXISTS std_attendance_updated_at ON std_attendance;
CREATE TRIGGER std_attendance_updated_at
  BEFORE UPDATE ON std_attendance
  FOR EACH ROW EXECUTE FUNCTION std_update_updated_at();

-- Helper function: Add face embedding (rolling update - keep last 20)
CREATE OR REPLACE FUNCTION std_add_face_embedding(
  student_uuid UUID,
  new_embedding JSONB
)
RETURNS VOID AS $$
DECLARE
  current_embeddings JSONB;
  new_embeddings JSONB;
BEGIN
  SELECT face_embeddings INTO current_embeddings
  FROM std_students
  WHERE id = student_uuid;

  -- Add new embedding
  new_embeddings := current_embeddings || jsonb_build_array(new_embedding);

  -- Keep only last 20
  IF jsonb_array_length(new_embeddings) > 20 THEN
    new_embeddings := new_embeddings - 0; -- Remove first (oldest)
  END IF;

  UPDATE std_students
  SET face_embeddings = new_embeddings
  WHERE id = student_uuid;
END;
$$ LANGUAGE plpgsql;

-- Sample data
INSERT INTO std_service_points (name, location, is_active) VALUES
  ('ศูนย์การศึกษาพิเศษ เขต 6 ลพบุรี', 'ลพบุรี', TRUE)
ON CONFLICT DO NOTHING;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Migration complete! Created 3 tables: std_service_points, std_students, std_attendance';
  RAISE NOTICE '⚠️  Using existing profiles table for teachers';
END $$;
