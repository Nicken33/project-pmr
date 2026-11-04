"use client";

import { useMemo, useState } from "react";
import { PencilLine } from "lucide-react";
import type { Application } from "@/lib/types";
import { categories, cities } from "@/lib/data";
import { getDistrictsForCity } from "@/lib/filters";
import { validateCoordinates, type LocationPatch } from "@/lib/moderation";
import { cn } from "@/lib/utils";

interface QuickEditFormProps {
  application: Application;
  onSaveLocation: (applicationId: string, locationId: string, patch: LocationPatch) => void;
  onSaveDirection: (applicationId: string, categorySlug: string, superSlug: string) => void;
  onEdited: (applicationId: string) => void;
}

/**
 * Одно поле для быстрой правки (§3.9.2): город, район, направление, координаты.
 * Правка служебная (§3.9.6) — не требует причины отказа, но должна быть видна до публикации.
 */
export function QuickEditForm({
  application,
  onSaveLocation,
  onSaveDirection,
  onEdited,
}: QuickEditFormProps) {
  const [locationId, setLocationId] = useState(application.locations[0]?.id ?? "");
  const location = application.locations.find((item) => item.id === locationId) ?? application.locations[0];

  const [citySlug, setCitySlug] = useState(location?.citySlug ?? cities[0]?.slug ?? "");
  const [districtSlug, setDistrictSlug] = useState(location?.districtSlug ?? "");
  const [categorySlug, setCategorySlug] = useState(application.categorySlug);
  const [lat, setLat] = useState(location ? String(location.lat) : "");
  const [lng, setLng] = useState(location ? String(location.lng) : "");
  const [errors, setErrors] = useState<string[]>([]);

  const districts = useMemo(() => getDistrictsForCity(citySlug), [citySlug]);

  // При смене точки подтягиваем её текущие значения, чтобы форма не показывала чужой адрес.
  const selectLocation = (nextId: string) => {
    const next = application.locations.find((item) => item.id === nextId);
    setLocationId(nextId);
    if (next) {
      setCitySlug(next.citySlug);
      setDistrictSlug(next.districtSlug ?? "");
      setLat(String(next.lat));
      setLng(String(next.lng));
    }
    setErrors([]);
  };

  const changeCity = (nextCity: string) => {
    setCitySlug(nextCity);
    // район принадлежит городу — при смене города старый район сбрасываем
    if (!getDistrictsForCity(nextCity).some((district) => district.slug === districtSlug)) {
      setDistrictSlug("");
    }
  };

  const apply = () => {
    const nextErrors: string[] = [];
    const latRaw = lat.trim();
    const lngRaw = lng.trim();
    if (!latRaw) nextErrors.push("Укажите широту.");
    if (!lngRaw) nextErrors.push("Укажите долготу.");
    const latNum = Number(latRaw.replace(",", "."));
    const lngNum = Number(lngRaw.replace(",", "."));
    if (latRaw && lngRaw) {
      const coordError = validateCoordinates(latNum, lngNum);
      if (coordError) nextErrors.push(coordError);
    }
    if (!locationId) nextErrors.push("Выберите точку для правки.");

    if (nextErrors.length) {
      setErrors(nextErrors);
      return;
    }

    onSaveLocation(application.id, locationId, {
      citySlug,
      districtSlug: districtSlug || undefined,
      lat: latNum,
      lng: lngNum,
    });
    if (categorySlug !== application.categorySlug) {
      const category = categories.find((item) => item.slug === categorySlug);
      onSaveDirection(application.id, categorySlug, category?.superSlug ?? application.superSlug);
    }
    setErrors([]);
    onEdited(application.id);
  };

  return (
    <form
      className="modEdit"
      onSubmit={(event) => {
        event.preventDefault();
        apply();
      }}
    >
      <div className="modEditHead">
        <PencilLine size={15} />
        <span>Быстрая правка — служебные поля (§3.9.2)</span>
      </div>

      {application.locations.length > 1 ? (
        <div className="modField">
          <label className="modLabel" htmlFor={`${application.id}-loc`}>
            Какая точка
          </label>
          <select
            id={`${application.id}-loc`}
            className="fieldSelect"
            value={locationId}
            onChange={(event) => selectLocation(event.target.value)}
          >
            {application.locations.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name ?? item.address}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="modEditGrid">
        <div className="modField">
          <label className="modLabel" htmlFor={`${application.id}-city`}>
            Город
          </label>
          <select
            id={`${application.id}-city`}
            className="fieldSelect"
            value={citySlug}
            onChange={(event) => changeCity(event.target.value)}
          >
            {cities.map((city) => (
              <option key={city.slug} value={city.slug}>
                {city.title}
              </option>
            ))}
          </select>
        </div>

        <div className="modField">
          <label className="modLabel" htmlFor={`${application.id}-district`}>
            Район
          </label>
          <select
            id={`${application.id}-district`}
            className="fieldSelect"
            value={districtSlug}
            onChange={(event) => setDistrictSlug(event.target.value)}
          >
            <option value="">не выбран</option>
            {districts.map((district) => (
              <option key={district.slug} value={district.slug}>
                {district.title}
              </option>
            ))}
          </select>
        </div>

        <div className="modField">
          <label className="modLabel" htmlFor={`${application.id}-category`}>
            Направление
          </label>
          <select
            id={`${application.id}-category`}
            className="fieldSelect"
            value={categorySlug}
            onChange={(event) => setCategorySlug(event.target.value)}
          >
            {categories.map((category) => (
              <option key={category.slug} value={category.slug}>
                {category.title}
              </option>
            ))}
          </select>
        </div>

        <div className="modField">
          <label className="modLabel" htmlFor={`${application.id}-lat`}>
            Широта
          </label>
          <input
            id={`${application.id}-lat`}
            className="fieldInput"
            type="text"
            inputMode="decimal"
            aria-label="Широта, от -90 до 90"
            value={lat}
            onChange={(event) => setLat(event.target.value)}
          />
        </div>

        <div className="modField">
          <label className="modLabel" htmlFor={`${application.id}-lng`}>
            Долгота
          </label>
          <input
            id={`${application.id}-lng`}
            className="fieldInput"
            type="text"
            inputMode="decimal"
            aria-label="Долгота, от -180 до 180"
            value={lng}
            onChange={(event) => setLng(event.target.value)}
          />
        </div>
      </div>

      {errors.length ? (
        <p className="modError" role="alert">
          {errors.join(" ")}
        </p>
      ) : null}

      <button type="submit" className="btn btn--soft">
        <PencilLine size={15} /> Применить правку
      </button>
    </form>
  );
}

/** Пометка о том, что карточка уже правилась служебно (§3.9.6). */
export function ServiceEditBadge({ edited }: { edited: boolean }) {
  if (!edited) return null;
  return (
    <span className={cn("modServiceBadge")}>
      <PencilLine size={12} /> служебная правка модератора
    </span>
  );
}
