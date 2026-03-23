import { supabaseServer } from '@/lib/supabase/server'
import DashboardView from '@/components/dashboard/dashboard-view'

// Keywords that indicate the teacher works at headquarters
const HQ_KEYWORDS = ['ห้อง', 'ห้องเรียน', 'Admin', 'ศูนย์การศึกษา']

interface ProfileRow {
  id: string
  first_name: string
  last_name: string
  nickname: string | null
  workplace: string | null
  position: string | null
}

interface ServicePointRow {
  id: string
  name: string
  short_name: string
  is_headquarters: boolean
}

function matchWorkplaceToServicePoint(
  workplace: string | null,
  servicePoints: ServicePointRow[]
): string | null {
  if (!workplace) return null

  const isHQ = HQ_KEYWORDS.some((kw) => workplace.includes(kw))
  if (isHQ) {
    const hq = servicePoints.find((sp) => sp.is_headquarters)
    return hq?.id || null
  }

  for (const sp of servicePoints) {
    const nameParts = [
      sp.short_name,
      sp.name,
      sp.name.replace(/หน่วยบริการอำเภอ|หน่วยบริการ|หน่วยฯ\s*/g, '').trim(),
    ]
    for (const part of nameParts) {
      if (!part) continue
      if (workplace.includes(part) || part.includes(workplace.replace(/หน่วยบริการ/g, '').trim())) {
        return sp.id
      }
    }
  }

  return null
}

const MANAGEMENT_POSITIONS = ['director', 'deputy_director', 'assistant_director']

export default async function DashboardPage() {
  const today = new Date().toISOString().split('T')[0]

  const [attendanceResult, studentsResult, servicePointsResult, profilesResult] = await Promise.all([
    supabaseServer
      .from('std_attendance')
      .select('*, student:student_id (*)')
      .eq('date', today)
      .order('created_at', { ascending: false }),
    supabaseServer
      .from('std_students')
      .select('id, service_point')
      .eq('is_active', true),
    supabaseServer
      .from('std_service_points')
      .select('id, name, short_name, is_headquarters')
      .eq('is_active', true)
      .order('name'),
    supabaseServer
      .from('profiles')
      .select('id, first_name, last_name, nickname, workplace, position')
      .not('first_name', 'eq', '')
      .order('first_name'),
  ])

  if (attendanceResult.error) {
    console.error('Error fetching attendance:', attendanceResult.error)
  }

  const servicePoints = (servicePointsResult.data || []) as ServicePointRow[]
  const profiles = (profilesResult.data || []) as ProfileRow[]

  // Build teacher_name → service_point_id mapping
  const teacherServicePointMap: Record<string, string> = {}
  // Build teacher_id → position mapping (for management check)
  const teacherPositionMap: Record<string, string> = {}

  for (const p of profiles) {
    const fullName = `${p.first_name} ${p.last_name}`.trim()
    const spId = matchWorkplaceToServicePoint(p.workplace, servicePoints)
    if (spId) {
      teacherServicePointMap[fullName] = spId
    }
    if (p.position) {
      teacherPositionMap[p.id] = p.position
    }
  }

  // Build list of management teacher IDs for client-side check
  const managementIds = profiles
    .filter((p) => p.position && MANAGEMENT_POSITIONS.includes(p.position))
    .map((p) => p.id)

  return (
    <main className="min-h-screen p-4 md:p-8">
      <DashboardView
        initialAttendance={attendanceResult.data || []}
        initialDate={today}
        totalStudents={studentsResult.data?.length || 0}
        servicePoints={servicePoints}
        teacherServicePointMap={teacherServicePointMap}
        managementIds={managementIds}
      />
    </main>
  )
}
