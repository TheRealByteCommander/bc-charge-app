import { Globe, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';

const partners = [
  { name: 'Mobilithek', region: 'Deutschland', rate: '0.55 €/kWh' },
  { name: 'Hubject', region: 'EU', rate: '0.58 €/kWh' },
  { name: 'Gireve', region: 'Frankreich', rate: '0.52 €/kWh' },
];

export function RoamingPage() {
  return (
    <div className="page-shell">
      <Link to="/profil" className="text-sm text-bc-accent">
        ← Profil
      </Link>
      <h1 className="mt-4 font-display text-2xl font-bold">Roaming</h1>
      <p className="mt-2 text-bc-muted">
        Laden Sie auch außerhalb des BC-Charge-Netzes – Ihre App und Zahlungsmethode bleiben gleich.
      </p>

      <div className="mt-6 flex items-center gap-3 rounded-2xl border border-bc-accent/30 bg-bc-accent/10 p-4">
        <Zap className="h-8 w-8 text-bc-accent" />
        <div>
          <p className="font-semibold">BC Charge Netzwerk</p>
          <p className="text-sm text-bc-muted">8 Standorte · Sachsen · ohne Aufschlag</p>
        </div>
      </div>

      <h2 className="mt-8 flex items-center gap-2 font-display font-semibold">
        <Globe className="h-5 w-5 text-bc-accent" />
        Roaming-Partner
      </h2>
      <div className="mt-3 space-y-3">
        {partners.map((p) => (
          <div key={p.name} className="rounded-2xl border border-bc-border bg-bc-elevated p-4">
            <p className="font-medium">{p.name}</p>
            <p className="text-sm text-bc-muted">{p.region}</p>
            <p className="mt-1 text-sm text-bc-accent">{p.rate}</p>
          </div>
        ))}
      </div>
      <p className="mt-6 text-xs text-bc-muted">
        Roaming-Preise werden zum Zeitpunkt der Ladung in der App angezeigt. BC Points gelten primär im eigenen Netz.
      </p>
    </div>
  );
}
