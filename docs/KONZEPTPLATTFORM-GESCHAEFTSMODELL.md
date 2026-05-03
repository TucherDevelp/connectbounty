# ConnectBounty - Konzeptpapier

## Geschäftsmodell, Conversion-Schutz, Tracking, KYC & Technische Architektur

---

## 1. Zweck und Positionierung

ConnectBounty ist eine **plattformgebundene Vermittlungsumgebung** für Job-Referral-Boni und ähnliche Anreize (Freelancer-Rollen, Programme mit Sign-On-Bonus).

**Was ist ein Bounty?** Viele Unternehmen zahlen ihren Mitarbeitern oder externen Personen eine Prämie, wenn diese erfolgreich einen geeigneten Kandidaten für eine offene Stelle vermitteln. Diese Prämie wird auf ConnectBounty als "Bounty" bezeichnet. Der Inserent - in der Regel eine Privatperson mit Zugang zu einem solchen Prämienprogramm - schaltet diesen Bounty auf der Plattform und initiiert damit den strukturierten Vermittlungsprozess.

**Verhältnis Inserent und Unternehmen:** Das Unternehmen hat dem Inserenten eine Vermittlungsprämie zugesagt (z. B. im Rahmen eines internen Mitarbeiter-Referral-Programms). Im Erfolgsfall erhält der Inserent diese Prämie vom Unternehmen vollständig ausgezahlt. ConnectBounty regelt, wie diese Prämie anschliessend zwischen allen am Vermittlungserfolg beteiligten Parteien aufgeteilt wird.

Kern der Plattform ist nicht nur „Matching“, sondern **messbare Attribution**, **Nachweise**, **regelbasierte Freigaben** und **verteilte Auszahlungen** - sodass Vermittlung und Vergütung **innerhalb eines nachvollziehbaren Prozesses** bleiben und nicht in einem unsichtbaren „Parallelhandel“ zwischen privaten Inserenten und Kandidaten stattfinden.

---

## 2. Geschäftsmodell (wer zahlt wen?)


| Rolle                       | Funktion                                                                   | Erlös                                                                                                                                                                           |
| --------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Inserent (Privatperson)** | Schaltet einen „Bounty“ (Bonus bei erfolgreicher Vermittlung/Einstellung). | **Erlös: 40 %** der vom Unternehmen geschuldeten Provision. Das ist sein **Vergütungsanteil**, keine zu tragende Kostenquote. Das Unternehmen begleicht die Provision **vollständig (100 %)** an den Inserenten; davon **entfallen 40 % auf seinen Erlös**. Die übrigen **60 %** werden ihm gegenüber der Plattform **in Rechnung gestellt** und gemäß Split an Kandidat, Referrer und Plattform verteilt (**Clearing**). Er initiiert den Bounty-Vorgang. |
| **Referrer / Vermittler**   | **Reine Akquisefunktion:** Wirbt Nutzer (Kandidaten) für die Plattform an und ordnet sie einem Bounty-Vorgang zu. Die Rolle des Referrers endet mit der Einreichung - er hat keine weitergehende operative oder inhaltliche Funktion im Bewerbungs- oder Einstellungsprozess. | Erhält 5% Referral-Anteil; bei zwei beteiligten Referrern wird der Anteil fix auf 2,5% / 2,5% aufgeteilt. Wenn kein Referrer beteiligt ist, entfällt dieser Anteil vollständig. |
| **Kandidat**                | Bewirbt sich / wird vorgeschlagen; nimmt Anstellung an (falls zutreffend). | Erhält fix 35% des Bounty (Split „Candidate“).                                                                                                                                  |
| **Plattform**               | Orchestrierung, Compliance (KYC), Streitschlichtung, Technik, Risiko.      | Erhält eine **fixe Plattformgebühr** von 20%; ohne Referrer zusätzlich den entfallenden 5%-Referreranteil (also 25%).                                                           |


Das Modell ist damit ein **Clearing-House für Attribution + Auszahlung**: Der monetäre Mehrwert entsteht durch **Vertrauen**, **Nachweis** und **Automatisierung** - nicht durch einen anonymen Kontaktbrief.

> **Rollenbeschränkung Referrer:** Der Referrer hat ausschließlich die Funktion, Nutzer für die Plattform anzuwerben. Er hat keinen Einblick in den weiteren Bewerbungs- oder Einstellungsverlauf und nimmt inhaltlich an diesem Prozess nicht teil.

---

## 3. Warum „Off-Platform Conversion“ kein tragfähiges Ausweichmodell ist

**Die Angst:** Private Inserenten und Kandidaten könnten den Abschluss **ohne Plattform** durchführen, um Gebühren zu sparen.

**Die strukturelle Antwort** dreht sich um drei Ebenen - ökonomisch, prozessual und technisch-rechtlich:

### 3.1 Ökonomisch: Wer soll ohne Plattform die Attribution klären?

Ohne Plattform fehlen:

- ein **einheitlicher Zeitstrahl** (wer hat wen wann eingereicht?),
- eine **eindeutige Zuordnung**, ob Kandidat und Inserent tatsächlich über die Plattform zusammengeführt wurden,
- eine **Treuhand-/Auszahlungslogik**, die erst nach einheitlichen Bestätigungen auslöst.

Der Inserent spart kurzfristig die Plattformgebühr - übernimmt aber **Volatilität**, **Reputationsschaden** bei Streit („wer hat den Kandidaten zuerst qualifiziert?“) und **Rechts-/Nachweisrisiken** (undokumentierte Vergütungen).

### 3.2 Prozessual: Drei-Stufen-Bestätigung und gebündeltes „Go“ für Auszahlung

Die Three-Stage-Confirmation bedeutet: Eine Auszahlung wird **nicht** durch eine einzelne Aussage ausgelöst, sondern erst dann, wenn drei klar definierte Bestätigungsebenen in der Plattform konsistent vorliegen.

**Stufe 1 - Nachweisstufe (Proof Stage)**

- Es liegt ein nachvollziehbarer Einstellungs- oder Vertragsnachweis im Vorgang vor (z. B. Upload, Referenz, zugeordneter Datensatz).
- Der Vorgang steht nicht mehr im Zustand „unbelegt“, sondern ist formal prüfbar.

**Stufe 2 - Prozessstufe (Process Stage)**

- Pflichtfelder für den Zahlungsprozess sind vollständig (z. B. Auszahlungsdaten, erforderliche Claims, Statusübergänge).
- Der Vorgang ist operativ auszahlungsbereit und nicht durch fehlende Prozessdaten blockiert.

**Stufe 3 - Freigabestufe (Release Stage)**

- Die für den jeweiligen Flow erforderlichen Freigaben/Bestätigungen sind abgeschlossen.
- Es liegt kein offener Konfliktstatus vor, der eine Auszahlung sperrt (z. B. Dispute oder formale Ablehnung).

**Auszahlungs-Gate (entscheidender Punkt):**
Erst wenn alle drei Stufen als erfüllt markiert sind, setzt das System den Vorgang auf „auszahlungsfähig“. Genau dieses gebündelte Gate verhindert, dass off-platform zugesagte, aber in der Plattform nicht belegte oder nicht freigegebene Vorgänge in den Payout laufen.

Damit wird ein „still abgewickelter Deal“ schwerer mit einem konsistenten Audit-Trail zu replizieren - offline Zusagen ohne vollständige Three-Stage-Erfüllung bleiben in der Plattform bewusst nicht auszahlungsreif.

### 3.3 Technisch-rechtlich: Nachweise und Identität binden den Prozess an die Plattform

- **Hire Proof / Dokumenten-Upload** und Status wie „awaiting hire proof“, „invoice pending“ etc. machen den Abschluss **belegbar**.
- **KYC** reduziert Ringbuchungen und anonyme Umgehungsgeschäfte.
- **Audit-Logs** zu Kernereignissen (`referral.`*, `payout.`*) schaffen **Revisionssicherheit** für Streit und Compliance.

**Wichtig:** Vollständige Umgehung kann niemand zu 100 % verhindern - aber sie wird **teuer, unsicher und nicht skalierbar**. Das Geschäftsmodell der Plattform ist genau die **Standardisierung und Bindung** dieser Transaktionskosten.

---

## 4. Tracking des Vermittlungsvorgangs (von Einreichung bis Auszahlung)

Ein überzeugender Nachweis für Investoren und Nutzer ist ein **gläserner Prozess** mit klaren Stationen (Auszug aus dem Schema-/Statusmodell):

1. **Inserat / Anfrage auf Plattform** - Ein privater Inserent erstellt den Bounty-Vorgang auf der Plattform.
2. **Kandidaten-Zuordnung (anonym)** - Der Kandidat wird einem Vorgang zugeordnet. Die Kommunikation zwischen Kandidat und Inserent ist zu diesem Zeitpunkt **vollständig anonym**: Kontaktdaten beider Seiten werden nicht ausgetauscht. Die Plattform fungiert als datenschutzwahrende Zwischenebene.
3. **Bewerbungs-Flag und Kontaktfreigabe** - Sobald der Kandidat explizit das Signal setzt, dass eine Bewerbung abgeschickt wurde oder wird (Flag „Bewerbung eingereicht“), werden seine Kontaktdaten erstmalig an den Inserenten weitergegeben. Dieser Zeitpunkt ist im Audit-Trail protokolliert und markiert den Übergang von der anonymen in die operative Phase.
4. **Aktiver Prozess und Nachweis des Bewerbungsausgangs** - Nach der Kontaktfreigabe gilt: Möchte der Kandidat den Vorgang abschliessen, weil sein Bewerbungsverfahren durch das Unternehmen beendet wurde, ist er verpflichtet, das **offizielle Ablehnungsschreiben des Unternehmens**, bei dem er sich beworben hat, in die Plattform hochzuladen. Eine informelle oder mündliche Mitteilung ist plattformseitig nicht ausreichend; ohne hochgeladenes Dokument verbleibt der Vorgang im aktiven Status. Das Schreiben wird vorgangsbezogen gespeichert und bildet die Grundlage für den weiteren Prozessabschluss.
5. **Nachweis der Einstellung / Hire Proof** - Upload und Prüfpfad (`hire_proof_documents`, Status „awaiting hire proof“ etc.).
6. **Claims / Kontoinformation** - z. B. Auszahlungskonto bestätigt (`awaiting payout_account`).
7. **Datenweitergabe / Abrechnung** - einheitliche Daten für Rechnungsstellung und Auszahlung.
8. **Rechnung / Zahlung** - Status wie „invoice_pending“, „invoice_paid“.
9. **Auszahlung / Split** - Aufteilung in Referrer-, Kandidaten- und Plattformanteile (`amount_*_cents`, Transfer-IDs).
10. **Streit / Eskalation** - Als formale Streitauslöser gelten insbesondere: das Fehlen eines plattformseitig hochgeladenen Ablehnungsschreibens des Unternehmens, das Fehlen eines Zusageschreibens trotz berichtetem Einstellungsergebnis sowie die Nichtzahlung der Plattformrechnung mehr als einen Monat nach dem dokumentierten Einstellungszeitpunkt. Das Vorliegen eines dieser Sachverhalte berechtigt die Plattform, den Vorgang in ein formales Streitverfahren zu überführen.

Parallel laufen **Reminder** und **Reputation Events**, um Nichterfüllung und Spielverhalten zu bestrafen - ohne Tracking keine faire Marktplatzordnung.

---

## 5. KYC und Vertrags-/Nachweis-Upload

### 5.1 KYC (Know Your Customer)

- **Ziel:** Identität und Risiko von Teilnehmern absichern; regulatorisch und fraud-seitig Mindeststandards erfüllen.
- **Technologie-Richtung (laut README):** **Ballerine** (Open Source) für Dokumentprüfung, optional Liveness/Face Match - mit **Mock-Provider** für Entwicklung und später produktiver Anschluss.
- **Effekt für Conversion-Schutz:** Höhere Kosten für Sybil-Angriffe und „Wegwerf-Accounts“, die Off-Platform-Deals maskieren sollen.

### 5.2 Vertrags- und Hire-Proof-Upload

- **Hire proofs** und verwandte Artefakte werden **gebunden an Referral und Nutzer** gespeichert (Storage mit policies - Produktion erfordert angepasste Bucket-/RLS-Policies).
- **Versionierung und Zuordnung** über Tabellen wie `hire_proof_documents` sichern Nachvollziehbarkeit gegenüber reinem E-Mail-Verkehr außerhalb der Plattform.

---

## 6. Split: Inserent, Kandidat, Referrer (Akquise), Plattform

- Fest vereinbarter **Aufteilungsschlüssel** der vom Unternehmen vereinbarten Provision: **40 % Erlös Inserent** / **35 % Kandidat** / **5 % Referrer** / **20 % Plattform**. Die **40 %** sind der **Erlös** des Inserenten (Vergütung für seine Rolle), **nicht** ein „zu tragender“ Fixkosten- oder Lastenanteil.
- **Abwicklung (Inserent):** Das Unternehmen zahlt die Provision **vollständig an den Inserenten**; **wirtschaftlich erhält** der Inserent **40 %** der Provision als **Erlös**. Die **60 %** werden **plattformseitig abgerechnet** (Rechnungsstellung gegenüber dem Inserenten) und an Kandidat, Referrer und Plattform verteilt. Strukturell handelt es sich um ein **Clearing** über den Inserenten als **Zahlungsempfänger gegenüber dem Unternehmen**. Es handelt sich bei den **40 %** nicht um eine zu tragende „Kostenlast“, sondern um den **vertraglich zustehenden Erlösanteil**.
- Referrer-Feinregel: Referrer-Anteil ist ein Akquise-Anteil. Sind zwei Referrer beteiligt, wird der 5 %-Block auf **2,5 % / 2,5 %** aufgeteilt.
- Fallback-Regel ohne Referrer: Ist kein Referrer beteiligt, wird der gesamte 5 %-Referrerblock der Plattform zugeschlagen (**Plattform dann 25 %**).
- Wichtiger Hinweis: Dieser Split ist **immer festgelegt**. In der Technik wird dieser feste Schlüssel in einem späteren Implementierungsschritt verbindlich umgesetzt.

---

**Technik-Status:** Der feste 40/35/5/20-Schlüssel ist verbindliche Business-Regel und wird in einem separaten Implementierungsschritt in Datenmodell, Orchestrierung und Stripe-Transfers technisch verankert.

## 7. Zahlungsabwicklung und regulatorische Abgrenzung

### 7.1 Stripe als Zahlungsinfrastruktur - die Plattform ist kein Zahlungsdienstleister

**Grundprinzip:** ConnectBounty hält zu keinem Zeitpunkt Gelder und tritt nicht als Zahlungsdienstleister, Treuhänder oder Intermediar im Sinne des Zahlungsdiensteaufsichtsgesetzes (ZAG) bzw. der EU-Zahlungsdiensterichtlinie (PSD2) auf. Alle tatsächlichen Zahlungsflüsse - Einzug vom Inserenten sowie Auszahlungen an Kandidat, Referrer und Plattformgebühr - werden ausschliesslich über **Stripe Connect** als regulierten und PCI-DSS-konformen Zahlungsdienstleister abgewickelt.

Die Plattform hat dabei ausschliesslich eine **orchestrierende Funktion**: Sie prüft, ob alle Prozessvoraussetzungen erfüllt sind (Three-Stage-Confirmation), und löst anschliessend den Auszahlungsvorgang bei Stripe aus. Der Geldfluss selbst liegt vollständig im Verantwortungsbereich von Stripe. ConnectBounty benötigt daher für diese Transaktionen keine eigene Zahlungsdienste-Lizenz.

### 7.2 Technische Umsetzung

- **Stripe Connect Express:** Jeder Auszahlungsempfänger (Kandidat, Referrer) verfügt über ein eigenes Stripe-Connect-Konto. Auszahlungen erfolgen direkt auf diese Konten - nicht über ein zentrales Plattformkonto, das als Durchlaufposten fungiert.
- **Application Fee / Plattformgebühr:** Die Plattformgebühr (20 %) wird von Stripe im Rahmen des Connect-Modells automatisch einbehalten und dem Plattformkonto gutgeschrieben. Es findet kein manueller Geldtransfer durch die Plattform statt.
- **Split-Ausführung:** Die Aufteilung 40/35/5/20 wird durch die Plattform berechnet und als Stripe-Transferparameter übergeben; die Ausführung und Verbuchung obliegt Stripe.
- **Idempotenz:** Ein Auszahlungsdatensatz pro Vorgang verhindert Doppelzahlungen bei technischen Wiederholungsversuchen.

---

## 8. Frameworks und Architektur für Skalierung, Performance, Erweiterung, Sicherheit

### 8.1 Anwendungsstack


| Bereich                                   | Technologie                                               | Rolle für Skalierung & Qualität                                                                          |
| ----------------------------------------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| **Frontend / SSR**                        | **Next.js** (App Router), React                           | Edge/CDN-fähige Auslieferung, granulares Caching, Server Components für Daten nah an der Quelle          |
| **Sprache**                               | **TypeScript**                                            | Weniger Laufzeitfehler, klarere Schnittstellen                                                           |
| **Styling**                               | **Tailwind CSS v4**                                       | Schnelle UI-Konsistenz, kleine Bundles bei disziplinierter Nutzung                                       |
| **Auth / Datenbank / Storage / Realtime** | **Supabase** (Postgres, Auth, Storage, optional Realtime) | Horizontale Skalierung über verwalteten Postgres; **RLS** für mandantenfähige Sicherheit auf Zeilenebene |
| **Edge / Automation**                     | **Supabase Edge Functions**                               | Webhooks, Hintergrundlogik nah am Datenbestand                                                           |
| **Payments**                              | **Stripe**                                                | Bewährtes Modell für Marktplatz-Auszahlungen und Gebühren                                                |
| **Rate Limiting**                         | **Upstash Redis** (geplant laut README)                   | Schutz vor Misbrauch und Brute-Force                                                                     |
| **E-Mail**                                | **Resend** (geplant)                                      | Transaktionale Kommunikation                                                                             |
| **Observability**                         | **Sentry**, **Logflare** (geplant)                        | Fehler- und Nutzungsanalyse                                                                              |


### 8.2 Sicherheit (Kernprinzipien)

- **Row Level Security (RLS)** auf allen relevanten Tabellen - Zugriff nur nach Rolle und Kontext.
- **Service Role** nur für klar abgegrenzte Server-Operationen (nie im Browser).
- **Security Headers** und CSP über Middleware/Proxy (`Strict-Transport-Security`, `Content-Security-Policy`, …).
- **Audit Logs** für kritische Aktionen (`audit_action`-Erweiterungen in Migration v7).
- **Env-Validation** (Zod) - Konfigurationsfehler werden früh sichtbar statt „silent fail“.

### 8.3 Performance & Betrieb

- **ISR / dynamische Segmentierung** wo nötig (z. B. öffentliche Seiten mit Revalidation).
- **Build-Optimierung** (Worker-Limits, Source Maps nur wo nötig) zur Entlastung von CI und lokaler Hardware.
- **Deploy-Ziel:** **Vercel** + Firewall - globale Edge-Pop-Latenzen, DDoS-Schutz auf Edge-Ebene.

### 8.4 Erweiterbarkeit

- Klare Schichtung: UI → Server Actions / Route Handlers → Supabase Client → Postgres.
- Migrationen versioniert unter `supabase/migrations/` - Schemaänderungen nachvollziehbar und reproduzierbar.
- Provider-Pattern für KYC (`mock` vs. `ballerine`) erlaubt Wechsel ohne Rewrite der Geschäftslogik.

---

## 9. Stand der Anwendungsumsetzung und Roadmap bis finished POC

### 9.1 Aktueller Umsetzungsstand

- Grundlegende App-Struktur mit Next.js App Router, Auth, Rollenlogik und geschützten Routen ist vorhanden.
- Zentrale Produktbereiche sind angelegt: Dashboard, Bounties, Referrals, Profile, Security, KYC, Payouts.
- Datenmodell und Migrationen für Referral-Lifecycle, Three-Stage-Confirmation, Split-Felder, Audit-Events und Dispute-Bausteine sind vorbereitet.
- Profil- und Security-Flows sind funktional vorhanden; laufende Stabilisierung erfolgt anhand realer Testsessions.
- Build-Pfad (`npm run build` + `npm run start`) ist als primärer Betriebsmodus vorgesehen.

### 9.2 Roadmap bis finished POC

**Phase A - Daten- und Prozesskonsistenz finalisieren**

- Alle produktionsrelevanten Supabase-Migrationen auf dem Zielprojekt vollständig anwenden und verifizieren.
- Split-Regel 40/35/5/20 inkl. No-Referrer-Fallback (25% Plattform) technisch verbindlich in Orchestrierung und Auszahlungslogik verankern.
- End-to-End-Tests für Kernpfad: Bounty -> Referral -> Nachweise -> Bestätigung -> Auszahlung.

**Phase B - Compliance und Zahlungsfluss POC-fest machen**

- KYC-Provider produktiv anbinden (statt nur Mock) und Ergebniszustände robust behandeln.
- Stripe-Connect-Payout-Flows mit idempotenten Webhooks und Retry-Konzept absichern.
- Nachweis-/Dokumenten-Upload inklusive Prüfpfad und Fehlerfällen stabilisieren.

**Phase C - Conversion-Schutz und Trust-Layer schärfen**

- Vollständigen Event-Trail je Referral implementieren (Statusübergänge, Audit, Zeitstempel, Actor).
- Dispute- und Rejection-Flow mit klaren SLA-Regeln als POC-Mindeststandard abschließen.
- Transparente Vorgangsansicht für Inserent, Kandidat und Referrer zur Reduktion von Off-Platform-Anreizen.

**Phase D - POC-Abnahme und Go-Live-Readiness**

- POC-Akzeptanzkriterien final prüfen: Stabilität, Nachvollziehbarkeit, Auszahlungssicherheit, Compliance-Basics.
- Monitoring-Baseline (Fehler, kritische Events, Auszahlungsstatus) produktionsnah betreiben.
- Abschließender Testlauf mit realistischen Beispielvorgängen und dokumentierter Ergebnisabnahme.

### 9.3 POC-Definition "fertig"

Der POC gilt als finished, wenn ein vollständiger Realprozess reproduzierbar funktioniert:

1. Inserent erstellt Bounty.
2. Referral wird zugeordnet und durchläuft den vorgesehenen Statuspfad.
3. Nachweise und Bestätigungen werden korrekt erfasst.
4. Split-Auszahlung wird gemäß fixer Regel nachvollziehbar berechnet und ausgelöst.
5. Alle kritischen Schritte sind im Audit-/Tracking-Verlauf prüfbar dokumentiert.

---

## 10. Fazit

ConnectBounty verkauft **standardisierte Attribution**, **rechtlich und technisch nachvollziehbare Nachweise** und **verteilte Auszahlungen**. Das Geschäftsmodell ist dann tragfähig, wenn Off-Platform-Deals **nicht nur unmoralisch**, sondern **operativ teuer und risikobehaftet** sind - durch Kombination aus **Split-Design**, **plattformgebundener Zuordnung Inserent-Kandidat**, **KYC**, **dokumentierten Übergängen** und **auditierbarer Auszahlung**.

Die beschriebene technische Roadmap (Next.js, Supabase, Stripe Connect, Ballerine, Edge Functions, Observability) unterstützt **Skalierung**, **Performance** und **Sicherheit** als gleichrangige Produktanforderungen - nicht als nachträglichen Firmenpatch.

---

**Hinweis:** Dieses Papier beschreibt das **konzeptionelle Modell** und die **im Repository angelegten oder geplanten Bausteine**. Für externe Kommunikation (Investoren, Versicherungen, Aufsicht) sollten finale Zahlen (Gebührensätze, SLA, Aufbewahrungsfristen) mit Legal und Steuerrecht abgestimmt werden.