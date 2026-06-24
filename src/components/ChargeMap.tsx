import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useMemo } from 'react';
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet';
import { Link } from 'react-router-dom';
import { getAvailableCount } from '../data/stations';
import type { Station } from '../types';

const iconAvailable = L.divIcon({
  className: '',
  html: `<div style="width:28px;height:28px;border-radius:50%;background:#2ee59d;border:3px solid #06080c;box-shadow:0 0 12px rgba(46,229,157,0.6)"></div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

const iconBusy = L.divIcon({
  className: '',
  html: `<div style="width:28px;height:28px;border-radius:50%;background:#ffb347;border:3px solid #06080c"></div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

const iconHighlight = L.divIcon({
  className: '',
  html: `<div style="width:32px;height:32px;border-radius:50%;background:#5dffb8;border:3px solid #2ee59d;box-shadow:0 0 16px rgba(46,229,157,0.9)"></div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
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
      stations.map((s) => {
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
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        <MapController center={center} zoom={zoom} fitPoints={fitPoints} />
        {routeLine.length > 1 && (
          <Polyline
            positions={routeLine}
            pathOptions={{ color: '#2ee59d', weight: 4, opacity: 0.75, dashArray: '8 8' }}
          />
        )}
        {markers.map(({ station, pos, icon }) => (
          <Marker key={station.id} position={pos} icon={icon}>
            <Popup>
              <div className="min-w-[180px] text-sm">
                <p className="font-semibold text-bc-text">{station.name}</p>
                <p className="text-bc-muted">{getAvailableCount(station)} Anschlüsse frei</p>
                <Link to={`/station/${station.id}`} className="mt-2 inline-block font-medium text-bc-accent">
                  Details öffnen →
                </Link>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
