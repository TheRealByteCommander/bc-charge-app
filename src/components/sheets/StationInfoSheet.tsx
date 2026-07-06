import {
  Accessibility,
  Clock,
  Gauge,
  Leaf,
  MapPin,
  Navigation,
  Scale,
  Star,
} from 'lucide-react';
import { BottomSheet } from '../BottomSheet';
import { StationTrustBadge } from '../StationTrustBadge';
import type { Station } from '../../types';

export function StationInfoSheet({
  open,
  onClose,
  station,
  distanceKm,
  liveTrust,
  availableCount,
  offlineCount,
  plugScore,
  showGreenBadge,
  showAccessibleBadge,
}: {
  open: boolean;
  onClose: () => void;
  station: Station;
  distanceKm?: number | null;
  liveTrust: boolean;
  availableCount: number;
  offlineCount: number;
  plugScore: number;
  showGreenBadge: boolean;
  showAccessibleBadge: boolean;
}) {
  return (
    <BottomSheet open={open} onClose={onClose} title="Station">
      <div className="space-y-4">
        <div>
          <p className="font-mono text-xs text-bc-accent">{station.evseCode}</p>
          <p className="font-display text-lg font-semibold">{station.name}</p>
          <p className="mt-1 flex items-start gap-2 text-sm text-bc-muted">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
            {station.address}, {station.zip} {station.city}
            {distanceKm != null ? ` · ${distanceKm} km` : ''}
          </p>
        </div>

        <StationTrustBadge
          stationId={station.id}
          liveData={liveTrust}
          availableCount={availableCount}
          offlineCount={offlineCount}
        />

        <div className="flex flex-wrap gap-2">
          <span className="rounded-lg bg-bc-surface px-2 py-1 text-xs">
            <Star className="inline h-3 w-3 fill-bc-warn text-bc-warn" /> PlugScore {plugScore}
          </span>
          <span className="rounded-lg bg-bc-surface px-2 py-1 text-xs text-bc-muted">
            <Clock className="inline h-3 w-3" /> {station.openingHours}
          </span>
          {showGreenBadge && (
            <span className="rounded-lg bg-bc-accent/15 px-2 py-1 text-xs text-bc-accent">
              <Leaf className="inline h-3 w-3" /> Ökostrom
            </span>
          )}
          {showAccessibleBadge && (
            <span className="rounded-lg bg-bc-surface px-2 py-1 text-xs text-bc-muted">
              <Accessibility className="inline h-3 w-3" /> Barrierefrei
            </span>
          )}
          {station.hardwareFeatures?.midCertifiedMeters && (
            <span className="rounded-lg bg-bc-blue/15 px-2 py-1 text-xs text-bc-blue">
              <Scale className="inline h-3 w-3" /> Eichrecht
            </span>
          )}
          {station.hardwareFeatures?.dynamicLoadManagement && (
            <span className="rounded-lg bg-bc-surface px-2 py-1 text-xs text-bc-muted">
              <Gauge className="inline h-3 w-3" /> Lastmanagement
            </span>
          )}
        </div>

        {station.amenities.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-bc-muted">Am Standort</p>
            <div className="flex flex-wrap gap-2">
              {station.amenities.map((a) => (
                <span key={a} className="rounded-lg border border-bc-border px-3 py-1 text-sm text-bc-muted">
                  {a}
                </span>
              ))}
            </div>
          </div>
        )}

        <a
          href={`https://www.google.com/maps/dir/?api=1&destination=${station.lat},${station.lng}`}
          target="_blank"
          rel="noreferrer"
          className="btn-secondary flex w-full items-center justify-center gap-2"
        >
          <Navigation className="h-4 w-4" />
          Route planen
        </a>
      </div>
    </BottomSheet>
  );
}
