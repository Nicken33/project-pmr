"use client";

import Link from "next/link";
import { useState } from "react";
import {
  BadgeCheck,
  Building2,
  CalendarClock,
  FileText,
  LogIn,
  MapPin,
  Phone,
  Plus,
  ShieldAlert,
  Store,
  Trash2,
  Undo2,
} from "lucide-react";
import type { Application, Location } from "@/lib/types";
import { applications as seedApplications, organizations } from "@/lib/data";
import { getCity, getDistrict } from "@/lib/filters";
import { MODERATION_SLA_DAYS, getOrganization, plural, statusLabels, workingDaysWaiting } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { useApp } from "@/components/providers/AppProviders";
import { OwnerLive } from "@/components/account/OwnerLive";

/**
 * Кабинет владельца.
 *
 * `demo` — витрина из локального набора данных: её видит тестировщик (§6), чтобы
 * оценить интерфейс до наполнения каталога. Живой кабинет (`demo === false`)
 * грузит карточки и организацию с бэкенда через прокси `/api/me/*` и ничего не
 * выдумывает. Роль в витрине рисует только подписи: права решает сервер.
 */
export function OwnerCabinet({
  demo,
  sessionRole,
}: {
  demo: boolean;
  sessionRole?: string;
}) {
  if (!demo) return <OwnerLive sessionRole={sessionRole} />;
  return <OwnerDemo />;
}

/* Анкеты и организации витрина берёт сама, а не получает пропсами со страницы:
   серверный компонент, который отдаёт списки пропсами, сериализует их в
   RSC-поток, и в анонимном ответе /account оказываются чужие анкеты. Настоящий
   срез «карточки текущего владельца» делает сервер — `OwnerLive` грузит его
   через прокси под кукой сессии. */
function statusClass(status: Application["status"]) {
  return cn("statusPill", `statusPill--${status}`);
}

function OwnerDemo() {
  const { user, toast } = useApp();
  const [tab, setTab] = useState<"apps" | "org">("apps");
  const [rows, setRows] = useState<Application[]>(
    () => seedApplications.filter((application) => application.byOwner),
  );

  const orgSlugs = user?.organizationSlug
    ? [user.organizationSlug]
    : Array.from(new Set(rows.map((row) => row.organizationSlug)));
  const [activeOrg, setActiveOrg] = useState(orgSlugs[0] ?? organizations[0]?.slug ?? "");
  const [draftOrg, setDraftOrg] = useState(() => {
    const org = getOrganization(orgSlugs[0] ?? organizations[0]?.slug ?? "");
    return { description: org?.description ?? "", phone: org?.phone ?? "", email: org?.email ?? "" };
  });

  if (!user) {
    return (
      <div className="cabinetGate container">
        <span className="cabinetGateIcon">
          <LogIn size={24} />
        </span>
        <h1>Кабинет владельца</h1>
        <p>
          Войти нужно, чтобы список анкет был вашим, а не общим. Правки в карточках видят только
          владельцы этой организации.
        </p>
        <div className="cabinetGateActions">
          <Link href="/login?next=/account" className="btn btn--primary">
            Войти
          </Link>
          <Link href="/register?next=/account" className="btn btn--soft">
            Создать аккаунт
          </Link>
        </div>
      </div>
    );
  }

  const mine = rows.filter(
    (row) => row.byOwner && (!user.organizationSlug || row.organizationSlug === user.organizationSlug),
  );
  const pendingCount = mine.filter((row) => row.status === "pending").length;

  const removeRow = (id: string) => {
    setRows((current) => current.filter((row) => row.id !== id));
    toast({ title: "Черновик удалён", description: "Список анкет лежит в этом браузере — удалённый черновик исчезает только здесь." });
  };

  const unpublish = (row: Application) => {
    setRows((current) =>
      current.map((item) => (item.id === row.id ? { ...item, status: "draft", updatedAt: new Date().toISOString() } : item)),
    );
    toast({
      title: "Статус изменён на этом устройстве",
      description: "Демонстрационная витрина: черновик снялся только в этом браузере, каталог и отзывы не изменились.",
    });
  };

  const resubmit = (row: Application) => {
    setRows((current) =>
      current.map((item) =>
        item.id === row.id ? { ...item, status: "pending", submittedAt: new Date().toISOString(), rejectReason: undefined } : item,
      ),
    );
    toast({
      title: "Статус «на проверке» проставлен в этом браузере",
      description: "Демонстрационная витрина: модератор ничего не увидит, очередь сервера не изменилась.",
    });
  };

  const org = getOrganization(activeOrg);

  // Точки общие для организации: одна и та же точка может быть указана в разных анкетах,
  // поэтому склеиваем дубли по id, оставляя заполненные поля.
  const pointsById = new Map<string, Location>();
  for (const row of mine) {
    for (const location of row.locations) {
      const known = pointsById.get(location.id);
      pointsById.set(
        location.id,
        known
          ? {
              ...known,
              name: known.name ?? location.name,
              districtSlug: known.districtSlug ?? location.districtSlug,
              phone: known.phone ?? location.phone,
            }
          : location,
      );
    }
  }
  const orgPoints = [...pointsById.values()];

  return (
    <div className="cabinetPage container">
      <header className="cabinetHead">
        <div>
          <span className="eyebrow">
            <Store size={13} /> Кабинет владельца
          </span>
          <h1>{user.name}</h1>
          <p className="cabinetSub">
            {user.role === "owner"
              ? "Права владельца включены. Это демонстрационная витрина: анкеты и правки живут в этом браузере."
              : "Аккаунт участника: анкеты можно черновикать, а права владельца включит модератор."}
          </p>
        </div>
        <Link href="/account/activities/new" className="btn btn--primary">
          <Plus size={16} /> Новая анкета
        </Link>
      </header>

      <p className="cabinetNotice">
        <ShieldAlert size={16} />
        Это демонстрационная витрина кабинета: анкеты и организации взяты из локального набора,
        решения живут до перезагрузки страницы и ничего не меняют в каталоге. Настоящий кабинет —
        у владельца, вошедшего в аккаунт с ролью owner_activity или owner_service.
      </p>

      <div className="cabinetTabs" role="tablist" aria-label="Разделы кабинета">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "apps"}
          className={cn("cabinetTab", tab === "apps" && "isActive")}
          onClick={() => setTab("apps")}
        >
          <FileText size={15} /> Анкеты
          <span className="cabinetTabCount">{mine.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "org"}
          className={cn("cabinetTab", tab === "org" && "isActive")}
          onClick={() => setTab("org")}
        >
          <Building2 size={15} /> Профиль организации
        </button>
      </div>

      {user.role !== "owner" ? (
        <p className="cabinetNotice">
          <ShieldAlert size={14} /> Роль меняет модератор. Пока вы участник: анкеты сохраняются в
          черновики, отправить их на проверку нельзя.
        </p>
      ) : null}

      {tab === "apps" ? (
        <section className="cabinetSection" aria-label="Мои анкеты">
          <div className="cabinetSectionHead">
            <h2>Мои анкеты</h2>
            {pendingCount ? (
              <span className="cabinetPendingNote">
                {pendingCount} {plural(pendingCount, "анкета ждёт", "анкеты ждут", "анкет ждут")} проверки ·
                норматив ответа {MODERATION_SLA_DAYS} рабочих дня
              </span>
            ) : null}
          </div>

          {mine.length === 0 ? (
            <div className="emptyState">
              <span className="emptyStateIcon">
                <FileText size={28} />
              </span>
              <h3>Анкеты пока не заведены</h3>
              <p>Начните с одной группы и одной точки — остальное добавите позже.</p>
              <Link href="/account/activities/new" className="btn btn--primary">
                <Plus size={16} /> Создать анкету
              </Link>
            </div>
          ) : (
            <div className="appList">
              {mine.map((row) => {
                const waiting = row.status === "pending" ? workingDaysWaiting(row.submittedAt) : 0;
                const overdue = waiting > MODERATION_SLA_DAYS;
                return (
                  <article
                    key={row.id}
                    className={cn("appRow", row.status === "rejected" && "appRow--rejected", overdue && "appRow--overdue")}
                  >
                    <div className="appRowMain">
                      <div className="appRowTop">
                        <Link href={`/account/activities/${row.id}`} className="appRowTitle">
                          {row.title}
                        </Link>
                        <span className={statusClass(row.status)}>{statusLabels[row.status]}</span>
                      </div>
                      <p className="appRowMeta">
                        <span>{getOrganization(row.organizationSlug)?.name ?? row.organizationSlug}</span>
                        <span>
                          {row.groups.length} {plural(row.groups.length, "группа", "группы", "групп")} ·{" "}
                          {row.locations.length}{" "}
                          {plural(row.locations.length, "точка", "точки", "точек")}
                        </span>
                        <span>
                          <CalendarClock size={12} /> обновлена {new Date(row.updatedAt).toLocaleDateString("ru-RU")}
                        </span>
                      </p>
                      {row.status === "pending" ? (
                        <p className={cn("appRowWait", overdue && "appRowWait--overdue")}>
                          {overdue
                            ? `Ждёт ответа ${waiting} ${plural(waiting, "рабочий день", "рабочих дня", "рабочих дней")} — дольше норматива. Модератор видит просрочку в очереди.`
                            : `На проверке: ${waiting} ${plural(waiting, "рабочий день", "рабочих дня", "рабочих дней")} из ${MODERATION_SLA_DAYS}.`}
                        </p>
                      ) : null}
                      {row.status === "rejected" && row.rejectReason ? (
                        <p className="appRowReason">
                          <ShieldAlert size={13} /> Причина отказа: {row.rejectReason}
                        </p>
                      ) : null}
                      {row.status === "published" ? (
                        <p className="appRowLive">
                          <BadgeCheck size={13} /> Анкета в каталоге — при правке групп или точек она
                          снова уходит на проверку.
                        </p>
                      ) : null}
                    </div>

                    <div className="appRowActions">
                      <Link href={`/account/activities/${row.id}`} className="btn btn--soft btn--sm">
                        Править
                      </Link>
                      {row.status === "published" ? (
                        <button type="button" className="btn btn--ghost btn--sm" onClick={() => unpublish(row)}>
                          <Undo2 size={14} /> Снять с публикации
                        </button>
                      ) : null}
                      {row.status !== "published" ? (
                        <button
                          type="button"
                          className="btn btn--ghost btn--sm"
                          onClick={() => removeRow(row.id)}
                        >
                          <Trash2 size={14} /> Удалить
                        </button>
                      ) : (
                        <span className="appRowDeleteNote">
                          Опубликованную удалить нельзя: сначала снимите с публикации.
                        </span>
                      )}
                      {row.status === "rejected" || row.status === "draft" ? (
                        <button type="button" className="btn btn--primary btn--sm" onClick={() => resubmit(row)}>
                          {row.status === "rejected" ? "Исправить и отправить" : "Отправить на проверку"}
                        </button>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
          <p className="cabinetFootNote">
            По ТЗ удалить можно только свою неопубликованную анкету, а опубликованную снимает
            модератор. В демонстрационной витрине все эти изменения — только в вашем браузере.
          </p>
        </section>
      ) : (
        <section className="cabinetSection" aria-label="Профиль организации">
          <div className="orgPicker">
            <label className="fieldLabel" htmlFor="org-select">
              Организация
            </label>
            <select
              id="org-select"
              className="fieldInput"
              value={activeOrg}
              onChange={(event) => {
                const next = event.target.value;
                setActiveOrg(next);
                const found = getOrganization(next);
                setDraftOrg({
                  description: found?.description ?? "",
                  phone: found?.phone ?? "",
                  email: found?.email ?? "",
                });
              }}
            >
              {orgSlugs.map((slug) => (
                <option key={slug} value={slug}>
                  {getOrganization(slug)?.name ?? slug}
                </option>
              ))}
            </select>
          </div>

          {org ? (
            <>
              <div className="orgProfileHead">
                <div>
                  <h2>{org.name}</h2>
                  <span className="badge badge--category">{org.type}</span>
                </div>
                <Link href={`/organizations/${org.slug}`} className="sectionLink">
                  Открыть публичную страницу
                </Link>
              </div>

              <div className="orgFields">
                <label className="fieldLabel" htmlFor="org-description">
                  Описание
                </label>
                <textarea
                  id="org-description"
                  className="textarea"
                  rows={4}
                  value={draftOrg.description}
                  onChange={(event) => setDraftOrg({ ...draftOrg, description: event.target.value })}
                />
                <div className="orgFieldsRow">
                  <div>
                    <label className="fieldLabel" htmlFor="org-phone">
                      Телефон
                    </label>
                    <input
                      id="org-phone"
                      className="fieldInput"
                      value={draftOrg.phone}
                      onChange={(event) => setDraftOrg({ ...draftOrg, phone: event.target.value })}
                    />
                  </div>
                  <div>
                    <label className="fieldLabel" htmlFor="org-email">
                      Почта
                    </label>
                    <input
                      id="org-email"
                      className="fieldInput"
                      type="email"
                      value={draftOrg.email}
                      onChange={(event) => setDraftOrg({ ...draftOrg, email: event.target.value })}
                    />
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={() =>
                    toast({
                      title: "Черновик профиля сохранён на этом устройстве",
                      description: "Демонстрационная витрина: сервер правки не получал, модератор их не увидит.",
                      tone: "success",
                    })
                  }
                >
                  Сохранить профиль
                </button>
                <p className="cabinetFootNote">
                  Контакты и описание проверяются: их меняет модератор после сверки с источником.
                  Группы и точки проведения — только внутри анкет.
                </p>
              </div>

              <div className="orgPointsAdmin">
                <h3>Точки проведения организации</h3>
                <p className="orgPointsHint">
                  Точки общие: занятие выбирает нужные из списка. Новая точка появляется в анкетах
                  после проверки.
                </p>
                <ul className="orgPointRows">
                  {orgPoints.map((location) => (
                    <li className="orgPointRow" key={location.id}>
                      <span className="orgPointRowPin">
                        <MapPin size={15} />
                      </span>
                      <span className="orgPointRowMain">
                        <strong>{location.name ?? location.address}</strong>
                        <small>
                          {getCity(location.citySlug)?.title ?? location.citySlug}
                          {location.districtSlug
                            ? ` · ${getDistrict(location.districtSlug)?.title ?? location.districtSlug}`
                            : ""}
                          {` · ${location.address}`}
                        </small>
                        <small className="orgPointRowCoords">
                          {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
                        </small>
                      </span>
                      {location.phone ? (
                        <a className="orgPointRowPhone" href={`tel:${location.phone.replace(/[^\d+]/g, "")}`}>
                          <Phone size={13} /> {location.phone}
                        </a>
                      ) : (
                        <span className="orgPointRowPhone orgPointRowPhone--muted">
                          <Phone size={13} /> телефон не указан
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
                <Link href="/account/activities/new" className="btn btn--soft btn--sm">
                  <Plus size={15} /> Добавить точку через анкету
                </Link>
              </div>
            </>
          ) : null}
        </section>
      )}
    </div>
  );
}
