import { supabaseServer } from '@/lib/supabase/server'
import AttendanceFlow from '@/components/attendance/attendance-flow'

export default async function AttendancePage() {
  const [studentsResult, servicePointsResult] = await Promise.all([
    // SLIM SELECT: embeddings are fetched lazily by the client only when
    // the user enters face-match mode. Sending the full embeddings array
    // (~20 × 1.5KB per student × hundreds of students) on every SSR render
    // was the largest single source of Vercel Fast Data Transfer.
    supabaseServer
      .from('std_students' as any)
      .select('id, name, nickname, service_point, classroom_id, is_active, created_at, updated_at')
      .eq('is_active', true)
      .order('name'),
    supabaseServer
      .from('std_service_points' as any)
      .select('id, name, short_name, district, lat, lng, radius_meters, is_headquarters')
      .eq('is_active', true)
      .order('name'),
  ])

  if (studentsResult.error) {
    console.error('Error fetching students:', studentsResult.error)
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="text-center text-red-600">
          <p>เกิดข้อผิดพลาดในการโหลดข้อมูล</p>
        </div>
      </main>
    )
  }

  // Stub face_embeddings as [] on the seed so existing client types stay
  // satisfied; the real embeddings are fetched lazily from
  // /api/students/embeddings only when the user enters face-match mode.
  const slimStudents = (studentsResult.data || []).map((s: Record<string, unknown>) => ({
    ...s,
    face_embeddings: [] as number[][],
  }))

  return (
    <main className="min-h-screen p-4 md:p-8">
      <AttendanceFlow
        students={slimStudents as any}
        servicePoints={servicePointsResult.data || []}
      />
    </main>
  )
}
