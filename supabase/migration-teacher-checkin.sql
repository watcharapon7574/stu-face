-- ⚠️  Teacher Check-in System: Face enrollment + attendance for teachers
-- Depends on: migration-std.sql (std_update_updated_at function, std_service_points table)
-- Uses existing profiles table for teacher reference

-- 1. Teacher Faces (ข้อมูลใบหน้าครู)
CREATE TABLE IF NOT EXISTS std_teacher_faces (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  teacher_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  face_embeddings JSONB DEFAULT '[]'::jsonb,  -- array of 512-dim vectors (from DeepFace Facenet512)
  device_fingerprint TEXT,                     -- SHA-256 hash of device properties
  enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),

  UNIQUE(teacher_id),
  CONSTRAINT max_10_teacher_embeddings CHECK (jsonb_array_length(face_embeddings) <= 10)
);

-- 2. Teacher Attendance (การลงเวลาเข้า-ออกงานครู)
CREATE TABLE IF NOT EXISTS std_teacher_attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  teacher_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,

  -- Check In
  check_in TIMESTAMP WITH TIME ZONE,
  confidence_in FLOAT,           -- face match confidence (0-1)
  anti_spoof_score_in FLOAT,     -- anti-spoofing score from DeepFace

  -- Check Out
  check_out TIMESTAMP WITH TIME ZONE,
  confidence_out FLOAT,
  anti_spoof_score_out FLOAT,

  device_fingerprint TEXT,
  service_point_id UUID REFERENCES std_service_points(id) ON DELETE SET NULL,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),

  -- One attendance record per teacher per day
  UNIQUE(teacher_id, date)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_std_teacher_faces_teacher ON std_teacher_faces(teacher_id);
CREATE INDEX IF NOT EXISTS idx_std_teacher_attendance_teacher ON std_teacher_attendance(teacher_id);
CREATE INDEX IF NOT EXISTS idx_std_teacher_attendance_date ON std_teacher_attendance(date);
CREATE INDEX IF NOT EXISTS idx_std_teacher_attendance_teacher_date ON std_teacher_attendance(teacher_id, date);

-- Enable Row Level Security
ALTER TABLE std_teacher_faces ENABLE ROW LEVEL SECURITY;
ALTER TABLE std_teacher_attendance ENABLE ROW LEVEL SECURITY;

-- RLS Policies (Allow all for now — same pattern as existing tables)
DROP POLICY IF EXISTS "Allow all on std_teacher_faces" ON std_teacher_faces;
CREATE POLICY "Allow all on std_teacher_faces" ON std_teacher_faces FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on std_teacher_attendance" ON std_teacher_attendance;
CREATE POLICY "Allow all on std_teacher_attendance" ON std_teacher_attendance FOR ALL USING (true) WITH CHECK (true);

-- Triggers (reuse existing std_update_updated_at function)
DROP TRIGGER IF EXISTS std_teacher_faces_updated_at ON std_teacher_faces;
CREATE TRIGGER std_teacher_faces_updated_at
  BEFORE UPDATE ON std_teacher_faces
  FOR EACH ROW EXECUTE FUNCTION std_update_updated_at();

DROP TRIGGER IF EXISTS std_teacher_attendance_updated_at ON std_teacher_attendance;
CREATE TRIGGER std_teacher_attendance_updated_at
  BEFORE UPDATE ON std_teacher_attendance
  FOR EACH ROW EXECUTE FUNCTION std_update_updated_at();

-- Helper function: Blend teacher embedding (adaptive 80/20 update)
CREATE OR REPLACE FUNCTION std_blend_teacher_embedding(
  teacher_uuid UUID,
  new_embedding JSONB,
  blend_index INTEGER DEFAULT 0
)
RETURNS VOID AS $$
DECLARE
  current_embeddings JSONB;
  old_embedding JSONB;
  blended JSONB;
  i INTEGER;
  old_val FLOAT;
  new_val FLOAT;
  blend_val FLOAT;
BEGIN
  SELECT face_embeddings INTO current_embeddings
  FROM std_teacher_faces
  WHERE teacher_id = teacher_uuid;

  IF current_embeddings IS NULL OR jsonb_array_length(current_embeddings) = 0 THEN
    RETURN;
  END IF;

  -- Get the embedding at blend_index
  old_embedding := current_embeddings->blend_index;

  -- Blend: 80% old + 20% new
  blended := '[]'::jsonb;
  FOR i IN 0..jsonb_array_length(old_embedding)-1 LOOP
    old_val := (old_embedding->>i)::float;
    new_val := (new_embedding->>i)::float;
    blend_val := old_val * 0.8 + new_val * 0.2;
    blended := blended || to_jsonb(blend_val);
  END LOOP;

  -- Replace the embedding at blend_index
  current_embeddings := jsonb_set(current_embeddings, ARRAY[blend_index::text], blended);

  UPDATE std_teacher_faces
  SET face_embeddings = current_embeddings
  WHERE teacher_id = teacher_uuid;
END;
$$ LANGUAGE plpgsql;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Teacher check-in migration complete!';
  RAISE NOTICE '   Created: std_teacher_faces, std_teacher_attendance';
  RAISE NOTICE '   Function: std_blend_teacher_embedding()';
END $$;
