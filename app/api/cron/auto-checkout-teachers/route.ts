import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

export const maxDuration = 30

// GET /api/cron/auto-checkout-teachers
// Runs daily via Vercel Cron. Closes any teacher attendance row from a past
// date that has check_in set but no check_out, by stamping check_out at the
// configured check_out_end time (Asia/Bangkok) and flagging auto_checkout.
export async function GET(request: Request) {
  // Auth: Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}`
  const authHeader = request.headers.get('authorization')
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    // Today's date in Bangkok
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Bangkok',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date())

    // Read check_out_end (default 22:00)
    const { data: settings } = await supabaseServer
      .from('std_teacher_settings' as any)
      .select('key, value')
      .eq('key', 'check_out_end')
      .maybeSingle()

    const checkoutEnd = settings?.value || '22:00'

    // Find rows from past dates that have check_in but no check_out
    const { data: stale } = await supabaseServer
      .from('std_teacher_attendance' as any)
      .select('id, teacher_id, date, check_in')
      .lt('date', today)
      .not('check_in', 'is', null)
      .is('check_out', null)

    if (!stale || stale.length === 0) {
      return NextResponse.json({ ok: true, closed: 0, today, checkoutEnd })
    }

    // Close each row with that date's check_out_end (+07:00)
    let closed = 0
    for (const row of stale as any[]) {
      // row.date is "YYYY-MM-DD"
      const checkOutISO = new Date(
        `${row.date}T${checkoutEnd}:00+07:00`
      ).toISOString()

      const { error } = await supabaseServer
        .from('std_teacher_attendance' as any)
        .update({
          check_out: checkOutISO,
          auto_checkout: true,
        })
        .eq('id', row.id)

      if (!error) closed += 1
    }

    return NextResponse.json({ ok: true, closed, today, checkoutEnd })
  } catch (error) {
    console.error('Auto-checkout cron error:', error)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}
