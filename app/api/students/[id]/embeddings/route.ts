import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { revalidateStudentReaders } from '@/lib/revalidate'
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

    // NOTE: intentionally do NOT revalidate the student caches here.
    // This endpoint is the per-scan "learn this face" rolling update — it
    // fires on every successful check-in. Busting the 'students-embeddings'
    // tag would purge the Vercel edge cache for /api/students/embeddings
    // (the ~6MB face-vector payload) on every scan, forcing every kiosk's
    // next hydrate to re-download it from origin — a huge Fast Origin
    // Transfer spike during morning check-in. The scanning kiosk already
    // updated its in-memory copy locally; other kiosks pick up the new
    // embedding on the next hourly cache cycle, which is fine for a
    // background recognition-improvement step. (Deliberate enrolls via
    // /setup use PUT, which still revalidates.)
    //
    // We also skip re-selecting the student row: the caller ignores the
    // response body, and select('*') would haul the full face_embeddings
    // jsonb back out of Supabase on every scan for nothing.
    return NextResponse.json({ success: true })
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
      .from('std_students' as any)
      .update({ face_embeddings: embeddings })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    revalidateStudentReaders()

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
