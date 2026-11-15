"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  BadgeCheck,
  Building2,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  ShieldAlert,
  Store,
  Undo2,
} from "lucide-react";
import type { ApiPage, ApiPlace } from "@/lib/api";
import { cn, plural, statusLabels, workingDaysWaiting, MODERATION_SLA_DAYS } from "@/lib/utils";
import { useApp } from "@/components/providers/AppProviders";
import {
  fetchMyActivities,
  fetchMyOrganization,
  fetchOwnerCities,
  ORGANIZATION_TYPES,
  submitMyActivity,
  toOwnerError,
  unpublishMyActivity,
  updateMyOrganization,
  type OwnedOrganization,
  type OwnerCardView,
  type OwnerOrganizationInput,
} from "@/lib/owner-api";
import { OwnerErrorView, OwnerLoading } from "@/components/account/OwnerStates";
import { OwnerCardEditor } from "@/components/account/OwnerCardEditor";

/**
 * Живой кабинет владельца.
 *
 * Карточки и организация берутся с бэкенда через прокси `/api/me/*`, а не из
 * моков: роль и принадлежность карточки сервер перечитывает на каждый запрос,
 * поэтому кабинет показывает ровно то, что сервер разрешил, — включая отказы
 * 401, 403, 404, 409 и 503 с его собственным текстом. Пустой список выглядит как
 * пустой список, а не как демонстрационный набор анкет.
 */

const PAGE_SIZE = 20;

type ListState =
  | { kind: "loading" }
  | { kind: "error"; error: ReturnType<typeof toOwnerError> }
  | { kind: "ready"; page: ApiPage<OwnerCardView> };

type OrgState =
  | { kind: "loading" }
  | { kind: "error"; error: ReturnType<typeof toOwnerError> }
  | { kind: "absent" }
  | { kind: "ready"; org: OwnedOrganization };

type CitiesState =
  | { kind: "loading" }
  | { kind: "error"; error: ReturnType<typeof toOwnerError> }
  | { kind: "ready"; items: ApiPlace[] };

interface OrgDraft {
  name: string;
  type: string;
  description: string;
  phone: string;
  email: string;
  site: string;
  address: string;
  city_id: string;
}

function orgDraft(org: OwnedOrganization): OrgDraft {
  return {
    name: org.name,
    type: org.type,
    description: org.description ?? "",
    phone: org.phone ?? "",
    email: org.email ?? "",
    site: org.site ?? "",
    address: org.address ?? "",
    city_id: org.city_id === null || org.city_id === undefined ? "" : String(org.city_id),
  };
}

export function OwnerLive({ sessionRole }: { sessionRole?: string }) {
  const { user, toast } = useApp();
  const [tab, setTab] = useState<"apps" | "org">("apps");
  const [page, setPage] = useState(1);
  const [list, setList] = useState<ListState>({ kind: "loading" });
  const [org, setOrg] = useState<OrgState>({ kind: "loading" });
  const [draft, setDraft] = useState<OrgDraft | null>(null);
  const [orgErrors, setOrgErrors] = useState<Record<string, string>>({});
  const [orgSaveError, setOrgSaveError] = useState<string | null>(null);
  const [orgSaving, setOrgSaving] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const [editor, setEditor] = useState<{ id: string | null } | null>(null);
  const [cities, setCities] = useState<CitiesState>({ kind: "loading" });
  const [citiesRetry, setCitiesRetry] = useState(0);

  const isOwner = sessionRole === "owner_activity" || sessionRole === "owner_service";
  const kind = sessionRole === "owner_service" ? "service" : "activity";

  const loadList = useCallback((next: number) => {
    setList({ kind: "loading" });
    fetchMyActivities(next, PAGE_SIZE)
      .then((result) => setList({ kind: "ready", page: result }))
      .catch((reason) => setList({ kind: "error", error: toOwnerError(reason) }));
  }, []);

  const loadOrg = useCallback(() => {
    setOrg({ kind: "loading" });
    fetchMyOrganization()
      .then((result) => {
        setOrg({ kind: "ready", org: result });
        setDraft(orgDraft(result));
      })
      .catch((reason) => {
        const error = toOwnerError(reason);
        // 404 — у вошедшего нет своей организации. Это ответ сервера, а не сбой.
        if (error.status === 404) setOrg({ kind: "absent" });
        else setOrg({ kind: "error", error });
      });
  }, []);

  /* Первая загрузка: оба состояния уже `loading`, поэтому эффекта хватает
     одного — синхронный setState внутри эффекта дал бы второй рендер до ответа. */
  useEffect(() => {
    let alive = true;
    const load = async () => {
      const [cards, organization] = await Promise.allSettled([
        fetchMyActivities(1, PAGE_SIZE),
        fetchMyOrganization(),
      ]);
      if (!alive) return;
      if (cards.status === "fulfilled") setList({ kind: "ready", page: cards.value });
      else setList({ kind: "error", error: toOwnerError(cards.reason) });
      if (organization.status === "fulfilled") {
        setOrg({ kind: "ready", org: organization.value });
        setDraft(orgDraft(organization.value));
      } else {
        const error = toOwnerError(organization.reason);
        if (error.status === 404) setOrg({ kind: "absent" });
        else setOrg({ kind: "error", error });
      }
    };
    void load();
    return () => {
      alive = false;
    };
  }, []);

  /* Справочник городов для city_id: тот же прокси, только чтение. Отказ не
     блокирует профиль — поле честно показывает сбой и повтор. */
  useEffect(() => {
    let alive = true;
    fetchOwnerCities()
      .then((items) => {
        if (alive) setCities({ kind: "ready", items });
      })
      .catch((reason) => {
        if (alive) setCities({ kind: "error", error: toOwnerError(reason) });
      });
    return () => {
      alive = false;
    };
  }, [citiesRetry]);

  const retryCities = () => {
    setCities({ kind: "loading" });
    setCitiesRetry((current) => current + 1);
  };

  const goTo = (next: number) => {
    if (next < 1) return;
    setPage(next);
    loadList(next);
  };

  const reload = () => {
    setRowError(null);
    loadList(page);
  };

  const act = async (row: OwnerCardView, action: "submit" | "unpublish") => {
    setBusy(row.id);
    setRowError(null);
    try {
      /* submit и unpublish возвращают конверт `{card}` — статус берём из него,
         а не из плоского тела, которого сервер больше не присылает. */
      const result =
        action === "submit" ? await submitMyActivity(row.id) : await unpublishMyActivity(row.id);
      toast({
        title: action === "submit" ? "Отправлено на проверку" : "Снято с публикации",
        description: `${row.title}: сервер вернул статус «${result.card.status}».`,
        tone: "success",
      });
      loadList(page);
    } catch (reason) {
      const error = toOwnerError(reason);
      // 409 — карточка уже на проверке. Показываем текст сервера и актуальный
      // статус, а не рисуем успех: решение принимает сервер.
      setRowError(`${row.title}: ${error.message} (ответ ${error.status})`);
      if (error.status === 409) loadList(page);
    } finally {
      setBusy(null);
    }
  };

  const saveOrg = async () => {
    if (org.kind !== "ready" || !draft) return;
    const problems: Record<string, string> = {};
    if (!draft.name.trim()) problems.name = "Название обязательно";
    if (!draft.phone.trim()) problems.phone = "Телефон обязателен";
    if (!(ORGANIZATION_TYPES as readonly string[]).includes(draft.type)) {
      problems.type = "Выберите тип организации из списка";
    }
    const cityId = draft.city_id.trim() === "" ? null : Number(draft.city_id);
    if (cityId !== null && (!Number.isInteger(cityId) || cityId <= 0)) {
      problems.city_id = "Выберите город из справочника";
    }
    setOrgErrors(problems);
    setOrgSaveError(null);
    if (Object.keys(problems).length > 0) return;

    setOrgSaving(true);
    const input: OwnerOrganizationInput = {
      name: draft.name.trim(),
      type: draft.type,
      description: draft.description.trim() || null,
      phone: draft.phone.trim(),
      email: draft.email.trim() || null,
      site: draft.site.trim() || null,
      address: draft.address.trim() || null,
      city_id: cityId,
      /* Координаты форма не правит: отправляем серверные значения как есть,
         чтобы PUT не затёр их-null. Slug и read-only поля в тело не входят. */
      lat: org.org.lat,
      lng: org.org.lng,
    };
    try {
      const updated = await updateMyOrganization(input);
      setOrg({ kind: "ready", org: updated });
      setDraft(orgDraft(updated));
      toast({
        title: "Профиль организации сохранён",
        description: "Сервер принял правки. Slug организации не меняется.",
        tone: "success",
      });
    } catch (reason) {
      const error = toOwnerError(reason);
      if (Object.keys(error.fields).length > 0) setOrgErrors(error.fields);
      setOrgSaveError(`${error.message} (ответ ${error.status})`);
    } finally {
      setOrgSaving(false);
    }
  };

  const rows = list.kind === "ready" ? list.page.items : [];
  const total = list.kind === "ready" ? list.page.total : 0;
  const pendingCount = rows.filter((row) => row.status === "pending").length;
  const orgId = org.kind === "ready" ? org.org.id : undefined;

  return (
    <div className="cabinetPage container">
      <header className="cabinetHead">
        <div>
          <span className="eyebrow">
            <Store size={13} /> Кабинет владельца
          </span>
          <h1>{user?.name ?? "Кабинет владельца"}</h1>
          <p className="cabinetSub">
            {isOwner
              ? "Карточки и профиль организации приходят с сервера. Сохранение не публикует карточку: публикацию решает модератор."
              : "Аккаунт участника: права владельца включает модератор. Кабинет запрашивает сервер и показывает его ответ как есть."}
          </p>
        </div>
        <div className="cabinetGateActions">
          <button type="button" className="btn btn--soft btn--sm" onClick={reload}>
            <RefreshCw size={14} /> Обновить
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => {
              setTab("apps");
              setEditor({ id: null });
            }}
          >
            <Plus size={16} /> Новая анкета
          </button>
        </div>
      </header>

      {/* Роль в витрине — только подпись. Отказ сервера (403) не скрывается. */}
      {!isOwner ? (
        <p className="cabinetNotice">
          <ShieldAlert size={14} />
          Сервер не считает этот аккаунт владельцем: кабинет доступен ролям owner_activity и
          owner_service. Ниже — настоящий ответ сервера, включая отказ, если он будет.
        </p>
      ) : null}

      {rowError ? (
        <p className="cabinetNotice" role="alert">
          <ShieldAlert size={14} /> {rowError}
        </p>
      ) : null}

      <div className="cabinetTabs" role="tablist" aria-label="Разделы кабинета">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "apps"}
          className={cn("cabinetTab", tab === "apps" && "isActive")}
          onClick={() => setTab("apps")}
        >
          <FileText size={15} /> Анкеты
          <span className="cabinetTabCount">{total}</span>
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

      {tab === "apps" ? (
        editor ? (
          <OwnerCardEditor
            key={editor.id ?? "new"}
            id={editor.id}
            kind={kind}
            orgId={orgId}
            orgPhase={org.kind}
            onCreated={(id) => setEditor({ id })}
            onSaved={reload}
            onClose={() => setEditor(null)}
          />
        ) : (
          <section className="cabinetSection" aria-label="Мои анкеты">
            <div className="cabinetSectionHead">
              <h2>Мои анкеты</h2>
              {pendingCount ? (
                <span className="cabinetPendingNote">
                  {pendingCount} {plural(pendingCount, "анкета ждёт", "анкеты ждут", "анкет ждут")}{" "}
                  проверки · норматив ответа {MODERATION_SLA_DAYS} рабочих дня
                </span>
              ) : null}
            </div>

            <ListSection state={list} onRetry={reload}>
              {(ready) => (
                <>
                  {ready.page.items.length === 0 ? (
                    <div className="emptyState">
                      <span className="emptyStateIcon">
                        <FileText size={28} />
                      </span>
                      <h3>Анкеты пока не заведены</h3>
                      <p>Начните с одной группы и одной точки — остальное добавите позже.</p>
                      <button
                        type="button"
                        className="btn btn--primary"
                        onClick={() => setEditor({ id: null })}
                      >
                        <Plus size={16} /> Создать анкету
                      </button>
                    </div>
                  ) : (
                    <div className="appList">
                      {ready.page.items.map((row) => (
                        <CardRow
                          key={row.id}
                          row={row}
                          busy={busy === row.id}
                          disabled={busy !== null}
                          onEdit={() => setEditor({ id: row.id })}
                          onSubmit={() => void act(row, "submit")}
                          onUnpublish={() => void act(row, "unpublish")}
                        />
                      ))}
                    </div>
                  )}
                  <Pager page={ready.page} current={page} onPage={goTo} />
                </>
              )}
            </ListSection>

            <p className="cabinetFootNote">
              Сервер не принимает удаление карточки: доступные действия — правка, отправка на
              проверку и снятие с публикации. Опубликованную карточку снимает с публикации владелец,
              а решение о публикации принимает модератор.
            </p>
          </section>
        )
      ) : (
        <section className="cabinetSection" aria-label="Профиль организации">
          <div className="cabinetSectionHead">
            <h2>Профиль организации</h2>
            <button type="button" className="btn btn--ghost btn--sm" onClick={loadOrg}>
              <RefreshCw size={14} /> Перечитать
            </button>
          </div>

          {org.kind === "loading" ? <OwnerLoading label="Загружаем организацию с сервера…" /> : null}
          {org.kind === "error" ? <OwnerErrorView error={org.error} /> : null}
          {org.kind === "absent" ? (
            <div className="emptyState">
              <span className="emptyStateIcon">
                <Building2 size={28} />
              </span>
              <h3>Организация не заведена</h3>
              <p>
                Сервер ответил 404: к этому аккаунту не привязана организация. Заведение организации
                выполняет модератор — после этого профиль появится здесь.
              </p>
            </div>
          ) : null}
          {org.kind === "ready" && draft ? (
            <>
              <div className="orgProfileHead">
                <div>
                  <h2>{org.org.name}</h2>
                  <span className="badge badge--category">{org.org.type}</span>
                </div>
                <Link href={`/organizations/${org.org.slug}`} className="sectionLink">
                  Открыть публичную страницу
                </Link>
              </div>

              <div className="orgFields">
                <label className="fieldLabel" htmlFor="org-name">
                  Название <span className="fieldRequired">обязательно</span>
                </label>
                <input
                  id="org-name"
                  className={cn("fieldInput", orgErrors.name && "fieldInput--error")}
                  value={draft.name}
                  onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                />
                {orgErrors.name ? <p className="formHint formHint--error">{orgErrors.name}</p> : null}

                <label className="fieldLabel" htmlFor="org-type">
                  Тип организации <span className="fieldRequired">обязательно</span>
                </label>
                <select
                  id="org-type"
                  className="fieldSelect"
                  value={draft.type}
                  onChange={(event) => setDraft({ ...draft, type: event.target.value })}
                >
                  {draft.type === "" ? <option value="">Выберите тип</option> : null}
                  {ORGANIZATION_TYPES.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                  {draft.type !== "" &&
                  !(ORGANIZATION_TYPES as readonly string[]).includes(draft.type) ? (
                    <option value={draft.type}>{draft.type} (нет в списке)</option>
                  ) : null}
                </select>
                {orgErrors.type ? <p className="formHint formHint--error">{orgErrors.type}</p> : null}

                <label className="fieldLabel" htmlFor="org-description">
                  Описание
                </label>
                <textarea
                  id="org-description"
                  className="textarea"
                  rows={4}
                  value={draft.description}
                  onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                />
                {orgErrors.description ? (
                  <p className="formHint formHint--error">{orgErrors.description}</p>
                ) : null}

                <div className="orgFieldsRow">
                  <div>
                    <label className="fieldLabel" htmlFor="org-phone">
                      Телефон <span className="fieldRequired">обязательно</span>
                    </label>
                    <input
                      id="org-phone"
                      className={cn("fieldInput", orgErrors.phone && "fieldInput--error")}
                      value={draft.phone}
                      onChange={(event) => setDraft({ ...draft, phone: event.target.value })}
                    />
                    {orgErrors.phone ? (
                      <p className="formHint formHint--error">{orgErrors.phone}</p>
                    ) : null}
                  </div>
                  <div>
                    <label className="fieldLabel" htmlFor="org-email">
                      Почта
                    </label>
                    <input
                      id="org-email"
                      className={cn("fieldInput", orgErrors.email && "fieldInput--error")}
                      type="email"
                      value={draft.email}
                      onChange={(event) => setDraft({ ...draft, email: event.target.value })}
                    />
                    {orgErrors.email ? (
                      <p className="formHint formHint--error">{orgErrors.email}</p>
                    ) : null}
                  </div>
                </div>

                <div className="orgFieldsRow">
                  <div>
                    <label className="fieldLabel" htmlFor="org-site">
                      Сайт
                    </label>
                    <input
                      id="org-site"
                      className={cn("fieldInput", orgErrors.site && "fieldInput--error")}
                      value={draft.site}
                      onChange={(event) => setDraft({ ...draft, site: event.target.value })}
                    />
                    {orgErrors.site ? <p className="formHint formHint--error">{orgErrors.site}</p> : null}
                  </div>
                  <div>
                    <label className="fieldLabel" htmlFor="org-city_id">
                      Город <span className="fieldOptional">можно пусто</span>
                    </label>
                    <select
                      id="org-city_id"
                      className="fieldSelect"
                      value={draft.city_id}
                      disabled={cities.kind !== "ready"}
                      onChange={(event) => setDraft({ ...draft, city_id: event.target.value })}
                    >
                      <option value="">
                        {cities.kind === "loading" ? "Загружаем справочник…" : "Не указан"}
                      </option>
                      {cities.kind === "ready"
                        ? cities.items.map((place) => (
                            <option key={place.id} value={String(place.id)}>
                              {place.name}
                            </option>
                          ))
                        : null}
                      {draft.city_id !== "" &&
                      (cities.kind !== "ready" ||
                        !cities.items.some((place) => String(place.id) === draft.city_id)) ? (
                        <option value={draft.city_id}>Город № {draft.city_id}</option>
                      ) : null}
                    </select>
                    {cities.kind === "error" ? (
                      <p className="formHint formHint--error">
                        Справочник городов не загрузился: {cities.error.message} (ответ{" "}
                        {cities.error.status}).{" "}
                        <button
                          type="button"
                          className="btn btn--ghost btn--sm"
                          onClick={retryCities}
                        >
                          Повторить
                        </button>
                      </p>
                    ) : null}
                    {orgErrors.city_id ? (
                      <p className="formHint formHint--error">{orgErrors.city_id}</p>
                    ) : null}
                  </div>
                </div>

                <label className="fieldLabel" htmlFor="org-address">
                  Адрес
                </label>
                <input
                  id="org-address"
                  className={cn("fieldInput", orgErrors.address && "fieldInput--error")}
                  value={draft.address}
                  onChange={(event) => setDraft({ ...draft, address: event.target.value })}
                />
                {orgErrors.address ? (
                  <p className="formHint formHint--error">{orgErrors.address}</p>
                ) : null}

                <button
                  type="button"
                  className="btn btn--primary"
                  disabled={orgSaving}
                  onClick={() => void saveOrg()}
                >
                  {orgSaving ? <Loader2 size={16} /> : null}
                  {orgSaving ? "Сохраняем…" : "Сохранить профиль"}
                </button>
                {orgSaveError ? (
                  <p className="formHint formHint--error" role="alert">
                    {orgSaveError}
                  </p>
                ) : null}
                <p className="cabinetFootNote">
                  Slug организации неизменяем. Контакты и описание проверяются: их сверяет
                  модератор. Группы и точки проведения живут внутри карточек.
                </p>
              </div>
            </>
          ) : null}
        </section>
      )}
    </div>
  );
}

function CardRow({
  row,
  busy,
  disabled,
  onEdit,
  onSubmit,
  onUnpublish,
}: {
  row: OwnerCardView;
  busy: boolean;
  disabled: boolean;
  onEdit: () => void;
  onSubmit: () => void;
  onUnpublish: () => void;
}) {
  const waiting = row.status === "pending" ? workingDaysWaiting(row.submittedAt) : 0;
  const overdue = waiting > MODERATION_SLA_DAYS;
  return (
    <article
      className={cn(
        "appRow",
        row.status === "rejected" && "appRow--rejected",
        overdue && "appRow--overdue",
      )}
    >
      <div className="appRowMain">
        <div className="appRowTop">
          <button type="button" className="appRowTitle" onClick={onEdit}>
            {row.title}
          </button>
          <span className={cn("statusPill", `statusPill--${row.status}`)} title={row.rawStatus}>
            {statusLabels[row.status]}
          </span>
        </div>
        <p className="appRowMeta">
          <span>{row.organizationTitle || "Организация не указана"}</span>
          <span>
            {row.groupsCount} {plural(row.groupsCount, "группа", "группы", "групп")} ·{" "}
            {row.locationsCount} {plural(row.locationsCount, "точка", "точки", "точек")}
          </span>
          <span>
            <CalendarClock size={12} /> обновлена {new Date(row.updatedAt).toLocaleDateString("ru-RU")}
          </span>
        </p>
        {row.status === "pending" && row.submittedAt ? (
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
            <BadgeCheck size={13} /> Анкета в каталоге — снятие с публикации возвращает её в
            черновики.
          </p>
        ) : null}
      </div>

      <div className="appRowActions">
        <button type="button" className="btn btn--soft btn--sm" onClick={onEdit}>
          Править
        </button>
        {row.status === "published" ? (
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            disabled={disabled}
            onClick={onUnpublish}
          >
            {busy ? <Loader2 size={14} /> : <Undo2 size={14} />} Снять с публикации
          </button>
        ) : null}
        {row.status === "rejected" || row.status === "draft" ? (
          <button
            type="button"
            className="btn btn--primary btn--sm"
            disabled={disabled}
            onClick={onSubmit}
          >
            {busy ? <Loader2 size={14} /> : null}
            {row.status === "rejected" ? "Исправить и отправить" : "Отправить на проверку"}
          </button>
        ) : null}
      </div>
    </article>
  );
}

function ListSection({
  state,
  onRetry,
  children,
}: {
  state: ListState;
  onRetry: () => void;
  children: (phase: { kind: "ready"; page: ApiPage<OwnerCardView> }) => React.ReactNode;
}) {
  if (state.kind === "loading") return <OwnerLoading label="Загружаем анкеты с сервера…" />;
  if (state.kind === "error") {
    return (
      <>
        <OwnerErrorView error={state.error} />
        {state.error.status !== 401 && state.error.status !== 403 && state.error.status !== 503 ? (
          <div className="cabinetGateActions">
            <button type="button" className="btn btn--soft btn--sm" onClick={onRetry}>
              <RefreshCw size={14} /> Повторить
            </button>
          </div>
        ) : null}
      </>
    );
  }
  return <>{children(state)}</>;
}

/** Страницы списка: сервер отдаёт `total`, и молча обрезать список до 20 анкет нельзя. */
function Pager({
  page,
  current,
  onPage,
}: {
  page: ApiPage<OwnerCardView>;
  current: number;
  onPage: (next: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(page.total / Math.max(1, page.limit)));
  if (pages <= 1) return null;
  const active = Math.min(Math.max(1, current), pages);
  return (
    <div className="cabinetPager">
      <button
        type="button"
        className="btn btn--ghost btn--sm"
        disabled={active <= 1}
        onClick={() => onPage(active - 1)}
      >
        <ChevronLeft size={14} /> Назад
      </button>
      <span>
        {active} из {pages}
      </span>
      <button
        type="button"
        className="btn btn--ghost btn--sm"
        disabled={active >= pages}
        onClick={() => onPage(active + 1)}
      >
        Вперёд <ChevronRight size={14} />
      </button>
    </div>
  );
}