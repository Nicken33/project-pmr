"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarClock, ChevronLeft, Loader2, MapPin, Save, ShieldAlert } from "lucide-react";
import type { ActivityFormat, ActivityKind, ActivityType } from "@/lib/types";
import { cn, plural } from "@/lib/utils";
import { useApp } from "@/components/providers/AppProviders";
import {
  categoryOptions,
  createMyActivity,
  fetchMyActivity,
  fetchOwnerCategories,
  toOwnerError,
  unpublishMyActivity,
  updateMyActivity,
  weekdayTitle,
  type CategoryOption,
  type OwnerCardDetail,
  type OwnerCardInput,
} from "@/lib/owner-api";
import { OwnerErrorView, OwnerLoading } from "@/components/account/OwnerStates";
import { OwnerMediaPanel } from "@/components/account/OwnerMediaPanel";

/**
 * Правка карточки владельца. Тело — ровно `models.OwnedCardInput`: `name`,
 * `kind`, `org_id`, `category_id`, `description`, `format`, `lesson_type`,
 * `phone`. Направление выбирается из справочника (числовой id), организация
 * берётся из `GET /me/organization`; город, адрес, цена и ссылка в поля карточки
 * не входят. Группы, расписание и точки показываются из ответа сервера, медиа
 * грузится и удаляется здесь же. Пустая карточка создаётся через POST и приходит
 * со статусом `draft`.
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
}

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
  };
}

function fromCard(card: OwnerCardDetail): Draft {
  return {
    name: card.name ?? "",
    description: card.description ?? "",
    category_id:
      card.category_id === null || card.category_id === undefined ? "" : String(card.category_id),
    format: card.format ?? "",
    lesson_type: card.lesson_type ?? "",
    phone: card.phone ?? "",
  };
}

function nullableText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function validate(draft: Draft): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!draft.name.trim()) errors.name = "Название обязательно";
  const categoryId = Number(draft.category_id);
  if (draft.category_id.trim() === "" || !Number.isInteger(categoryId) || categoryId <= 0) {
    errors.category_id = "Выберите направление из справочника";
  }
  if (draft.format === "") errors.format = "Формат обязателен";
  return errors;
}

/**
 * `lesson_type` у услуги отсутствует вовсе (CHECK базы): ключ не отправляем.
 * Пустые необязательные строки — null, а не пустая строка.
 */
function toInput(draft: Draft, kind: ActivityKind, orgId: number): OwnerCardInput {
  return {
    name: draft.name.trim(),
    kind,
    org_id: orgId,
    category_id: Number(draft.category_id),
    description: nullableText(draft.description),
    format: draft.format as ActivityFormat,
    ...(kind === "service" ? {} : { lesson_type: draft.lesson_type === "" ? null : draft.lesson_type }),
    phone: nullableText(draft.phone),
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
  orgPhase,
  onCreated,
  onSaved,
  onClose,
}: {
  /** null — новая карточка: создаётся только после первого сохранения. */
  id: string | null;
  kind: ActivityKind;
  orgId?: number;
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
    const problems = validate(draft);
    setErrors(problems);
    setSaveError(null);
    if (Object.keys(problems).length > 0) return;
    if (!orgReady || orgId === undefined) {
      setSaveError(
        "Сохранение недоступно: сервер не подтвердил вашу организацию. Карточка требует org_id своей организации.",
      );
      return;
    }

    setSaving(true);
    try {
      const input = toInput(draft, kind, orgId);
      const card = id ? await updateMyActivity(id, input) : await createMyActivity(input);
      toast({
        title: id ? "Карточка сохранена" : "Черновик создан",
        description: id
          ? `Сервер вернул статус «${card.status}».`
          : `Карточка создана со статусом «${card.status}» — отправьте её на проверку из списка.`,
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
          ? "Карточка услуги: роль owner_service. Сохранение не публикует карточку — на проверку её отправляет владелец из списка."
          : "Карточка занятия: роль owner_activity. Сохранение не публикует карточку — на проверку её отправляет владелец из списка."}
      </p>

      {!orgReady ? (
        <p className="cabinetNotice" role="alert">
          <ShieldAlert size={14} />
          {orgPhase === "loading"
            ? "Проверяем вашу организацию на сервере — сохранение станет доступно после ответа."
            : orgPhase === "absent"
              ? "Карточка требует организацию: сервер ответил 404 — к аккаунту не привязана организация. Заведение организации выполняет модератор; без неё сохранить карточку нельзя."
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
          Город и адрес живут в профиле организации, цена и расписание — в группах и точках ниже:
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
  return (
    <div className="appFormField">
      <label className="fieldLabel" htmlFor={`card-${name}`}>
        {label}{" "}
        {required ? (
          <span className="fieldRequired">обязательно</span>
        ) : (
          <span className="fieldOptional">можно пусто</span>
        )}
      </label>
      {children}
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