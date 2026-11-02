import React, { useEffect, useCallback } from 'react';
import { APIProvider, Map, AdvancedMarker, useMap, MapMouseEvent } from '@vis.gl/react-google-maps';
import { MapPin, Navigation, Compass, Check } from 'lucide-react';
import { PMR_CITIES_COORDINATES } from './TransnistriaMap';

const GOOGLE_MAPS_API_KEY =
  import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyCTCulkDTBQlS6-B4xskw6sikZLM5BPQno';

interface OwnerLocationMapPickerProps {
  city: string;
  lat: number;
  lng: number;
  title?: string;
  onCoordinatesChange: (lat: number, lng: number) => void;
}

// Subcomponent to pan to city when changed if marker is far or not yet set
const CameraController: React.FC<{ city: string; lat: number; lng: number }> = ({ city, lat, lng }) => {
  const map = useMap();

  useEffect(() => {
    if (!map) return;
    // If lat & lng are valid, center to them, otherwise center to city
    if (lat && lng && !isNaN(lat) && !isNaN(lng)) {
      map.panTo({ lat, lng });
    } else {
      const cityCoords = PMR_CITIES_COORDINATES[city] || PMR_CITIES_COORDINATES['Тирасполь'];
      if (cityCoords) {
        map.panTo({ lat: cityCoords.lat, lng: cityCoords.lng });
        map.setZoom(cityCoords.zoom);
      }
    }
  }, [city, map]);

  return null;
};

export const OwnerLocationMapPicker: React.FC<OwnerLocationMapPickerProps> = ({
  city,
  lat,
  lng,
  title,
  onCoordinatesChange,
}) => {
  const cityPreset = PMR_CITIES_COORDINATES[city] || PMR_CITIES_COORDINATES['Тирасполь'];

  const defaultCenter = {
    lat: lat && !isNaN(lat) ? lat : cityPreset.lat,
    lng: lng && !isNaN(lng) ? lng : cityPreset.lng,
  };

  const handleMapClick = useCallback((e: MapMouseEvent) => {
    if (e.detail?.latLng) {
      const newLat = e.detail.latLng.lat;
      const newLng = e.detail.latLng.lng;
      onCoordinatesChange(Number(newLat.toFixed(5)), Number(newLng.toFixed(5)));
    }
  }, [onCoordinatesChange]);

  const handleResetToCityCenter = () => {
    if (cityPreset) {
      onCoordinatesChange(cityPreset.lat, cityPreset.lng);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <label className="font-bold text-[#1F1B3D] flex items-center gap-1.5">
          <MapPin className="w-4 h-4 text-[#0284C7]" />
          <span>Местоположение на Google Maps (кликните по карте):</span>
        </label>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] bg-sky-50 text-[#0284C7] font-semibold px-2 py-0.5 rounded-md border border-sky-200">
            {lat.toFixed(4)}, {lng.toFixed(4)}
          </span>
          <button
            type="button"
            onClick={handleResetToCityCenter}
            className="text-[10px] text-[#858394] hover:text-[#0284C7] underline cursor-pointer"
            title="Сбросить в центр выбранного города"
          >
            В центр {city}
          </button>
        </div>
      </div>

      <div className="relative w-full h-56 sm:h-64 rounded-2xl overflow-hidden border-2 border-sky-300 shadow-inner bg-slate-100">
        <APIProvider apiKey={GOOGLE_MAPS_API_KEY} solutionChannel="GMP_visgl_reactgooglemaps_v1">
          <Map
            defaultCenter={defaultCenter}
            defaultZoom={14}
            mapId="DEMO_MAP_ID"
            onClick={handleMapClick}
            disableDefaultUI={false}
            gestureHandling="greedy"
            zoomControl={true}
            streetViewControl={false}
            mapTypeControl={false}
            fullscreenControl={false}
            className="w-full h-full cursor-crosshair"
          >
            <CameraController city={city} lat={lat} lng={lng} />

            {/* Dropped section pin */}
            <AdvancedMarker position={{ lat, lng }}>
              <div className="flex flex-col items-center pointer-events-none drop-shadow-lg -translate-y-1">
                <div className="px-2 py-0.5 bg-[#1F1B3D] text-white text-[10px] font-bold rounded-md shadow-md whitespace-nowrap mb-0.5 border border-white/20 flex items-center gap-1">
                  <span>{title || 'Точка секции'}</span>
                  <Check className="w-3 h-3 text-[#38BDF8]" />
                </div>
                <div className="w-8 h-8 rounded-full bg-[#0284C7] border-2 border-white shadow-xl flex items-center justify-center text-white ring-4 ring-[#0284C7]/20">
                  <MapPin className="w-4 h-4 fill-white" />
                </div>
              </div>
            </AdvancedMarker>
          </Map>
        </APIProvider>

        {/* Overlay instruction */}
        <div className="absolute top-2 left-2 pointer-events-none bg-white/95 backdrop-blur-sm px-3 py-1.5 rounded-xl text-[11px] text-[#1F1B3D] font-bold shadow-md border border-slate-200 flex items-center gap-1.5">
          <Compass className="w-3.5 h-3.5 text-[#0284C7]" />
          <span>Кликните в любую точку города, чтобы поставить метку</span>
        </div>
      </div>

      <div className="flex items-center justify-between text-[11px] text-[#858394] px-1">
        <span>Метка сразу появится на общей карте Приднестровья и в фильтре «Рядом со мной».</span>
      </div>
    </div>
  );
};
