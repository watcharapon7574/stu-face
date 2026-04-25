import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

async function assertAdmin(teacherId: string | null) {
  if (!teacherId) return false
  const { data } = await supabaseServer
    .from('std_teacher_faces' as any)
    .select('is_admin')
    .eq('teacher_id', teacherId)
    .maybeSingle()
  return !!data?.is_admin
}

// GET /api/teacher-checkin/admin?teacher_id=xxx
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const teacherId = searchParams.get('teacher_id')

    if (!teacherId) {
      return NextResponse.json({ error: 'teacher_id is required' }, { status: 400 })
    }

    if (!(await assertAdmin(teacherId))) {
      return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 })
    }

    // Settings
    const { data: settings } = await supabaseServer
      .from('std_teacher_settings' as any)
      .select('key, value')

    // Enrolled teachers
    const { data: teachersFaces } = await supabaseServer
      .from('std_teacher_faces' as any)
      .select('teacher_id, enrolled_at, is_admin, service_point_id, device_fingerprint, face_embeddings')

    const teacherIds = (teachersFaces || []).map((t: any) => t.teacher_id)

    // Enrolled teacher profiles
    const { data: enrolledProfiles } = await supabaseServer
      .from('profiles')
      .select('id, prefix, first_name, last_name, nickname, phone, workplace')
      .in('id', teacherIds.length > 0 ? teacherIds : ['none'])

    // Today attendance
    const today = new Date().toISOString().split('T')[0]
    const { data: attendance } = await supabaseServer
      .from('std_teacher_attendance' as any)
      .select('*')
      .eq('date', today)

    // Recent auto-checkouts (last 14 days)
    const fourteenDaysAgo = new Date(Date.now() - 14 * 86400000)
      .toISOString()
      .split('T')[0]
    const { data: autoCheckouts } = await supabaseServer
      .from('std_teacher_attendance' as any)
      .select('teacher_id, date, check_in, check_out')
      .eq('auto_checkout', true)
      .gte('date', fourteenDaysAgo)
      .order('date', { ascending: false })

    // Service points
    const { data: servicePoints } = await supabaseServer
      .from('std_service_points' as any)
      .select('id, name, short_name, lat, lng, radius_meters, is_active, is_headquarters')
      .order('is_headquarters', { ascending: false })
      .order('name')

    // Students
    const { data: students } = await supabaseServer
      .from('std_students' as any)
      .select('id, name, nickname, date_of_birth, service_point_id, face_embeddings, photo_url, is_active, created_at')
      .order('name')

    // Enrollable profiles (have telegram_chat_id, not yet enrolled as teacher)
    const { data: candidates } = await supabaseServer
      .from('profiles')
      .select('id, prefix, first_name, last_name, nickname, phone, workplace, telegram_chat_id')
      .not('telegram_chat_id', 'is', null)
      .order('first_name')

    const candidateProfiles = (candidates || []).filter(
      (p: any) => !teacherIds.includes(p.id)
    )

    const teachers = (teachersFaces || []).map((t: any) => {
      const profile = (enrolledProfiles || []).find((p: any) => p.id === t.teacher_id)
      const att = (attendance || []).find((a: any) => a.teacher_id === t.teacher_id)
      return {
        teacher_id: t.teacher_id,
        name: profile
          ? `${profile.prefix || ''}${profile.first_name || ''} ${profile.last_name || ''}`.trim()
          : 'ไม่ทราบ',
        nickname: profile?.nickname || null,
        phone: profile?.phone || null,
        workplace: profile?.workplace || null,
        is_admin: !!t.is_admin,
        enrolled_at: t.enrolled_at,
        service_point_id: t.service_point_id,
        embedding_count: Array.isArray(t.face_embeddings) ? t.face_embeddings.length : 0,
        checked_in: !!att?.check_in,
        checked_out: !!att?.check_out,
        check_in_time: att?.check_in || null,
        check_out_time: att?.check_out || null,
        is_late: !!att?.is_late,
        late_reason: att?.late_reason || null,
      }
    })

    const teacherNameById = new Map<string, string>()
    for (const t of teachers) {
      teacherNameById.set(t.teacher_id, t.name || t.nickname)
    }
    const autoCheckoutList = (autoCheckouts || []).map((a: any) => ({
      teacher_id: a.teacher_id,
      teacher_name: teacherNameById.get(a.teacher_id) || 'ไม่ทราบ',
      date: a.date,
      check_in: a.check_in,
      check_out: a.check_out,
    }))

    return NextResponse.json({
      settings: Object.fromEntries((settings || []).map((s: any) => [s.key, s.value])),
      teachers,
      auto_checkouts: autoCheckoutList,
      students: (students || []).map((s: any) => ({
        ...s,
        embedding_count: Array.isArray(s.face_embeddings) ? s.face_embeddings.length : 0,
        face_embeddings: undefined,
      })),
      service_points: servicePoints || [],
      candidate_profiles: candidateProfiles.map((p: any) => ({
        id: p.id,
        name: `${p.prefix || ''}${p.first_name || ''} ${p.last_name || ''}`.trim(),
        nickname: p.nickname,
        phone: p.phone,
        workplace: p.workplace,
      })),
    })
  } catch (error) {
    console.error('Admin GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/teacher-checkin/admin — update settings + service points + teacher is_admin
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { teacher_id, settings, service_points, teacher_admins } = body

    if (!(await assertAdmin(teacher_id))) {
      return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 })
    }

    if (settings) {
      for (const [key, value] of Object.entries(settings)) {
        await supabaseServer
          .from('std_teacher_settings' as any)
          .upsert({ key, value: String(value) }, { onConflict: 'key' })
      }
    }

    if (Array.isArray(service_points)) {
      for (const sp of service_points) {
        await supabaseServer
          .from('std_service_points' as any)
          .update({ radius_meters: sp.radius_meters })
          .eq('id', sp.id)
      }
    }

    if (Array.isArray(teacher_admins)) {
      for (const ta of teacher_admins) {
        await supabaseServer
          .from('std_teacher_faces' as any)
          .update({ is_admin: !!ta.is_admin })
          .eq('teacher_id', ta.teacher_id)
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Admin POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
