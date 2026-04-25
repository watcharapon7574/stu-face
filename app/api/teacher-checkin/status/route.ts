import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

// GET /api/teacher-checkin/status?teacher_id=xxx&date=yyyy-mm-dd
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const teacherId = searchParams.get('teacher_id')
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0]

    if (!teacherId) {
      return NextResponse.json({ error: 'teacher_id is required' }, { status: 400 })
    }

    // Check enrollment status + admin + service_point
    const { data: faceData } = await supabaseServer
      .from('std_teacher_faces' as any)
      .select('teacher_id, enrolled_at, device_fingerprint, is_admin, service_point_id')
      .eq('teacher_id', teacherId)
      .maybeSingle()

    const enrolled = !!faceData && !!faceData.enrolled_at

    // Check today's attendance
    const { data: attendance } = await supabaseServer
      .from('std_teacher_attendance' as any)
      .select('*')
      .eq('teacher_id', teacherId)
      .eq('date', date)
      .maybeSingle()

    // Get settings
    const { data: settingsData } = await supabaseServer
      .from('std_teacher_settings' as any)
      .select('key, value')

    const settings: Record<string, string> = {}
    if (settingsData) {
      for (const s of settingsData) {
        settings[s.key] = s.value
      }
    }

    // Get service points (for geofencing)
    const { data: servicePoints } = await supabaseServer
      .from('std_service_points' as any)
      .select('id, name, short_name, lat, lng, radius_meters')
      .eq('is_active', true)

    return NextResponse.json({
      enrolled,
      checked_in: !!attendance?.check_in,
      checked_out: !!attendance?.check_out,
      check_in_time: attendance?.check_in || null,
      check_out_time: attendance?.check_out || null,
      device_fingerprint: faceData?.device_fingerprint || null,
      is_admin: faceData?.is_admin || false,
      service_point_id: faceData?.service_point_id || null,
      settings: {
        geofence_enabled: settings.geofence_enabled === 'true',
        check_in_start: settings.check_in_start || '07:00',
        check_in_end: settings.check_in_end || '09:30',
        check_out_start: settings.check_out_start || '15:30',
        check_out_end: settings.check_out_end || '22:00',
      },
      service_points: servicePoints || [],
    })
  } catch (error) {
    console.error('Teacher checkin status error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
