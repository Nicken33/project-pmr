"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";

const pinIcon = L.divIcon({
  className: "talentroLeafletPinWrap talentroLeafletPinWrap--active",
  html: '<span class="talentroLeafletPin talentroLeafletPin--active"><svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><path d="M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7Z" fill="#7C3AED"/><circle cx="12" cy="9" r="2.6" fill="#fff"/></svg></span>',
  iconSize: [40, 48],
  iconAnchor: [20, 46],
});

function MapClickHandler({
  onPick,
}: {
  onPick: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      onPick(Number(e.latlng.lat.toFixed(6)), Number(e.latlng.lng.toFixed(6)));
    },
  });
  return null;
}

function MapInitAndRecenter({
  center,
  zoom = 15,
}: {
  center: [number, number];
  zoom?: number;
}) {
  const map = useMap();
  const prevCenterRef = useRef<string>("");

  useEffect(() => {
    map.invalidateSize();
    const t1 = setTimeout(() => map.invalidateSize(), 150);
    const t2 = setTimeout(() => map.invalidateSize(), 500);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [map]);

  useEffect(() => {
    const key = `${center[0].toFixed(5)},${center[1].toFixed(5)}`;
    if (prevCenterRef.current !== key) {
      prevCenterRef.current = key;
      map.invalidateSize();
      map.flyTo(center, Math.max(map.getZoom(), zoom), { duration: 0.6 });
    }
  }, [center, map, zoom]);

  return null;
}

export interface LocationPickerProps {
  latitude?: number | string;
  longitude?: number | string;
  defaultCenter?: [number, number];
  onChange: (coords: { latitude: string; longitude: string }) => void;
}

export default function LeafletLocationPickerMap({
  latitude,
  longitude,
  defaultCenter = [46.8378, 29.6234],
  onChange,
}: LocationPickerProps) {
  const latNum = Number(latitude);
  const lngNum = Number(longitude);
  const hasCoords = Number.isFinite(latNum) && Number.isFinite(lngNum) && latNum > 0 && lngNum > 0;

  const activeLat = hasCoords ? latNum : defaultCenter[0];
  const activeLng = hasCoords ? lngNum : defaultCenter[1];
  const center: [number, number] = [activeLat, activeLng];

  // If no coords were passed, report initial center
  useEffect(() => {
    if (!hasCoords) {
      onChange({
        latitude: String(defaultCenter[0]),
        longitude: String(defaultCenter[1]),
      });
    }
  }, [hasCoords, defaultCenter, onChange]);

  const handlePick = (lat: number, lng: number) => {
    onChange({ latitude: String(lat), longitude: String(lng) });
  };

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "260px",
        borderRadius: "12px",
        overflow: "hidden",
        border: "1px solid var(--border, #e2e8f0)",
        marginTop: "6px",
      }}
    >
      <MapContainer
        center={center}
        zoom={15}
        scrollWheelZoom={true}
        className="leafletMap"
        style={{ width: "100%", height: "100%" }}
      >
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        <MapClickHandler onPick={handlePick} />
        <Marker
          position={[activeLat, activeLng]}
          icon={pinIcon}
          draggable
          eventHandlers={{
            dragend(e) {
              const marker = e.target;
              const pos = marker.getLatLng();
              handlePick(Number(pos.lat.toFixed(6)), Number(pos.lng.toFixed(6)));
            },
          }}
        />
        <MapInitAndRecenter center={center} zoom={15} />
      </MapContainer>
      <div
        style={{
          position: "absolute",
          bottom: "8px",
          left: "8px",
          right: "8px",
          background: "rgba(255, 255, 255, 0.94)",
          backdropFilter: "blur(4px)",
          padding: "6px 12px",
          borderRadius: "8px",
          fontSize: "12px",
          color: "var(--foreground, #1e293b)",
          zIndex: 1000,
          pointerEvents: "none",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
        }}
      >
        <span>
          {`Метка: ${activeLat.toFixed(4)}, ${activeLng.toFixed(4)} (кликните или перетащите)`}
        </span>
        <span style={{ color: "var(--muted, #64748b)", fontSize: "11px" }}>Колёсико мыши: масштаб</span>
      </div>
    </div>
  );
}
