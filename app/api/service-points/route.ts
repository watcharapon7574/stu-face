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

    const res = NextResponse.json({ service_points: data })
    // Service points are admin-edited very rarely. Long TTL minimizes ISR
    // regenerations; service-point writes don't currently bust this route
    // (add revalidatePath here if a write endpoint is introduced).
    res.headers.set(
      'Cache-Control',
      'public, s-maxage=3600, stale-while-revalidate=86400',
    )
    return res
  } catch (error) {
    console.error('Error fetching service points:', error)
    return NextResponse.json(
      { error: 'Failed to fetch service points' },
      { status: 500 }
    )
  }
}
