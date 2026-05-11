import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { requireBearer } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

interface GuardianRow {
  name: string
  count: number
  last_used: string
}

// GET /api/students/:id/guardians
// Returns the distinct guardians who have ever picked up or dropped off the
// student, sorted by frequency desc so the UI can default to the most-used one.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireBearer(request)
  if (!auth.ok) return auth.response

  const { id } = await params
  if (!id) {
    return NextResponse.json({ error: 'Missing student id' }, { status: 400 })
  }

  const { data, error } = await supabaseServer
    .from('std_attendance' as any)
    .select('guardian_in, guardian_out, check_in, check_out')
    .eq('student_id', id)

  if (error) {
    console.error('guardians fetch error:', error)
    return NextResponse.json({ error: 'Failed to load guardians' }, { status: 500 })
  }

  const tally = new Map<string, { count: number; last_used: string }>()

  const bump = (raw: string | null | undefined, when: string | null | undefined) => {
    if (!raw) return
    const name = raw.trim()
    if (!name) return
    const ts = when || ''
    const prev = tally.get(name)
    if (prev) {
      prev.count += 1
      if (ts > prev.last_used) prev.last_used = ts
    } else {
      tally.set(name, { count: 1, last_used: ts })
    }
  }

  for (const row of (data || []) as any[]) {
    bump(row.guardian_in, row.check_in)
    bump(row.guardian_out, row.check_out)
  }

  const guardians: GuardianRow[] = Array.from(tally.entries())
    .map(([name, v]) => ({ name, count: v.count, last_used: v.last_used }))
    .sort((a, b) => b.count - a.count || b.last_used.localeCompare(a.last_used))

  return NextResponse.json({ guardians })
}
