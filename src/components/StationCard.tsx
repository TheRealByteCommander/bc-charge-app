import { motion } from 'framer-motion';
import { Heart, MapPin, Star, Zap } from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { getAvailableCount } from '../data/stations';
import { useAppStore } from '../store/appStore';
import type { Station } from '../types';
import { computePlugScore } from '../services/community';
import { StationTrustBadge } from '../components/StationTrustBadge';
import { formatCurrency } from '../utils/format';
import { minKnownPricePerKwh } from '../utils/pricing';

export function StationCard({ station, index = 0 }: { station: Station; index?: number }) {
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
        className="block overflow-hidden rounded-2xl border border-bc-border bg-bc-elevated shadow-card transition active:scale-[0.99]"
      >
        <div className={`h-2 bg-gradient-to-r ${station.imageGradient}`} />
        <div className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h3 className="font-display font-semibold text-bc-text leading-tight">{station.name}</h3>
              <p className="mt-1 flex items-center gap-1 text-sm text-bc-muted">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">
                  {station.address}, {station.zip} {station.city}
                </span>
              </p>
            </div>
            {user && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  toggleFavorite(station.id);
                }}
                className="rounded-full p-2 text-bc-muted hover:bg-bc-surface"
                aria-label={isFav ? 'Aus Favoriten entfernen' : 'Zu Favoriten'}
              >
                <Heart className={`h-5 w-5 ${isFav ? 'fill-bc-danger text-bc-danger' : ''}`} />
              </button>
            )}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-lg bg-bc-accent/15 px-2 py-1 text-xs font-semibold text-bc-accent">
              <Zap className="h-3.5 w-3.5" />
              {available} frei
            </span>
            {minPrice != null && (
              <span className="text-xs text-bc-muted">
                ab {formatCurrency(minPrice)}/kWh
              </span>
            )}
            {distance != null && <span className="text-xs text-bc-muted">{distance} km</span>}
            <span className="inline-flex items-center gap-0.5 text-xs text-bc-muted" title="PlugScore">
              <Star className="h-3 w-3 fill-bc-warn text-bc-warn" />
              {plugScore} PlugScore
            </span>
            <StationTrustBadge
              stationId={station.id}
              liveData={liveTrust}
              availableCount={available}
              offlineCount={station.connectors.filter((c) => c.status === 'offline').length}
              compact
            />
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
