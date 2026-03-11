-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Service Points Table
CREATE TABLE service_points (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  location TEXT,
  is_main_center BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Teachers Table
CREATE TABLE teachers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  phone TEXT,
  service_point_id UUID REFERENCES service_points(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Students Table
CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  nickname TEXT,
  date_of_birth DATE,
  service_point_id UUID REFERENCES service_points(id) ON DELETE SET NULL,
  embeddings JSONB DEFAULT '[]'::jsonb,
  photo_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  CONSTRAINT embeddings_max_length CHECK (jsonb_array_length(embeddings) <= 20)
);

-- Attendance Table
CREATE TABLE attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  teacher_id UUID REFERENCES teachers(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  check_in TIMESTAMP WITH TIME ZONE,
  check_out TIMESTAMP WITH TIME ZONE,
  confidence_in FLOAT,
  confidence_out FLOAT,
  method_in TEXT CHECK (method_in IN ('auto', 'manual', 'suggestion')),
  method_out TEXT CHECK (method_out IN ('auto', 'manual', 'suggestion')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  UNIQUE(student_id, date)
);

-- Create indexes for better performance
CREATE INDEX idx_teachers_service_point ON teachers(service_point_id);
CREATE INDEX idx_students_service_point ON students(service_point_id);
CREATE INDEX idx_students_active ON students(is_active);
CREATE INDEX idx_attendance_student ON attendance(student_id);
CREATE INDEX idx_attendance_teacher ON attendance(teacher_id);
CREATE INDEX idx_attendance_date ON attendance(date);
CREATE INDEX idx_attendance_student_date ON attendance(student_id, date);

-- Enable Row Level Security
ALTER TABLE service_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

-- RLS Policies (Allow all for now - can be customized based on auth)
CREATE POLICY "Allow all on service_points" ON service_points FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on teachers" ON teachers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on students" ON students FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on attendance" ON attendance FOR ALL USING (true) WITH CHECK (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc', NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_service_points_updated_at BEFORE UPDATE ON service_points
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_teachers_updated_at BEFORE UPDATE ON teachers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_students_updated_at BEFORE UPDATE ON students
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_attendance_updated_at BEFORE UPDATE ON attendance
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to add embedding and maintain max 20 limit (rolling update)
CREATE OR REPLACE FUNCTION add_student_embedding(
  student_uuid UUID,
  new_embedding JSONB
)
RETURNS VOID AS $$
DECLARE
  current_embeddings JSONB;
  new_embeddings JSONB;
BEGIN
  -- Get current embeddings
  SELECT embeddings INTO current_embeddings
  FROM students
  WHERE id = student_uuid;

  -- Add new embedding to the end
  new_embeddings := current_embeddings || jsonb_build_array(new_embedding);

  -- If more than 20, remove the oldest (first) one
  IF jsonb_array_length(new_embeddings) > 20 THEN
    new_embeddings := new_embeddings - 0;
  END IF;

  -- Update the student record
  UPDATE students
  SET embeddings = new_embeddings
  WHERE id = student_uuid;
END;
$$ LANGUAGE plpgsql;

-- Sample data (optional - for testing)
-- INSERT INTO service_points (name, location, is_main_center) VALUES
--   ('ศูนย์การศึกษาพิเศษ เขต 6 ลพบุรี', 'ลพบุรี', TRUE),
--   ('หน่วยบริการ 1', 'โคกสำโรง', FALSE),
--   ('หน่วยบริการ 2', 'ท่าวุ้ง', FALSE);
