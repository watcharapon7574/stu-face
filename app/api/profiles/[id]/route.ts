import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

// GET /api/profiles/[id] — minimal teacher self-profile
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Join the admin flag from std_teacher_faces so the client can hide
    // admin-only UI (e.g. the student-management tab in /setup) without a
    // second round trip.
    const [profileRes, faceRes] = await Promise.all([
      supabaseServer
        .from('profiles')
        .select('id, prefix, first_name, last_name, nickname, workplace')
        .eq('id', id)
        .maybeSingle(),
      supabaseServer
        .from('std_teacher_faces' as any)
        .select('is_admin')
        .eq('teacher_id', id)
        .maybeSingle(),
    ])

    if (profileRes.error) throw profileRes.error
    if (!profileRes.data) return NextResponse.json({ error: 'not found' }, { status: 404 })

    return NextResponse.json({
      profile: {
        ...profileRes.data,
        is_admin: !!(faceRes.data as { is_admin?: boolean } | null)?.is_admin,
      },
    })
  } catch (error) {
    console.error('Profile GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/profiles/[id] — update workplace (only allowed field via this route)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const workplace = typeof body.workplace === 'string' ? body.workplace.trim() : null

    if (!workplace) {
      return NextResponse.json(
        { error: 'workplace is required' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseServer
      .from('profiles')
      .update({ workplace })
      .eq('id', id)
      .select('id, workplace')
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, profile: data })
  } catch (error) {
    console.error('Profile PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
