import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

// GET /api/teacher-checkin/admin?teacher_id=xxx
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const teacherId = searchParams.get('teacher_id')

    if (!teacherId) {
      return NextResponse.json({ error: 'teacher_id is required' }, { status: 400 })
    }

    // Check admin
    const { data: face } = await supabaseServer
      .from('std_teacher_faces' as any)
      .select('is_admin')
      .eq('teacher_id', teacherId)
      .maybeSingle()

    if (!face?.is_admin) {
      return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 })
    }

    // Get settings
    const { data: settings } = await supabaseServer
      .from('std_teacher_settings' as any)
      .select('key, value')

    // Get all enrolled teachers
    const { data: teachers } = await supabaseServer
      .from('std_teacher_faces' as any)
      .select('teacher_id, enrolled_at, is_admin, service_point_id, device_fingerprint')

    // Get teacher profiles
    const teacherIds = (teachers || []).map((t: any) => t.teacher_id)
    const { data: profiles } = await supabaseServer
      .from('profiles' as any)
      .select('id, first_name, last_name, nickname')
      .in('id', teacherIds.length > 0 ? teacherIds : ['none'])

    // Get today's attendance
    const today = new Date().toISOString().split('T')[0]
    const { data: attendance } = await supabaseServer
      .from('std_teacher_attendance' as any)
      .select('*')
      .eq('date', today)

    // Get service points
    const { data: servicePoints } = await supabaseServer
      .from('std_service_points' as any)
      .select('id, name, short_name, lat, lng, radius_meters, is_active')
      .order('name')

    return NextResponse.json({
      settings: Object.fromEntries((settings || []).map((s: any) => [s.key, s.value])),
      teachers: (teachers || []).map((t: any) => {
        const profile = (profiles || []).find((p: any) => p.id === t.teacher_id)
        const att = (attendance || []).find((a: any) => a.teacher_id === t.teacher_id)
        return {
          ...t,
          name: profile ? `${profile.first_name} ${profile.last_name}` : 'ไม่ทราบ',
          nickname: profile?.nickname || null,
          checked_in: !!att?.check_in,
          checked_out: !!att?.check_out,
          check_in_time: att?.check_in || null,
          check_out_time: att?.check_out || null,
        }
      }),
      service_points: servicePoints || [],
    })
  } catch (error) {
    console.error('Admin API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/teacher-checkin/admin — update settings
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { teacher_id, settings } = body

    if (!teacher_id) {
      return NextResponse.json({ error: 'teacher_id is required' }, { status: 400 })
    }

    // Check admin
    const { data: face } = await supabaseServer
      .from('std_teacher_faces' as any)
      .select('is_admin')
      .eq('teacher_id', teacher_id)
      .maybeSingle()

    if (!face?.is_admin) {
      return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 })
    }

    // Update settings
    if (settings) {
      for (const [key, value] of Object.entries(settings)) {
        await supabaseServer
          .from('std_teacher_settings' as any)
          .upsert({ key, value: String(value) }, { onConflict: 'key' })
      }
    }

    // Update service points
    if (body.service_points) {
      for (const sp of body.service_points) {
        await supabaseServer
          .from('std_service_points' as any)
          .update({ radius_meters: sp.radius_meters })
          .eq('id', sp.id)
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Admin update error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
