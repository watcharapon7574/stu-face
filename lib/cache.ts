import { unstable_cache } from 'next/cache'
import { supabaseServer } from '@/lib/supabase/server'
import { CACHE_TAGS } from '@/lib/revalidate'

// All fetchers below cache their result in the Next.js Data Cache keyed by
// (function-name, args). On Vercel, this layer is shared across regions
// and is invalidated by revalidateTag() — which also purges the Vercel
// Edge Cache for any Route Handler response that reads from it. That's
// the contract that lets us trust slim/embeddings staleness.

type SlimStudent = {
  id: string
  name: string
  nickname: string | null
  service_point: string | null
  classroom_id: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  // Always [] in slim responses — use embedding_count for UI badges and
  // fetch /api/students/embeddings when you need the real vectors.
  face_embeddings: never[]
  embedding_count: number
}

// Fetch slim roster (no embeddings), keyed by service_point + is_active.
// embedding_count is read straight from a stored generated column on
// std_students (jsonb_array_length of face_embeddings) so this never
// transfers the heavy ~6MB jsonb out of Supabase just to count it.
export const getSlimStudents = unstable_cache(
  async (servicePoint: string | null, isActive: boolean | null): Promise<SlimStudent[]> => {
    let query = supabaseServer
      .from('std_students' as any)
      .select(
        'id, name, nickname, service_point, classroom_id, is_active, created_at, updated_at, embedding_count',
      )
      .order('name')

    if (servicePoint) {
      query = query.eq('service_point', servicePoint)
    }
    if (isActive !== null) {
      query = query.eq('is_active', isActive)
    }

    const { data, error } = await query
    if (error) throw error

    const rows = (data ?? []) as Array<Record<string, unknown> & { embedding_count?: number }>
    return rows.map((row) => ({
      ...(row as Omit<SlimStudent, 'face_embeddings' | 'embedding_count'>),
      face_embeddings: [] as never[],
      embedding_count: typeof row.embedding_count === 'number' ? row.embedding_count : 0,
    }))
  },
  ['students-slim'],
  { tags: [CACHE_TAGS.students], revalidate: 3600 },
)

type EmbeddingRow = { id: string; face_embeddings: number[][] }

// Fetch embeddings only — heavy payload, but mostly stable. Cached longer
// since changes only come through /setup which busts the tag explicitly.
export const getStudentEmbeddings = unstable_cache(
  async (servicePoint: string | null, isActive: boolean | null): Promise<EmbeddingRow[]> => {
    let query = supabaseServer
      .from('std_students' as any)
      .select('id, face_embeddings')

    if (servicePoint) {
      query = query.eq('service_point', servicePoint)
    }
    if (isActive !== null) {
      query = query.eq('is_active', isActive)
    }

    const { data, error } = await query
    if (error) throw error

    const rows = (data ?? []) as Array<{ id: string; face_embeddings: unknown }>
    return rows
      .filter((r) => Array.isArray(r.face_embeddings) && (r.face_embeddings as unknown[]).length > 0)
      .map((r) => ({ id: r.id, face_embeddings: r.face_embeddings as number[][] }))
  },
  ['students-embeddings'],
  { tags: [CACHE_TAGS.studentEmbeddings], revalidate: 3600 },
)
