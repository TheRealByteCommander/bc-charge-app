import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useMemo } from 'react';
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet';
import { Link } from 'react-router-dom';
import { getAvailableCount } from '../data/stations';
import type { Station } from '../types';
import { isValidStationPosition } from '../utils/geo';
import { formatCurrency } from '../utils/format';
import { minKnownPricePerKwh } from '../utils/pricing';

const iconAvailable = L.divIcon({
  className: '',
  html: `<div style="width:32px;height:32px;border-radius:50%;background:#10b981;border:3px solid #ffffff;box-shadow:0 2px 8px rgba(0,0,0,0.2)"></div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

const iconBusy = L.divIcon({
  className: '',
  html: `<div style="width:32px;height:32px;border-radius:50%;background:#f59e0b;border:3px solid #ffffff;box-shadow:0 2px 8px rgba(0,0,0,0.2)"></div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

const iconHighlight = L.divIcon({
  className: '',
  html: `<div style="width:36px;height:36px;border-radius:50%;background:#10b981;border:4px solid #34d399;box-shadow:0 2px 12px rgba(16,185,129,0.5)"></div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
});

function MapController({
  center,
  zoom,
  fitPoints,
}: {
  center: [number, number];
  zoom: number;
  fitPoints?: [number, number][];
}) {
  const map = useMap();
  useEffect(() => {
    if (fitPoints && fitPoints.length > 1) {
      map.fitBounds(fitPoints, { padding: [40, 40] });
      return;
    }
    map.setView(center, zoom);
  }, [map, center, zoom, fitPoints]);
  return null;
}

export function ChargeMap({
  stations,
  center,
  zoom = 11,
  height = '100%',
  highlightStationIds = [],
  routeLine = [],
}: {
  stations: Station[];
  center: [number, number];
  zoom?: number;
  height?: string;
  highlightStationIds?: string[];
  routeLine?: [number, number][];
}) {
  const highlightSet = useMemo(() => new Set(highlightStationIds), [highlightStationIds]);

  const markers = useMemo(
    () =>
      stations.filter((s) => isValidStationPosition(s.lat, s.lng)).map((s) => {
        const highlighted = highlightSet.has(s.id);
        const available = getAvailableCount(s) > 0;
        return {
          station: s,
          pos: [s.lat, s.lng] as [number, number],
          icon: highlighted ? iconHighlight : available ? iconAvailable : iconBusy,
        };
      }),
    [stations, highlightSet]
  );

  const fitPoints = routeLine.length > 1 ? routeLine : undefined;

  return (
    <div style={{ height }} className="overflow-hidden rounded-2xl border border-bc-border">
      <MapContainer center={center} zoom={zoom} scrollWheelZoom className="z-0" style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />
        <MapController center={center} zoom={zoom} fitPoints={fitPoints} />
        {routeLine.length > 1 && (
          <Polyline
            positions={routeLine}
            pathOptions={{ color: '#3b82f6', weight: 4, opacity: 0.85, dashArray: '8 8' }}
          />
        )}
        {markers.map(({ station, pos, icon }) => {
          const available = getAvailableCount(station);
          const maxKw = Math.max(0, ...station.connectors.map((c) => c.powerKw || 0));
          const minPrice = minKnownPricePerKwh(station.connectors);
          return (
            <Marker key={station.id} position={pos} icon={icon}>
              <Popup>
                <div className="min-w-[200px] text-sm">
                  <p className="font-semibold text-bc-text">{station.name}</p>
                  <p className="mt-1 text-bc-muted">
                    {available} frei
                    {maxKw > 0 ? ` · bis ${maxKw} kW` : ''}
                    {minPrice != null ? ` · ab ${formatCurrency(minPrice)}/kWh` : ''}
                  </p>
                  <div className="mt-2 flex flex-col gap-1.5">
                    <Link
                      to={`/station/${station.id}`}
                      className="inline-block font-medium text-bc-accent"
                    >
                      Details & laden →
                    </Link>
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${station.lat},${station.lng}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-block text-xs font-medium text-bc-muted underline-offset-2 hover:underline"
                    >
                      Navigation
                    </a>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
