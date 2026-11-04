"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Heart, LogIn, MapPin, RotateCcw, Search, X } from "lucide-react";
import type { Activity, CatalogMatch } from "@/lib/types";
import { activities } from "@/lib/data";
import { cityCenters, distanceKm } from "@/lib/filters";
import { useApp } from "@/components/providers/AppProviders";
import { ActivityCard } from "@/components/catalog/ActivityCard";
import { plural } from "@/lib/utils";

/** Избранное (§3.6): карточка хранится целиком, группа и точка выбираются заново — ближайшая. */
function pickMatch(activity: Activity, age: string, position: { lat: number; lng: number } | null): CatalogMatch {
  const origin = position ?? cityCenters.tiraspol;
  const location = [...activity.locations].sort(
    (a, b) => distanceKm(origin, a) - distanceKm(origin, b),
  )[0];

  const ageNumber = Number(age);
  const byAge = Number.isFinite(ageNumber)
    ? activity.groups.find((group) => group.ageFrom <= ageNumber && group.ageTo >= ageNumber)
    : undefined;
  const atNearestLocation = activity.groups.find((group) => group.locationId === location?.id);
  const group = byAge ?? atNearestLocation ?? activity.groups[0];

  return {
    groupId: group?.id ?? "",
    locationId: group?.locationId ?? location?.id ?? activity.locations[0]?.id ?? "",
  };
}

export function FavoritesClient() {
  const { user, ready, favorites, removeFavorite, toggleFavorite, toast } = useApp();
  const [age, setAge] = useState("");
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragged, setDragged] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [undo, setUndo] = useState<{ slug: string; activity: Activity } | null>(null);

  const saved = useMemo(
    () =>
      favorites
        .map((slug) => activities.find((activity) => activity.slug === slug))
        .filter((activity): activity is Activity => Boolean(activity)),
    [favorites],
  );

  const askLocation = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setError("Браузер не умеет определять местоположение — покажем точки Тирасполя.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (coords) => {
        setPosition({ lat: coords.coords.latitude, lng: coords.coords.longitude });
        setLocating(false);
      },
      () => {
        setLocating(false);
        setError("Доступа к геолокации нет. Считаем расстояние по центру Тирасполя.");
      },
      { timeout: 8000 },
    );
  }, []);

  /* Состояние повреждённого localStorage проверяем только на клиенте. */
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!user) return;
    try {
      const raw = window.localStorage.getItem("talentro_favorites");
      if (raw === null) return;
      JSON.parse(raw);
    } catch {
      setError("Список избранного повреждён и не читается.");
    }
  }, [user]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const drop = (activity: Activity) => {
    removeFavorite(activity.slug);
    setUndo({ slug: activity.slug, activity });
  };

  const restore = () => {
    if (!undo) return;
    if (!favorites.includes(undo.slug)) toggleFavorite(undo.slug);
    toast({ title: "Вернули в избранное", description: undo.activity.title, tone: "success" });
    setUndo(null);
  };

  if (!ready) {
    return (
      <div className="favoritesPage container">
        <div className="favoritesSkeleton" aria-busy="true" aria-live="polite">
          {Array.from({ length: 3 }).map((_, index) => (
            <div className="catalogSkeleton" key={index}>
              <div className="skeletonBlock skeletonImage" />
              <div className="skeletonBlock skeletonLine skeletonLine--lg" />
              <div className="skeletonBlock skeletonLine" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="favoritesPage container">
        <div className="emptyState surface favoritesEmpty">
          <span className="emptyStateIcon">
            <Heart size={28} />
          </span>
          <h3>Избранное есть только у участников</h3>
          <p>
            Гостям доступен каталог, поиск, фильтры и карта. Войдите, чтобы сохранять занятия и
            возвращаться к ним с ближайшей точкой и подходящей группой.
          </p>
          <div className="emptyStateActions">
            <Link href="/login?next=/favorites" className="btn btn--primary btn--lg">
              <LogIn size={17} /> Войти
            </Link>
            <Link href="/" className="btn btn--soft btn--lg">
              <Search size={16} /> В каталог
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="favoritesPage container">
      <header className="favoritesHead">
        <div>
          <span className="eyebrow">Сохранённое</span>
          <h1>Избранное</h1>
          <p className="muted">
            {saved.length
              ? `${saved.length} ${plural(saved.length, "карточка", "карточки", "карточек")} · удаление свайпом или крестиком`
              : "Пока ничего не сохранено"}
          </p>
        </div>
        <div className="favoritesTools">
          <div className="favoritesAge" role="group" aria-label="Возраст ребёнка">
            <span>Подобрать группу по возрасту:</span>
            {["5", "8", "12", "16"].map((value) => (
              <button
                key={value}
                type="button"
                className={age === value ? "choicePill choicePill--sm isActive" : "choicePill choicePill--sm"}
                aria-pressed={age === value}
                onClick={() => setAge(age === value ? "" : value)}
              >
                {value} лет
              </button>
            ))}
          </div>
          <button type="button" className="btn btn--soft btn--sm" onClick={askLocation} disabled={locating}>
            <MapPin size={15} />
            {locating ? "Ищем…" : position ? "Ближайшее пересчитано" : "Считать расстояние по мне"}
          </button>
        </div>
      </header>

      {error ? (
        <div className="authError favoritesError" role="alert">
          <span>{error}</span>
          <button
            type="button"
            className="linkButton"
            onClick={() => {
              setError(null);
              askLocation();
            }}
          >
            <RotateCcw size={14} /> Повторить
          </button>
        </div>
      ) : null}

      {undo ? (
        <div className="favoritesUndo" role="status">
          <span>
            <b>{undo.activity.title}</b> убрано из избранного
          </span>
          <button type="button" className="linkButton" onClick={restore}>
            Вернуть
          </button>
          <button type="button" className="favoritesUndoClose" aria-label="Закрыть" onClick={() => setUndo(null)}>
            <X size={15} />
          </button>
        </div>
      ) : null}

      {saved.length ? (
        <div className="favoritesList">
          {saved.map((activity) => {
            const match = pickMatch(activity, age, position);
            return (
              <div
                key={activity.slug}
                className={dragged === activity.slug ? "favoriteRow isDragging" : "favoriteRow"}
                style={{ transform: dragged === activity.slug ? `translateX(${offset}px)` : undefined }}
                onTouchStart={() => setDragged(activity.slug)}
                onTouchMove={(event) => {
                  const start = event.touches[0].clientX;
                  setOffset(Math.min(0, start - 40));
                }}
                onTouchEnd={() => {
                  if (offset < -90) drop(activity);
                  setOffset(0);
                  setDragged(null);
                }}
              >
                <button
                  type="button"
                  className="favoriteRemove"
                  aria-label={`Убрать ${activity.title} из избранного`}
                  onClick={() => drop(activity)}
                >
                  <X size={18} />
                  <span>Убрать</span>
                </button>
                <ActivityCard
                  activity={activity}
                  initialGroupId={match.groupId}
                  initialLocationId={match.locationId}
                />
              </div>
            );
          })}
          <p className="favoritesHint">
            {saved.length} {plural(saved.length, "занятие", "занятия", "занятий")} сохранено целиком:{" "}
            {saved.length === 1 ? "точка" : "точки и группы"} выбираются заново — ближайшая{" "}
            {position ? "по вашей геолокации" : "по центру Тирасполя"}
            {age ? ` и подходящая по возрасту ${age} лет` : ""}.
          </p>
        </div>
      ) : (
        <div className="emptyState surface favoritesEmpty">
          <span className="emptyStateIcon">
            <Heart size={28} />
          </span>
          <h3>В избранном пока пусто</h3>
          <p>
            Нажмите сердечко на карточке в каталоге — занятие появится здесь. Сохранённое открывается
            с ближайшей точкой и подходящей группой.
          </p>
          <div className="emptyStateActions">
            <Link href="/" className="btn btn--primary btn--lg">
              <Search size={17} /> Найти занятие
            </Link>
            <Link href="/map" className="btn btn--soft btn--lg">
              <MapPin size={16} /> Открыть карту
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
