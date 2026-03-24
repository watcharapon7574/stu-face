import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

export async function GET() {
  try {
    const { data, error } = await supabaseServer
      .from('std_service_points' as any)
      .select('id, name, short_name, district, lat, lng, radius_meters, is_headquarters')
      .eq('is_active', true)
      .order('name')

    if (error) throw error

    return NextResponse.json({ service_points: data })
  } catch (error) {
    console.error('Error fetching service points:', error)
    return NextResponse.json(
      { error: 'Failed to fetch service points' },
      { status: 500 }
    )
  }
}
