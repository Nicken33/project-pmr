"use client";

import { useState } from "react";
import {
  Camera,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  FileText,
  MapPin,
  Phone,
  Users,
  Video,
  X,
} from "lucide-react";
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
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [fullModalOpen, setFullModalOpen] = useState(false);
  const organization = getOrganization(application.organizationSlug);

  return (
    <div className="modPreview">
      <div className="modPreviewHead">
        <span className="badge badge--category">{getCategoryTitle(application.categorySlug)}</span>
        <span className="modPreviewOrg">{organization?.name ?? application.organizationSlug}</span>
        <button
          type="button"
          className="btn btn--outline btn--xs modFullPreviewBtn"
          onClick={() => setFullModalOpen(true)}
        >
          <Eye size={13} /> Посмотреть анкету целиком
        </button>
      </div>

      {/* Meta tags: Phone, Format, Lesson Type */}
      <div className="modMetaPills">
        {application.phone ? (
          <a href={`tel:${application.phone}`} className="modMetaPill">
            <Phone size={12} /> {application.phone}
          </a>
        ) : null}
        {application.format ? (
          <span className="modMetaPill">
            {application.format === "online"
              ? "🌐 Онлайн"
              : application.format === "offline"
                ? "📍 Офлайн"
                : "🌐📍 Онлайн и офлайн"}
          </span>
        ) : null}
        {application.type ? (
          <span className="modMetaPill">
            {application.type === "individual" ? "👤 Индивидуально" : "👥 В группе"}
          </span>
        ) : null}
      </div>

      {/* Photos Section */}
      {application.photos && application.photos.length > 0 ? (
        <div className="modPreviewSection">
          <div className="modSectionTitle">
            <Camera size={13} />
            <span>Фотографии ({application.photos.length}) — нажмите для просмотра</span>
          </div>
          <div className="modPhotosGrid">
            {application.photos.map((src, idx) => (
              <button
                key={idx}
                type="button"
                className="modPhotoThumb"
                onClick={() => {
                  setLightboxIndex(idx);
                  setLightboxOpen(true);
                }}
                title={`Открыть фото ${idx + 1}`}
              >
                <img src={src} alt={`Фото ${idx + 1}`} loading="lazy" />
                {idx === 0 ? <span className="modPhotoCoverBadge">Обложка</span> : null}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* Videos Section */}
      {application.videos && application.videos.length > 0 ? (
        <div className="modPreviewSection">
          <div className="modSectionTitle">
            <Video size={13} />
            <span>Видео ({application.videos.length})</span>
          </div>
          <div className="modVideosGrid">
            {application.videos.map((src, idx) => (
              <video key={idx} src={src} controls preload="metadata" className="modVideoPlayer" />
            ))}
          </div>
        </div>
      ) : null}

      {/* Description Section */}
      {application.description ? (
        <div className="modPreviewSection">
          <div className="modSectionTitle">
            <FileText size={13} />
            <span>Описание</span>
          </div>
          <div className="modDescBox">
            <p>{application.description}</p>
          </div>
        </div>
      ) : null}

      {/* Groups Section */}
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
                {group.seats ? (
                  <span className="modSeats">
                    {group.seats} {plural(group.seats, "место", "места", "мест")}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {/* Locations Section */}
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
            {plural(
              application.locations.length,
              "точка проведения",
              "точки проведения",
              "точек проведения",
            )}
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

      {/* Lightbox for Photos */}
      {lightboxOpen && application.photos.length > 0 ? (
        <div
          className="lightbox"
          role="dialog"
          aria-modal="true"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            type="button"
            className="lightboxClose"
            aria-label="Закрыть"
            onClick={() => setLightboxOpen(false)}
          >
            <X size={20} />
          </button>
          <figure onClick={(e) => e.stopPropagation()}>
            <img
              src={application.photos[lightboxIndex]}
              alt={`Фото ${lightboxIndex + 1}`}
            />
            <figcaption>
              Фото {lightboxIndex + 1} из {application.photos.length}
            </figcaption>
          </figure>
          {application.photos.length > 1 ? (
            <>
              <button
                type="button"
                className="lightboxNav lightboxNav--prev"
                aria-label="Предыдущее"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIndex((prev) =>
                    prev > 0 ? prev - 1 : application.photos.length - 1,
                  );
                }}
              >
                <ChevronLeft size={22} />
              </button>
              <button
                type="button"
                className="lightboxNav lightboxNav--next"
                aria-label="Следующее"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIndex((prev) =>
                    prev < application.photos.length - 1 ? prev + 1 : 0,
                  );
                }}
              >
                <ChevronRight size={22} />
              </button>
            </>
          ) : null}
        </div>
      ) : null}

      {/* Full Modal Preview */}
      {fullModalOpen ? (
        <div
          className="modModalOverlay"
          role="dialog"
          aria-modal="true"
          onClick={() => setFullModalOpen(false)}
        >
          <div
            className="modModalContent"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modModalHeader">
              <div>
                <span className="badge badge--category">
                  {getCategoryTitle(application.categorySlug)}
                </span>
                <h2 className="modModalTitle">{application.title}</h2>
                <span className="modPreviewOrg">
                  {organization?.name ?? application.organizationSlug}
                </span>
              </div>
              <button
                type="button"
                className="btn btn--ghost btn--icon"
                aria-label="Закрыть"
                onClick={() => setFullModalOpen(false)}
              >
                <X size={20} />
              </button>
            </div>

            {application.photos && application.photos.length > 0 ? (
              <div className="modModalGallery">
                <div className="modModalCoverWrap">
                  <img
                    src={application.photos[0]}
                    alt={application.title}
                    className="modModalCover"
                  />
                </div>
                {application.photos.length > 1 ? (
                  <div className="modModalThumbs">
                    {application.photos.slice(1).map((src, idx) => (
                      <button
                        key={idx}
                        type="button"
                        className="modModalThumbBtn"
                        onClick={() => {
                          setLightboxIndex(idx + 1);
                          setLightboxOpen(true);
                        }}
                      >
                        <img src={src} alt={`Фото ${idx + 2}`} />
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            {application.description ? (
              <div className="modModalSection">
                <h3>О секции / услуге</h3>
                <p className="modModalDesc">{application.description}</p>
              </div>
            ) : null}

            <div className="modModalSection">
              <h3>Группы и цены ({application.groups.length})</h3>
              <div className="modModalGroups">
                {application.groups.map((group) => (
                  <div key={group.id} className="modModalGroupCard">
                    <div className="modModalGroupTop">
                      <h4>{group.title || "Основная группа"}</h4>
                      <span className="modModalPrice">{formatPrice(group)}</span>
                    </div>
                    <div className="modModalGroupMeta">
                      <span>
                        <Users size={13} /> {formatAge(group)}
                      </span>
                      {group.seats ? <span>{group.seats} мест</span> : null}
                    </div>
                    {group.schedule && group.schedule.length > 0 ? (
                      <div className="modModalSchedule">
                        <Clock3 size={13} />
                        <span>{formatSchedule(group)}</span>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>

            <div className="modModalSection">
              <h3>Точки проведения ({application.locations.length})</h3>
              <div className="modModalLocations">
                {application.locations.map((loc) => (
                  <div key={loc.id} className="modModalLocationCard">
                    <MapPin size={16} />
                    <div>
                      <strong>
                        {getCity(loc.citySlug)?.title ?? loc.citySlug}
                        {loc.districtSlug
                          ? `, ${getDistrict(loc.districtSlug)?.title ?? loc.districtSlug}`
                          : ""}
                      </strong>
                      <p>{loc.address}</p>
                      {loc.lat && loc.lng ? (
                        <small className="modCoords">
                          Координаты: {loc.lat.toFixed(5)}, {loc.lng.toFixed(5)}
                        </small>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {application.phone ? (
              <div className="modModalFooter">
                <a
                  href={`tel:${application.phone}`}
                  className="btn btn--primary btn--md"
                >
                  <Phone size={15} /> Позвонить: {application.phone}
                </a>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
