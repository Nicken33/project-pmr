"use client";

import { useEffect } from "react";
import L from "leaflet";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";

const pinIcon = L.divIcon({
  className: "talentroLeafletPinWrap talentroLeafletPinWrap--active",
  html: '<span class="talentroLeafletPin talentroLeafletPin--active"><svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path d="M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7Z" fill="#7C3AED"/><circle cx="12" cy="9" r="2.6" fill="#fff"/></svg></span>',
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

function RecenterOnPick({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, Math.max(map.getZoom(), 14));
  }, [center, map]);
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

  const center: [number, number] = hasCoords ? [latNum, lngNum] : defaultCenter;

  const handlePick = (lat: number, lng: number) => {
    onChange({ latitude: String(lat), longitude: String(lng) });
  };

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "240px",
        borderRadius: "12px",
        overflow: "hidden",
        border: "1px solid var(--border, #e2e8f0)",
        marginTop: "6px",
      }}
    >
      <MapContainer
        center={center}
        zoom={14}
        scrollWheelZoom={false}
        className="leafletMap"
        style={{ width: "100%", height: "100%" }}
      >
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        <MapClickHandler onPick={handlePick} />
        {hasCoords ? (
          <Marker
            position={[latNum, lngNum]}
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
        ) : null}
        <RecenterOnPick center={center} />
      </MapContainer>
      <div
        style={{
          position: "absolute",
          bottom: "8px",
          left: "8px",
          right: "8px",
          background: "rgba(255, 255, 255, 0.92)",
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
          {hasCoords
            ? `Метка: ${latNum.toFixed(4)}, ${lngNum.toFixed(4)} (кликните или перетащите)`
            : "Кликните по карте, чтобы поставить метку"}
        </span>
        <span style={{ color: "var(--muted, #64748b)", fontSize: "11px" }}>OpenStreetMap</span>
      </div>
    </div>
  );
}
