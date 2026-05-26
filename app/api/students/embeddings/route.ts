import { NextResponse } from 'next/server'
import { getStudentEmbeddings } from '@/lib/cache'

// GET /api/students/embeddings - ดึงเฉพาะ face_embeddings ของนักเรียน
// Heavy payload (face vectors) but rarely changes. Backed by unstable_cache
// (tag: 'students-embeddings'), invalidated by revalidateStudentReaders()
// whenever /setup re-enrolls a face. Edge cache hangs onto a copy for
// repeat kiosk requests.
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const servicePoint = searchParams.get('service_point')
    const isActiveParam = searchParams.get('is_active')
    const isActive = isActiveParam === null ? null : isActiveParam === 'true'

    const embeddings = await getStudentEmbeddings(servicePoint, isActive)

    const res = NextResponse.json({ embeddings })
    res.headers.set(
      'Cache-Control',
      'public, s-maxage=3600, stale-while-revalidate=86400',
    )
    return res
  } catch (error) {
    console.error('Error fetching student embeddings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch embeddings' },
      { status: 500 }
    )
  }
}
