-- ⚠️  Add late tracking to teacher attendance
-- Depends on: migration-teacher-checkin.sql

ALTER TABLE std_teacher_attendance
  ADD COLUMN IF NOT EXISTS is_late BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS late_reason TEXT;

DO $$
BEGIN
  RAISE NOTICE '✅ Late tracking columns added to std_teacher_attendance';
END $$;
