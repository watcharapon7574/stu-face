import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

// POST /api/teacher-checkin/enroll
// Body: { teacher_id, embeddings: number[][], device_fingerprint? }
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { teacher_id, embeddings, device_fingerprint } = body

    if (!teacher_id || !Array.isArray(embeddings) || embeddings.length === 0) {
      return NextResponse.json(
        { success: false, message: 'ข้อมูลไม่ครบ (teacher_id, embeddings)' },
        { status: 400 }
      )
    }

    // Schema constraint: max 10 embeddings
    const capped = embeddings.slice(0, 10)

    const { error } = await supabaseServer
      .from('std_teacher_faces' as any)
      .upsert(
        {
          teacher_id,
          face_embeddings: capped,
          device_fingerprint: device_fingerprint || null,
          enrolled_at: new Date().toISOString(),
        },
        { onConflict: 'teacher_id' }
      )

    if (error) {
      console.error('Enroll error:', error)
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'ลงทะเบียนใบหน้าสำเร็จ',
      embedding_count: capped.length,
    })
  } catch (error) {
    console.error('Enroll route error:', error)
    return NextResponse.json(
      { success: false, message: 'เกิดข้อผิดพลาด' },
      { status: 500 }
    )
  }
}
