-- Student Attendance System - Simple Schema
-- Tables: std_students, std_attendance (2 tables only)

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Students (นักเรียน + Face Embeddings + จุดบริการ)
CREATE TABLE IF NOT EXISTS std_students (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Student Info
  name TEXT NOT NULL,
  nickname TEXT,
  service_point TEXT, -- ชื่อจุดบริการ (เก็บเป็น text ไม่ต้อง FK)

  -- Face Recognition (เก็บ embeddings สูงสุด 20 อัน)
  face_embeddings JSONB DEFAULT '[]'::jsonb,

  -- Metadata
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Attendance (การเช็คชื่อเข้า-ออก)
CREATE TABLE IF NOT EXISTS std_attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID REFERENCES std_students(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,

  -- Teacher Info (เก็บเป็น text ง่ายๆ)
  teacher_name TEXT,

  -- Check In
  check_in TIMESTAMPTZ,
  confidence_in FLOAT, -- 0.0 - 1.0
  method_in TEXT, -- 'auto', 'manual', 'suggestion'

  -- Check Out
  check_out TIMESTAMPTZ,
  confidence_out FLOAT,
  method_out TEXT,

  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- One record per student per day
  UNIQUE(student_id, date)
);

-- Indexes สำหรับ performance
CREATE INDEX IF NOT EXISTS idx_std_students_active ON std_students(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_std_students_service_point ON std_students(service_point);
CREATE INDEX IF NOT EXISTS idx_std_attendance_student_date ON std_attendance(student_id, date);
CREATE INDEX IF NOT EXISTS idx_std_attendance_date ON std_attendance(date);

-- Enable Row Level Security
ALTER TABLE std_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE std_attendance ENABLE ROW LEVEL SECURITY;

-- RLS Policies (อนุญาตทุกคน - เพราะเป็นระบบภายใน)
CREATE POLICY "Allow all on std_students" ON std_students FOR ALL USING (TRUE);
CREATE POLICY "Allow all on std_attendance" ON std_attendance FOR ALL USING (TRUE);

-- Function: Rolling Update Embeddings (เก็บแค่ 20 ล่าสุด)
CREATE OR REPLACE FUNCTION std_add_embedding(
  p_student_id UUID,
  p_embedding JSONB
)
RETURNS VOID AS $$
DECLARE
  v_embeddings JSONB;
BEGIN
  -- ดึง embeddings ปัจจุบัน
  SELECT face_embeddings INTO v_embeddings
  FROM std_students
  WHERE id = p_student_id;

  -- เพิ่ม embedding ใหม่
  v_embeddings := v_embeddings || jsonb_build_array(p_embedding);

  -- ถ้าเกิน 20 ตัว ให้ตัดตัวเก่าสุดทิ้ง
  WHILE jsonb_array_length(v_embeddings) > 20 LOOP
    v_embeddings := v_embeddings - 0;
  END LOOP;

  -- Update กลับเข้าตาราง
  UPDATE std_students
  SET face_embeddings = v_embeddings,
      updated_at = NOW()
  WHERE id = p_student_id;
END;
$$ LANGUAGE plpgsql;

-- Function: Auto-update updated_at
CREATE OR REPLACE FUNCTION std_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers
CREATE TRIGGER std_students_set_updated_at
  BEFORE UPDATE ON std_students
  FOR EACH ROW
  EXECUTE FUNCTION std_set_updated_at();

CREATE TRIGGER std_attendance_set_updated_at
  BEFORE UPDATE ON std_attendance
  FOR EACH ROW
  EXECUTE FUNCTION std_set_updated_at();

-- Sample Data
INSERT INTO std_students (name, nickname, service_point) VALUES
  ('ทดสอบ นักเรียน', 'ทดสอบ', 'ศูนย์การศึกษาพิเศษ เขต 6 ลพบุรี')
ON CONFLICT DO NOTHING;

-- Success
DO $$
BEGIN
  RAISE NOTICE '✅ Migration Complete!';
  RAISE NOTICE '📊 Created 2 tables:';
  RAISE NOTICE '   - std_students (นักเรียน + face embeddings)';
  RAISE NOTICE '   - std_attendance (การเช็คชื่อ)';
  RAISE NOTICE '🔧 Created functions:';
  RAISE NOTICE '   - std_add_embedding() (rolling update)';
  RAISE NOTICE '   - std_set_updated_at() (auto timestamp)';
END $$;
