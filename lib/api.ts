import { getSavedTeacher } from '@/lib/teacher-store'

/**
 * fetch() wrapper that attaches Authorization: Bearer <teacher-uuid> from
 * the saved teacher in localStorage. Server-side routes validate the
 * header via lib/api-auth.ts::requireBearer.
 *
 * Use this instead of raw fetch() for any call to our /api/* routes.
 */
export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const teacher = getSavedTeacher()
  const headers = new Headers(init.headers)
  if (teacher?.id) {
    headers.set('Authorization', `Bearer ${teacher.id}`)
  }
  return fetch(input, { ...init, headers })
}
