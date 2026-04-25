import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
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
    }

    if (!student_id || !date || !type) {
      return NextResponse.json(
        { error: 'student_id, date, and type are required' },
        { status: 400 }
      )
    }

    const now = new Date().toISOString()

    // Check if attendance record exists for this student on this date
    const { data: existing } = await supabaseServer
      .from('std_attendance' as any)
      .select('*')
      .eq('student_id', student_id)
      .eq('date', date)
      .single()

    let result

    if (existing) {
      // Update existing record
      if (type === 'check_in') {
        const { data, error } = await supabaseServer
          .from('std_attendance' as any)
          .update({
            check_in: now,
            confidence_in: confidence,
            method_in: method,
            teacher_name: teacher_name || existing.teacher_name,
            check_in_lat: lat ?? null,
            check_in_lng: lng ?? null,
          })
          .eq('id', existing.id)
          .select(`
            *,
            student:student_id (*)
          `)
          .single()

        if (error) throw error
        result = data
      } else {
        const { data, error } = await supabaseServer
          .from('std_attendance' as any)
          .update({
            check_out: now,
            confidence_out: confidence,
            method_out: method,
            check_out_lat: lat ?? null,
            check_out_lng: lng ?? null,
          })
          .eq('id', existing.id)
          .select(`
            *,
            student:student_id (*)
          `)
          .single()

        if (error) throw error
        result = data
      }
    } else {
      // Create new record
      const insertData: any = {
        student_id,
        teacher_name,
        date,
        service_point_id: service_point_id || null,
      }

      if (type === 'check_in') {
        insertData.check_in = now
        insertData.confidence_in = confidence
        insertData.method_in = method
        insertData.check_in_lat = lat ?? null
        insertData.check_in_lng = lng ?? null
      } else {
        insertData.check_out = now
        insertData.confidence_out = confidence
        insertData.method_out = method
        insertData.check_out_lat = lat ?? null
        insertData.check_out_lng = lng ?? null
      }

      const { data, error } = await supabaseServer
        .from('std_attendance' as any)
        .insert(insertData)
        .select(`
          *,
          student:student_id (*)
        `)
        .single()

      if (error) throw error
      result = data
    }

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
