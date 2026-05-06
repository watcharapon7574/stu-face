import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

// GET /api/students - ดึงรายชื่อนักเรียนทั้งหมด
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const servicePoint = searchParams.get('service_point')
    const isActive = searchParams.get('is_active')

    let query = supabaseServer
      .from('std_students' as any)
      .select('*')
      .order('name')

    if (servicePoint) {
      query = query.eq('service_point', servicePoint)
    }

    if (isActive !== null) {
      query = query.eq('is_active', isActive === 'true')
    }

    const { data, error } = await query

    if (error) throw error

    return NextResponse.json({ students: data })
  } catch (error) {
    console.error('Error fetching students:', error)
    return NextResponse.json(
      { error: 'Failed to fetch students' },
      { status: 500 }
    )
  }
}

// POST /api/students - สร้างนักเรียนใหม่
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, nickname, service_point, classroom_id } = body

    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseServer
      .from('std_students' as any)
      .insert({
        name,
        nickname,
        service_point,
        classroom_id: classroom_id || null,
        face_embeddings: [],
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ student: data }, { status: 201 })
  } catch (error) {
    console.error('Error creating student:', error)
    return NextResponse.json(
      { error: 'Failed to create student' },
      { status: 500 }
    )
  }
}
