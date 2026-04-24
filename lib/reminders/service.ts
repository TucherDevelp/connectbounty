import "server-only";

import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { logAuditEvent } from "@/lib/auth/roles";

export type ReminderChannel = "email" | "in_app";
export type ReminderDay = 7 | 10 | 13;

/**
 * Prüft alle Referrals mit offenen Rechnungen (status = invoice_pending)
 * und versendet fällige Zahlungserinnerungen an Tag 7, 10 und 13
 * (gerechnet ab `payment_window_until - 14 Tage`).
 *
 * Idempotenz: Die `payment_reminders`-Tabelle hat einen UNIQUE-Constraint
 * auf (referral_id, due_day, channel). Ein wiederholter Aufruf schreibt
 * maximal eine Zeile pro Slot - `onConflict: ignore` macht den Rest.
 *
 * Aufruf: Supabase Edge Function (pg_cron, stündlich) oder manueller
 * Admin-Trigger. Niemals direkt aus Client-Code.
 */
export async function dispatchDueReminders(): Promise<{ sent: number; skipped: number }> {
  const sb = getSupabaseServiceRoleClient();
  const now = new Date();

  // Alle offenen Referrals mit Zahlungsfenster laden
  const { data: referrals, error } = await sb
    .from("bounty_referrals")
    .select("id, payment_window_until, referrer_id, candidate_user_id, bounty_id")
    .eq("status", "invoice_pending")
    .not("payment_window_until", "is", null);

  if (error || !referrals) return { sent: 0, skipped: 0 };

  let sent = 0;
  let skipped = 0;

  for (const referral of referrals) {
    if (!referral.payment_window_until) continue;

    const windowEnd = new Date(referral.payment_window_until);
    const windowStart = new Date(windowEnd.getTime() - 14 * 24 * 60 * 60 * 1000);
    const daysSinceStart = Math.floor(
      (now.getTime() - windowStart.getTime()) / (1000 * 60 * 60 * 24),
    );

    const dueDays: ReminderDay[] = [7, 10, 13];

    for (const day of dueDays) {
      if (daysSinceStart < day) continue;

      // Prüfen ob Erinnerung für diesen Tag + Channel bereits gesendet
      const { error: insertError } = await sb
        .from("payment_reminders")
        .insert({
          referral_id: referral.id,
          due_day: day,
          channel: "in_app" as ReminderChannel,
          sent_at: now.toISOString(),
        })
        .select()
        .single();

      if (insertError) {
        // Unique-Constraint-Verletzung = bereits gesendet
        if ((insertError as { code?: string }).code === "23505") {
          skipped++;
          continue;
        }
        // Anderer Fehler: überspringen (non-blocking)
        skipped++;
        continue;
      }

      // In-App Notification (Audit-Log als Proxy bis echtes Notification-System steht)
      try {
        await logAuditEvent({
          action: "reminder.sent",
          targetId: referral.id,
          metadata: {
            day,
            channel: "in_app",
            bounty_id: referral.bounty_id,
            days_remaining: 14 - day,
          },
        });
      } catch { /* non-blocking */ }

      sent++;
    }
  }

  return { sent, skipped };
}
