import { supabaseServer } from '@/lib/supabase/server'
import AttendanceFlow from '@/components/attendance/attendance-flow'

export default async function AttendancePage() {
  // Fetch students from server
  const { data: students, error } = await supabaseServer
    .from('std_students')
    .select('*')
    .eq('is_active', true)
    .order('name')

  if (error) {
    console.error('Error fetching students:', error)
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
      <AttendanceFlow students={students || []} />
    </main>
  )
}
