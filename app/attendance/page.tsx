import { supabaseServer } from '@/lib/supabase/server'
import AttendanceFlow from '@/components/attendance/attendance-flow'

export default async function AttendancePage() {
  const [studentsResult, servicePointsResult] = await Promise.all([
    supabaseServer
      .from('std_students' as any)
      .select('*')
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

  return (
    <main className="min-h-screen p-4 md:p-8">
      <AttendanceFlow
        students={studentsResult.data || []}
        servicePoints={servicePointsResult.data || []}
      />
    </main>
  )
}
