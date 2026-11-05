"use client";

import Link from "next/link";
import { useState } from "react";
import {
  BadgeCheck,
  ChevronDown,
  Clock3,
  Heart,
  MapPin,
  Phone,
  ThumbsDown,
  ThumbsUp,
  Users,
  Image as ImageIcon,
  ImageOff,
} from "lucide-react";
import type { Activity, AgeGroup } from "@/lib/types";
import { useApp } from "@/components/providers/AppProviders";
import { ResponsiveImage } from "@/components/ui/ResponsiveImage";
import {
  formatDate,
  getCategoryTitle,
  getOrganization,
  groupWord,
  addressWord,
} from "@/lib/utils";
import { formatAge, formatPrice, formatPriceCard, formatSchedule, getCity, getDistrict } from "@/lib/filters";
import { cn } from "@/lib/utils";

/**
 * Подпись направления: на живом каталоге имя приходит вместе с занятием
 * (`categoryTitle` из `/api/v1`), словарь — только запасной вариант для моков
 * плана: у канона свои слаги, и по мок-слагу живое занятие упало бы в «Другое».
 */
function categoryLabel(activity: Activity): string {
  return activity.categoryTitle ?? getCategoryTitle(activity.categorySlug);
}

interface ActivityCardProps {
  /** Не нужен в режиме скелета: карточка-заглушка ничего не читает из активности. */
  activity?: Activity;
  initialGroupId?: string;
  initialLocationId?: string;
  rank?: number;
  compact?: boolean;
  skeleton?: boolean;
}

export function ActivityCard({
  skeleton = false,
  activity,
  initialGroupId,
  initialLocationId,
  rank,
  compact = false,
}: ActivityCardProps) {
  const { isFavorite, toggleFavorite } = useApp();
  const [groupId, setGroupId] = useState(initialGroupId ?? activity?.groups[0]?.id ?? "");
  const [locationId, setLocationId] = useState(initialLocationId ?? activity?.locations[0]?.id ?? "");
  const [groupsOpen, setGroupsOpen] = useState(false);
  const [locationsOpen, setLocationsOpen] = useState(false);

  const selectGroup = (nextGroup: AgeGroup) => {
    setGroupId(nextGroup.id);
    setLocationId(nextGroup.locationId);
    setGroupsOpen(false);
  };

  if (skeleton || !activity) {
    return (
      <article className={cn("activityCard", compact && "recommendedCard", "isSkeleton")}>
        <div className="cardCover">
          <div className="skeletonImage">
            <ImageIcon size={24} />
          </div>
        </div>
        <div className="cardBody">
          <div className="cardHeading">
            <div className="cardTitle skeletonLine skeletonLine--lg" />
            <div className="cardOrgLine">
              <div className="cardOrg skeletonLine skeletonLine--sm" />
              <div className="tag skeletonLine skeletonLine--xs" />
            </div>
          </div>
          <div className="cardGroupBlock">
            <div className="cardMetaStatic skeletonLine skeletonLine--md" />
          </div>
          <div className="cardSchedule skeletonLine skeletonLine--md" />
          <div className="cardLocationBlock skeletonLine skeletonLine--lg" />
          <div className="cardVotes">
            <div className="voteLine skeletonLine skeletonLine--sm" />
          </div>
          <div className="cardFooter">
            <div className="cardPrice skeletonLine skeletonLine--md" />
            <div className="cardCta skeletonLine skeletonLine--lg" />
          </div>
        </div>
      </article>
    );
  }

  const group = activity.groups.find((item) => item.id === groupId) ?? activity.groups[0];
  const groupLocation = activity.locations.find((item) => item.id === group?.locationId);
  const location = activity.locations.find((item) => item.id === locationId) ?? groupLocation ?? activity.locations[0];
  const organization = getOrganization(activity.organizationSlug);
  const favorite = isFavorite(activity.slug);
  const reviewsCount = activity.reviews.length;
  const votesTotal = activity.votesPlus + activity.votesMinus;
  const hasVotes = votesTotal >= 3;

  if (compact) {
    return (
      <article className="recommendedCard">
        <Link href={`/activities/${activity.slug}`} className="recommendedCover" aria-label={activity.title}>
          {activity.photos[0] ? (
            <ResponsiveImage
              src={activity.photos[0]}
              alt={activity.title}
              width={400}
              height={300}
              sizes="(max-width: 768px) 100vw, 50vw"
            />
          ) : (
            <div className="coverEmpty">
              <ImageOff size={18} />
            </div>
          )}
          <span className="recommendedTag">{categoryLabel(activity)}</span>
        </Link>
        <div className="recommendedBody">
          <Link href={`/activities/${activity.slug}`} className="recommendedTitle">
            {activity.title}
          </Link>
          <div className="recommendedFooter">
            <span className="miniVotes">
              {activity.votesPlus + activity.votesMinus ? (
                <>
                  <ThumbsUp size={13} /> {activity.votesPlus}
                  <ThumbsDown size={13} /> {activity.votesMinus}
                </>
              ) : (
                "Голосов нет"
              )}
            </span>
            <span className="recommendedPrice">{formatPrice(group)}</span>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="activityCard">
      <div className="cardCover">
        <Link href={`/activities/${activity.slug}`} aria-label={activity.title}>
          {activity.photos[0] ? (
            <ResponsiveImage
              src={activity.photos[0]}
              alt={activity.title}
              width={200}
              height={150}
              sizes="(max-width: 768px) 100vw, 50vw"
            />
          ) : (
            <div className="coverEmpty">
              <ImageOff size={22} />
              <span>Фото нет</span>
            </div>
          )}
        </Link>
        <button
          type="button"
          className={cn("favoriteButton", favorite && "isActive")}
          aria-label={favorite ? "Убрать из избранного" : "Добавить в избранное"}
          aria-pressed={favorite}
          title={favorite ? "В избранном" : "В избранное"}
          onClick={() => toggleFavorite(activity.slug)}
        >
          <Heart size={18} fill={favorite ? "currentColor" : "none"} />
        </button>
        <div className="coverBadges">
          {activity.verifiedAt ? (
            <span className="badge badge--verified" title={`Данные проверены ${formatDate(activity.verifiedAt)}`}>
              <BadgeCheck size={12} /> Проверено
            </span>
          ) : (
            <span className="badge badge--warning">Ориентировочно</span>
          )}
          {activity.kind === "service" ? <span className="badge badge--service">Услуга</span> : null}
        </div>
        {rank ? <span className="cardRank">{String(rank).padStart(2, "0")}</span> : null}
      </div>

      <div className="cardBody">
        <div className="cardHeading">
          <Link href={`/activities/${activity.slug}`} className="cardTitle">
            {activity.title}
          </Link>
          <div className="cardOrgLine">
            <span className="cardOrg">
              {activity.organizationTitle ?? organization?.name ?? "Организация"}
            </span>
            <span className="tag">{categoryLabel(activity)}</span>
          </div>
        </div>

        {activity.kind === "activity" && group ? (
          <div className="cardGroupBlock">
            <button
              type="button"
              className={cn("cardMetaButton", groupsOpen && "isOpen")}
              aria-expanded={groupsOpen}
              onClick={() => setGroupsOpen((open) => !open)}
            >
              <span>
                <Users size={14} />
                {formatAge(group)}
                {activity.groups.length > 1 ? (
                  <>
                    {", ещё "}
                    <b>
                      {activity.groups.length - 1} {groupWord(activity.groups.length - 1)}
                    </b>
                  </>
                ) : null}
              </span>
              <ChevronDown size={15} />
            </button>
            {groupsOpen ? (
              <div className="quickGroupList">
                {activity.groups.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={cn("quickGroup", item.id === group.id && "isActive")}
                    onClick={() => selectGroup(item)}
                  >
                    <span>
                      <b>{item.title || formatAge(item)}</b>
                      <small>
                        {formatAge(item)} · {formatPrice(item)}
                      </small>
                    </span>
                    {item.id === group.id ? <BadgeCheck size={15} /> : null}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="cardGroupBlock">
            <span className="cardMetaStatic">
              <Users size={14} /> {activity.serviceMode ?? "Услуга"}
            </span>
          </div>
        )}

        <div className="cardSchedule">
          <Clock3 size={14} />
          <span>{formatSchedule(group) || "Расписание уточняется"}</span>
        </div>

        <div className="cardLocationBlock">
          <button
            type="button"
            className={cn("cardLocationButton", locationsOpen && "isOpen")}
            aria-expanded={locationsOpen}
            onClick={() => setLocationsOpen((open) => !open)}
          >
            <MapPin size={14} />
            <span>
              {location ? (
                <>
                  {location.cityTitle ?? getCity(location.citySlug)?.title}
                  {location.districtSlug
                    ? `, ${location.districtTitle ?? getDistrict(location.districtSlug)?.title}`
                    : ""}
                  {`, ${location.address}`}
                </>
              ) : (
                "Адрес уточняется"
              )}
            </span>
            {activity.locations.length > 1 ? (
              <em>
                ещё {activity.locations.length - 1} {addressWord(activity.locations.length - 1)}
              </em>
            ) : null}
          </button>
          {locationsOpen ? (
            <div className="quickLocationList">
              {activity.locations.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={cn("quickLocation", item.id === location?.id && "isActive")}
                  onClick={() => {
                    setLocationId(item.id);
                    setLocationsOpen(false);
                  }}
                >
                  <MapPin size={14} />
                  <span>
                    <b>{item.name ?? item.address}</b>
                    <small>
                      {item.cityTitle ?? getCity(item.citySlug)?.title}, {item.address}
                    </small>
                  </span>
                  {item.phone ? <Phone size={13} /> : null}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="cardVotes">
          <span className={cn("voteLine", hasVotes ? "hasVotes" : "")}>
            {votesTotal ? (
              <>
                <ThumbsUp size={13} /> {activity.votesPlus}
                <ThumbsDown size={13} /> {activity.votesMinus}
              </>
            ) : (
              "Голосов нет"
            )}
          </span>
          {reviewsCount ? <span className="cardReviews">{reviewsCount} отз.</span> : null}
          {activity.verifiedAt ? <span className="cardVerifiedDate">{formatDate(activity.verifiedAt)}</span> : null}
        </div>

        <div className="cardFooter">
          <div className={cn("cardPrice", group?.priceFrom === 0 && "cardPrice--free")}>
            {formatPriceCard(group)}
          </div>
          <Link className="cardCta" href={`/activities/${activity.slug}`}>
            Подробнее
          </Link>
        </div>
      </div>
    </article>
  );
}
