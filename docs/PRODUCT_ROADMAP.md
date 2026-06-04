# BC Charge – Produkt-Roadmap (Marktführer-Ziel)

Ziel: **Eine App für E-Auto-Fahrer**, die Fragmentierung, unzuverlässige Daten, komplizierte Zahlung und schwache Routenplanung adressiert – vereint in einer überlegenen UX (PlugShare + ABRP + ChargePoint).

**Aktueller Stack:** React 18 PWA, CitrineOS (OCPP 2.0.1), Stripe, Demo-OCPI-Vorbereitung. Native iOS/Android/CarPlay folgen in einer späteren Phase (Flutter/React Native oder native Shell).

---

## Technische Grundlagen

| Bereich | Status | Phase |
|--------|--------|-------|
| PWA (installierbar, offline-Karten-Cache) | In Arbeit | MVP |
| OCPI 2.2.1 (Roaming, Locations, Tariffs, Sessions) | CitrineOS-OCPI / Hub-Anbindung geplant | MVP → 2 |
| OCPP 1.6J / 2.0.1 | CitrineOS Core aktiv | MVP |
| ISO 15118 Plug & Charge | Geplant | 2 |
| Eichrecht DE/EU | Konzept + CPO-Abrechnung | 2–3 |
| Cloud-Skalierung, WebSockets, Push | Architektur vorbereitet | 2 |
| DSGVO, OAuth, Biometrie | Teilweise (lokal + Stripe) | 2 |

---

## 1. Karten & Stationen (MVP Core)

| Feature | Status |
|---------|--------|
| Karte mit allen BC-/Demo-Standorten | ✅ |
| Echtzeit-Status (CitrineOS) | ✅ bei Live-Sync |
| Mehrstufige Filter (Stecker, kW, Preis, Amenities, Barrierefrei, Ökostrom) | ✅ App |
| Community-Reports & PlugScore | ✅ lokal (Demo); Backend Phase 2 |
| Offline: gespeicherte Stationen | ✅ Cache |
| Suche Adresse/POI/Favoriten | ✅ Basis |

---

## 2. Routenplanung (Differenzierung)

| Feature | Status |
|---------|--------|
| Fahrzeugprofile | ✅ |
| Reiseplaner mit Lade-Stopp-Vorschlägen | ✅ Basis |
| Wetter/Verkehr/Höhenprofil | Geplant Phase 2 |
| Live-SoC (OBD/API) | Geplant Phase 2 |
| Turn-by-Turn (Maps-Deep-Link) | ✅ Deep-Link |

---

## 3. Zahlung & Preise

| Feature | Status |
|---------|--------|
| Stripe Karte/SEPA | ✅ |
| Echtzeit-Tarife CitrineOS | ✅ |
| Gast-Zahlung / ohne Pflicht-Account | Teilweise (Karte ohne Login) |
| Plug & Charge ISO 15118 | Phase 2 |
| OCPI-Roaming-Abrechnung | Phase 2 |

---

## 4. Session & Komfort

| Feature | Status |
|---------|--------|
| Start/Stopp/Monitoring | ✅ |
| Reservierung / Warteschlange | Phase 2 |
| Push-Benachrichtigungen | Phase 2 (PWA) |
| Wallbox / Fleet | Phase 3 |

---

## 5. Zuverlässigkeit & Support

| Feature | Status |
|---------|--------|
| Fehler-Report mit Foto-Text | ✅ Community-Report |
| In-App Hilfe / Tickets | ✅ Hilfe-Seite; KI Phase 3 |
| Predictive Alerts | Phase 3 |

---

## 6. Retention

| Feature | Status |
|---------|--------|
| Mehrere Fahrzeuge, Historie, CO₂ | ✅ |
| BC Points / Loyalty | ✅ |
| Abzeichen, Streaks, Challenges, Rangliste (Demo) | ✅ MVP |
| Gamification erweitert (Teams, Live-Leaderboard) | Phase 3 |
| KI-Empfehlungen | Phase 3 |

---

## 7. UX / NFR

| Feature | Status |
|---------|--------|
| Dark UI, DE/EN | ✅ |
| WCAG-Basis | Laufend |
| Performance Karte | ✅ Leaflet |
| Freemium / CPO-Provisionen | Geschäftsmodell Phase 3 |

---

## Priorisierung (Team)

1. **MVP (jetzt):** Karte, Filter, CitrineOS, Payment, Session, Reise-Basis, Roadmap, PWA, Gast-Entdecken.
2. **Phase 2:** OCPI-Hub, Plug & Charge, Community-Backend, Reservierungen, erweiterter Routenplaner.
3. **Phase 3:** KI, Wallbox, Gamification, native Apps + CarPlay.

## Nächste Schritte

- Marktanalyse (PlugShare, ABRP, Chargemap, EnBW) finalisieren
- OCPI 2.2.1 API-Spezifikation intern
- Wireframes + User-Tests
- CPO-Roaming-Verträge (Hubject etc.)
