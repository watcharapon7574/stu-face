import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { requireBearer } from '@/lib/api-auth'
import { revalidateDashboardReaders } from '@/lib/revalidate'

// DELETE /api/attendance/[id] - ลบบันทึกการเช็คชื่อ (กดผิดคน/นิคเนมซ้ำ)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireBearer(request)
  if (!auth.ok) return auth.response

  try {
    // requireBearer only validates UUID v4 format. Verify the token maps to
    // a real teacher in profiles before letting it destroy data — DELETE is
    // far more dangerous than the existing POST upsert (which can only
    // pollute, not erase).
    const { data: profile, error: profileErr } = await supabaseServer
      .from('profiles')
      .select('id')
      .eq('id', auth.teacherId)
      .maybeSingle()
    if (profileErr) throw profileErr
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: 'id required' }, { status: 400 })
    }

    // Log deletions so we have a paper trail when a record disappears.
    // (Audit log table doesn't exist; console is the next-best until we add one.)
    console.warn(
      `[attendance.delete] teacher=${auth.teacherId} attendance=${id}`
    )

    const { error } = await supabaseServer
      .from('std_attendance' as any)
      .delete()
      .eq('id', id)

    if (error) throw error

    revalidateDashboardReaders()
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting attendance:', error)
    return NextResponse.json(
      { error: 'Failed to delete attendance' },
      { status: 500 }
    )
  }
}
