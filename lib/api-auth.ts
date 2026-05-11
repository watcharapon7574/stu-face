import { NextResponse } from 'next/server'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface AuthOk {
  ok: true
  teacherId: string
}

export interface AuthErr {
  ok: false
  response: NextResponse
}

/**
 * Validates Authorization: Bearer <teacher-uuid> on an incoming request.
 * Returns the teacher id on success, or a 401 NextResponse on failure.
 *
 * Why a teacher uuid: the saved teacher in localStorage is the only piece
 * of identity the client has after OTP login. UUID v4 is unguessable, so
 * this stops untargeted scripts hitting the API while staying simple —
 * no extra env var, no token-issuing route.
 */
export function requireBearer(request: Request): AuthOk | AuthErr {
  const header = request.headers.get('authorization')
  if (!header?.toLowerCase().startsWith('bearer ')) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }
  const token = header.slice(7).trim()
  if (!UUID_RE.test(token)) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Invalid token' }, { status: 401 }),
    }
  }
  return { ok: true, teacherId: token }
}
