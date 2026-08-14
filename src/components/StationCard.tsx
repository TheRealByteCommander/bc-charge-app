import { motion } from 'framer-motion';
import { Heart, MapPin, Star, Zap } from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { getAvailableCount } from '../data/stations';
import { useAppStore } from '../store/appStore';
import type { Station } from '../types';
import { computePlugScore } from '../services/community';
import { StationReliabilityBadge } from '../components/StationReliabilityBadge';
import { StationTrustBadge } from '../components/StationTrustBadge';
import { formatCurrency } from '../utils/format';
import { minKnownPricePerKwh } from '../utils/pricing';

export function StationCard({
  station,
  index = 0,
  compact = false,
}: {
  station: Station;
  index?: number;
  compact?: boolean;
}) {
  const userLocation = useAppStore((s) => s.userLocation);
  const distance = useMemo(
    () => useAppStore.getState().distanceKm(station),
    [userLocation, station.id, station.lat, station.lng]
  );
  const user = useAppStore((s) => s.user);
  const toggleFavorite = useAppStore((s) => s.toggleFavorite);
  const available = getAvailableCount(station);
  const minPrice = minKnownPricePerKwh(station.connectors);
  const isFav = user?.favoriteStationIds.includes(station.id);
  const plugScore = computePlugScore(station.id, station.rating, station.reviewCount);
  const stationDataSource = useAppStore((s) => s.stationDataSource);
  const citrineosConnected = useAppStore((s) => s.citrineosConnected);
  const liveTrust = citrineosConnected && stationDataSource === 'citrineos';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Link
        to={`/station/${station.id}`}
        className="block overflow-hidden rounded-2xl border border-bc-border bg-bc-elevated shadow-card transition-all duration-200 hover:border-bc-accent/40 active:scale-[0.99]"
      >
        <div className={`h-1.5 bg-gradient-to-r ${station.imageGradient}`} />
        <div className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h3 className="font-display font-bold text-bc-text leading-tight">{station.name}</h3>
              {!compact && (
                <p className="mt-1 flex items-center gap-1 text-sm text-bc-muted/80">
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-bc-accent/60" />
                  <span className="truncate">
                    {station.address}, {station.zip} {station.city}
                  </span>
                </p>
              )}
            </div>
            {user && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  toggleFavorite(station.id);
                }}
                className="rounded-full p-2 text-bc-muted transition-all hover:bg-bc-surface active:scale-90"
                aria-label={isFav ? 'Aus Favoriten entfernen' : 'Zu Favoriten'}
              >
                <Heart className={`h-5 w-5 transition-colors ${isFav ? 'fill-bc-danger text-bc-danger' : ''}`} />
              </button>
            )}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-bc-accent-soft px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-bc-accent border border-bc-accent/20">
              <Zap className="h-3 w-3 fill-current" />
              {available} frei
            </span>
            {minPrice != null && (
              <div className="flex items-center gap-1 text-xs font-medium text-bc-text/80">
                <span className="text-bc-muted">ab</span>
                <span className="text-bc-text font-bold">{formatCurrency(minPrice)}/kWh</span>
              </div>
            )}
            {distance != null && (
              <div className="flex items-center gap-1 text-xs font-medium text-bc-muted">
                <MapPin className="h-3 w-3" />
                {distance} km
              </div>
            )}
            <div className={`flex items-center gap-2 ${compact ? '' : 'ml-auto'}`}>
              {!compact && (
                <span className="inline-flex items-center gap-0.5 text-xs font-medium text-bc-muted" title="PlugScore">
                  <Star className="h-3 w-3 fill-bc-warn text-bc-warn" />
                  {plugScore}
                </span>
              )}
              <StationReliabilityBadge stationId={station.id} compact />
              {!compact && (
                <StationTrustBadge
                  stationId={station.id}
                  liveData={liveTrust}
                  availableCount={available}
                  offlineCount={station.connectors.filter((c) => c.status === 'offline').length}
                  compact
                />
              )}
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
