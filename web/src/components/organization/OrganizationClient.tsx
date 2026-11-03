"use client";

import { useState } from "react";
import { Clock3, Globe2, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import type { Activity, Location, Organization } from "@/lib/types";
import { getCity, getDistrict } from "@/lib/filters";
import { addressWord, formatDateLong } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { ActivityCard } from "@/components/catalog/ActivityCard";
import { MiniMap } from "@/components/map/MiniMap";

export interface OrgDirection {
  categorySlug: string;
  title: string;
  activities: Activity[];
}

function locationLabel(location: Location) {
  const city = getCity(location.citySlug)?.title ?? "";
  const district = location.districtSlug ? getDistrict(location.districtSlug)?.title : undefined;
  return [city, district].filter(Boolean).join(", ");
}

function messengerHref(organization: Organization) {
  const messengers = organization.messengers ?? {};
  if (messengers.telegram) return `https://t.me/${messengers.telegram.replace(/^@/, "")}`;
  if (messengers.whatsapp) return `https://wa.me/${String(messengers.whatsapp).replace(/[^\d]/g, "")}`;
  if (messengers.viber) return `viber://chat?number=${String(messengers.viber).replace(/[^\d+]/g, "")}`;
  return undefined;
}

export function OrganizationClient({
  organization,
  locations,
  directions,
}: {
  organization: Organization;
  locations: Location[];
  directions: OrgDirection[];
}) {
  const [activeLocationId, setActiveLocationId] = useState<string | null>(null);
  const activeLocation = locations.find((item) => item.id === activeLocationId);

  const points = locations.map((location) => ({
    id: location.id,
    lat: location.lat,
    lng: location.lng,
    label: location.name ?? location.address,
    address: locationLabel(location),
  }));

  const activitiesAt = (locationId: string) =>
    directions
      .flatMap((direction) => direction.activities)
      .filter((activity) => activity.locations.some((location) => location.id === locationId));

  const shownDirections = activeLocation
    ? directions
        .map((direction) => ({
          ...direction,
          activities: direction.activities.filter((activity) =>
            activity.locations.some((location) => location.id === activeLocation.id),
          ),
        }))
        .filter((direction) => direction.activities.length)
    : directions;

  const totalCards = directions.reduce((sum, direction) => sum + direction.activities.length, 0);

  return (
    <>
      <section className="detailCard orgContactsCard">
        <div className="detailCardHead">
          <div>
            <span className="eyebrow">Контакты</span>
            <h2>Как связаться</h2>
          </div>
          {organization.verifiedAt ? (
            <span className="updatedNote">Данные проверены {formatDateLong(organization.verifiedAt)}</span>
          ) : (
            <span className="badge badge--warning">Данные не сверялись</span>
          )}
        </div>
        <p className="orgDescription">{organization.description}</p>
        <div className="orgContactList">
          <a className="orgContact" href={`tel:${organization.phone.replace(/[^\d+]/g, "")}`}>
            <Phone size={16} />
            <span>
              <small>Телефон</small>
              <strong>{organization.phone}</strong>
            </span>
          </a>
          {organization.email ? (
            <a className="orgContact" href={`mailto:${organization.email}`}>
              <Mail size={16} />
              <span>
                <small>Почта</small>
                <strong>{organization.email}</strong>
              </span>
            </a>
          ) : null}
          {organization.site ? (
            <a className="orgContact" href={organization.site} target="_blank" rel="noopener noreferrer">
              <Globe2 size={16} />
              <span>
                <small>Сайт</small>
                <strong>{organization.site.replace(/^https?:\/\//, "")}</strong>
              </span>
            </a>
          ) : null}
          {messengerHref(organization) ? (
            <a className="orgContact" href={messengerHref(organization)} target="_blank" rel="noopener noreferrer">
              <MessageCircle size={16} />
              <span>
                <small>Мессенджер</small>
                <strong>Написать в чат</strong>
              </span>
            </a>
          ) : null}
        </div>
        <p className="orgContactNote">
          Talentro не принимает оплату и не записывает за вас: созванивайтесь напрямую с организацией.
        </p>
      </section>

      {locations.length ? (
        <section className="detailCard orgPointsCard" id="points">
          <div className="detailCardHead">
            <div>
              <span className="eyebrow">Где проходят занятия</span>
              <h2>
                Точки проведения · {locations.length} {addressWord(locations.length)}
              </h2>
            </div>
            {activeLocation ? (
              <button type="button" className="sectionLink" onClick={() => setActiveLocationId(null)}>
                Показать все анкеты
              </button>
            ) : (
              <span className="detailCardHint">Выберите точку — покажем, что на ней идёт</span>
            )}
          </div>

          <div className="orgPointsGrid">
            <div className="orgPointList">
              {locations.map((location) => {
                const count = activitiesAt(location.id).length;
                const isActive = location.id === activeLocation?.id;
                return (
                  <button
                    key={location.id}
                    type="button"
                    className={cn("orgPoint", isActive && "isActive")}
                    aria-pressed={isActive}
                    onClick={() => setActiveLocationId(isActive ? null : location.id)}
                  >
                    <span className="orgPointPin">
                      <MapPin size={16} />
                    </span>
                    <span className="orgPointMain">
                      <strong>{location.name ?? location.address}</strong>
                      <small>{locationLabel(location)}</small>
                      <small className="orgPointAddress">{location.address}</small>
                    </span>
                    <span className="orgPointCount">
                      {count} {count === 1 ? "анкета" : "анкеты"}
                    </span>
                    {location.phone ? (
                      <a
                        className="orgPointPhone"
                        href={`tel:${location.phone.replace(/[^\d+]/g, "")}`}
                        onClick={(event) => event.stopPropagation()}
                      >
                        <Phone size={13} /> {location.phone}
                      </a>
                    ) : (
                      <span className="orgPointPhone orgPointPhone--muted">
                        <Clock3 size={13} /> уточните адрес телефона
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <MiniMap points={points} activeId={activeLocation?.id} className="orgMiniMap" />
          </div>
        </section>
      ) : null}

      <section className="detailCard orgActivitiesCard" id="activities">
        <div className="detailCardHead">
          <div>
            <span className="eyebrow">Каталог организации</span>
            <h2>
              {activeLocation
                ? `Анкеты на точке «${activeLocation.name ?? activeLocation.address}»`
                : `Все анкеты · ${totalCards}`}
            </h2>
          </div>
        </div>

        {shownDirections.length ? (
          shownDirections.map((direction) => (
            <div className="orgDirection" key={direction.categorySlug}>
              <div className="orgDirectionHead">
                <h3>{direction.title}</h3>
                <span>
                  {direction.activities.length}{" "}
                  {direction.activities.length === 1 ? "анкета" : "анкеты"}
                </span>
              </div>
              <div className="catalogGrid catalogGrid--org">
                {direction.activities.map((activity) => (
                  <ActivityCard key={activity.slug} activity={activity} />
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="emptyState">
            <span className="emptyStateIcon">
              <MapPin size={28} />
            </span>
            <h3>На этой точке пока нет анкет</h3>
            <p>Выберите другую точку или посмотрите все анкеты организации.</p>
          </div>
        )}
      </section>
    </>
  );
}
