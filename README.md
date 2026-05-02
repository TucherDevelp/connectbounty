# ConnectBounty

Plattform für Job-Referral-Boni mit drei klar getrennten Personas:

| Persona | Rolle |
|---|---|
| **Inserent** | Erstellt einen Bounty (Job-Ausschreibung mit Bonus). Ist die einstellende Partei und zahlt die Provision. |
| **Kandidat (Bewerber)** | Bewirbt sich auf den ausgeschriebenen Job. Bestätigt via Flag, wenn die Bewerbung eingereicht wurde (löst Kontaktfreigabe aus). |
| **Referrer** | Reine Akquisefunktion – wirbt Nutzer (Inserenten oder Kandidaten) für die Plattform an. Hat nach dem Onboarding keinen Einfluss auf den Bewerbungs- oder Einstellungsprozess. |

**Fester Auszahlungsschlüssel** (Konzept: `docs/KONZEPTPLATTFORM-GESCHAEFTSMODELL.md`):
40 % Inserent · 35 % Kandidat · 5 % Referrer(n) · 20 % Plattform (25 % ohne Referrer).

## Status

**Phase 1–2 abgeschlossen** (Fundament + Kernflows):

- ✅ Auth + KYC-Prüfung (Ballerine)
- ✅ Bounty-Erstellung + Admin-Approval-Workflow
- ✅ Referral-Einreichung durch Referrer (mit Personas streng getrennt)
- ✅ Three-Stage-Confirmation-Flow (Hire-Proof → Claim → Payout-Account → Data-Forwarding)
- ✅ Anonyme Phase: Kontaktdaten erst nach Bewerbungs-Flag freigegeben
- ✅ Ablehnungs-Schreiben-Upload (Inserent) nach Kontaktfreigabe
- ✅ Split-Payout via Stripe Connect + Invoice (40/35/5/20)
- ✅ Dispute-Flow Grundgerüst (Admin)
- ✅ Stripe-Webhook-Handler
- ✅ Migrations 0001–0013 deployed

**Nächste Schritte (Phase 3)**:
- Real-Time Notifications (Supabase Realtime)
- E-Mail-Workflows (Resend)
- Reputation-Punkte-Berechnung
- Admin-Payout-Dashboard (Stripe Transfer Monitoring)

Alter Code liegt zur Referenz in `[_legacy/](./_legacy)`.

## Tech-Stack (Ziel)

- **Frontend**: Next.js 16 (App Router) + React 19 + TypeScript + Tailwind v4 + shadcn/ui
- **Auth + DB + Storage + Realtime**: Supabase
- **KYC**: Ballerine (Open-Source - Dokument, Liveness, Face-Match, Adress-/TIN-Prüfung)
- **Payments**: Stripe Connect Express
- **Edge-Logik**: Supabase Edge Functions (Webhooks, Moderation)
- **Rate-Limits**: Upstash Redis
- **Mail**: Resend
- **Observability**: Sentry + Logflare
- **Deploy**: Vercel + Vercel Firewall

## Lokale Entwicklung

```bash
npm install
cp .env.example .env.local      # Werte aus Supabase-Dashboard eintragen
npm run check:supabase          # prüft Anon- und Service-Role-Key live
npm run dev                     # http://localhost:3000
npm run typecheck
npm run lint
npm run test
npm run build
```

### Benötigte Env-Variablen

Siehe `[.env.example](./.env.example)`. Werden via `lib/env.ts` (Zod) beim
ersten Zugriff validiert - fehlende Werte führen zu einem klaren Fehler statt
einem stillen Crash zur Laufzeit.


| Variable                        | Scope  | Quelle                            |
| ------------------------------- | ------ | --------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Client | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client | Supabase → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY`     | Server | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SITE_URL`          | Client | `http://localhost:3000` lokal     |


## Verzeichnisstruktur

```
app/
  (admin)/            Admin-Bereich (Bounties, KYC, Disputes, Referrals, Users)
  (app)/              User-Bereich (Bounties, Referrals, Payout-Onboarding)
  api/
    stripe/webhooks/  Stripe-Webhook-Handler (invoice.paid, transfer.created, …)
    storage/          Signed-Upload-URLs (hire-proof, rejection-documents)
components/
  referral/           Referral-spezifische Komponenten (Timeline, Buttons, Badges)
  ui/                 Wiederverwendbare UI-Primitives (Button, Input, Select, …)
lib/
  admin/              Server Actions für Admin-Flows
  auth/               Session, Rollen, Audit-Log
  bounty/             Bounty-Schemas + Actions
  referral/           Referral-Schemas, Confirmations-Actions, Tests
  stripe/
    split.ts          Split-Berechnung (40/35/5/20, assertFixedSplit)
    split-constants.ts Konzept-Konstanten (INSERENT_BPS, CANDIDATE_BPS, …)
    payout-orchestrator.ts  Payout-Phase-1 (Invoice) + Phase-2 (Transfers)
    transfers.ts      Stripe-Transfer-Ausführung (idempotent)
  supabase/           Client, Server, Types (DB-Typen, manuell gepflegt)
  env.ts              Zod-Env-Validation
  i18n.ts             Übersetzungsstrings (de/en)
supabase/
  migrations/         SQL-Migrationen 0001–0013
  functions/          Edge Functions (geplant)
scripts/
  force-migrate.mjs   Direkter DB-Migrations-Runner (ohne supabase link)
  test-rls-view.mjs   RLS-Test für bounty_referrals_owner_view
docs/
  KONZEPTPLATTFORM-GESCHAEFTSMODELL.md  Vollständiges Geschäftsmodell
public/               Statische Assets
_legacy/              Vorheriger Code (read-only Referenz)
```

## Supabase-CLI

Verbindung zum Cloud-Projekt herstellen (einmalig pro Maschine):

```bash
export SUPABASE_ACCESS_TOKEN=<personal-access-token>   # https://supabase.com/dashboard/account/tokens
npx supabase link --project-ref gggovrqckwhjqipfoetu
```

Danach: `npx supabase db push`, `npx supabase gen types typescript ...`,
`npx supabase functions deploy <name>`.

## Auth Branding (Google + E-Mail)

### Google-Login: "ConnectBounty" statt Supabase-Ref

Wenn bei Google aktuell die Supabase-Project-ID/Domain sichtbar ist, liegt das an der
OAuth-Client-Konfiguration in Google Cloud bzw. Supabase-Dashboard (nicht am Next.js-Code).

1. In Supabase unter Authentication -> Providers -> Google eigene Google Credentials eintragen.
2. In Google Cloud den OAuth Consent Screen auf Produktname `ConnectBounty` setzen.
3. Falls moeglich eine eigene Auth-Domain verwenden (Custom Domain), damit nicht die
  `<project-ref>.supabase.co` Domain im OAuth-Flow angezeigt wird.

### Gebrandete Auth-E-Mails (Light Mode)

Fuer lokale/self-hosted Supabase-Umgebungen sind HTML-Templates hinterlegt:

- `supabase/templates/confirmation.html`
- `supabase/templates/recovery.html`
- `supabase/templates/email-change.html`
- `supabase/templates/magic-link.html`
- `supabase/templates/invite.html`

Sie werden ueber `supabase/config.toml` unter `[auth.email.template.*]` verdrahtet
und verwenden das ConnectBounty-Branding (helles Layout + Logo).

Fuer gehostete Supabase-Projekte muessen dieselben Inhalte im Dashboard unter
Authentication -> Email Templates gepflegt werden.