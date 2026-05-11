import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { requireBearer } from '@/lib/api-auth'
import type { AttendanceMethod } from '@/types/database'

// GET /api/attendance - ดึงข้อมูลการเข้าเรียน
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date')
    const studentId = searchParams.get('student_id')
    const servicePoint = searchParams.get('service_point')

    let query = supabaseServer
      .from('std_attendance' as any)
      .select(`
        *,
        student:student_id (
          id,
          name,
          nickname,
          service_point
        )
      `)
      .order('date', { ascending: false })
      .order('check_in', { ascending: false })

    if (date) {
      query = query.eq('date', date)
    }

    if (studentId) {
      query = query.eq('student_id', studentId)
    }

    const { data, error } = await query

    if (error) throw error

    // Filter by service point if provided
    let filteredData = data
    if (servicePoint) {
      filteredData = data?.filter(
        (record: any) => record.student?.service_point === servicePoint
      )
    }

    return NextResponse.json({ attendance: filteredData })
  } catch (error) {
    console.error('Error fetching attendance:', error)
    return NextResponse.json(
      { error: 'Failed to fetch attendance' },
      { status: 500 }
    )
  }
}

// POST /api/attendance - บันทึกการเข้าเรียน
export async function POST(request: Request) {
  const auth = requireBearer(request)
  if (!auth.ok) return auth.response

  try {
    const body = await request.json()
    const {
      student_id,
      teacher_name,
      date,
      type, // 'check_in' | 'check_out'
      confidence,
      method,
      service_point_id,
      lat,
      lng,
      guardian,
    } = body as {
      student_id: string
      teacher_name?: string
      date: string
      type: 'check_in' | 'check_out'
      confidence?: number
      method: AttendanceMethod
      service_point_id?: string
      lat?: number | null
      lng?: number | null
      guardian?: string | null
    }

    const guardianTrim = (guardian ?? '').trim() || null

    if (!student_id || !date || !type) {
      return NextResponse.json(
        { error: 'student_id, date, and type are required' },
        { status: 400 }
      )
    }

    const now = new Date().toISOString()

    // Short-circuit duplicate scans: if this student already has the
    // requested timestamp recorded for today, don't overwrite — surface
    // the existing record so the UI can say "scanned already at HH:MM".
    // The race window between this SELECT and the upsert below is tiny
    // and harmless (two simultaneous first-time scans both succeed via
    // the atomic upsert).
    const { data: existing } = await supabaseServer
      .from('std_attendance' as any)
      .select('id, check_in, check_out, guardian_in, guardian_out, student:student_id (id, name, nickname)')
      .eq('student_id', student_id)
      .eq('date', date)
      .maybeSingle()

    if (existing) {
      if (type === 'check_in' && existing.check_in) {
        return NextResponse.json({
          success: true,
          already_done: true,
          type: 'check_in',
          attendance: existing,
        })
      }
      if (type === 'check_out' && existing.check_out) {
        return NextResponse.json({
          success: true,
          already_done: true,
          type: 'check_out',
          attendance: existing,
        })
      }
    }

    // Atomic upsert keyed by UNIQUE(student_id, date) — eliminates the
    // SELECT-then-INSERT race that surfaces during the morning rush when
    // multiple teachers (or a retry from the same device) hit this route
    // for the same student in the same instant.
    const upsertPayload: Record<string, unknown> = {
      student_id,
      date,
      service_point_id: service_point_id || null,
    }

    if (teacher_name) upsertPayload.teacher_name = teacher_name

    if (type === 'check_in') {
      upsertPayload.check_in = now
      upsertPayload.confidence_in = confidence
      upsertPayload.method_in = method
      upsertPayload.check_in_lat = lat ?? null
      upsertPayload.check_in_lng = lng ?? null
      upsertPayload.guardian_in = guardianTrim
    } else {
      upsertPayload.check_out = now
      upsertPayload.confidence_out = confidence
      upsertPayload.method_out = method
      upsertPayload.check_out_lat = lat ?? null
      upsertPayload.check_out_lng = lng ?? null
      upsertPayload.guardian_out = guardianTrim
    }

    const { data: result, error } = await supabaseServer
      .from('std_attendance' as any)
      .upsert(upsertPayload, { onConflict: 'student_id,date' })
      .select(`
        *,
        student:student_id (*)
      `)
      .single()

    if (error) throw error

    return NextResponse.json({
      success: true,
      attendance: result,
    })
  } catch (error) {
    console.error('Error recording attendance:', error)
    return NextResponse.json(
      { error: 'Failed to record attendance' },
      { status: 500 }
    )
  }
}
