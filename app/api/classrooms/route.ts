import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

// GET /api/classrooms?service_point_id=xxx
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const servicePointId = searchParams.get('service_point_id')

    let query = supabaseServer
      .from('std_classrooms' as any)
      .select('id, name, service_point_id, is_active')
      .eq('is_active', true)
      .order('name')

    if (servicePointId) {
      query = query.eq('service_point_id', servicePointId)
    }

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json({ classrooms: data || [] })
  } catch (error) {
    console.error('Classrooms GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
