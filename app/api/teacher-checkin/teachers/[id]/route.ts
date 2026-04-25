import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

// POST /api/teacher-checkin/teachers/[id] — create empty enrollment placeholder
// Teacher will log in on their own device and complete face enrollment.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { error } = await supabaseServer
      .from('std_teacher_faces' as any)
      .upsert(
        {
          teacher_id: id,
          face_embeddings: [],
          enrolled_at: null,
        },
        { onConflict: 'teacher_id' }
      )

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Teacher POST error:', error)
    return NextResponse.json({ error: 'Failed to add teacher' }, { status: 500 })
  }
}

// DELETE /api/teacher-checkin/teachers/[id] — remove teacher enrollment
// (deletes std_teacher_faces row; std_teacher_attendance rows are kept for history)
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { error } = await supabaseServer
      .from('std_teacher_faces' as any)
      .delete()
      .eq('teacher_id', id)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Teacher DELETE error:', error)
    return NextResponse.json({ error: 'Failed to remove teacher' }, { status: 500 })
  }
}
