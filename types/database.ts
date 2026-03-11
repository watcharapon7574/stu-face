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
      service_points: {
        Row: {
          id: string
          name: string
          location: string | null
          is_main_center: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          location?: string | null
          is_main_center?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          location?: string | null
          is_main_center?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      teachers: {
        Row: {
          id: string
          name: string
          email: string | null
          phone: string | null
          service_point_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          email?: string | null
          phone?: string | null
          service_point_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          email?: string | null
          phone?: string | null
          service_point_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      students: {
        Row: {
          id: string
          name: string
          nickname: string | null
          date_of_birth: string | null
          service_point_id: string | null
          embeddings: FaceEmbedding[]
          photo_url: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          nickname?: string | null
          date_of_birth?: string | null
          service_point_id?: string | null
          embeddings?: FaceEmbedding[]
          photo_url?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          nickname?: string | null
          date_of_birth?: string | null
          service_point_id?: string | null
          embeddings?: FaceEmbedding[]
          photo_url?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      attendance: {
        Row: {
          id: string
          student_id: string | null
          teacher_id: string | null
          date: string
          check_in: string | null
          check_out: string | null
          confidence_in: number | null
          confidence_out: number | null
          method_in: 'auto' | 'manual' | 'suggestion' | null
          method_out: 'auto' | 'manual' | 'suggestion' | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          student_id?: string | null
          teacher_id?: string | null
          date: string
          check_in?: string | null
          check_out?: string | null
          confidence_in?: number | null
          confidence_out?: number | null
          method_in?: 'auto' | 'manual' | 'suggestion' | null
          method_out?: 'auto' | 'manual' | 'suggestion' | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          student_id?: string | null
          teacher_id?: string | null
          date?: string
          check_in?: string | null
          check_out?: string | null
          confidence_in?: number | null
          confidence_out?: number | null
          method_in?: 'auto' | 'manual' | 'suggestion' | null
          method_out?: 'auto' | 'manual' | 'suggestion' | null
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
export type ServicePoint = Database['public']['Tables']['service_points']['Row']
export type Teacher = Database['public']['Tables']['teachers']['Row']
export type Student = Database['public']['Tables']['students']['Row']
export type Attendance = Database['public']['Tables']['attendance']['Row']

// Attendance with relations
export type AttendanceWithRelations = Attendance & {
  student?: Student
  teacher?: Teacher
}

// Recognition confidence thresholds
export const CONFIDENCE_THRESHOLD = {
  AUTO: 0.85,        // confidence > 0.85 = บันทึกอัตโนมัติ
  SUGGESTION: 0.6,   // 0.6-0.85 = แสดงตัวเลือก 3 คน
  MANUAL: 0.6,       // < 0.6 = ให้ครูเลือกเอง
} as const

export type AttendanceMethod = 'auto' | 'manual' | 'suggestion'
