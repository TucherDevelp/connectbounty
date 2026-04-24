/**
 * Supabase Edge Function: dispatch-reminders
 *
 * Wird via pg_cron stündlich aufgerufen (oder manuell via Dashboard).
 *
 * Setup in Supabase Dashboard → Database → Cron Jobs:
 *   Schedule: 0 * * * *  (stündlich)
 *   Command:  SELECT net.http_post(
 *               url := 'https://<ref>.supabase.co/functions/v1/dispatch-reminders',
 *               headers := '{"Authorization":"Bearer <anon-key>"}',
 *               body := '{}'
 *             );
 *
 * Alternativ via Supabase CLI:
 *   npx supabase functions deploy dispatch-reminders
 */

// Deno-kompatibler Import (Edge Functions laufen auf Deno)
// Die eigentliche Reminder-Logik ist in lib/reminders/service.ts definiert
// und wird hier über eine direkte DB-Abfrage gespiegelt, da Next.js-Imports
// in Edge Functions nicht verfügbar sind.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

Deno.serve(async (_req) => {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(
      JSON.stringify({ error: "Missing env vars" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  // Referrals mit offenen Rechnungen laden
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/bounty_referrals?status=eq.invoice_pending&payment_window_until=not.is.null&select=id,payment_window_until,bounty_id`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
    },
  );

  const referrals = (await res.json()) as Array<{
    id: string;
    payment_window_until: string;
    bounty_id: string;
  }>;

  const now = Date.now();
  let sent = 0;
  let skipped = 0;

  for (const r of referrals) {
    const windowEnd = new Date(r.payment_window_until).getTime();
    const windowStart = windowEnd - 14 * 24 * 60 * 60 * 1000;
    const daysSince = Math.floor((now - windowStart) / (1000 * 60 * 60 * 24));

    for (const day of [7, 10, 13]) {
      if (daysSince < day) continue;

      const insertRes = await fetch(
        `${SUPABASE_URL}/rest/v1/payment_reminders`,
        {
          method: "POST",
          headers: {
            apikey: SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            "Content-Type": "application/json",
            Prefer: "return=minimal,resolution=ignore-duplicates",
          },
          body: JSON.stringify({
            referral_id: r.id,
            due_day: day,
            channel: "in_app",
            sent_at: new Date().toISOString(),
          }),
        },
      );

      if (insertRes.status === 409 || insertRes.status === 200 || insertRes.status === 201) {
        if (insertRes.status === 409) { skipped++; continue; }
        sent++;
      } else {
        skipped++;
      }
    }
  }

  return new Response(
    JSON.stringify({ ok: true, sent, skipped }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
});
