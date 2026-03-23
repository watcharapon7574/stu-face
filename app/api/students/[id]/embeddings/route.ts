import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import type { FaceEmbedding } from '@/types/database'

// POST /api/students/[id]/embeddings - เพิ่ม embedding ให้นักเรียน (rolling update)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { embedding } = body as { embedding: FaceEmbedding }

    if (!embedding || !Array.isArray(embedding)) {
      return NextResponse.json(
        { error: 'Valid embedding array is required' },
        { status: 400 }
      )
    }

    // ใช้ function ที่สร้างไว้ใน database เพื่อจัดการ rolling update
    const { error } = await supabaseServer.rpc('add_student_embedding', {
      student_uuid: id,
      new_embedding: embedding,
    })

    if (error) throw error

    // ดึงข้อมูลนักเรียนที่อัพเดตแล้ว
    const { data: student, error: fetchError } = await supabaseServer
      .from('std_students')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError) throw fetchError

    return NextResponse.json({
      success: true,
      student,
      embeddings_count: (student.face_embeddings as any[])?.length ?? 0
    })
  } catch (error) {
    console.error('Error adding embedding:', error)
    return NextResponse.json(
      { error: 'Failed to add embedding' },
      { status: 500 }
    )
  }
}

// PUT /api/students/[id]/embeddings - อัพเดต embeddings ทั้งหมด (สำหรับ setup)
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { embeddings } = body as { embeddings: FaceEmbedding[] }

    if (!Array.isArray(embeddings)) {
      return NextResponse.json(
        { error: 'Embeddings must be an array' },
        { status: 400 }
      )
    }

    if (embeddings.length > 20) {
      return NextResponse.json(
        { error: 'Maximum 20 embeddings allowed' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseServer
      .from('std_students')
      .update({ face_embeddings: embeddings })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({
      success: true,
      student: data,
      embeddings_count: (data.face_embeddings as any[])?.length ?? 0
    })
  } catch (error) {
    console.error('Error updating embeddings:', error)
    return NextResponse.json(
      { error: 'Failed to update embeddings' },
      { status: 500 }
    )
  }
}
