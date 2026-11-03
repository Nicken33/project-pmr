"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ExternalLink,
  Flag,
  Globe2,
  Heart,
  Info,
  MapPin,
  MessageCircle,
  Phone,
  Share2,
  ShieldCheck,
  ThumbsDown,
  ThumbsUp,
  Users,
  X,
} from "lucide-react";
import type { Activity, Organization } from "@/lib/types";
import {
  formatAge,
  formatPrice,
  formatSchedule,
  getCity,
  getDistrict,
} from "@/lib/filters";
import {
  addressWord,
  formatDateLong,
  formatRelative,
  groupWord,
  plural,
} from "@/lib/utils";
import { cn } from "@/lib/utils";
import { useApp } from "@/components/providers/AppProviders";
import { MiniMap } from "@/components/map/MiniMap";
import { ActivityCard } from "@/components/catalog/ActivityCard";
import { ReviewsBlock } from "@/components/activity/ReviewsBlock";

interface ActivityDetailProps {
  activity: Activity;
  organization: Organization;
  categoryTitle: string;
  superTitle: string;
  similar: Activity[];
  initialGroupId?: string;
  initialLocationId?: string;
}

const reportReasons = [
  "Неверная цена или расписание",
  "Занятие больше не проводится",
  "Ошибка в адресе или телефоне",
  "Некорректный отзыв",
  "Другое",
];

function ageSummary(activity: Activity) {
  const ages = activity.groups.flatMap((group) => [group.ageFrom, group.ageTo]);
  if (!ages.length) return "Возраст уточняется";
  const min = Math.min(...ages);
  const max = Math.max(...ages);
  if (min === 0 && max === 99) return "Для всей семьи";
  if (max >= 99) return `От ${min} лет`;
  return `${min}–${max} лет`;
}

function formatPhoneHref(phone?: string) {
  return (phone ?? "").replace(/[^\d+]/g, "");
}

function messengerUrl(organization: Organization) {
  if (organization.messengers?.telegram) {
    return `https://t.me/${organization.messengers.telegram.replace(/^@/, "")}`;
  }
  if (organization.messengers?.whatsapp) {
    return `https://wa.me/${organization.messengers.whatsapp.replace(/[^\d]/g, "")}`;
  }
  if (organization.email) return `mailto:${organization.email}`;
  if (organization.site) return organization.site;
  return undefined;
}

export function ActivityDetail({
  activity,
  organization,
  categoryTitle,
  superTitle,
  similar,
  initialGroupId,
  initialLocationId,
}: ActivityDetailProps) {
  const { user, isFavorite, toggleFavorite, requestAuth, toast } = useApp();
  const [activeGroupId, setActiveGroupId] = useState(
    initialGroupId ?? activity.groups[activity.featuredGroupIndex ?? 0]?.id ?? activity.groups[0]?.id ?? "",
  );
  const activeGroup =
    activity.groups.find((group) => group.id === activeGroupId) ?? activity.groups[0];
  const [activeLocationId, setActiveLocationId] = useState(
    initialLocationId ?? activity.featuredLocationId ?? activeGroup?.locationId ?? activity.locations[0]?.id ?? "",
  );
  const activeLocation =
    activity.locations.find((location) => location.id === activeLocationId) ??
    activity.locations.find((location) => location.id === activeGroup?.locationId) ??
    activity.locations[0];

  const [photoIndex, setPhotoIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [votes, setVotes] = useState({ plus: activity.votesPlus, minus: activity.votesMinus });
  const [userVote, setUserVote] = useState<"up" | "down" | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState(reportReasons[0]);
  const [reportText, setReportText] = useState("");
  const [reportSent, setReportSent] = useState(false);

  const favorite = isFavorite(activity.slug);
  const allPhotos = activity.photos;
  const activePhoto = allPhotos[photoIndex] ?? allPhotos[0];
  const score =
    votes.plus + votes.minus >= 3
      ? Math.round((votes.plus / Math.max(votes.plus + votes.minus, 1)) * 100)
      : null;
  const seats = activeGroup?.seats;

  const points = activity.locations.map((location) => ({
    id: location.id,
    lat: location.lat,
    lng: location.lng,
    label: location.name ?? location.address,
    address: `${getCity(location.citySlug)?.title ?? ""}, ${location.address}`,
  }));

  useEffect(() => {
    if (!lightboxOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLightboxOpen(false);
      if (event.key === "ArrowRight") setPhotoIndex((index) => (index + 1) % allPhotos.length);
      if (event.key === "ArrowLeft")
        setPhotoIndex((index) => (index - 1 + allPhotos.length) % allPhotos.length);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [allPhotos.length, lightboxOpen]);

  useEffect(() => {
    if (reportOpen) {
      setReportSent(false);
    }
  }, [reportOpen]);

  const selectGroup = (groupId: string) => {
    const group = activity.groups.find((item) => item.id === groupId);
    setActiveGroupId(groupId);
    if (group) setActiveLocationId(group.locationId);
  };

  const tryVote = (direction: "up" | "down") => {
    if (!user) {
      requestAuth("Войдите, чтобы голосовать за занятие");
      return;
    }
    if (userVote === direction) {
      setUserVote(null);
      setVotes((current) => ({
        ...current,
        [direction === "up" ? "plus" : "minus"]: Math.max(
          0,
          current[direction === "up" ? "plus" : "minus"] - 1,
        ),
      }));
      return;
    }
    setVotes((current) => {
      const next = { ...current };
      if (userVote === "up") next.plus = Math.max(0, next.plus - 1);
      if (userVote === "down") next.minus = Math.max(0, next.minus - 1);
      if (direction === "up") next.plus += 1;
      else next.minus += 1;
      return next;
    });
    setUserVote(direction);
    toast({ title: "Спасибо за голос", tone: "success" });
  };

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: activity.title, text: activity.shortDescription, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast({ title: "Ссылка скопирована", tone: "success" });
    } catch {
      toast({ title: "Не удалось поделиться", description: "Скопируйте адрес из строки браузера." });
    }
  };

  const submitReport = () => {
    setReportSent(true);
    toast({
      title: "Спасибо, что сообщили",
      description: "Модератор проверит карточку в течение рабочего дня.",
      tone: "success",
    });
  };

  const minPrice = Math.min(...activity.groups.map((group) => group.priceFrom));
  const maxPrice = Math.max(...activity.groups.map((group) => group.priceFrom));

  return (
    <div className="activityPage container">
      <nav className="breadcrumbs" aria-label="Хлебные крошки">
        <Link href="/">
          <ArrowLeft size={14} /> Каталог
        </Link>
        <span>/</span>
        <Link href={`/?super=${activity.superSlug}`}>{superTitle}</Link>
        <span>/</span>
        <Link href={`/?category=${activity.categorySlug}`}>{categoryTitle}</Link>
      </nav>

      <header className="activityHeader">
        <div className="activityHeaderMain">
          <div className="activityTags">
            {activity.verifiedAt ? (
              <span className="badge badge--verified badge--lg">
                <BadgeCheck size={13} /> Данные проверены
              </span>
            ) : (
              <span className="badge badge--warning badge--lg">Данные ориентировочные</span>
            )}
            <span className="badge badge--category badge--lg">{categoryTitle}</span>
            {activity.kind === "service" ? <span className="badge badge--service badge--lg">Услуга</span> : null}
            {activity.isNew ? <span className="badge badge--new badge--lg">Новое</span> : null}
          </div>
          <h1>{activity.title}</h1>
          <div className="activityOrgLine">
            <Link href={`/organizations/${organization.slug}`} className="activityOrgName">
              {organization.name}
              {organization.verifiedAt ? <BadgeCheck size={15} /> : null}
            </Link>
            <span className="activityDot" />
            <span>
              {activeLocation ? getCity(activeLocation.citySlug)?.title : "Приднестровье"}
            </span>
            <span className="activityDot" />
            <span>{activity.kind === "service" ? "по записи" : `${activity.groups.length} ${groupWord(activity.groups.length)}`}</span>
          </div>
        </div>

        <div className="activityActions">
          <button
            type="button"
            className={cn("detailAction", favorite && "isActive")}
            aria-pressed={favorite}
            onClick={() => toggleFavorite(activity.slug)}
          >
            <Heart size={18} fill={favorite ? "currentColor" : "none"} />
            <span>{favorite ? "В избранном" : "В избранное"}</span>
          </button>
          <button type="button" className="detailAction" onClick={share}>
            <Share2 size={18} />
            <span>Поделиться</span>
          </button>
          <button type="button" className="detailAction detailAction--muted" onClick={() => setReportOpen(true)}>
            <Flag size={17} />
            <span>Пожаловаться</span>
          </button>
        </div>
      </header>

      <div className="activityDetailGrid">
        <div className="activityMainColumn">
          <section className="galleryCard" aria-label="Фотографии занятия">
            <button
              type="button"
              className="galleryMain"
              onClick={() => setLightboxOpen(true)}
              aria-label="Открыть фотографию на весь экран"
            >
              <img src={activePhoto} alt={`${activity.title} — фото ${photoIndex + 1}`} />
              <span className="galleryExpand">
                <ArrowRight size={16} /> Смотреть фото
              </span>
              <span className="galleryCounter">
                {photoIndex + 1} / {allPhotos.length}
              </span>
            </button>
            <div className="galleryThumbs" role="list">
              {allPhotos.map((photo, index) => (
                <button
                  key={photo + index}
                  type="button"
                  role="listitem"
                  className={cn("galleryThumb", index === photoIndex && "isActive")}
                  onClick={() => setPhotoIndex(index)}
                  aria-label={`Фото ${index + 1}`}
                  aria-pressed={index === photoIndex}
                >
                  <img src={photo} alt="" loading="lazy" />
                </button>
              ))}
            </div>
          </section>

          <section className="detailCard aboutCard">
            <div className="detailCardHead">
              <h2>О занятии</h2>
              {activity.updatedAt ? (
                <span className="updatedNote">Обновлено {formatRelative(activity.updatedAt)}</span>
              ) : null}
            </div>
            <p className="detailDescription">{activity.description}</p>
            <div className="factGrid">
              {activity.kind === "service" ? (
                <div className="fact">
                  <span className="factIcon"><MapPin size={18} /></span>
                  <span>
                    <small>Где оказывается</small>
                    <strong>
                      {activity.serviceMode === "оба"
                        ? "Выезд и на месте"
                        : activity.serviceMode === "выезд"
                          ? "Выезд к клиенту"
                          : "На месте"}
                    </strong>
                  </span>
                </div>
              ) : (
                <div className="fact">
                  <span className="factIcon"><Users size={18} /></span>
                  <span>
                    <small>Возраст</small>
                    <strong>{ageSummary(activity)}</strong>
                  </span>
                </div>
              )}
              <div className="fact">
                <span className="factIcon"><Globe2 size={18} /></span>
                <span>
                  <small>Формат</small>
                  <strong>
                    {activity.format === "online"
                      ? "Онлайн"
                      : activity.format === "both"
                        ? "Офлайн и онлайн"
                        : "Офлайн"}
                  </strong>
                </span>
              </div>
              <div className="fact">
                <span className="factIcon"><CalendarDays size={18} /></span>
                <span>
                  <small>Тип</small>
                  <strong>
                    {activity.kind === "service"
                      ? "Услуга по записи"
                      : activity.type === "individual"
                        ? "Индивидуально"
                        : activity.type === "both"
                          ? "Группы и индивидуально"
                          : "Групповые занятия"}
                  </strong>
                </span>
              </div>
              <div className="fact">
                <span className="factIcon"><MapPin size={18} /></span>
                <span>
                  <small>Адреса</small>
                  <strong>
                    {activity.locations.length} {addressWord(activity.locations.length)}
                  </strong>
                </span>
              </div>
            </div>
            {activity.shortDescription ? (
              <p className="detailLead">{activity.shortDescription}</p>
            ) : null}
          </section>

          <section className="detailCard groupsCard" id="groups">
            <div className="detailCardHead">
              <div>
                <span className="eyebrow">Расписание и стоимость</span>
                <h2>
                  {activity.kind === "service"
                    ? "Услуга и запись"
                    : activity.groups.length > 1
                      ? "Группы"
                      : "Группа и расписание"}
                </h2>
              </div>
              {activity.groups.length > 1 ? (
                <span className="detailCardHint">Выберите подходящую группу</span>
              ) : null}
            </div>

            {activity.groups.length > 1 ? (
              <div className="groupTabs" role="tablist" aria-label="Группы занятия">
                {activity.groups.map((group) => (
                  <button
                    key={group.id}
                    type="button"
                    role="tab"
                    aria-selected={group.id === activeGroupId}
                    className={cn("groupTab", group.id === activeGroupId && "isActive")}
                    onClick={() => selectGroup(group.id)}
                  >
                    <span className="groupTabTop">
                      <strong>{group.title || formatAge(group)}</strong>
                      {group.id === activeGroupId ? <Check size={15} /> : null}
                    </span>
                    <span className="groupTabAge">{formatAge(group)}</span>
                    <span className="groupTabPrice">{formatPrice(group)}</span>
                    {group.seats ? (
                      <span className={cn("groupSeats", group.seats <= 2 && "groupSeats--low")}>
                        {group.seats} {plural(group.seats, "место", "места", "мест")}
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
            ) : null}

            {activeGroup ? (
              <div className="groupDetail">
                <div className="schedulePanel">
                  <div className="schedulePanelHead">
                    <h3>
                      {activity.kind === "service" ? (
                        <>
                          <CalendarDays size={18} /> Как оказывается услуга
                        </>
                      ) : (
                        <>
                          <Clock3 size={18} /> Расписание
                        </>
                      )}
                    </h3>
                    {seats ? (
                      <span className={cn("seatsPill", seats <= 2 && "seatsPill--low")}>
                        {seats} {plural(seats, "свободное место", "свободных места", "свободных мест")}
                      </span>
                    ) : (
                      <span className="seatsPill seatsPill--neutral">
                        {activity.kind === "service" ? "По записи" : "Запись по телефону"}
                      </span>
                    )}
                  </div>
                  {activity.kind === "service" ? (
                    <ul className="serviceFacts">
                      <li>
                        <span>Формат</span>
                        <strong>
                          {activity.format === "online"
                            ? "Онлайн"
                            : activity.format === "both"
                              ? "Офлайн и онлайн"
                              : "Офлайн"}
                        </strong>
                      </li>
                      <li>
                        <span>Где</span>
                        <strong>
                          {activity.serviceMode === "оба"
                            ? "Выезд и на месте"
                            : activity.serviceMode === "выезд"
                              ? "Выезд к клиенту"
                              : "На месте"}
                        </strong>
                      </li>
                      <li>
                        <span>Оплата</span>
                        <strong>{formatPrice(activeGroup)}</strong>
                      </li>
                    </ul>
                  ) : (
                    <>
                      <div className="scheduleList">
                        {activeGroup.schedule.map((row, index) => (
                          <div className="scheduleRow" key={`${row.day}-${row.start}-${index}`}>
                            <span className="scheduleDay">{row.day}</span>
                            <span className="scheduleTime">
                              {row.start}–{row.end}
                            </span>
                            {row.note ? <span className="scheduleNote">{row.note}</span> : <span />}
                          </div>
                        ))}
                      </div>
                      <p className="scheduleSummary">{formatSchedule(activeGroup)}</p>
                    </>
                  )}
                </div>

                <div className="groupAside">
                  <span className="groupAsideLabel">Стоимость</span>
                  <strong className="groupAsidePrice">{formatPrice(activeGroup)}</strong>
                  {activity.kind === "service" ? null : (
                    <span className="groupAsideMeta">
                      {activeGroup.title || formatAge(activeGroup)} · {formatAge(activeGroup)}
                    </span>
                  )}
                  <a
                    className="btn btn--primary btn--block btn--lg"
                    href={`tel:${formatPhoneHref(activeLocation?.phone ?? organization.phone)}`}
                  >
                    <Phone size={17} /> Позвонить
                  </a>
                  <span className="groupAsideNote">
                    Скажите, что нашли {activity.kind === "service" ? "услугу" : "занятие"} на Talentro — так проще
                    сверить наличие мест.
                  </span>
                </div>
              </div>
            ) : null}
          </section>

          <section className="detailCard locationCard">
            <div className="detailCardHead">
              <div>
                <span className="eyebrow">Где заниматься</span>
                <h2>Расположение</h2>
              </div>
              <Link href={`/map?activity=${activity.slug}`} className="sectionLink">
                Открыть на карте <ArrowRight size={14} />
              </Link>
            </div>
            <div className="locationGrid">
              <div className="locationInfo">
                {activity.locations.length > 1 ? (
                  <div className="locationTabs" role="tablist" aria-label="Адреса">
                    {activity.locations.map((location) => (
                      <button
                        key={location.id}
                        type="button"
                        role="tab"
                        aria-selected={location.id === activeLocation?.id}
                        className={cn("locationTab", location.id === activeLocation?.id && "isActive")}
                        onClick={() => setActiveLocationId(location.id)}
                      >
                        <MapPin size={15} />
                        <span>
                          <strong>{location.name ?? location.address}</strong>
                          <small>
                            {getCity(location.citySlug)?.title}
                            {location.districtSlug
                              ? `, ${getDistrict(location.districtSlug)?.title}`
                              : ""}
                          </small>
                        </span>
                      </button>
                    ))}
                  </div>
                ) : null}
                {activeLocation ? (
                  <div className="addressBlock">
                    <strong>
                      {getCity(activeLocation.citySlug)?.title}
                      {activeLocation.districtSlug
                        ? `, ${getDistrict(activeLocation.districtSlug)?.title}`
                        : ""}
                    </strong>
                    <span>{activeLocation.address}</span>
                    {activeLocation.phone ? (
                      <a href={`tel:${formatPhoneHref(activeLocation.phone)}`}>
                        <Phone size={14} /> {activeLocation.phone}
                      </a>
                    ) : null}
                  </div>
                ) : null}
              </div>
              <MiniMap points={points} activeId={activeLocation?.id} />
            </div>
          </section>

          <ReviewsBlock activity={activity} limit={5} />

          {similar.length ? (
            <section className="similarSection">
              <div className="sectionHeadRow">
                <div>
                  <span className="eyebrow">Рядом по духу</span>
                  <h2>Похожие занятия</h2>
                </div>
                <Link href={`/?super=${activity.superSlug}`} className="sectionLink">
                  Все в категории <ChevronRight size={15} />
                </Link>
              </div>
              <div className="recommendedGrid recommendedGrid--similar">
                {similar.map((item) => (
                  <ActivityCard key={item.slug} activity={item} compact />
                ))}
              </div>
            </section>
          ) : null}
        </div>

        <aside className="activitySideColumn">
          <div className="contactCard">
            <div className="contactPriceRow">
              <div>
                <span className="contactLabel">Стоимость</span>
                <strong>
                  {activeGroup ? formatPrice(activeGroup) : `${minPrice}–${maxPrice} руб. ПМР`}
                </strong>
              </div>
              {score !== null ? (
                <span className="contactRating">
                  <ThumbsUp size={13} /> {score}% рекомендуют
                </span>
              ) : (
                <span className="contactRating contactRating--empty">Голосов нет</span>
              )}
            </div>
            <div className="voteButtons voteButtons--side" role="group" aria-label="Оценить занятие">
              <button
                type="button"
                className={cn("voteButton", userVote === "up" && "isActive")}
                onClick={() => tryVote("up")}
                aria-pressed={userVote === "up"}
              >
                <ThumbsUp size={17} /> Полезно <b>{votes.plus}</b>
              </button>
              <button
                type="button"
                className={cn("voteButton", userVote === "down" && "isActive")}
                onClick={() => tryVote("down")}
                aria-pressed={userVote === "down"}
              >
                <ThumbsDown size={17} /> Не подошло <b>{votes.minus}</b>
              </button>
            </div>
            <p className="voteSideNote">
              Голос — один на карточку, его можно отозвать повторным нажатием.{" "}
              {votes.plus + votes.minus > 0
                ? `${votes.plus + votes.minus} ${plural(votes.plus + votes.minus, "голос", "голоса", "голосов")}.`
                : "Голосов пока нет."}
            </p>
            {activeGroup ? (
              <div className="contactGroupLine">
                <Users size={15} />
                <span>
                  {activeGroup.title || formatAge(activeGroup)} · {formatAge(activeGroup)}
                </span>
              </div>
            ) : null}
            <a
              className="btn btn--primary btn--block btn--lg contactCall"
              href={`tel:${formatPhoneHref(activeLocation?.phone ?? organization.phone)}`}
            >
              <Phone size={18} />
              Позвонить
            </a>
            {messengerUrl(organization) ? (
              <a
                className="btn btn--soft btn--block"
                href={messengerUrl(organization)}
                target="_blank"
                rel="noopener noreferrer"
              >
                <MessageCircle size={16} /> Написать организации
              </a>
            ) : null}
            <div className="contactQuickActions">
              <button type="button" className={cn("contactQuick", favorite && "isActive")} onClick={() => toggleFavorite(activity.slug)}>
                <Heart size={16} fill={favorite ? "currentColor" : "none"} />
                {favorite ? "Сохранено" : "В избранное"}
              </button>
              <button type="button" className="contactQuick" onClick={share}>
                <Share2 size={16} /> Поделиться
              </button>
            </div>
            <div className="contactTrust">
              <ShieldCheck size={15} />
              <span>
                {activity.verifiedAt
                  ? `Данные проверены ${formatDateLong(activity.verifiedAt)}`
                  : "Данные карточки уточняются"}
              </span>
            </div>
          </div>

          <Link href={`/organizations/${organization.slug}`} className="orgMiniCard">
            <div className="orgMiniCover">
              <img src={organization.cover ?? activity.photos[0]} alt="" loading="lazy" />
            </div>
            <div className="orgMiniBody">
              <span className="orgMiniType">{organization.type}</span>
              <strong>{organization.name}</strong>
              <span className="orgMiniMeta">
                {activity.superSlug === "other" ? "Услуги" : superTitle} · {activity.locations.length}{" "}
                {addressWord(activity.locations.length)}
              </span>
              <span className="orgMiniLink">
                Страница организации <ArrowRight size={14} />
              </span>
            </div>
          </Link>

          <div className="safetyCard">
            <span className="safetyIcon">
              <Info size={18} />
            </span>
            <div>
              <strong>Перед записью</strong>
              <p>
                Уточните цену, наличие мест и условия пробного занятия. Talentro не
                принимает оплату — все договорённости напрямую с организацией.
              </p>
              <Link href="/rules">Правила публикации</Link>
            </div>
          </div>
        </aside>
      </div>

      <div className="activityMobileCta">
        <div>
          <strong>{activeGroup ? formatPrice(activeGroup) : "Цена уточняется"}</strong>
          <span>{activeGroup ? activeGroup.title || formatAge(activeGroup) : activity.title}</span>
        </div>
        <a className="btn btn--primary" href={`tel:${formatPhoneHref(activeLocation?.phone ?? organization.phone)}`}>
          <Phone size={17} /> Позвонить
        </a>
      </div>

      {lightboxOpen ? (
        <div
          className="lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="Просмотр фотографий"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setLightboxOpen(false);
          }}
        >
          <button type="button" className="lightboxClose" aria-label="Закрыть" onClick={() => setLightboxOpen(false)}>
            <X size={22} />
          </button>
          <button
            type="button"
            className="lightboxNav lightboxNav--prev"
            aria-label="Предыдущее фото"
            onClick={() => setPhotoIndex((index) => (index - 1 + allPhotos.length) % allPhotos.length)}
          >
            <ChevronLeft size={26} />
          </button>
          <figure>
            <img src={activePhoto} alt={`${activity.title} — фото ${photoIndex + 1}`} />
            <figcaption>
              {activity.title} · {photoIndex + 1} из {allPhotos.length}
            </figcaption>
          </figure>
          <button
            type="button"
            className="lightboxNav lightboxNav--next"
            aria-label="Следующее фото"
            onClick={() => setPhotoIndex((index) => (index + 1) % allPhotos.length)}
          >
            <ChevronRight size={26} />
          </button>
        </div>
      ) : null}

      {reportOpen ? (
        <div className="modalBackdrop" role="presentation" onMouseDown={() => setReportOpen(false)}>
          <div
            className="reportModal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="report-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button type="button" className="modalClose reportClose" aria-label="Закрыть" onClick={() => setReportOpen(false)}>
              <X size={20} />
            </button>
            {reportSent ? (
              <div className="reportSuccess">
                <span className="reportSuccessIcon">
                  <Check size={26} />
                </span>
                <h2 id="report-title">Сообщение отправлено</h2>
                <p>Модератор проверит карточку и свяжется с организацией, если данные не подтвердятся.</p>
                <button type="button" className="btn btn--primary" onClick={() => setReportOpen(false)}>
                  Хорошо
                </button>
              </div>
            ) : (
              <>
                <span className="eyebrow">Обратная связь</span>
                <h2 id="report-title">Что не так с карточкой?</h2>
                <p className="reportIntro">Помогите нам поддерживать каталог точным. Жалоба не публикуется.</p>
                <fieldset className="reportReasons">
                  <legend className="srOnly">Причина жалобы</legend>
                  {reportReasons.map((reason) => (
                    <label key={reason} className={cn("reportReason", reportReason === reason && "isActive")}>
                      <input
                        type="radio"
                        name="report-reason"
                        value={reason}
                        checked={reportReason === reason}
                        onChange={() => setReportReason(reason)}
                      />
                      <span>{reason}</span>
                    </label>
                  ))}
                </fieldset>
                <label className="fieldLabel" htmlFor="report-comment">
                  Комментарий <span>необязательно</span>
                </label>
                <textarea
                  id="report-comment"
                  className="textarea"
                  rows={3}
                  value={reportText}
                  onChange={(event) => setReportText(event.target.value)}
                  placeholder="Что именно стоит проверить?"
                />
                <button type="button" className="btn btn--primary btn--block btn--lg" onClick={submitReport}>
                  Отправить жалобу
                </button>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
