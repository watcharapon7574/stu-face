export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      std_students: {
        Row: {
          id: string
          name: string
          nickname: string | null
          service_point: string | null
          face_embeddings: Json
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          nickname?: string | null
          service_point?: string | null
          face_embeddings?: Json
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          nickname?: string | null
          service_point?: string | null
          face_embeddings?: Json
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      std_attendance: {
        Row: {
          id: string
          student_id: string | null
          teacher_name: string | null
          date: string
          check_in: string | null
          check_out: string | null
          confidence_in: number | null
          confidence_out: number | null
          method_in: AttendanceMethod | null
          method_out: AttendanceMethod | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          student_id?: string | null
          teacher_name?: string | null
          date: string
          check_in?: string | null
          check_out?: string | null
          confidence_in?: number | null
          confidence_out?: number | null
          method_in?: AttendanceMethod | null
          method_out?: AttendanceMethod | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          student_id?: string | null
          teacher_name?: string | null
          date?: string
          check_in?: string | null
          check_out?: string | null
          confidence_in?: number | null
          confidence_out?: number | null
          method_in?: AttendanceMethod | null
          method_out?: AttendanceMethod | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}

// Face embedding type (array of numbers from @vladmandic/human)
export type FaceEmbedding = number[]

// Helper types
export type Student = Database['public']['Tables']['std_students']['Row']
export type Attendance = Database['public']['Tables']['std_attendance']['Row']

// Attendance with relations
export type AttendanceWithRelations = Attendance & {
  student?: Student
}

// Recognition confidence thresholds
export const CONFIDENCE_THRESHOLD = {
  AUTO: 0.85,        // confidence > 0.85 = บันทึกอัตโนมัติ
  SUGGESTION: 0.6,   // 0.6-0.85 = แสดงตัวเลือก 3 คน
  MANUAL: 0.6,       // < 0.6 = ให้ครูเลือกเอง
} as const

export type AttendanceMethod = 'auto' | 'manual' | 'suggestion'
