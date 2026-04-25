import { supabaseServer } from '@/lib/supabase/server'
import DashboardView from '@/components/dashboard/dashboard-view'

// Always fetch fresh data — dashboard reflects today's attendance state
export const dynamic = 'force-dynamic'

// Keywords that indicate the teacher works at headquarters
const HQ_KEYWORDS = ['ห้อง', 'ห้องเรียน', 'Admin', 'ศูนย์การศึกษา']

interface ProfileRow {
  id: string
  prefix: string | null
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

  const [
    attendanceResult,
    teacherAttendanceResult,
    studentsResult,
    servicePointsResult,
    profilesResult,
    teacherFacesResult,
  ] = await Promise.all([
    supabaseServer
      .from('std_attendance' as any)
      .select('*, student:student_id (*)')
      .eq('date', today)
      .order('created_at', { ascending: false }),
    supabaseServer
      .from('std_teacher_attendance' as any)
      .select(
        'id, teacher_id, date, check_in, check_out, confidence_in, confidence_out, service_point_id, auto_checkout, is_late, late_reason'
      )
      .eq('date', today)
      .order('check_in', { ascending: false, nullsFirst: false }),
    supabaseServer
      .from('std_students' as any)
      .select('id, service_point')
      .eq('is_active', true),
    supabaseServer
      .from('std_service_points' as any)
      .select('id, name, short_name, is_headquarters')
      .eq('is_active', true)
      .order('name'),
    supabaseServer
      .from('profiles' as any)
      .select('id, prefix, first_name, last_name, nickname, workplace, position')
      .not('first_name', 'eq', '')
      .order('first_name'),
    supabaseServer
      .from('std_teacher_faces' as any)
      .select('teacher_id, is_admin')
      .eq('is_admin', true),
  ])

  if (attendanceResult.error) {
    console.error('Error fetching attendance:', attendanceResult.error)
  }

  const servicePoints = (servicePointsResult.data || []) as ServicePointRow[]
  const profiles = (profilesResult.data || []) as ProfileRow[]

  // Build teacher_id → display info map
  const profileById = new Map<string, ProfileRow>()
  for (const p of profiles) profileById.set(p.id, p)

  const teacherAttendance = (teacherAttendanceResult.data || []).map((a: any) => {
    const p = profileById.get(a.teacher_id)
    return {
      id: a.id,
      teacher_id: a.teacher_id,
      teacher_name: p
        ? `${p.prefix || ''}${p.first_name || ''} ${p.last_name || ''}`.trim()
        : 'ไม่ทราบ',
      teacher_nickname: p?.nickname || null,
      check_in: a.check_in as string | null,
      check_out: a.check_out as string | null,
      service_point_id: a.service_point_id as string | null,
      auto_checkout: !!a.auto_checkout,
      is_late: !!a.is_late,
      late_reason: a.late_reason as string | null,
    }
  })

  // Profile lookup for realtime updates (teacher_id → name/nickname)
  const teacherProfileLookup: Record<string, { name: string; nickname: string | null }> = {}
  for (const p of profiles) {
    teacherProfileLookup[p.id] = {
      name: `${p.prefix || ''}${p.first_name || ''} ${p.last_name || ''}`.trim(),
      nickname: p.nickname,
    }
  }

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
  // (also treat std_teacher_faces.is_admin as management for full visibility)
  const positionMgmtIds = profiles
    .filter((p) => p.position && MANAGEMENT_POSITIONS.includes(p.position))
    .map((p) => p.id)
  const adminTeacherIds = (teacherFacesResult.data || []).map(
    (f: any) => f.teacher_id as string
  )
  const managementIds = Array.from(
    new Set([...positionMgmtIds, ...adminTeacherIds])
  )

  return (
    <main className="min-h-screen p-4 md:p-8">
      <DashboardView
        initialAttendance={attendanceResult.data || []}
        initialTeacherAttendance={teacherAttendance}
        initialDate={today}
        totalStudents={studentsResult.data?.length || 0}
        totalTeachers={profiles.length}
        servicePoints={servicePoints}
        teacherServicePointMap={teacherServicePointMap}
        teacherProfileLookup={teacherProfileLookup}
        managementIds={managementIds}
      />
    </main>
  )
}
