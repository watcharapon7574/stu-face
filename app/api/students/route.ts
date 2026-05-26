import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { revalidateStudentReaders } from '@/lib/revalidate'
import { getSlimStudents } from '@/lib/cache'

// GET /api/students - ดึงรายชื่อนักเรียนทั้งหมด
// Always SLIM: face_embeddings is [] in the response and embedding_count
// carries the count for /setup badges. To get real vectors for the
// face-match flow, hit /api/students/embeddings.
//
// Backed by unstable_cache in lib/cache.ts (tag: 'students'), busted by
// revalidateStudentReaders() on every mutation.
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const servicePoint = searchParams.get('service_point')
    const isActiveParam = searchParams.get('is_active')
    const isActive = isActiveParam === null ? null : isActiveParam === 'true'

    const students = await getSlimStudents(servicePoint, isActive)

    const res = NextResponse.json({ students })
    // Edge layer cache. revalidateTag('students') purges both the Data
    // Cache that getSlimStudents writes and this Edge entry on Vercel.
    res.headers.set(
      'Cache-Control',
      'public, s-maxage=600, stale-while-revalidate=86400',
    )
    return res
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

    revalidateStudentReaders()

    return NextResponse.json({ student: data }, { status: 201 })
  } catch (error) {
    console.error('Error creating student:', error)
    return NextResponse.json(
      { error: 'Failed to create student' },
      { status: 500 }
    )
  }
}
