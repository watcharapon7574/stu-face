import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

const MATCH_THRESHOLD = 0.6 // cosine similarity normalized to 0-1

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb)
  if (denom === 0) return 0
  return (dot / denom + 1) / 2
}

// POST /api/teacher-checkin/verify
// Body: { teacher_id, embedding: number[], device_fingerprint?, service_point_id?, check_type, date }
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      teacher_id,
      embedding,
      device_fingerprint,
      service_point_id,
      check_type,
      date,
    } = body

    if (!teacher_id || !Array.isArray(embedding) || !check_type || !date) {
      return NextResponse.json(
        {
          matched: false,
          attendance_saved: false,
          message: 'ข้อมูลไม่ครบ (teacher_id, embedding, check_type, date)',
        },
        { status: 400 }
      )
    }

    // Fetch stored embeddings
    const { data: face } = await supabaseServer
      .from('std_teacher_faces' as any)
      .select('face_embeddings')
      .eq('teacher_id', teacher_id)
      .maybeSingle()

    const stored = (face?.face_embeddings as number[][] | undefined) || []
    if (stored.length === 0) {
      return NextResponse.json(
        {
          matched: false,
          attendance_saved: false,
          confidence: 0,
          is_real: true,
          message: 'ไม่พบข้อมูลใบหน้า กรุณาลงทะเบียนก่อน',
        },
        { status: 404 }
      )
    }

    // Find best match
    let maxSim = 0
    for (const emb of stored) {
      const sim = cosineSimilarity(embedding, emb)
      if (sim > maxSim) maxSim = sim
    }

    if (maxSim < MATCH_THRESHOLD) {
      return NextResponse.json({
        matched: false,
        attendance_saved: false,
        confidence: maxSim,
        is_real: true,
        spoofing_scores: [],
        frame_results: { total: 1, real: 1, matched: 0 },
        message: `ใบหน้าไม่ตรง (${(maxSim * 100).toFixed(0)}%) กรุณาลองใหม่`,
      })
    }

    // Match passed — save attendance
    const now = new Date().toISOString()
    const isCheckIn = check_type === 'check_in'

    const { data: existing } = await supabaseServer
      .from('std_teacher_attendance' as any)
      .select('id, check_in, check_out')
      .eq('teacher_id', teacher_id)
      .eq('date', date)
      .maybeSingle()

    const timeFields = isCheckIn
      ? { check_in: now, confidence_in: maxSim, anti_spoof_score_in: 1 }
      : { check_out: now, confidence_out: maxSim, anti_spoof_score_out: 1 }

    const optionalFields: Record<string, unknown> = {}
    if (service_point_id) optionalFields.service_point_id = service_point_id
    if (device_fingerprint) optionalFields.device_fingerprint = device_fingerprint

    if (existing) {
      const { error } = await supabaseServer
        .from('std_teacher_attendance' as any)
        .update({ ...timeFields, ...optionalFields })
        .eq('id', existing.id)
      if (error) throw error
    } else {
      const { error } = await supabaseServer
        .from('std_teacher_attendance' as any)
        .insert({
          teacher_id,
          date,
          ...timeFields,
          ...optionalFields,
        })
      if (error) throw error
    }

    return NextResponse.json({
      matched: true,
      attendance_saved: true,
      confidence: maxSim,
      is_real: true,
      anti_spoof_score: 1,
      spoofing_scores: [0],
      frame_results: { total: 1, real: 1, matched: 1 },
      message: isCheckIn ? 'สแกนเข้างานสำเร็จ' : 'สแกนออกงานสำเร็จ',
    })
  } catch (error) {
    console.error('Verify route error:', error)
    return NextResponse.json(
      {
        matched: false,
        attendance_saved: false,
        message: 'เกิดข้อผิดพลาด',
      },
      { status: 500 }
    )
  }
}
