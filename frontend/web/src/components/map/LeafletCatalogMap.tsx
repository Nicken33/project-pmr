"use client";

import { useEffect } from "react";
import L from "leaflet";
import "leaflet.markercluster";
import { Circle, MapContainer, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import type { CatalogMarker } from "@/lib/filters";

const pinIcon = L.divIcon({
  className: "talentroLeafletPinWrap",
  html: '<span class="talentroLeafletPin"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7Z" fill="currentColor"/><circle cx="12" cy="9" r="2.6" fill="#fff"/></svg></span>',
  iconSize: [34, 42],
  iconAnchor: [17, 40],
});

const pinIconActive = L.divIcon({
  className: "talentroLeafletPinWrap talentroLeafletPinWrap--active",
  html: '<span class="talentroLeafletPin talentroLeafletPin--active"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7Z" fill="currentColor"/><circle cx="12" cy="9" r="2.6" fill="#fff"/></svg></span>',
  iconSize: [40, 48],
  iconAnchor: [20, 46],
});

const clusterIcon = (count: number) =>
  L.divIcon({
    className: "talentroClusterWrap",
    html: `<span class="talentroCluster${count >= 8 ? " talentroCluster--big" : ""}">${count}</span>`,
    iconSize: [44, 44],
  });

function ClusteredMarkers({
  markers,
  activeId,
  onSelect,
}: {
  markers: CatalogMarker[];
  activeId?: string;
  onSelect: (marker: CatalogMarker) => void;
}) {
  const map = useMap();

  useEffect(() => {
    const layer = L.markerClusterGroup({
      maxClusterRadius: 48,
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true,
      iconCreateFunction: (cluster) => clusterIcon(cluster.getChildCount()),
    });

    for (const marker of markers) {
      const point = L.marker([marker.lat, marker.lng], {
        icon: marker.id === activeId ? pinIconActive : pinIcon,
        title: `${marker.activityTitle} — ${marker.address}`,
        alt: marker.activityTitle,
      });
      point.on("click", () => onSelect(marker));
      layer.addLayer(point);
    }

    map.addLayer(layer);
    return () => {
      map.removeLayer(layer);
    };
  }, [activeId, map, markers, onSelect]);

  return null;
}

function FollowActive({ marker }: { marker?: CatalogMarker }) {
  const map = useMap();
  useEffect(() => {
    if (!marker) return;
    map.flyTo([marker.lat, marker.lng], Math.max(map.getZoom(), 15), { duration: 0.5 });
  }, [map, marker]);
  return null;
}

function FitToMarkers({ markers, center }: { markers: CatalogMarker[]; center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    if (markers.length > 1) {
      const bounds = L.latLngBounds(markers.map((marker) => [marker.lat, marker.lng]));
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    } else if (markers.length === 1) {
      map.setView([markers[0].lat, markers[0].lng], 15);
    } else {
      map.setView(center, 12);
    }
    // Перецентрирование только при смене набора меток, чтобы не мешать ручному движению карты.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markers.length, map]);
  return null;
}

export function LeafletCatalogMap({
  markers,
  activeId,
  center,
  position,
  radius,
  onSelect,
}: {
  markers: CatalogMarker[];
  activeId?: string;
  center: [number, number];
  position?: { lat: number; lng: number } | null;
  radius?: number;
  onSelect: (marker: CatalogMarker) => void;
}) {
  const active = markers.find((marker) => marker.id === activeId);

  return (
    <MapContainer
      center={position ? [position.lat, position.lng] : center}
      zoom={13}
      scrollWheelZoom
      className="leafletMap leafletMap--full"
      zoomControl
    >
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors (ODbL)'
        maxZoom={19}
      />
      {position && radius ? (
        <Circle
          center={[position.lat, position.lng]}
          radius={radius}
          pathOptions={{ color: "#6d48db", weight: 1.5, fillColor: "#6d48db", fillOpacity: 0.08 }}
        />
      ) : null}
      <ClusteredMarkers markers={markers} activeId={activeId} onSelect={onSelect} />
      <FollowActive marker={active} />
      <FitToMarkers markers={markers} center={center} />
    </MapContainer>
  );
}
