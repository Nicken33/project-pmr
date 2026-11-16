"use client";

import { cloneElement, isValidElement, useCallback, useEffect, useState, type ReactElement } from "react";
import { CalendarClock, ChevronLeft, Loader2, MapPin, Plus, Save, ShieldAlert, Trash2 } from "lucide-react";
import type { ActivityFormat, ActivityKind, ActivityType } from "@/lib/types";
import { cn, plural } from "@/lib/utils";
import { useApp } from "@/components/providers/AppProviders";
import {
  categoryOptions,
  createMyActivity,
  fetchMyActivity,
  fetchOwnerCategories,
  fetchOwnerCities,
  fetchOwnerDistricts,
  toOwnerError,
  unpublishMyActivity,
  updateMyActivity,
  weekdayTitle,
  type CategoryOption,
  type OwnerCardDetail,
  type OwnerCardInput,
} from "@/lib/owner-api";
import type { ApiPlace } from "@/lib/api";
import { OwnerErrorView, OwnerLoading } from "@/components/account/OwnerStates";
import { OwnerMediaPanel } from "@/components/account/OwnerMediaPanel";

/**
 * Правка карточки владельца. Тело — ровно `models.OwnedCardInput`: `name`,
 * `kind`, `org_id`, `category_id`, `description`, `format`, `lesson_type`,
 * `phone`. Направление выбирается из справочника (числовой id), организация
 * берётся из `GET /me/organization`; точки, группы и расписание принадлежат
 * анкете. Пустая карточка создаётся через POST и приходит со статусом `draft`.
 */

/** Состояние своей организации в кабинете: без неё сервер карточку не примет. */
export type OrgPhase = "loading" | "ready" | "absent" | "error";

interface Draft {
  name: string;
  description: string;
  category_id: string;
  format: "" | ActivityFormat;
  lesson_type: "" | ActivityType;
  phone: string;
  address: string;
  latitude: string;
  longitude: string;
  age_from: string;
  age_to: string;
  seats: string;
  price_from: string;
  price_period: string;
  weekday: string;
  start_time: string;
  end_time: string;
  schedule_note: string;
  primaryLocationKey: string;
  primaryGroupLocationKey: string;
  primaryCityId: string;
  primaryDistrictId: string;
  primaryPhone: string;
  primaryExtraSchedules: ScheduleDraft[];
  extraLocations: LocationDraft[];
  extraGroups: GroupDraft[];
}

interface ScheduleDraft { weekday: string; start_time: string; end_time: string; note: string }
interface LocationDraft { key: string; id?: string; name: string; address: string; latitude: string; longitude: string; city_id: string; district_id: string; phone: string }
interface GroupDraft { key: string; name: string; age_from: string; age_to: string; seats: string; price_from: string; price_to: string; price_period: string; locationKey: string; schedules: ScheduleDraft[] }

const newSchedule = (): ScheduleDraft => ({ weekday: "1", start_time: "10:00", end_time: "11:00", note: "" });
const newGroup = (locationKey = "primary-location"): GroupDraft => ({ key: `group-${crypto.randomUUID()}`, name: "", age_from: "", age_to: "", seats: "", price_from: "0", price_to: "", price_period: "month", locationKey, schedules: [newSchedule()] });

const FORMATS: Array<{ value: ActivityFormat; label: string }> = [
  { value: "offline", label: "Очно" },
  { value: "online", label: "Онлайн" },
  { value: "both", label: "Очно и онлайн" },
];

const LESSON_TYPES: Array<{ value: ActivityType; label: string }> = [
  { value: "group", label: "Групповые" },
  { value: "individual", label: "Индивидуальные" },
  { value: "both", label: "Групповые и индивидуальные" },
];

function emptyDraft(): Draft {
  return {
    name: "",
    description: "",
    category_id: "",
    format: "",
    lesson_type: "",
    phone: "",
    address: "", latitude: "", longitude: "", age_from: "", age_to: "", seats: "", price_from: "0", price_period: "month", weekday: "1", start_time: "10:00", end_time: "11:00", schedule_note: "",
    primaryLocationKey: "primary-location", primaryGroupLocationKey: "primary-location", primaryCityId: "", primaryDistrictId: "", primaryPhone: "", primaryExtraSchedules: [], extraLocations: [], extraGroups: [],
  };
}

function fromCard(card: OwnerCardDetail): Draft {
  const firstGroup = card.groups[0];
  const firstLocation = firstGroup ? card.locations.find((x) => x.id === firstGroup.location_id) : undefined;
  const primaryLocationKey = firstLocation ? String(firstLocation.id) : "primary-location";
  const extraLocations: LocationDraft[] = card.locations.filter((x) => x.id !== firstLocation?.id).map((x) => ({ key: String(x.id), id: String(x.id), name: x.name ?? "", address: x.address, latitude: x.lat == null ? "" : String(x.lat), longitude: x.lng == null ? "" : String(x.lng), city_id: String(x.city_id ?? ""), district_id: String(x.district_id ?? ""), phone: x.phone ?? "" }));
  const toSchedule = (s: OwnerCardDetail["groups"][number]["schedules"][number]): ScheduleDraft => ({ weekday: String(s.weekday), start_time: s.time_from, end_time: s.time_to, note: s.note ?? "" });
  const extraGroups: GroupDraft[] = card.groups.slice(1).map((g) => ({ key: `group-${g.id}`, name: g.name ?? "", age_from: String(g.age_from ?? ""), age_to: String(g.age_to ?? ""), seats: String(g.seats ?? ""), price_from: String(g.price_from ?? 0), price_to: g.price_to == null ? "" : String(g.price_to), price_period: g.price_period ?? "month", locationKey: String(g.location_id), schedules: (g.schedules ?? []).map(toSchedule) }));
  const primarySchedules = (firstGroup?.schedules ?? []).map(toSchedule);
  const primaryFirstSchedule = primarySchedules[0] ?? newSchedule();
  return {
    name: card.name ?? "",
    description: card.description ?? "",
    category_id:
      card.category_id === null || card.category_id === undefined ? "" : String(card.category_id),
    format: card.format ?? "",
    lesson_type: card.lesson_type ?? "",
    phone: card.phone ?? "",
    address: firstLocation?.address ?? "", latitude: firstLocation?.lat == null ? "" : String(firstLocation.lat), longitude: firstLocation?.lng == null ? "" : String(firstLocation.lng),
    age_from: String(firstGroup?.age_from ?? ""), age_to: String(firstGroup?.age_to ?? ""), seats: String(firstGroup?.seats ?? ""), price_from: String(firstGroup?.price_from ?? 0), price_period: firstGroup?.price_period ?? "month", weekday: primaryFirstSchedule.weekday, start_time: primaryFirstSchedule.start_time, end_time: primaryFirstSchedule.end_time, schedule_note: primaryFirstSchedule.note,
    primaryLocationKey, primaryGroupLocationKey: primaryLocationKey, primaryCityId: String(firstLocation?.city_id ?? ""), primaryDistrictId: String(firstLocation?.district_id ?? ""), primaryPhone: firstLocation?.phone ?? "", primaryExtraSchedules: primarySchedules.slice(1), extraLocations, extraGroups,
  };
}

function nullableText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function validate(draft: Draft, kind: ActivityKind): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!draft.name.trim()) errors.name = "Название обязательно";
  const categoryId = Number(draft.category_id);
  if (draft.category_id.trim() === "" || !Number.isInteger(categoryId) || categoryId <= 0) {
    errors.category_id = "Выберите направление из справочника";
  }
  if (draft.format === "") errors.format = "Формат обязателен";
  if (!draft.address.trim()) errors.address = "Адрес точки обязателен";
  for (const field of ["latitude", "longitude"] as const) if (draft[field] === "" || !Number.isFinite(Number(draft[field]))) errors[field] = "Заполните числовое поле";
  if (kind === "activity") {
    for (const field of ["age_from", "age_to", "seats"] as const) if (draft[field] === "" || !Number.isFinite(Number(draft[field]))) errors[field] = "Заполните числовое поле";
    if (!draft.start_time || !draft.end_time) errors.start_time = "Укажите расписание";
    if (draft.age_from && draft.age_to && Number(draft.age_to) < Number(draft.age_from)) errors.age_to = "Возраст «до» не может быть меньше возраста «от»";
    if (draft.seats && Number(draft.seats) < 1) errors.seats = "Нужно хотя бы одно место";
  }
  draft.extraGroups.forEach((group, index) => {
    if (kind === "activity" && (!group.age_from || !group.age_to || Number(group.age_to) < Number(group.age_from))) errors[`group.${index}.age`] = "Проверьте границы возраста";
    if (kind === "activity" && (!group.seats || Number(group.seats) < 1)) errors[`group.${index}.seats`] = "Укажите количество мест";
    if (!group.locationKey) errors[`group.${index}.location`] = "Выберите точку";
    if (kind === "activity" && !group.schedules.length) errors[`group.${index}.schedule`] = "Добавьте расписание";
  });
  draft.extraLocations.forEach((location, index) => {
    if (!location.address.trim()) errors[`location.${index}.address`] = "Укажите адрес точки";
    if (!location.latitude || !location.longitude) errors[`location.${index}.coords`] = "Укажите координаты точки";
    if (!location.city_id) errors[`location.${index}.city`] = "Выберите город";
  });
  return errors;
}

/**
 * `lesson_type` у услуги отсутствует вовсе (CHECK базы): ключ не отправляем.
 * Пустые необязательные строки — null, а не пустая строка.
 */
function toInput(draft: Draft, kind: ActivityKind, cityId: number, existing?: OwnerCardDetail | null): OwnerCardInput {
  const locationKey = draft.primaryLocationKey;
  const existingLocation = existing?.locations.find((location) => String(location.id) === locationKey);
  const primarySchedules = kind === "service" ? [] : [{ weekday: Number(draft.weekday), start_time: draft.start_time, end_time: draft.end_time, note: nullableText(draft.schedule_note) }, ...draft.primaryExtraSchedules.map((s) => ({ weekday: Number(s.weekday), start_time: s.start_time, end_time: s.end_time, note: nullableText(s.note) }))];
  const locations: OwnerCardInput["locations"] = [{ key: locationKey, ...(existingLocation ? { id: String(existingLocation.id) } : {}), city_id: draft.primaryCityId || String(cityId), district_id: draft.primaryDistrictId ? String(draft.primaryDistrictId) : null, address: draft.address.trim(), latitude: Number(draft.latitude), longitude: Number(draft.longitude), phone: nullableText(draft.primaryPhone), source_type: "person" }, ...draft.extraLocations.map((point) => ({ key: point.key, ...(point.id ? { id: point.id } : {}), name: nullableText(point.name), city_id: point.city_id || String(cityId), district_id: point.district_id ? String(point.district_id) : null, address: point.address.trim(), latitude: Number(point.latitude), longitude: Number(point.longitude), phone: nullableText(point.phone), source_type: "person" }))];
  const groups: OwnerCardInput["groups"] = [{ name: draft.name.trim(), age_from: kind === "service" ? null : Number(draft.age_from), age_to: kind === "service" ? null : Number(draft.age_to), price_from: Number(draft.price_from || 0), price_period: Number(draft.price_from || 0) > 0 ? draft.price_period : null, location_key: draft.primaryGroupLocationKey, seats: kind === "service" ? null : Number(draft.seats), schedules: primarySchedules }, ...draft.extraGroups.map((group) => ({ name: group.name.trim() || "Группа", age_from: kind === "service" ? null : Number(group.age_from), age_to: kind === "service" ? null : Number(group.age_to), price_from: Number(group.price_from || 0), price_to: group.price_to ? Number(group.price_to) : null, price_period: Number(group.price_from || 0) > 0 ? group.price_period : null, location_key: group.locationKey, seats: kind === "service" ? null : Number(group.seats), schedules: kind === "service" ? [] : group.schedules.map((s) => ({ weekday: Number(s.weekday), start_time: s.start_time, end_time: s.end_time, note: nullableText(s.note) })) }))];
  return {
    name: draft.name.trim(),
    record_type: kind,
    direction_id: draft.category_id,
    description: nullableText(draft.description),
    class_format: draft.format as ActivityFormat,
    ...(kind === "activity" ? { class_type: (draft.lesson_type || "group") as ActivityType } : {}),
    phone: nullableText(draft.phone),
    locations,
    groups,
  };
}

type Phase =
  | { kind: "loading" }
  | { kind: "error"; error: ReturnType<typeof toOwnerError> }
  | { kind: "ready" };

type CategoriesState =
  | { kind: "loading" }
  | { kind: "error"; error: ReturnType<typeof toOwnerError> }
  | { kind: "ready"; options: CategoryOption[] };

export function OwnerCardEditor({
  id,
  kind,
  orgId,
  cityId,
  orgPhase,
  onCreated,
  onSaved,
  onClose,
}: {
  /** null — новая карточка: создаётся только после первого сохранения. */
  id: string | null;
  kind: ActivityKind;
  orgId?: number;
  cityId?: number;
  orgPhase: OrgPhase;
  onCreated: (id: string) => void;
  onSaved: () => void;
  onClose: () => void;
}) {
  const { toast } = useApp();
  const [phase, setPhase] = useState<Phase>(id ? { kind: "loading" } : { kind: "ready" });
  const [detail, setDetail] = useState<OwnerCardDetail | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [unpublishing, setUnpublishing] = useState(false);
  const [categories, setCategories] = useState<CategoriesState>({ kind: "loading" });
  const [categoriesRetry, setCategoriesRetry] = useState(0);
  const [cities, setCities] = useState<ApiPlace[]>([]);
  const [districtsByCity, setDistrictsByCity] = useState<Record<string, ApiPlace[]>>({});

  const orgReady = orgPhase === "ready" && orgId !== undefined;

  /* Загрузка без синхронного setState в эффекте: состояние уже `loading`,
     поэтому одного асинхронного вызова хватает. */
  useEffect(() => {
    if (!id) return;
    let alive = true;
    fetchMyActivity(id)
      .then((card) => {
        if (!alive) return;
        setDetail(card);
        setDraft(fromCard(card));
        setPhase({ kind: "ready" });
      })
      .catch((reason) => {
        if (alive) setPhase({ kind: "error", error: toOwnerError(reason) });
      });
    return () => {
      alive = false;
    };
  }, [id]);

  useEffect(() => {
    let alive = true;
    fetchOwnerCategories()
      .then((raw) => {
        if (alive) setCategories({ kind: "ready", options: categoryOptions(raw, kind) });
      })
      .catch((reason) => {
        if (alive) setCategories({ kind: "error", error: toOwnerError(reason) });
      });
    return () => {
      alive = false;
    };
  }, [kind, categoriesRetry]);

  useEffect(() => { fetchOwnerCities().then(setCities).catch(() => setCities([])); }, []);
  const districtCityIDs = [...new Set([draft.primaryCityId || String(cityId ?? ""), ...draft.extraLocations.map((point) => point.city_id)].filter(Boolean))].sort().join(",");
  useEffect(() => {
    let alive = true;
    const ids = districtCityIDs ? districtCityIDs.split(",") : [];
    Promise.all(ids.map(async (id) => [id, await fetchOwnerDistricts(id)] as const))
      .then((entries) => { if (alive) setDistrictsByCity(Object.fromEntries(entries)); })
      .catch(() => { if (alive) setDistrictsByCity({}); });
    return () => { alive = false; };
  }, [districtCityIDs]);

  const retryCategories = () => {
    setCategories({ kind: "loading" });
    setCategoriesRetry((current) => current + 1);
  };

  /* После загрузки и удаления файла перечитываем карточку: путь и порядок знает
     сервер, а не витрина. Черновик формы не трогаем — в нём могут быть
     несохранённые правки владельца. */
  const reload = useCallback(() => {
    if (!id) return;
    fetchMyActivity(id)
      .then(setDetail)
      .catch(() =>
        toast({
          title: "Карточка не перечитана",
          description: "Файл изменён на сервере, но список медиа мог устареть — обновите страницу.",
          tone: "danger",
        }),
      );
  }, [id, toast]);

  const patch = (field: keyof Draft, value: string) =>
    setDraft((current) => ({ ...current, [field]: value }));

  const save = async () => {
    const problems = validate(draft, kind);
    setErrors(problems);
    setSaveError(null);
    if (Object.keys(problems).length > 0) return;
    if (!orgReady || orgId === undefined || cityId === undefined) {
      setSaveError(
        "Сохранение недоступно: сервер не подтвердил вашу организацию. Карточка требует org_id своей организации.",
      );
      return;
    }

    setSaving(true);
    try {
      const input = toInput(draft, kind, cityId, detail);
      const card = id ? await updateMyActivity(id, input) : await createMyActivity(input);
      toast({
        title: id ? "Карточка сохранена" : "Черновик создан",
          description: id
          ? `Сервер вернул статус «${card.status}».`
          : `Карточка создана со статусом «${card.status ?? "draft"}».`,
        tone: "success",
      });
      onSaved();
      if (!id) {
        onCreated(String(card.id));
        return;
      }
      /* POST/PUT возвращают плоский OwnedCard без групп, точек и медиа — деталь
         перечитывается отдельным GET, иначе срезы пришлось бы выдумывать. */
      try {
        const fresh = await fetchMyActivity(id);
        setDetail(fresh);
        setDraft(fromCard(fresh));
      } catch {
        toast({
          title: "Карточка сохранена, но не перечитана",
          description: "Сервер принял правки; группы и медиа могли устареть — обновите страницу.",
          tone: "danger",
        });
      }
    } catch (reason) {
      const apiError = toOwnerError(reason);
      if (Object.keys(apiError.fields).length > 0) {
        setErrors((current) => ({ ...current, ...apiError.fields }));
      }
      setSaveError(`${apiError.message} (ответ ${apiError.status})`);
    } finally {
      setSaving(false);
    }
  };

  const unpublish = async () => {
    if (!id) return;
    setUnpublishing(true);
    setSaveError(null);
    try {
      const result = await unpublishMyActivity(id);
      toast({
        title: "Снято с публикации",
        description: `Сервер вернул статус «${result.card.status}» — теперь медиа можно менять.`,
        tone: "success",
      });
      onSaved();
      reload();
    } catch (reason) {
      const apiError = toOwnerError(reason);
      setSaveError(`${apiError.message} (ответ ${apiError.status})`);
    } finally {
      setUnpublishing(false);
    }
  };

  if (phase.kind === "loading") return <OwnerLoading label="Загружаем карточку с сервера…" />;
  if (phase.kind === "error") {
    return (
      <OwnerErrorView
        error={phase.error}
        notFound="Карточка не найдена: она удалена либо принадлежит другой организации."
      />
    );
  }

  const categoryOptionsReady = categories.kind === "ready" ? categories.options : [];
  const categoryMissing =
    draft.category_id !== "" &&
    !categoryOptionsReady.some((option) => String(option.id) === draft.category_id);

  return (
    <section className="cabinetSection" aria-label={id ? "Правка карточки" : "Новая карточка"}>
      <div className="cabinetSectionHead">
        <h2>{id ? (detail?.name ?? "Правка карточки") : "Новая анкета"}</h2>
        <button type="button" className="btn btn--ghost btn--sm" onClick={onClose}>
          <ChevronLeft size={14} /> К списку анкет
        </button>
      </div>

      <p className="cabinetNotice">
        <CalendarClock size={14} />
        {kind === "service"
          ? "Карточка услуги. Сохранение создаёт черновик — на проверку его отправляет владелец из списка."
          : "Карточка занятия. Сохранение создаёт черновик — на проверку его отправляет владелец из списка."}
      </p>

      {!orgReady ? (
        <p className="cabinetNotice" role="alert">
          <ShieldAlert size={14} />
          {orgPhase === "loading"
            ? "Проверяем вашу организацию на сервере — сохранение станет доступно после ответа."
            : orgPhase === "absent"
              ? "Сначала создайте профиль во вкладке «Профиль организации», затем вернитесь к анкете."
              : "Сервер не подтвердил вашу организацию — сохранение недоступно. Откройте вкладку «Профиль организации» и перечитайте профиль."}
        </p>
      ) : null}

      <div className="orgFields">
        <div className="appFormGrid">
          <Field label="Название" name="name" required error={errors.name}>
            <input
              id="card-name"
              className={cn("fieldInput", errors.name && "fieldInput--error")}
              value={draft.name}
              maxLength={120}
              onChange={(event) => patch("name", event.target.value)}
            />
          </Field>
          <Field label="Направление" name="category_id" required error={errors.category_id}>
            <select
              id="card-category_id"
              className="fieldSelect"
              value={draft.category_id}
              disabled={categories.kind !== "ready"}
              onChange={(event) => patch("category_id", event.target.value)}
            >
              <option value="">
                {categories.kind === "loading" ? "Загружаем справочник…" : "Выберите направление"}
              </option>
              {categoryOptionsReady.map((option) => (
                <option key={option.id} value={String(option.id)}>
                  {option.title}
                </option>
              ))}
              {categoryMissing ? (
                <option value={draft.category_id}>Направление № {draft.category_id}</option>
              ) : null}
            </select>
            {categories.kind === "error" ? (
              <p className="formHint formHint--error">
                Справочник направлений не загрузился: {categories.error.message} (ответ{" "}
                {categories.error.status}).{" "}
                <button type="button" className="btn btn--ghost btn--sm" onClick={retryCategories}>
                  Повторить
                </button>
              </p>
            ) : null}
            {categories.kind === "ready" && categoryOptionsReady.length === 0 ? (
              <p className="formHint">Сервер не прислал направлений для этого вида карточки.</p>
            ) : null}
          </Field>
          <Field label="Формат" name="format" required error={errors.format}>
            <select
              id="card-format"
              className="fieldSelect"
              value={draft.format}
              onChange={(event) => patch("format", event.target.value)}
            >
              <option value="">Выберите формат</option>
              {FORMATS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </Field>
          {kind === "activity" ? (
            <Field label="Тип занятий" name="lesson_type" error={errors.lesson_type}>
              <select
                id="card-lesson_type"
                className="fieldSelect"
                value={draft.lesson_type}
                onChange={(event) => patch("lesson_type", event.target.value)}
              >
                <option value="">Не указан</option>
                {LESSON_TYPES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}
          <Field label="Телефон" name="phone" error={errors.phone}>
            <input
              id="card-phone"
              className={cn("fieldInput", errors.phone && "fieldInput--error")}
              value={draft.phone}
              onChange={(event) => patch("phone", event.target.value)}
            />
          </Field>
        </div>

        <label className="fieldLabel" htmlFor="card-description">
          Описание
        </label>
        <textarea
          id="card-description"
          className="textarea"
          rows={5}
          value={draft.description}
          onChange={(event) => patch("description", event.target.value)}
        />
        {errors.description ? (
          <p className="formHint formHint--error">{errors.description}</p>
        ) : null}

        <section className="appFormFieldset" aria-label="Первая группа и точка проведения">
          <div className="appFormSetHead"><h2>Первая группа и точка проведения</h2></div>
          <p className="appFormSetHint">Для секции укажите возраст, места и расписание. Для услуги нужны цена и точка. Город основной точки берётся из профиля организации.</p>
          <div className="appFormGrid">
            <Field label="Город основной точки" name="primary-city" required><select id="card-primary-city" className="fieldSelect" value={draft.primaryCityId || String(cityId ?? "")} disabled={!cities.length} onChange={(e) => setDraft((current) => ({ ...current, primaryCityId: e.target.value, primaryDistrictId: "" }))}><option value="">Выберите город</option>{cities.map((city) => <option key={city.id} value={city.id}>{city.name}</option>)}</select></Field>
            <Field label="Район основной точки" name="primary-district"><select className="fieldSelect" value={draft.primaryDistrictId} onChange={(e) => setDraft((current) => ({ ...current, primaryDistrictId: e.target.value }))}><option value="">Без района</option>{(districtsByCity[draft.primaryCityId || String(cityId ?? "")] ?? []).map((district) => <option key={district.id} value={district.id}>{district.name}</option>)}</select></Field>
            <Field label="Телефон точки" name="primary-location-phone"><input className="fieldInput" type="tel" value={draft.primaryPhone} onChange={(e) => setDraft((current) => ({ ...current, primaryPhone: e.target.value }))} /></Field>
            <Field label="Адрес" name="address" required error={errors.address}><input id="card-address" className="fieldInput" value={draft.address} onChange={(e) => patch("address", e.target.value)} placeholder="Улица, дом" /></Field>
            <Field label="Широта" name="latitude" required error={errors.latitude}><input id="card-latitude" className="fieldInput" type="number" step="any" value={draft.latitude} onChange={(e) => patch("latitude", e.target.value)} /></Field>
            <Field label="Долгота" name="longitude" required error={errors.longitude}><input id="card-longitude" className="fieldInput" type="number" step="any" value={draft.longitude} onChange={(e) => patch("longitude", e.target.value)} /></Field>
            {kind === "activity" ? <>
              <Field label="Возраст от" name="age_from" required error={errors.age_from}><input id="card-age_from" className="fieldInput" type="number" min="0" value={draft.age_from} onChange={(e) => patch("age_from", e.target.value)} /></Field>
              <Field label="Возраст до" name="age_to" required error={errors.age_to}><input id="card-age_to" className="fieldInput" type="number" min="0" value={draft.age_to} onChange={(e) => patch("age_to", e.target.value)} /></Field>
              <Field label="Мест в группе" name="seats" required error={errors.seats}><input id="card-seats" className="fieldInput" type="number" min="1" value={draft.seats} onChange={(e) => patch("seats", e.target.value)} /></Field>
            </> : null}
            <Field label="Цена от" name="price_from"><input id="card-price_from" className="fieldInput" type="number" min="0" value={draft.price_from} onChange={(e) => patch("price_from", e.target.value)} /></Field>
            {Number(draft.price_from) > 0 ? <Field label="Период цены" name="price-period" required><select id="card-price-period" className="fieldSelect" value={draft.price_period} onChange={(e) => patch("price_period", e.target.value)}><option value="session">за занятие</option><option value="month">в месяц</option><option value="course">за курс</option></select></Field> : null}
            <Field label="Точка этой группы" name="primary-group-location" required><select className="fieldSelect" value={draft.primaryGroupLocationKey} onChange={(e) => setDraft((current) => ({ ...current, primaryGroupLocationKey: e.target.value }))}><option value={draft.primaryLocationKey}>Основная точка · {draft.address || "адрес не задан"}</option>{draft.extraLocations.map((point) => <option key={point.key} value={point.key}>{point.name || point.address || "Новая точка"}</option>)}</select></Field>
            {kind === "activity" ? <>
              <Field label="День недели" name="weekday" required><select id="card-weekday" className="fieldSelect" value={draft.weekday} onChange={(e) => patch("weekday", e.target.value)}>{["Понедельник","Вторник","Среда","Четверг","Пятница","Суббота","Воскресенье"].map((day, i) => <option key={day} value={i + 1}>{day}</option>)}</select></Field>
              <Field label="Начало" name="start_time" required error={errors.start_time}><input id="card-start_time" className="fieldInput" type="time" value={draft.start_time} onChange={(e) => patch("start_time", e.target.value)} /></Field>
              <Field label="Окончание" name="end_time" required error={errors.end_time}><input id="card-end_time" className="fieldInput" type="time" value={draft.end_time} onChange={(e) => patch("end_time", e.target.value)} /></Field>
              <Field label="Примечание к расписанию" name="schedule-note"><input id="card-schedule-note" className="fieldInput" value={draft.schedule_note} maxLength={240} onChange={(e) => patch("schedule_note", e.target.value)} placeholder="Например: сбор за 10 минут" /></Field>
            </> : null}
          </div>
          {kind === "activity" ? <>
            {draft.primaryExtraSchedules.map((schedule, index) => <div className="appFormGrid" key={`primary-schedule-${index}`}>
              <Field label="День недели" name={`schedule-${index}-weekday`} required><select className="fieldSelect" value={schedule.weekday} onChange={(e) => setDraft((current) => ({ ...current, primaryExtraSchedules: current.primaryExtraSchedules.map((row, i) => i === index ? { ...row, weekday: e.target.value } : row) }))}>{["Понедельник","Вторник","Среда","Четверг","Пятница","Суббота","Воскресенье"].map((day, i) => <option key={day} value={i + 1}>{day}</option>)}</select></Field>
              <Field label="Начало" name={`schedule-${index}-start`} required><input className="fieldInput" type="time" value={schedule.start_time} onChange={(e) => setDraft((current) => ({ ...current, primaryExtraSchedules: current.primaryExtraSchedules.map((row, i) => i === index ? { ...row, start_time: e.target.value } : row) }))} /></Field>
              <Field label="Окончание" name={`schedule-${index}-end`} required><input className="fieldInput" type="time" value={schedule.end_time} onChange={(e) => setDraft((current) => ({ ...current, primaryExtraSchedules: current.primaryExtraSchedules.map((row, i) => i === index ? { ...row, end_time: e.target.value } : row) }))} /></Field>
              <Field label="Примечание" name={`schedule-${index}-note`}><input className="fieldInput" value={schedule.note} maxLength={240} onChange={(e) => setDraft((current) => ({ ...current, primaryExtraSchedules: current.primaryExtraSchedules.map((row, i) => i === index ? { ...row, note: e.target.value } : row) }))} /></Field>
              <button type="button" className="btn btn--ghost btn--sm" aria-label="Удалить строку расписания" onClick={() => setDraft((current) => ({ ...current, primaryExtraSchedules: current.primaryExtraSchedules.filter((_, i) => i !== index) }))}><Trash2 size={14} /> Удалить</button>
            </div>)}
            <button type="button" className="btn btn--soft btn--sm" onClick={() => setDraft((current) => ({ ...current, primaryExtraSchedules: [...current.primaryExtraSchedules, newSchedule()] }))}><Plus size={14} /> Добавить время</button>
          </> : null}
        </section>

        <section className="appFormFieldset" aria-label="Дополнительные точки и группы">
          <div className="appFormSetHead"><h2>Точки и группы</h2><span className="appFormSetCount">{1 + draft.extraLocations.length} точек · {1 + draft.extraGroups.length} групп</span></div>
          {draft.extraLocations.map((point, index) => <article className="appFormCard" key={point.key}>
            <div className="appFormCardHead"><h3>Точка {index + 2}</h3><button type="button" className="btn btn--ghost btn--sm" aria-label="Удалить точку" onClick={() => setDraft((current) => ({ ...current, extraLocations: current.extraLocations.filter((x) => x.key !== point.key), primaryGroupLocationKey: current.primaryGroupLocationKey === point.key ? current.primaryLocationKey : current.primaryGroupLocationKey, extraGroups: current.extraGroups.map((g) => g.locationKey === point.key ? { ...g, locationKey: current.primaryLocationKey } : g) }))}><Trash2 size={14} /> Удалить</button></div>
            <div className="appFormGrid">
              <Field label="Название точки" name={`location-${index}-name`}><input className="fieldInput" value={point.name} onChange={(e) => setDraft((current) => ({ ...current, extraLocations: current.extraLocations.map((x) => x.key === point.key ? { ...x, name: e.target.value } : x) }))} /></Field>
              <Field label="Город" name={`location-${index}-city`} required error={errors[`location.${index}.city`]}><select id={`card-location-${index}-city`} className="fieldSelect" value={point.city_id || String(cityId ?? "")} onChange={(e) => setDraft((current) => ({ ...current, extraLocations: current.extraLocations.map((x) => x.key === point.key ? { ...x, city_id: e.target.value, district_id: "" } : x) }))}><option value="">Выберите город</option>{cities.map((city) => <option key={city.id} value={city.id}>{city.name}</option>)}</select></Field>
              <Field label="Район" name={`location-${index}-district`}><select className="fieldSelect" value={point.district_id} onChange={(e) => setDraft((current) => ({ ...current, extraLocations: current.extraLocations.map((x) => x.key === point.key ? { ...x, district_id: e.target.value } : x) }))}><option value="">Без района</option>{(districtsByCity[point.city_id || String(cityId ?? "")] ?? []).map((district) => <option key={district.id} value={district.id}>{district.name}</option>)}</select></Field>
              <Field label="Телефон точки" name={`location-${index}-phone`}><input className="fieldInput" type="tel" value={point.phone} onChange={(e) => setDraft((current) => ({ ...current, extraLocations: current.extraLocations.map((x) => x.key === point.key ? { ...x, phone: e.target.value } : x) }))} /></Field>
              <Field label="Адрес" name={`location-${index}-address`} required error={errors[`location.${index}.address`]}><input className="fieldInput" value={point.address} onChange={(e) => setDraft((current) => ({ ...current, extraLocations: current.extraLocations.map((x) => x.key === point.key ? { ...x, address: e.target.value } : x) }))} /></Field>
              <Field label="Широта" name={`location-${index}-lat`} required error={errors[`location.${index}.coords`]}><input className="fieldInput" type="number" step="any" value={point.latitude} onChange={(e) => setDraft((current) => ({ ...current, extraLocations: current.extraLocations.map((x) => x.key === point.key ? { ...x, latitude: e.target.value } : x) }))} /></Field>
              <Field label="Долгота" name={`location-${index}-lng`} required><input className="fieldInput" type="number" step="any" value={point.longitude} onChange={(e) => setDraft((current) => ({ ...current, extraLocations: current.extraLocations.map((x) => x.key === point.key ? { ...x, longitude: e.target.value } : x) }))} /></Field>
            </div>
          </article>)}
          <button type="button" className="btn btn--soft btn--sm" onClick={() => { const key = `location-${crypto.randomUUID()}`; setDraft((current) => ({ ...current, extraLocations: [...current.extraLocations, { key, name: "", address: "", latitude: "", longitude: "", city_id: String(cityId ?? ""), district_id: "", phone: "" }] })); }}><Plus size={14} /> Добавить точку</button>
          {draft.extraGroups.map((group, index) => <article className="appFormCard" key={group.key}>
            <div className="appFormCardHead"><h3>Группа {index + 2}</h3><button type="button" className="btn btn--ghost btn--sm" aria-label="Удалить группу" onClick={() => setDraft((current) => ({ ...current, extraGroups: current.extraGroups.filter((x) => x.key !== group.key) }))}><Trash2 size={14} /> Удалить</button></div>
            <div className="appFormGrid">
              <Field label="Название группы" name={`group-${index}-name`}><input className="fieldInput" value={group.name} onChange={(e) => setDraft((current) => ({ ...current, extraGroups: current.extraGroups.map((x) => x.key === group.key ? { ...x, name: e.target.value } : x) }))} /></Field>
              {kind === "activity" ? <>
                <Field label="Возраст от" name={`group-${index}-age-from`} required error={errors[`group.${index}.age`]}><input className="fieldInput" type="number" min="0" value={group.age_from} onChange={(e) => setDraft((current) => ({ ...current, extraGroups: current.extraGroups.map((x) => x.key === group.key ? { ...x, age_from: e.target.value } : x) }))} /></Field>
                <Field label="Возраст до" name={`group-${index}-age-to`} required><input className="fieldInput" type="number" min="0" value={group.age_to} onChange={(e) => setDraft((current) => ({ ...current, extraGroups: current.extraGroups.map((x) => x.key === group.key ? { ...x, age_to: e.target.value } : x) }))} /></Field>
                <Field label="Мест" name={`group-${index}-seats`} required error={errors[`group.${index}.seats`]}><input className="fieldInput" type="number" min="1" value={group.seats} onChange={(e) => setDraft((current) => ({ ...current, extraGroups: current.extraGroups.map((x) => x.key === group.key ? { ...x, seats: e.target.value } : x) }))} /></Field>
              </> : null}
              <Field label="Цена от" name={`group-${index}-price`}><input className="fieldInput" type="number" min="0" value={group.price_from} onChange={(e) => setDraft((current) => ({ ...current, extraGroups: current.extraGroups.map((x) => x.key === group.key ? { ...x, price_from: e.target.value } : x) }))} /></Field>
              {Number(group.price_from) > 0 ? <Field label="Период цены" name={`group-${index}-period`} required><select className="fieldSelect" value={group.price_period} onChange={(e) => setDraft((current) => ({ ...current, extraGroups: current.extraGroups.map((x) => x.key === group.key ? { ...x, price_period: e.target.value } : x) }))}><option value="session">за занятие</option><option value="month">в месяц</option><option value="course">за курс</option></select></Field> : null}
              <Field label="Точка проведения" name={`group-${index}-location`} required error={errors[`group.${index}.location`]}><select className="fieldSelect" value={group.locationKey} onChange={(e) => setDraft((current) => ({ ...current, extraGroups: current.extraGroups.map((x) => x.key === group.key ? { ...x, locationKey: e.target.value } : x) }))}><option value={draft.primaryLocationKey}>Основная точка · {draft.address || "адрес не задан"}</option>{draft.extraLocations.map((point) => <option key={point.key} value={point.key}>{point.name || point.address || "Новая точка"}</option>)}</select></Field>
            </div>
            {kind === "activity" ? <>
              {group.schedules.map((schedule, scheduleIndex) => <div className="appFormGrid" key={`${group.key}-schedule-${scheduleIndex}`}>
                <Field label="День" name={`group-${index}-day-${scheduleIndex}`} required><select className="fieldSelect" value={schedule.weekday} onChange={(e) => setDraft((current) => ({ ...current, extraGroups: current.extraGroups.map((x) => x.key === group.key ? { ...x, schedules: x.schedules.map((s, i) => i === scheduleIndex ? { ...s, weekday: e.target.value } : s) } : x) }))}>{["Понедельник","Вторник","Среда","Четверг","Пятница","Суббота","Воскресенье"].map((day, i) => <option key={day} value={i + 1}>{day}</option>)}</select></Field>
                <Field label="Начало" name={`group-${index}-start-${scheduleIndex}`} required><input className="fieldInput" type="time" value={schedule.start_time} onChange={(e) => setDraft((current) => ({ ...current, extraGroups: current.extraGroups.map((x) => x.key === group.key ? { ...x, schedules: x.schedules.map((s, i) => i === scheduleIndex ? { ...s, start_time: e.target.value } : s) } : x) }))} /></Field>
                <Field label="Окончание" name={`group-${index}-end-${scheduleIndex}`} required><input className="fieldInput" type="time" value={schedule.end_time} onChange={(e) => setDraft((current) => ({ ...current, extraGroups: current.extraGroups.map((x) => x.key === group.key ? { ...x, schedules: x.schedules.map((s, i) => i === scheduleIndex ? { ...s, end_time: e.target.value } : s) } : x) }))} /></Field>
                <Field label="Примечание" name={`group-${index}-note-${scheduleIndex}`}><input className="fieldInput" value={schedule.note} maxLength={240} onChange={(e) => setDraft((current) => ({ ...current, extraGroups: current.extraGroups.map((x) => x.key === group.key ? { ...x, schedules: x.schedules.map((s, i) => i === scheduleIndex ? { ...s, note: e.target.value } : s) } : x) }))} /></Field>
                {scheduleIndex > 0 ? <button type="button" className="btn btn--ghost btn--sm" onClick={() => setDraft((current) => ({ ...current, extraGroups: current.extraGroups.map((x) => x.key === group.key ? { ...x, schedules: x.schedules.filter((_, i) => i !== scheduleIndex) } : x) }))}><Trash2 size={14} /> Удалить время</button> : null}
              </div>)}
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setDraft((current) => ({ ...current, extraGroups: current.extraGroups.map((x) => x.key === group.key ? { ...x, schedules: [...x.schedules, newSchedule()] } : x) }))}><Plus size={14} /> Добавить время группе</button>
            </> : null}
          </article>)}
          <button type="button" className="btn btn--soft btn--sm" onClick={() => setDraft((current) => ({ ...current, extraGroups: [...current.extraGroups, newGroup(current.primaryGroupLocationKey)] }))}><Plus size={14} /> Добавить группу</button>
        </section>

        <div className="mediaAdminActions">
          <button
            type="button"
            className="btn btn--primary"
            disabled={saving || !orgReady}
            onClick={() => void save()}
          >
            {saving ? <Loader2 size={16} /> : <Save size={16} />}
            {saving ? "Сохраняем…" : id ? "Сохранить карточку" : "Создать черновик"}
          </button>
        </div>
        {saveError ? (
          <p className="formHint formHint--error" role="alert">
            {saveError}
          </p>
        ) : null}
          <p className="cabinetFootNote">
          Адреса и координаты сохраняются в точках организации, цены и расписания — в группах анкеты.
          в поля карточки они не входят и сервером не принимаются.
        </p>
      </div>

      {id && detail ? (
        <OwnerMediaPanel
          cardId={id}
          status={detail.status}
          photos={detail.photos ?? []}
          videos={detail.videos ?? []}
          onChanged={reload}
          onUnpublish={() => void unpublish()}
          unpublishing={unpublishing}
        />
      ) : (
        <p className="cabinetFootNote">
          Медиа появится после первого сохранения: файлы привязываются к созданной карточке.
        </p>
      )}

      {detail ? <CardStructure detail={detail} /> : null}
    </section>
  );
}

function Field({
  label,
  name,
  required,
  error,
  children,
}: {
  label: string;
  name: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  const controlId = `card-${name}`;
  const control = isValidElement(children)
    ? cloneElement(children as ReactElement<{ id?: string }>, { id: controlId })
    : children;
  return (
    <div className="appFormField">
      <label className="fieldLabel" htmlFor={controlId}>
        {label}{" "}
        {required ? (
          <span className="fieldRequired">обязательно</span>
        ) : (
          <span className="fieldOptional">можно пусто</span>
        )}
      </label>
      {control}
      {error ? <p className="formHint formHint--error">{error}</p> : null}
    </div>
  );
}

/** Группы, расписание и точки — из ответа сервера, только чтение. */
function CardStructure({ detail }: { detail: OwnerCardDetail }) {
  const groups = detail.groups ?? [];
  const locations = detail.locations ?? [];
  return (
    <section className="appFormFieldset" aria-label="Группы и точки карточки">
      <div className="appFormSetHead">
        <h2>Группы и точки</h2>
        <span className="appFormSetCount">
          {groups.length} {plural(groups.length, "группа", "группы", "групп")} · {locations.length}{" "}
          {plural(locations.length, "точка", "точки", "точек")}
        </span>
      </div>
      {groups.length === 0 ? (
        <p className="appFormSetHint">Групп сервер не прислал.</p>
      ) : (
        groups.map((group) => (
          <article className="appFormCard" key={group.id}>
            <div className="appFormCardHead">
              <h3>{group.name ?? `Группа ${group.id}`}</h3>
            </div>
            <p className="appFormSetHint">
              Возраст: {group.age_from ?? "—"}–{group.age_to ?? "—"} · цена:{" "}
              {group.price_from ?? "—"}
              {group.price_to === null ? "" : `–${group.price_to}`}
              {group.price_period ? ` · ${group.price_period}` : ""}
              {group.seats === null ? "" : ` · мест: ${group.seats}`}
            </p>
            {(group.schedules ?? []).length === 0 ? (
              <p className="formHint">Расписание не задано.</p>
            ) : (
              <ul className="orgPointRows">
                {(group.schedules ?? []).map((lesson, index) => (
                  <li className="orgPointRow" key={`${group.id}-${index}`}>
                    <span className="orgPointRowPin">
                      <CalendarClock size={15} />
                    </span>
                    <span className="orgPointRowMain">
                      <strong>
                        {weekdayTitle(lesson.weekday) ?? `день ${lesson.weekday}`} ·{" "}
                        {lesson.time_from}–{lesson.time_to}
                      </strong>
                      {lesson.note ? <small>{lesson.note}</small> : null}
                      {lesson.seats === null ? null : <small>мест: {lesson.seats}</small>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </article>
        ))
      )}

      {locations.length > 0 ? (
        <ul className="orgPointRows">
          {locations.map((location) => (
            <li className="orgPointRow" key={location.id}>
              <span className="orgPointRowPin">
                <MapPin size={15} />
              </span>
              <span className="orgPointRowMain">
                <strong>{location.name ?? location.address}</strong>
                <small>
                  {location.city}
                  {location.district ? ` · ${location.district}` : ""} · {location.address}
                </small>
                {location.lat !== null && location.lng !== null ? (
                  <small className="orgPointRowCoords">
                    {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
                  </small>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
