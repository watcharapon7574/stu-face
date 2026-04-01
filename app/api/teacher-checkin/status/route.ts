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

    // Check enrollment status
    const { data: faceData } = await supabaseServer
      .from('std_teacher_faces' as any)
      .select('teacher_id, enrolled_at, device_fingerprint')
      .eq('teacher_id', teacherId)
      .maybeSingle()

    const enrolled = !!faceData

    // Check today's attendance
    const { data: attendance } = await supabaseServer
      .from('std_teacher_attendance' as any)
      .select('*')
      .eq('teacher_id', teacherId)
      .eq('date', date)
      .maybeSingle()

    return NextResponse.json({
      enrolled,
      checked_in: !!attendance?.check_in,
      checked_out: !!attendance?.check_out,
      check_in_time: attendance?.check_in || null,
      check_out_time: attendance?.check_out || null,
      device_fingerprint: faceData?.device_fingerprint || null,
    })
  } catch (error) {
    console.error('Teacher checkin status error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
