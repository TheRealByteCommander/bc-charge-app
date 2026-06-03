import { Link } from 'react-router-dom';
import { ChargingPlannerCard } from '../components/ChargingPlannerCard';

export function ChargePlanPage() {
  return (
    <div className="page-shell">
      <Link to="/" className="text-sm text-bc-accent">
        ← Start
      </Link>
      <h1 className="mt-4 font-display text-2xl font-bold">Station in der Nähe</h1>
      <p className="mt-2 text-sm text-bc-muted leading-relaxed">
        BC Charge schlägt Ihnen bis zu zwei nächste Stationen mit freiem Anschluss vor – inkl.
        Entfernung in km. Der Hinweis erscheint nur auf der Startseite, lässt sich ausblenden oder
        für 24 Stunden pausieren.
      </p>
      <div className="mt-6">
        <ChargingPlannerCard variant="page" />
      </div>
    </div>
  );
}
