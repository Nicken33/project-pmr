"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  ArrowRight,
  Info,
  List,
  LocateFixed,
  MapPin,
  Navigation,
  Pin,
  SlidersHorizontal,
  WifiOff,
  X,
} from "lucide-react";
import type { CatalogMarker } from "@/lib/filters";
import { defaultFilters, filtersToParams } from "@/lib/filters";
import type { Category, City, District, FilterState, SuperCategory } from "@/lib/types";
import { getOrganization } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { FilterSidebar, MobileFilterSheet } from "@/components/catalog/FilterSidebar";

const LeafletCatalogMap = dynamic(
  () => import("@/components/map/LeafletCatalogMap").then((mod) => mod.LeafletCatalogMap),
  {
    ssr: false,
    loading: () => (
      <div className="mapLoading">
        <span className="mapLoadingPin">
          <MapPin size={22} />
        </span>
        <span>Загружаем карту…</span>
      </div>
    ),
  },
);

const RADIUSES = [
  { value: "500", label: "500 м" },
  { value: "1000", label: "1 км" },
  { value: "3000", label: "3 км" },
  { value: "10000", label: "10 км" },
];

interface MapClientProps {
  filters: FilterState;
  markers: CatalogMarker[];
  activitiesCount: number;
  categories: Category[];
  superCategories: SuperCategory[];
  cities: City[];
  districts: District[];
  counts: { bySuper: Record<string, number>; byCategory: Record<string, number>; total: number };
  emptyReason?: string;
  loadError?: string;
}

export function MapClient({
  filters,
  markers,
  activitiesCount,
  categories,
  superCategories,
  cities,
  districts,
  counts,
  emptyReason,
  loadError,
}: MapClientProps) {
  const router = useRouter();
  const [localFilters, setLocalFilters] = useState<FilterState>(filters);
  const [isPending, startTransition] = useTransition();
  const [activeId, setActiveId] = useState<string>();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [explainOpen, setExplainOpen] = useState(false);
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [geoState, setGeoState] = useState<"idle" | "loading" | "denied" | "ok">("idle");
  const [mapError, setMapError] = useState(false);

  useEffect(() => setLocalFilters(filters), [filters]);

  useEffect(() => {
    document.body.style.overflow = sheetOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [sheetOpen]);

  useEffect(() => {
    if (filters.near && geoState === "idle") setExplainOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.near]);

  const navigate = useCallback(
    (nextFilters: FilterState) => {
      setLocalFilters(nextFilters);
      const params = filtersToParams(nextFilters);
      startTransition(() => router.push(`/map${params.toString() ? `?${params.toString()}` : ""}`, { scroll: false }));
    },
    [router],
  );

  const updateFilters = (patch: Partial<FilterState>) => {
    const next: FilterState = { ...localFilters, ...patch };
    if (
      ["superCategory", "category", "kind", "city", "district"].some(
        (key) => patch[key as keyof FilterState] !== undefined,
      )
    ) {
      next.activity = "";
    }
    if (patch.superCategory !== undefined && patch.category === undefined) next.category = "";
    if (patch.category) {
      const category = categories.find((item) => item.slug === patch.category);
      if (category) next.superCategory = category.superSlug;
    }
    if (patch.near === true && !next.city) next.city = "tiraspol";
    navigate(next);
  };

  const resetFilters = () => navigate({ ...defaultFilters, view: localFilters.view });

  const askPosition = () => {
    setGeoState("loading");
    setExplainOpen(false);
    if (!("geolocation" in navigator)) {
      setGeoState("denied");
      setMapError(true);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (coords) => {
        setPosition({ lat: coords.coords.latitude, lng: coords.coords.longitude });
        setGeoState("ok");
        setMapError(false);
        navigate({ ...localFilters, near: true, radius: localFilters.radius || "3000" });
      },
      () => {
        setGeoState("denied");
        setMapError(false);
        navigate({ ...localFilters, near: false });
      },
      { enableHighAccuracy: false, timeout: 9000 },
    );
  };

  const active = markers.find((marker) => marker.id === activeId);
  const center = useMemo<[number, number]>(() => {
    const city = cities.find((item) => item.slug === localFilters.city);
    if (city && markers.length) {
      const inCity = markers.filter((marker) => marker.citySlug === city.slug);
      if (inCity.length) return [inCity[0].lat, inCity[0].lng];
    }
    if (markers.length) return [markers[0].lat, markers[0].lng];
    return [46.8403, 29.6433];
  }, [cities, localFilters.city, markers]);

  const grouped = useMemo(() => {
    const byActivity = new Map<string, CatalogMarker[]>();
    for (const marker of markers) {
      byActivity.set(marker.activitySlug, [...(byActivity.get(marker.activitySlug) ?? []), marker]);
    }
    return [...byActivity.entries()];
  }, [markers]);

  return (
    <div className="mapLayout container">
      <div className="mapSidebar">
        <FilterSidebar
          filters={localFilters}
          onChange={updateFilters}
          onReset={resetFilters}
          resultCount={activitiesCount}
          categories={categories}
          superCategories={superCategories}
          cities={cities}
          districts={districts}
          counts={counts}
          className="filterSidebar filterSidebar--map"
        />
      </div>

      <div className="mapStage">
        <div className="mapToolbar">
          <div className="mapToolbarMain">
            <h1 className="mapTitle">Карта занятий и услуг</h1>
            <p className="mapCount" aria-live="polite">
              Найдено: <strong>{activitiesCount}</strong> {activitiesCount === 1 ? "занятие" : "занятий"} ·{" "}
              {markers.length} {markers.length === 1 ? "метка" : "меток"}
            </p>
            {localFilters.activity ? (
              <p className="mapPinNote">
                <Pin size={13} /> Показаны точки одного занятия: «{markers[0]?.activityTitle ?? localFilters.activity}»
                <button type="button" className="linkButton" onClick={() => updateFilters({ activity: "" })}>
                  Показать все
                </button>
              </p>
            ) : null}
          </div>
          <div className="mapToolbarActions">
            <button type="button" className="btn btn--soft btn--sm mapListToggle" onClick={() => setListOpen((open) => !open)}>
              <List size={16} /> Список
            </button>
            <button
              type="button"
              className={cn("btn btn--sm", position ? "btn--primary" : "btn--outline")}
              onClick={() => setExplainOpen(true)}
            >
              <LocateFixed size={16} /> Рядом со мной
            </button>
          </div>
        </div>

        {position ? (
          <div className="radiusChips" role="group" aria-label="Радиус поиска">
            <span className="radiusChipsLabel">
              <Navigation size={13} /> Радиус:
            </span>
            {RADIUSES.map((item) => (
              <button
                key={item.value}
                type="button"
                className={cn("choicePill choicePill--sm", localFilters.radius === item.value && "isActive")}
                aria-pressed={localFilters.radius === item.value}
                onClick={() => updateFilters({ radius: item.value, near: true })}
              >
                {item.label}
              </button>
            ))}
            <button type="button" className="linkButton" onClick={() => updateFilters({ near: false })}>
              Выключить
            </button>
          </div>
        ) : null}

        <div className="mapFrame">
          {isPending ? <div className="mapBusy" aria-live="polite">Обновляем метки…</div> : null}
          {loadError ? (
            <div className="mapEmpty" role="alert">
              <span className="emptyStateIcon">
                <WifiOff size={26} />
              </span>
              <h2>Карта не загрузилась</h2>
              <p>{loadError}. Данные могли не дойти — попробуйте ещё раз.</p>
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => router.refresh()}
                disabled={isPending}
              >
                Повторить
              </button>
            </div>
          ) : markers.length === 0 ? (
            <div className="mapEmpty">
              <span className="emptyStateIcon">
                <MapPin size={26} />
              </span>
              <h2>На карте пусто</h2>
              <p>
                {emptyReason ??
                  "Ни одна точка не подходит под выбранные фильтры. Расширьте радиус, уберите район или возраст."}
              </p>
              <button type="button" className="btn btn--primary" onClick={resetFilters}>
                Сбросить фильтры
              </button>
            </div>
          ) : mapError ? (
            <div className="mapEmpty">
              <span className="emptyStateIcon">
                <Info size={26} />
              </span>
              <h2>Карта не загрузилась</h2>
              <p>Похоже, нет сети. Список справа работает — карточки и телефоны доступны без тайлов.</p>
              <button type="button" className="btn btn--primary" onClick={() => setMapError(false)}>
                Повторить
              </button>
            </div>
          ) : (
            <LeafletCatalogMap
              markers={markers}
              activeId={activeId}
              center={center}
              position={position}
              radius={position ? Number(localFilters.radius) || 3000 : undefined}
              onSelect={(marker) => setActiveId(marker.id)}
            />
          )}
          <span className="mapAttributionNote">© OpenStreetMap contributors</span>

          {active ? (
            <article className="mapMiniCard" aria-live="polite">
              <button
                type="button"
                className="mapMiniClose"
                aria-label="Закрыть карточку"
                onClick={() => setActiveId(undefined)}
              >
                <X size={16} />
              </button>
              <span className="badge badge--category">{active.kind === "service" ? "Услуга" : "Занятие"}</span>
              <h2>{active.activityTitle}</h2>
              <p className="mapMiniAddress">
                <MapPin size={14} />
                {active.cityTitle}
                {active.districtTitle ? `, ${active.districtTitle}` : ""}, {active.address}
                {active.locationName ? ` — ${active.locationName}` : ""}
              </p>
              <p className="mapMiniMeta">
                <span>{active.groupTitle}</span>
                <b>{active.price}</b>
              </p>
              <div className="mapMiniActions">
                <Link
                  className="btn btn--primary btn--sm"
                  href={`/activities/${active.activitySlug}?group=${active.groupId}&location=${active.locationId}`}
                >
                  Открыть карточку <ArrowRight size={14} />
                </Link>
                <a
                  className="btn btn--soft btn--sm"
                  href={`https://www.openstreetmap.org/directions?to=${active.lat}%2C${active.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Как добраться
                </a>
              </div>
              <small className="mapMiniOrg">{getOrganization(active.organizationSlug)?.name}</small>
            </article>
          ) : null}
        </div>

        {listOpen ? (
          <div className="mapList" aria-label="Список точек на карте">
            {grouped.map(([slug, items]) => (
              <div className="mapListGroup" key={slug}>
                <Link href={`/activities/${slug}?group=${items[0].groupId}&location=${items[0].locationId}`}>
                  <strong>{items[0].activityTitle}</strong>
                  <small>
                    {items.length} {items.length === 1 ? "точка" : "точки"} · {items[0].price}
                  </small>
                </Link>
                {items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={cn("mapListItem", item.id === activeId && "isActive")}
                    onClick={() => setActiveId(item.id)}
                  >
                    <MapPin size={14} />
                    <span>
                      <b>{item.locationName ?? item.address}</b>
                      <small>
                        {item.cityTitle}
                        {item.districtTitle ? `, ${item.districtTitle}` : ""}
                      </small>
                    </span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        ) : null}

        <button
          type="button"
          className="btn btn--primary mapFiltersButton"
          onClick={() => setSheetOpen(true)}
        >
          <SlidersHorizontal size={16} /> Фильтры карты
        </button>
      </div>

      <MobileFilterSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        filters={localFilters}
        onChange={updateFilters}
        onReset={resetFilters}
        resultCount={activitiesCount}
        categories={categories}
        superCategories={superCategories}
        cities={cities}
        districts={districts}
        counts={counts}
      />

      {explainOpen ? (
        <div className="modalBackdrop" role="presentation" onMouseDown={() => setExplainOpen(false)}>
          <div
            className="geoModal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="geo-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button type="button" className="modalClose" aria-label="Закрыть" onClick={() => setExplainOpen(false)}>
              <X size={20} />
            </button>
            <span className="geoIcon">
              <LocateFixed size={24} />
            </span>
            <h2 id="geo-title">Показать занятия рядом</h2>
            <p>
              Браузер спросит разрешение на точное местоположение. Мы используем его только один раз,
              чтобы отсортировать карточки по расстоянию и нарисовать круг радиуса — адрес не сохраняем
              и на сервер не отправляем.
            </p>
            <div className="geoActions">
              <button type="button" className="btn btn--primary btn--lg" onClick={askPosition}>
                Разрешить и показать
              </button>
              <button type="button" className="btn btn--ghost btn--lg" onClick={() => setExplainOpen(false)}>
                Выбрать город самому
              </button>
            </div>
            {geoState === "denied" ? (
              <p className="geoHint">
                Доступа к геолокации нет — список отсортирован не по расстоянию, а по городу и району.
                Выберите город в фильтрах слева.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
