import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

// Daily auto-close of teacher attendance rows that were never checked out.
// Triggered by pg_cron at 17:00 UTC = 00:00 Asia/Bangkok.
// Deployed via Supabase MCP; scheduled via cron.schedule() + pg_net.http_post.

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  )

  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())

  const { data: settingRow } = await supabase
    .from("std_teacher_settings")
    .select("value")
    .eq("key", "check_out_end")
    .maybeSingle()

  const checkoutEnd = (settingRow?.value as string) || "22:00"

  const { data: stale, error: selErr } = await supabase
    .from("std_teacher_attendance")
    .select("id, date")
    .lt("date", today)
    .not("check_in", "is", null)
    .is("check_out", null)

  if (selErr) {
    return new Response(
      JSON.stringify({ ok: false, error: selErr.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }

  let closed = 0
  for (const row of (stale || []) as { id: string; date: string }[]) {
    const checkOutISO = new Date(
      `${row.date}T${checkoutEnd}:00+07:00`
    ).toISOString()
    const { error } = await supabase
      .from("std_teacher_attendance")
      .update({ check_out: checkOutISO, auto_checkout: true })
      .eq("id", row.id)
    if (!error) closed++
  }

  return new Response(
    JSON.stringify({ ok: true, closed, today, checkoutEnd }),
    { headers: { "Content-Type": "application/json" } }
  )
})
