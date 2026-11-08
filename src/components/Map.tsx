import React, { useEffect } from 'react';
import L from 'leaflet';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import Link from 'next/link';
import { CityName, Coordinates, Organization } from '@/types';
import { cityCoordinates } from '@/mocks/data';

interface MapProps {
  organizations: Organization[];
  /** Город из фильтра: карта перелетает к его центру (§5.9). */
  activeCity?: CityName | '';
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  center?: Coordinates;
  zoom?: number;
}

/** Свой маркер вместо L.Icon.Default: у него битые пути к картинкам под сборщиком. */
function pinIcon(selected: boolean) {
  return L.divIcon({
    className: `mapPin${selected ? ' mapPin--selected' : ''}`,
    html: '<span></span>',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
  });
}

function CityRecenter({ activeCity }: { activeCity?: CityName | '' }) {
  const map = useMap();
  useEffect(() => {
    if (!activeCity) return;
    const { lat, lng } = cityCoordinates[activeCity];
    map.flyTo([lat, lng], 13);
  }, [activeCity, map]);
  return null;
}

const Map: React.FC<MapProps> = ({
  organizations,
  activeCity = '',
  selectedId = null,
  onSelect,
  center = { lat: 46.85, lng: 29.6 },
  zoom = 10,
}) => {
  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={zoom}
      style={{ height: '600px', width: '100%' }}
      className="rounded-lg shadow-lg border border-gray-200"
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      <CityRecenter activeCity={activeCity} />
      {organizations.map((org) => (
        <Marker
          key={org.id}
          position={[org.coordinates.lat, org.coordinates.lng]}
          icon={pinIcon(org.id === selectedId)}
          eventHandlers={{ click: () => onSelect?.(org.id) }}
        >
          <Popup>
            <div className="space-y-1">
              <h4 className="text-base font-semibold text-gray-800">{org.name}</h4>
              <p className="text-sm text-gray-600">{org.address}</p>
              <p className="text-sm text-gray-600">
                Возраст: {org.ageRange[0]}–{org.ageRange[1]} лет
              </p>
              <Link
                href={`/organization/${org.id}`}
                className="inline-block mt-2 text-sm text-blue-600 underline"
              >
                Открыть карточку
              </Link>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
};

export default Map;
