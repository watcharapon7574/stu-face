import { NextResponse } from 'next/server'

const FACE_API_URL = process.env.FACE_API_URL || 'http://localhost:8000'
const FACE_API_KEY = process.env.FACE_API_SECRET_KEY || ''

// POST /api/teacher-checkin/enroll — proxy to Python API
export async function POST(request: Request) {
  try {
    const body = await request.json()

    const res = await fetch(`${FACE_API_URL}/enroll`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': FACE_API_KEY,
      },
      body: JSON.stringify(body),
    })

    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch (error) {
    console.error('Enroll proxy error:', error)
    return NextResponse.json(
      { success: false, message: 'ไม่สามารถเชื่อมต่อ Face API ได้' },
      { status: 502 }
    )
  }
}
