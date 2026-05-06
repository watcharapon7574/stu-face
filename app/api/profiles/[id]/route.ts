import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

// GET /api/profiles/[id] — minimal teacher self-profile
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { data, error } = await supabaseServer
      .from('profiles')
      .select('id, prefix, first_name, last_name, nickname, workplace')
      .eq('id', id)
      .maybeSingle()

    if (error) throw error
    if (!data) return NextResponse.json({ error: 'not found' }, { status: 404 })

    return NextResponse.json({ profile: data })
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
