import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

const ALLOWED_FIELDS = [
  'name',
  'nickname',
  'date_of_birth',
  'service_point',
  'service_point_id',
  'classroom_id',
  'is_active',
  'photo_url',
] as const

// PATCH /api/students/[id] — edit student fields
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const update: Record<string, unknown> = {}
    for (const key of ALLOWED_FIELDS) {
      if (key in body) update[key] = body[key]
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'No editable fields provided' }, { status: 400 })
    }

    const { data, error } = await supabaseServer
      .from('std_students' as any)
      .update(update)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, student: data })
  } catch (error) {
    console.error('Student PATCH error:', error)
    return NextResponse.json({ error: 'Failed to update student' }, { status: 500 })
  }
}

// DELETE /api/students/[id]
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { error } = await supabaseServer
      .from('std_students' as any)
      .delete()
      .eq('id', id)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Student DELETE error:', error)
    return NextResponse.json({ error: 'Failed to delete student' }, { status: 500 })
  }
}
