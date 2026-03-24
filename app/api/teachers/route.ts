import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

// Keywords that indicate the teacher works at headquarters (ศูนย์หลัก)
const HQ_KEYWORDS = ['ห้อง', 'ห้องเรียน', 'Admin', 'ศูนย์การศึกษา']

// Keywords mapping from workplace text → service point short_name/name fragments
function matchWorkplaceToServicePoint(
  workplace: string | null,
  servicePoints: { id: string; short_name: string; name: string; is_headquarters: boolean }[]
): string | null {
  if (!workplace) return null

  // Check if it's a headquarters workplace (ห้องเรียน, ห้อง, etc.)
  const isHQ = HQ_KEYWORDS.some((kw) => workplace.includes(kw))
  if (isHQ) {
    const hq = servicePoints.find((sp) => sp.is_headquarters)
    return hq?.id || null
  }

  // Fuzzy match: extract district/location keywords from workplace
  // e.g. "หน่วยบริการโคกสำโรง" → match "โคกสำโรง"
  for (const sp of servicePoints) {
    // Check if workplace contains the short_name or parts of the name
    const nameParts = [
      sp.short_name,
      sp.name,
      // Extract district from name like "หน่วยบริการอำเภอXXX" → "XXX"
      sp.name.replace(/หน่วยบริการอำเภอ|หน่วยบริการ|หน่วยฯ\s*/g, '').trim(),
    ]

    for (const part of nameParts) {
      if (!part) continue
      // Fuzzy: check if workplace includes the key part or vice versa
      if (workplace.includes(part) || part.includes(workplace.replace(/หน่วยบริการ/g, '').trim())) {
        return sp.id
      }
    }
  }

  return null
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const servicePointId = searchParams.get('service_point_id')

    // Fetch all service points for matching
    const { data: servicePoints } = await supabaseServer
      .from('std_service_points' as any)
      .select('id, name, short_name, is_headquarters')
      .eq('is_active', true)

    // Fetch all profiles with workplace
    const { data: profiles, error } = await supabaseServer
      .from('profiles')
      .select('id, first_name, last_name, nickname, workplace')
      .not('first_name', 'eq', '')
      .order('first_name')

    if (error) throw error

    // Map profiles to their service point
    const teachers = (profiles || []).map((p) => ({
      id: p.id,
      name: `${p.first_name} ${p.last_name}`.trim(),
      nickname: p.nickname,
      workplace: p.workplace,
      service_point_id: matchWorkplaceToServicePoint(p.workplace, servicePoints || []),
    }))

    // Filter by service point if requested
    if (servicePointId) {
      const filtered = teachers.filter((t) => t.service_point_id === servicePointId)
      return NextResponse.json({ teachers: filtered })
    }

    return NextResponse.json({ teachers })
  } catch (error) {
    console.error('Error fetching teachers:', error)
    return NextResponse.json(
      { error: 'Failed to fetch teachers' },
      { status: 500 }
    )
  }
}
