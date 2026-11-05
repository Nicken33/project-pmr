"use client";

import { useEffect } from "react";
import L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

export interface MapPoint {
  id: string;
  lat: number;
  lng: number;
  label: string;
  address?: string;
}

const pinIcon = L.divIcon({
  className: "talentroLeafletPinWrap",
  html: '<span class="talentroLeafletPin"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7Z" fill="currentColor"/><circle cx="12" cy="9" r="2.6" fill="#fff"/></svg></span>',
  iconSize: [34, 42],
  iconAnchor: [17, 40],
  popupAnchor: [0, -38],
});

const pinIconActive = L.divIcon({
  className: "talentroLeafletPinWrap talentroLeafletPinWrap--active",
  html: '<span class="talentroLeafletPin talentroLeafletPin--active"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7Z" fill="currentColor"/><circle cx="12" cy="9" r="2.6" fill="#fff"/></svg></span>',
  iconSize: [40, 48],
  iconAnchor: [20, 46],
  popupAnchor: [0, -44],
});

function Recenter({ point }: { point?: MapPoint }) {
  const map = useMap();
  useEffect(() => {
    if (point) map.flyTo([point.lat, point.lng], Math.max(map.getZoom(), 15), { duration: 0.6 });
  }, [map, point]);
  return null;
}

export default function LeafletMiniMap({
  points,
  activeId,
}: {
  points: MapPoint[];
  activeId?: string;
}) {
  const active = points.find((point) => point.id === activeId) ?? points[0];
  if (!active) return null;

  return (
    <MapContainer
      center={[active.lat, active.lng]}
      zoom={15}
      scrollWheelZoom={false}
      zoomControl={false}
      attributionControl
      className="leafletMap"
    >
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />
      {points.map((point) => (
        <Marker
          key={point.id}
          position={[point.lat, point.lng]}
          icon={point.id === active.id ? pinIconActive : pinIcon}
        >
          <Popup>
            <strong>{point.label}</strong>
            {point.address ? <span>{point.address}</span> : null}
          </Popup>
        </Marker>
      ))}
      <Recenter point={active} />
    </MapContainer>
  );
}
