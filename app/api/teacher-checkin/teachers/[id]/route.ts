import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

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
