"use client";

import { useState } from "react";
import { ChevronDown, Clock3, MapPin, Users } from "lucide-react";
import type { Application } from "@/lib/types";
import { formatAge, formatPrice, formatSchedule, getCity, getDistrict } from "@/lib/filters";
import { getCategoryTitle, getOrganization, groupWord, plural } from "@/lib/utils";
import { cn } from "@/lib/utils";

/**
 * Превью карточки так, как её увидит пользователь: ВСЕ точки и ВСЕ группы,
 * а не только featured (§3.9.1). Раскрытие — кнопкой с aria-expanded (§10.6).
 */
export function ApplicationPreview({ application }: { application: Application }) {
  const [groupsOpen, setGroupsOpen] = useState(false);
  const [locationsOpen, setLocationsOpen] = useState(false);
  const organization = getOrganization(application.organizationSlug);

  return (
    <div className="modPreview">
      <div className="modPreviewHead">
        <span className="badge badge--category">{getCategoryTitle(application.categorySlug)}</span>
        <span className="modPreviewOrg">{organization?.name ?? application.organizationSlug}</span>
      </div>

      <div className="modPreviewSection">
        <button
          type="button"
          className={cn("cardMetaButton", groupsOpen && "isOpen")}
          aria-expanded={groupsOpen}
          onClick={() => setGroupsOpen((open) => !open)}
        >
          <span>
            <Users size={14} />
            {application.groups.length} {groupWord(application.groups.length)} — как их увидят
          </span>
          <ChevronDown size={15} />
        </button>
        {groupsOpen ? (
          <ul className="modPreviewList">
            {application.groups.map((group) => (
              <li key={group.id} className="modPreviewItem">
                <span className="modPreviewItemMain">
                  <b>{group.title || formatAge(group)}</b>
                  <small>
                    <Users size={12} /> {formatAge(group)} · {formatPrice(group)}
                  </small>
                  <small>
                    <Clock3 size={12} /> {formatSchedule(group) || "расписание не указано"}
                  </small>
                </span>
                {group.seats ? <span className="modSeats">{group.seats} {plural(group.seats, "место", "места", "мест")}</span> : null}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="modPreviewSection">
        <button
          type="button"
          className={cn("cardLocationButton", locationsOpen && "isOpen")}
          aria-expanded={locationsOpen}
          onClick={() => setLocationsOpen((open) => !open)}
        >
          <MapPin size={14} />
          <span>
            {application.locations.length}{" "}
            {plural(application.locations.length, "точка проведения", "точки проведения", "точек проведения")}
          </span>
          <ChevronDown size={15} />
        </button>
        {locationsOpen ? (
          <ul className="modPreviewList">
            {application.locations.map((location) => (
              <li key={location.id} className="modPreviewItem">
                <span className="modPreviewItemMain">
                  <b>{location.name ?? location.address}</b>
                  <small>
                    {getCity(location.citySlug)?.title ?? location.citySlug}
                    {location.districtSlug
                      ? ` · ${getDistrict(location.districtSlug)?.title ?? location.districtSlug}`
                      : ""}
                    {` · ${location.address}`}
                  </small>
                  <small className="modCoords">
                    {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
                  </small>
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
