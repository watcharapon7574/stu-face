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

    // Scan location is mandatory now — every attendance row must be tied
    // to a service point (the row used to be 42% NULL because the client
    // sent matched?.id || null when GPS failed; the client now falls
    // back to the teacher's workplace SP, so this should always be set).
    if (!service_point_id) {
      return NextResponse.json(
        { error: 'service_point_id is required' },
        { status: 400 }
      )
    }

    const now = new Date().toISOString()

    // Look up the existing row for (student_id, date). Both code paths
    // depend on this — check_in to detect duplicates, check_out to
    // enforce that a check_in exists first.
    const { data: existing } = await supabaseServer
      .from('std_attendance' as any)
      .select('id, check_in, check_out, guardian_in, guardian_out, student:student_id (id, name, nickname)')
      .eq('student_id', student_id)
      .eq('date', date)
      .maybeSingle()

    // --- check_out branch: must UPDATE an existing row. ---------------
    // Previously this was an upsert which silently INSERTed when the
    // student had no morning check_in, leaving orphan rows where
    // check_out was set but check_in was NULL. Reject that case now.
    if (type === 'check_out') {
      if (!existing) {
        return NextResponse.json(
          {
            error: 'no_check_in',
            message: 'นักเรียนคนนี้ยังไม่ได้เช็คชื่อเข้าวันนี้ — สแกนเข้าก่อน',
          },
          { status: 409 }
        )
      }
      if (!existing.check_in) {
        return NextResponse.json(
          {
            error: 'no_check_in',
            message: 'พบบันทึกวันนี้ แต่ยังไม่มีเวลาเข้า — สแกนเข้าก่อน',
            attendance: existing,
          },
          { status: 409 }
        )
      }
      if (existing.check_out) {
        return NextResponse.json({
          success: true,
          already_done: true,
          type: 'check_out',
          attendance: existing,
        })
      }

      const { data: updated, error: updateErr } = await supabaseServer
        .from('std_attendance' as any)
        .update({
          check_out: now,
          confidence_out: confidence,
          method_out: method,
          check_out_lat: lat ?? null,
          check_out_lng: lng ?? null,
          guardian_out: guardianTrim,
        })
        .eq('id', existing.id)
        .select(`*, student:student_id (*)`)
        .single()

      if (updateErr) throw updateErr

      return NextResponse.json({ success: true, attendance: updated })
    }

    // --- check_in branch: upsert (safe — UNIQUE(student_id, date)) ---
    if (existing?.check_in) {
      return NextResponse.json({
        success: true,
        already_done: true,
        type: 'check_in',
        attendance: existing,
      })
    }

    const upsertPayload: Record<string, unknown> = {
      student_id,
      date,
      service_point_id,
      check_in: now,
      confidence_in: confidence,
      method_in: method,
      check_in_lat: lat ?? null,
      check_in_lng: lng ?? null,
      guardian_in: guardianTrim,
    }
    if (teacher_name) upsertPayload.teacher_name = teacher_name

    const { data: result, error } = await supabaseServer
      .from('std_attendance' as any)
      .upsert(upsertPayload, { onConflict: 'student_id,date' })
      .select(`*, student:student_id (*)`)
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
