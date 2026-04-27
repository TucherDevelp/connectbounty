# ConnectBounty

Plattform für Job-Referral-Boni: Vermittler inserieren Sign-On-Boni, Freelancer-Rollen,
Studenten-Programme und Sales-Incentives. Bewerber werden über plattforminternen Chat
vermittelt; nach erfolgreicher Vermittlung fließt eine Provision.

## Status

Im Rebuild nach dem Plan unter `.cursor/plans/`. Aktuell **Phase 0 - Fundament**.
Alter Code liegt zur Referenz in [`_legacy/`](./_legacy).

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

Siehe [`.env.example`](./.env.example). Werden via `lib/env.ts` (Zod) beim
ersten Zugriff validiert - fehlende Werte führen zu einem klaren Fehler statt
einem stillen Crash zur Laufzeit.

| Variable                          | Scope     | Quelle                                 |
| --------------------------------- | --------- | -------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`        | Client    | Supabase → Project Settings → API      |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`   | Client    | Supabase → Project Settings → API      |
| `SUPABASE_SERVICE_ROLE_KEY`       | Server    | Supabase → Project Settings → API      |
| `NEXT_PUBLIC_SITE_URL`            | Client    | `http://localhost:3000` lokal          |

## Verzeichnisstruktur

```
app/                  Next.js App Router (Routen, Layouts, Pages)
components/ui/        Wiederverwendbare UI-Primitives (Button, …)
lib/
  env.ts              Zod-basierte Env-Validation (client + server)
  supabase/
    client.ts         Browser-Singleton (Client Components)
    server.ts         Server Components / Actions / Route Handler
    middleware.ts     Session-Refresh (wird aus proxy.ts aufgerufen)
    types.ts          Generierte DB-Typen (Stub bis Schema v1)
  utils.ts            cn() - Tailwind-aware className-Combiner
proxy.ts              Globale Security-Header + Supabase-Session-Refresh
supabase/
  config.toml         Supabase-CLI-Konfiguration
  migrations/         SQL-Migrationen (ab Phase 1)
  functions/          Edge Functions (ab Phase 2)
public/               Statische Assets (Logo, Fonts, OG-Bilder)
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
