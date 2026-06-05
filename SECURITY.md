# Sicherheit & Datenschutz – BC Charge App

## Aktueller Stand

Die App nutzt einen **Express-API-Server** (`server/app.mjs`) mit **umschaltbarer Datenbank** (`sqlite` oder `postgres`), **JWT-Session-Cookies** (httpOnly) und integriertem Stripe-BFF. Mit `VITE_BC_USE_BACKEND=true` (Standard in `.env.example`) werden Nutzerdaten serverseitig gehalten; ohne dieses Flag bleibt der **localStorage-Demo-Modus** aktiv.

## Implementierte Schutzmaßnahmen (Stand Juni 2026)

| Bereich | Maßnahme |
|---------|----------|
| Auth | JWT in httpOnly-Cookie (`bc_session`), PBKDF2-SHA256 (210k), Demo-Seed optional |
| API | CORS-Allowlist mit Credentials, Rate-Limit, JSON-Limit 256 KB |
| Stripe | Session-Auth, Kunden-Ownership, Abbuchung max. 250 €, Betragsabgleich mit Sitzung |
| Stripe | Webhook-Endpoint mit Signaturprüfung (`STRIPE_WEBHOOK_SECRET`) |
| Ladesitzungen | Serverseitige Kostenvalidierung (Tarif-Obergrenzen) beim Abschluss |
| CitrineOS | Proxy-Routen `/api/citrineos/*` – Hasura-Admin nur serverseitig |
| Passwörter | Keine Hashes im Frontend-Response; Legacy-Hash-Migration beim Login |
| DSGVO | Export/Löschung über API, Datenschutzseite, Geo-Einwilligung |
| Datenbank | SQLite (Dev) oder PostgreSQL (Skalierung), DB-Pool über `BC_DB_POOL_MAX` |
| Secrets | `.env` in `.gitignore`, SQLite unter `data/` ignoriert |

## Vor Produktion (Checkliste)

1. **`BC_JWT_SECRET`** – min. 32 Zeichen Zufallswert, `BC_COOKIE_SECURE=true` hinter HTTPS.
2. **`VITE_BC_USE_BACKEND=true`** im Produktions-Build; kein `VITE_BC_STRIPE_API_KEY` im Bundle.
3. **CitrineOS** – `CITRINEOS_*` nur auf dem Server; `VITE_CITRINEOS_HASURA_ADMIN_SECRET` niemals setzen.
4. **Stripe-Webhooks** in Stripe Dashboard auf `/api/webhooks/stripe` registrieren.
5. **Datenbank** – für Multi-Instance `BC_DB_CLIENT=postgres` + `DATABASE_URL` verwenden.
6. Regelmäßig `npm audit`, TLS, WAF, Logging ohne PCI-Daten.

## Meldung von Schwachstellen

Kontakt: info@bytecommander.com (Betreiber laut App-Impressum).

## Compliance

- **DSGVO:** Datenschutzerklärung unter `/datenschutz`; Verarbeitung Stripe als Auftragsverarbeiter dokumentieren (AVV).
- **PCI DSS:** Kartendaten nur über Stripe Elements – Scope reduzieren, SAQ A anstreben.
- **OWASP:** Input-Validierung auf dem BFF, keine Security-by-Obscurity allein.
