# Sicherheit & Datenschutz – BC Charge App

## Aktueller Stand

Diese App ist ein **Demo-/Prototyp** mit Browser-`localStorage` und einem lokalen **Stripe-BFF** (`server/index.mjs`). Für den **Produktivbetrieb** sind zusätzliche Maßnahmen zwingend (siehe unten).

## Implementierte Schutzmaßnahmen (Stand Juni 2026)

| Bereich | Maßnahme |
|---------|----------|
| Stripe-API | API-Key (`BC_STRIPE_API_KEY`), User-Bindung (`X-BC-User-Id`), Kunden-Ownership-Check |
| Stripe-API | CORS-Allowlist, Rate-Limit, JSON-Limit 64 KB, Bind `127.0.0.1` (Dev) |
| Stripe-API | Abbuchung max. 250 €/Request, Idempotenz-Key pro `sessionId` |
| Passwörter | PBKDF2-SHA256 (210k Iterationen), Migration vom Legacy-Hash |
| Frontend | Security-Header (Vite Dev), keine Rohkarten auf eigenem Server |
| DSGVO | Datenschutzseite, Geo-Einwilligung, lokale Kontolöschung |
| Secrets | `.env` in `.gitignore`, Warnung bei Hasura-Admin im `VITE_*` |

## Kritisch vor Produktion

1. **Echte Authentifizierung** (OAuth2/OIDC oder Backend-Sessions mit httpOnly-Cookies) – ersetzt `localStorage`-User-ID.
2. **Serverseitige Datenhaltung** – keine Passwort-Hashes und PII im Browser.
3. **Ladebeträge serverseitig** aus CitrineOS/Tarif – nicht aus manipulierbarem `localStorage`.
4. **Stripe-Webhooks** mit Signaturprüfung für Zahlungsstatus.
5. **Hasura/CitrineOS** nur über Backend; **niemals** `VITE_CITRINEOS_HASURA_ADMIN_SECRET` im Frontend.
6. **`BC_STRIPE_API_KEY`** durch echte JWT/OAuth-Session ersetzen (API-Key im Frontend-Bundle ist nur Dev-Schutz).
7. Regelmäßig `npm audit`, TLS, WAF, Logging ohne PCI-Daten.

## Meldung von Schwachstellen

Kontakt: info@bytecommander.com (Betreiber laut App-Impressum).

## Compliance

- **DSGVO:** Datenschutzerklärung unter `/datenschutz`; Verarbeitung Stripe als Auftragsverarbeiter dokumentieren (AVV).
- **PCI DSS:** Kartendaten nur über Stripe Elements – Scope reduzieren, SAQ A anstreben.
- **OWASP:** Input-Validierung auf dem BFF, keine Security-by-Obscurity allein.
