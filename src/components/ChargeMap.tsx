import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useMemo } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
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

function MapController({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [map, center, zoom]);
  return null;
}

export function ChargeMap({
  stations,
  center,
  zoom = 11,
  height = '100%',
}: {
  stations: Station[];
  center: [number, number];
  zoom?: number;
  height?: string;
}) {
  const markers = useMemo(
    () =>
      stations.map((s) => ({
        station: s,
        pos: [s.lat, s.lng] as [number, number],
        icon: getAvailableCount(s) > 0 ? iconAvailable : iconBusy,
      })),
    [stations]
  );

  return (
    <div style={{ height }} className="overflow-hidden rounded-2xl border border-bc-border">
      <MapContainer center={center} zoom={zoom} scrollWheelZoom className="z-0" style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        <MapController center={center} zoom={zoom} />
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
