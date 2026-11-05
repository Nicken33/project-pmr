"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUp,
  CalendarClock,
  Check,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  GripVertical,
  ImagePlus,
  MapPin,
  Phone,
  Plus,
  Save,
  Send,
  Trash2,
  X,
} from "lucide-react";
import type {
  ActivityFormat,
  ActivityKind,
  ActivityType,
  AgeGroup,
  Application,
  Category,
  City,
  District,
  Location,
  Organization,
  ScheduleRow,
  SuperCategory,
  Weekday,
} from "@/lib/types";
import { cn, plural } from "@/lib/utils";
import { useApp } from "@/components/providers/AppProviders";

const STEPS = [
  { id: "basic", label: "Основное" },
  { id: "groups", label: "Группы и расписание" },
  { id: "points", label: "Точки проведения" },
  { id: "contacts", label: "Контакты" },
  { id: "media", label: "Фото" },
] as const;

type StepId = (typeof STEPS)[number]["id"];

const DAYS: Weekday[] = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const DAY_NAMES: Record<Weekday, string> = {
  Пн: "понедельник",
  Вт: "вторник",
  Ср: "среда",
  Чт: "четверг",
  Пт: "пятница",
  Сб: "суббота",
  Вс: "воскресенье",
};
const PERIODS = ["тренировка", "месяц", "курс", "час", "визит", "занятие"] as const;
const MAX_SCHEDULE_ROWS = 7;
const MAX_MEDIA = 12;
const MEDIA_LONG_SIDE = 1600;
const MAX_VIDEO_SECONDS = 30;
/** Координаты Приднестровья с небольшим запасом — за ними метки нет смысла ставить. */
const PMR_BOUNDS = { latMin: 45.0, latMax: 47.9, lngMin: 27.6, lngMax: 30.6 };

type Draft = {
  slug: string;
  title: string;
  kind: ActivityKind;
  superSlug: string;
  categorySlug: string;
  format: ActivityFormat;
  type: ActivityType;
  serviceMode: "выезд" | "на месте" | "оба" | "";
  description: string;
  shortDescription: string;
  phone: string;
  messengers: Partial<Record<"telegram" | "viber" | "whatsapp" | "instagram", string>>;
  locations: Location[];
  groups: AgeGroup[];
  photos: string[];
  videos: string[];
};

type Errors = Record<string, string>;

function transliterate(value: string): string {
  const map: Record<string, string> = {
    а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i",
    й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t",
    у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "",
    э: "e", ю: "yu", я: "ya",
  };
  return value
    .toLowerCase()
    .split("")
    .map((char) => map[char] ?? char)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function emptyGroup(locationId: string): AgeGroup {
  return {
    id: `grp-${Math.random().toString(36).slice(2, 9)}`,
    ageFrom: 7,
    ageTo: 12,
    priceFrom: 0,
    pricePeriod: "месяц",
    locationId,
    schedule: [{ day: "Пн", start: "17:00", end: "18:30" }],
  };
}

function emptyLocation(citySlug: string): Location {
  return {
    id: `loc-${Math.random().toString(36).slice(2, 9)}`,
    citySlug,
    address: "",
    lat: 0,
    lng: 0,
  };
}

function toDraft(application: Application | null, fallbackOrg: Organization, citySlug: string): Draft {
  if (!application) {
    const location = emptyLocation(citySlug);
    return {
      slug: "",
      title: "",
      kind: "activity",
      superSlug: "",
      categorySlug: "",
      format: "offline",
      type: "group",
      serviceMode: "",
      description: "",
      shortDescription: "",
      phone: fallbackOrg.phone,
      messengers: {},
      locations: [location],
      groups: [emptyGroup(location.id)],
      photos: [],
      videos: [],
    };
  }
  return {
    slug: application.slug,
    title: application.title,
    kind: application.kind,
    superSlug: application.superSlug,
    categorySlug: application.categorySlug,
    format: application.format,
    type: application.type ?? "group",
    serviceMode: application.serviceMode ?? "",
    description: application.description,
    shortDescription: application.shortDescription ?? "",
    phone: application.phone ?? fallbackOrg.phone,
    messengers: {},
    locations: application.locations.map((location) => ({ ...location })),
    groups: application.groups.map((group) => ({
      ...group,
      schedule: group.schedule.map((row) => ({ ...row })),
    })),
    photos: [...application.photos],
    videos: [],
  };
}

function structureKey(draft: Draft): string {
  return JSON.stringify({
    locations: draft.locations.map((l) => [l.id, l.name, l.citySlug, l.districtSlug, l.address, l.lat, l.lng]),
    groups: draft.groups.map((g) => [
      g.id, g.title, g.ageFrom, g.ageTo, g.priceFrom, g.priceTo, g.pricePeriod, g.locationId, g.seats, g.schedule,
    ]),
  });
}

/** Телефон ПМР: +373 и ещё девять цифр, разделители не важны. */
function isPhone(value: string): boolean {
  const digits = value.trim().replace(/[^\d]/g, "");
  return digits.length === 11 && digits.startsWith("373");
}

/** jpg/png/webp сжимаем до 1600 px по длинной стороне (§8, таблица 7). */
async function normalizeImage(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const node = new Image();
      node.onload = () => resolve(node);
      node.onerror = () => reject(new Error("read-failed"));
      node.src = url;
    });
    const longSide = Math.max(image.naturalWidth, image.naturalHeight);
    if (longSide <= MEDIA_LONG_SIDE) return url;
    const scale = MEDIA_LONG_SIDE / longSide;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(image.naturalWidth * scale);
    canvas.height = Math.round(image.naturalHeight * scale);
    const context = canvas.getContext("2d");
    if (!context) return url;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.86));
    if (!blob) return url;
    URL.revokeObjectURL(url);
    return URL.createObjectURL(blob);
  } catch {
    return url;
  }
}

async function readVideoSeconds(file: File): Promise<number> {
  const url = URL.createObjectURL(file);
  try {
    const video = await new Promise<HTMLVideoElement>((resolve, reject) => {
      const node = document.createElement("video");
      node.preload = "metadata";
      node.onloadedmetadata = () => resolve(node);
      node.onerror = () => reject(new Error("read-failed"));
      node.src = url;
    });
    return Number.isFinite(video.duration) ? video.duration : 0;
  } catch {
    return 0;
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
}

export function ApplicationForm({
  application,
  organizations,
  categories,
  superCategories,
  cities,
  districts,
}: {
  application: Application | null;
  organizations: Organization[];
  categories: Category[];
  superCategories: SuperCategory[];
  cities: City[];
  districts: District[];
}) {
  const { user, toast } = useApp();
  const router = useRouter();
  const organization =
    organizations.find((item) => item.slug === application?.organizationSlug) ?? organizations[0];
  const draftKey = `talentro:application-draft:${application?.id ?? "new"}`;

  const [step, setStep] = useState<StepId>("basic");
  const [draft, setDraft] = useState<Draft>(() =>
    toDraft(application, organization, cities[0]?.slug ?? "tiraspol"),
  );
  const [errors, setErrors] = useState<Errors>({});
  const [restored, setRestored] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [mediaBusy, setMediaBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  /* Черновик анкеты хранится в localStorage и доступен только на клиенте. */
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(draftKey);
      if (!raw) return;
      const stored = JSON.parse(raw) as { savedAt: string; draft: Draft };
      if (Date.now() - new Date(stored.savedAt).getTime() > 7 * 864e5) return;
      setDraft(stored.draft);
      setRestored(true);
    } catch {
      // повреждённый черновик игнорируем: анкета соберётся заново
    }
  }, [draftKey]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const availableCategories = useMemo(
    () =>
      categories.filter(
        (category) =>
          (!draft.superSlug || category.superSlug === draft.superSlug) &&
          (category.kind === "both" || category.kind === draft.kind),
      ),
    [categories, draft.superSlug, draft.kind],
  );

  const districtsFor = (citySlug: string) => districts.filter((d) => d.citySlug === citySlug);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!current[key as string]) return current;
      const next = { ...current };
      delete next[key as string];
      return next;
    });
  };

  const patchLocation = (id: string, patch: Partial<Location>) => {
    setDraft((current) => ({
      ...current,
      locations: current.locations.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    }));
  };

  const patchGroup = (id: string, patch: Partial<AgeGroup>) => {
    setDraft((current) => ({
      ...current,
      groups: current.groups.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    }));
  };

  const patchSchedule = (groupId: string, index: number, patch: Partial<ScheduleRow>) => {
    setDraft((current) => ({
      ...current,
      groups: current.groups.map((group) =>
        group.id !== groupId
          ? group
          : { ...group, schedule: group.schedule.map((row, i) => (i === index ? { ...row, ...patch } : row)) },
      ),
    }));
  };

  const validateStep = (target: StepId, value: Draft = draft): Errors => {
    const found: Errors = {};
    const int = (raw: unknown): raw is number => Number.isInteger(raw) && Number(raw) >= 0;

    if (target === "basic") {
      if (value.title.trim().length < 4) found.title = "Название — минимум 4 знака: по нему ищут карточку.";
      if (!value.categorySlug) found.categorySlug = "Выберите направление — одна карточка = одно направление.";
      if (value.kind === "activity" && !value.type) found.type = "Укажите тип: индивидуальная, групповая или оба.";
      if (value.description.trim().length > 600) found.description = "Описание длиннее 600 знаков — сократите.";
      if (value.shortDescription.trim().length > 120)
        found.shortDescription = "Короткое описание — до 120 знаков, оно в карточке списка.";
    }

    if (target === "groups") {
      if (!value.groups.length) found.groups = "Группа нужна хотя бы одна — без неё карточку не публикуем.";
      value.groups.forEach((group, index) => {
        const at = `Группа ${index + 1}`;
        if (value.kind === "activity") {
          if (!int(group.ageFrom)) found[`groups.${group.id}.ageFrom`] = `${at}: возраст от — целое число лет.`;
          if (!int(group.ageTo)) found[`groups.${group.id}.ageTo`] = `${at}: возраст до — целое число лет.`;
          if (int(group.ageFrom) && int(group.ageTo) && group.ageTo < group.ageFrom)
            found[`groups.${group.id}.ageTo`] = `${at}: верхняя граница не меньше нижней.`;
          if (!group.schedule.length)
            found[`groups.${group.id}.schedule`] = `${at}: нужна хотя бы одна строка расписания.`;
          if (group.schedule.length > MAX_SCHEDULE_ROWS)
            found[`groups.${group.id}.schedule`] = `${at}: максимум ${MAX_SCHEDULE_ROWS} строк — по одной на день.`;
          group.schedule.forEach((row, rowIndex) => {
            if (!row.start || !row.end)
              found[`groups.${group.id}.row.${rowIndex}`] = `${at}, строка ${rowIndex + 1}: начало и конец обязательны.`;
            else if (row.end <= row.start)
              found[`groups.${group.id}.row.${rowIndex}`] = `${at}, строка ${rowIndex + 1}: конец позже начала.`;
          });
        }
        if (!int(group.priceFrom))
          found[`groups.${group.id}.priceFrom`] = `${at}: цена от — целые рубли ПМР, 0 = бесплатно.`;
        if ((group.priceFrom ?? 0) > 0 && !group.pricePeriod)
          found[`groups.${group.id}.pricePeriod`] = `${at}: укажите период — тренировка, месяц или курс.`;
        if (int(group.priceTo) && int(group.priceFrom) && group.priceTo < group.priceFrom)
          found[`groups.${group.id}.priceTo`] = `${at}: цена до не меньше цены от.`;
        if (!value.locations.some((location) => location.id === group.locationId))
          found[`groups.${group.id}.locationId`] = `${at}: выберите точку проведения — без неё группа не публикуется.`;
      });
    }

    if (target === "points") {
      if (!value.locations.length) found.locations = "Точка нужна хотя бы одна — по адресу ищут рядом с домом.";
      value.locations.forEach((location, index) => {
        const at = `Точка ${index + 1}`;
        if (!location.citySlug) found[`locations.${location.id}.citySlug`] = `${at}: город из справочника.`;
        if (location.address.trim().length < 5)
          found[`locations.${location.id}.address`] = `${at}: улица и дом без города — минимум 5 знаков.`;
        const hasLat = Boolean(location.lat);
        const hasLng = Boolean(location.lng);
        if (!hasLat && !hasLng) {
          found[`locations.${location.id}.coords`] = `${at}: координаты нужны для метки и «рядом со мной».`;
        } else if (hasLat !== hasLng) {
          found[`locations.${location.id}.coords`] = `${at}: широта и долгота заполняются вместе.`;
        } else if (
          location.lat < PMR_BOUNDS.latMin ||
          location.lat > PMR_BOUNDS.latMax ||
          location.lng < PMR_BOUNDS.lngMin ||
          location.lng > PMR_BOUNDS.lngMax
        ) {
          found[`locations.${location.id}.coords`] = `${at}: координаты вне Приднестровья — проверьте значения.`;
        }
        if (location.phone && !isPhone(location.phone))
          found[`locations.${location.id}.phone`] = `${at}: формат +373 777 12345.`;
      });
    }

    if (target === "contacts") {
      if (value.phone && !isPhone(value.phone))
        found.phone = "Формат телефона: +373 777 12345.";
      const filled = Object.values(value.messengers).filter(Boolean).length;
      if (filled > 4) found.messengers = "Мессенджеров максимум четыре — по одному на тип.";
    }

    return found;
  };

  const stepErrorCount = (target: StepId) => Object.keys(validateStep(target)).length;

  const goNext = () => {
    const found = validateStep(step);
    setErrors((current) => ({ ...current, ...found }));
    if (Object.keys(found).length) {
      toast({
        title: "Проверьте поля шага",
        description: "Подсвечено то, без чего анкета не пройдёт валидацию.",
        tone: "danger",
      });
      return;
    }
    const index = STEPS.findIndex((item) => item.id === step);
    if (index < STEPS.length - 1) setStep(STEPS[index + 1].id);
  };

  const goPrev = () => {
    const index = STEPS.findIndex((item) => item.id === step);
    if (index > 0) setStep(STEPS[index - 1].id);
  };

  const saveDraft = () => {
    try {
      window.localStorage.setItem(draftKey, JSON.stringify({ savedAt: new Date().toISOString(), draft }));
      toast({
        title: "Черновик сохранён",
        description: "Он лежит в этом браузере и не виден модератору, пока не отправите анкету.",
        tone: "success",
      });
    } catch {
      toast({ title: "Черновик не сохранён", description: "Браузер запретил локальное хранение.", tone: "danger" });
    }
  };

  const submit = () => {
    const all: Errors = {
      ...validateStep("basic", draft),
      ...validateStep("groups", draft),
      ...validateStep("points", draft),
      ...validateStep("contacts", draft),
    };
    if (!draft.photos.length) all.photos = "Добавьте хотя бы одно фото — первое станет обложкой.";
    setErrors(all);
    if (Object.keys(all).length) {
      const firstStep = STEPS.find((item) => Object.keys(validateStep(item.id, draft)).length > 0)?.id ?? "media";
      setStep(firstStep);
      toast({ title: "Анкета не сохранена", description: "Есть незаполненные обязательные поля.", tone: "danger" });
      return;
    }
    const touchedStructure = structureKey(draft) !== structureKey(toDraft(application, organization, cities[0]?.slug ?? "tiraspol"));
    toast({
      title: application ? "Изменения остались в этом браузере" : "Анкета осталась в этом браузере",
      description: touchedStructure
        ? "Сервера приёма анкет ещё нет: карточка в каталоге не меняется, в очередь на проверку ничего не попало, черновик сохранён."
        : "Сервера приёма анкет ещё нет: модератор текст не получит, поэтому и срок ответа обещать нечем. Черновик сохранён.",
      tone: "default",
    });
    window.setTimeout(() => {
      router.push("/account");
    }, 900);
  };

  const addMedia = async (files: FileList | null) => {
    if (!files || !files.length) return;
    setMediaBusy(true);
    const accepted: string[] = [];
    const videoUrls: string[] = [];
    for (const file of Array.from(files)) {
      if (draft.photos.length + accepted.length >= MAX_MEDIA) {
        toast({ title: `Максимум ${MAX_MEDIA} файлов`, description: "Первые по порядку — обложка.", tone: "danger" });
        break;
      }
      if (/^image\/(jpeg|png|webp)$/.test(file.type)) {
        accepted.push(await normalizeImage(file));
      } else if (file.type === "video/mp4") {
        const seconds = await readVideoSeconds(file);
        if (seconds > MAX_VIDEO_SECONDS) {
          toast({
            title: "Видео длиннее 30 секунд",
            description: `Сейчас ${seconds.toFixed(1)} с — сократите ролик перед загрузкой.`,
            tone: "danger",
          });
          continue;
        }
        const url = URL.createObjectURL(file);
        accepted.push(url);
        videoUrls.push(url);
      } else {
        toast({
          title: "Формат не подходит",
          description: "jpg, png, webp или mp4 — других форматов анкета не принимает.",
          tone: "danger",
        });
      }
    }
    if (accepted.length) {
      setDraft((current) => ({
        ...current,
        photos: [...current.photos, ...accepted],
        videos: [...current.videos, ...videoUrls],
      }));
      setErrors((current) => {
        const next = { ...current };
        delete next.photos;
        return next;
      });
    }
    setMediaBusy(false);
    if (fileInput.current) fileInput.current.value = "";
  };

  const moveMedia = (from: number, to: number) => {
    if (to < 0 || to >= draft.photos.length) return;
    setDraft((current) => {
      const next = [...current.photos];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return { ...current, photos: next };
    });
  };

  if (!user) {
    return (
      <div className="cabinetGate container">
        <span className="cabinetGateIcon">
          <AlertTriangle size={24} />
        </span>
        <h1>Анкету создаёт владелец</h1>
        <p>
          Гостям форма недоступна: анкета привязывается к организации и заводится из кабинета.
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

  return (
    <div className="appForm container">
      <nav className="breadcrumbs" aria-label="Хлебные крошки">
        <Link href="/account">
          <ArrowLeft size={14} /> Кабинет владельца
        </Link>
        <span>/</span>
        <span>{application ? "Правка анкеты" : "Новая анкета"}</span>
      </nav>

      <header className="appFormHead">
        <div>
          <h1>{application ? application.title : "Новая анкета"}</h1>
          <p className="appFormSub">
            {organization.name} · шаг {STEPS.findIndex((item) => item.id === step) + 1} из {STEPS.length}:{" "}
            {STEPS.find((item) => item.id === step)?.label}
          </p>
        </div>
        <div className="appFormHeadActions">
          <button type="button" className="btn btn--soft" onClick={saveDraft}>
            <Save size={16} /> Сохранить черновик
          </button>
        </div>
      </header>

      {restored ? (
        <p className="appFormNotice">
          <Save size={14} /> Восстановлен несохранённый черновик из этого браузера.{" "}
          <button type="button" className="linkButton" onClick={() => {
            try {
              window.localStorage.removeItem(draftKey);
            } catch {
              // нечего удалять
            }
            setDraft(toDraft(application, organization, cities[0]?.slug ?? "tiraspol"));
            setRestored(false);
          }}>
            Сбросить
          </button>
        </p>
      ) : null}

      {application ? (
        <p className="appFormStatus">
          <span className={cn("statusPill", `statusPill--${application.status}`)}>
            {application.status === "published"
              ? "Опубликовано"
              : application.status === "pending"
                ? "На проверке"
                : application.status === "rejected"
                  ? "Отклонено"
                  : "Черновик"}
          </span>
          {application.status === "rejected" && application.rejectReason
            ? ` Причина отказа: ${application.rejectReason}`
            : " Любая правка группы или точки возвращает карточку в очередь модерации."}
        </p>
      ) : null}

      <ol className="appFormSteps" aria-label="Шаги анкеты">
        {STEPS.map((item, index) => {
          const issues = stepErrorCount(item.id);
          const isDone =
            index < STEPS.findIndex((current) => current.id === step) && issues === 0;
          return (
            <li key={item.id}>
              <button
                type="button"
                className={cn(
                  "appFormStep",
                  step === item.id && "isActive",
                  isDone && "isDone",
                  issues > 0 && !isDone && "hasIssue",
                )}
                onClick={() => setStep(item.id)}
              >
                <span className="appFormStepIndex">{isDone ? <Check size={13} /> : index + 1}</span>
                <span className="appFormStepLabel">{item.label}</span>
                {issues > 0 && !isDone ? <span className="appFormStepBadge">{issues}</span> : null}
              </button>
            </li>
          );
        })}
      </ol>

      <div className="appFormBody">
        {step === "basic" ? (
          <section className="appFormFieldset" aria-label="Основное">
            <div className="appFormField appFormField--wide">
              <label className="fieldLabel" htmlFor="f-title">
                Название <span className="fieldRequired">обязательно</span>
              </label>
              <input
                id="f-title"
                className={cn("fieldInput", errors.title && "fieldInput--error")}
                value={draft.title}
                maxLength={90}
                onChange={(event) => {
                  const next = event.target.value;
                  setDraft((current) => ({
                    ...current,
                    title: next,
                    slug: application ? current.slug : transliterate(next),
                  }));
                  setErrors((current) => {
                    const copy = { ...current };
                    delete copy.title;
                    return copy;
                  });
                }}
                placeholder="Например: Футбольная секция для детей 7–12 лет"
              />
              {errors.title ? <p className="formHint formHint--error">{errors.title}</p> : null}
            </div>

            <div className="appFormField appFormField--wide">
              <span className="fieldLabel">
                Ссылка на карточку <span className="fieldOptional">правит модератор</span>
              </span>
              <p className="appFormSlug">/activities/{draft.slug || "название-появится-здесь"}</p>
              <p className="formHint">
                Генерируется из названия, строчные латиница, цифры и дефис. Занятый адрес не
                переиспользуется.
              </p>
            </div>

            <div className="appFormField">
              <span className="fieldLabel">
                Тип записи <span className="fieldRequired">обязательно</span>
              </span>
              <div className="segmented" role="group" aria-label="Тип записи">
                {(["activity", "service"] as ActivityKind[]).map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    className={cn("segment", draft.kind === kind && "isActive")}
                    aria-pressed={draft.kind === kind}
                    onClick={() => set("kind", kind)}
                  >
                    {kind === "activity" ? "Занятие" : "Услуга"}
                  </button>
                ))}
              </div>
              <p className="formHint">
                {draft.kind === "service"
                  ? "У услуги нет возраста и расписания: одна группа и обычно одна точка."
                  : "Группы и точки живут внутри карточки: секция с тремя группами в двух залах — одна анкета."}
              </p>
            </div>

            <div className="appFormField">
              <label className="fieldLabel" htmlFor="f-super">
                Наднаправление
              </label>
              <select
                id="f-super"
                className="fieldSelect"
                value={draft.superSlug}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, superSlug: event.target.value, categorySlug: "" }))
                }
              >
                <option value="">Все наднаправления</option>
                {superCategories.map((item) => (
                  <option key={item.slug} value={item.slug}>
                    {item.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="appFormField">
              <label className="fieldLabel" htmlFor="f-category">
                Направление <span className="fieldRequired">обязательно</span>
              </label>
              <select
                id="f-category"
                className={cn("fieldSelect", errors.categorySlug && "fieldInput--error")}
                value={draft.categorySlug}
                onChange={(event) => set("categorySlug", event.target.value)}
              >
                <option value="">Выберите направление</option>
                {availableCategories.map((item) => (
                  <option key={item.slug} value={item.slug}>
                    {item.title}
                  </option>
                ))}
                <option value="drugoe">Другое</option>
              </select>
              {errors.categorySlug ? (
                <p className="formHint formHint--error">{errors.categorySlug}</p>
              ) : (
                <p className="formHint">Одна карточка — одно направление, не три тега.</p>
              )}
            </div>

            <div className="appFormField">
              <label className="fieldLabel" htmlFor="f-format">
                Формат <span className="fieldRequired">обязательно</span>
              </label>
              <select
                id="f-format"
                className="fieldSelect"
                value={draft.format}
                onChange={(event) => set("format", event.target.value as ActivityFormat)}
              >
                <option value="offline">Офлайн</option>
                <option value="online">Онлайн</option>
                <option value="both">Онлайн и офлайн</option>
              </select>
            </div>

            {draft.kind === "activity" ? (
              <div className="appFormField">
                <label className="fieldLabel" htmlFor="f-type">
                  Тип занятий <span className="fieldRequired">обязательно</span>
                </label>
                <select
                  id="f-type"
                  className={cn("fieldSelect", errors.type && "fieldInput--error")}
                  value={draft.type}
                  onChange={(event) => set("type", event.target.value as ActivityType)}
                >
                  <option value="group">Групповая</option>
                  <option value="individual">Индивидуальная</option>
                  <option value="both">Индивидуальная и групповая</option>
                </select>
              </div>
            ) : (
              <div className="appFormField">
                <label className="fieldLabel" htmlFor="f-service-mode">
                  Выезд или на месте
                </label>
                <select
                  id="f-service-mode"
                  className="fieldSelect"
                  value={draft.serviceMode}
                  onChange={(event) =>
                    set("serviceMode", event.target.value as Draft["serviceMode"])
                  }
                >
                  <option value="">Не указано</option>
                  <option value="на месте">Клиент приходит сам</option>
                  <option value="выезд">Выезжаем к клиенту</option>
                  <option value="оба">И так, и так</option>
                </select>
              </div>
            )}

            <div className="appFormField appFormField--wide">
              <label className="fieldLabel" htmlFor="f-short">
                Короткое описание <span className="fieldOptional">до 120 знаков</span>
              </label>
              <input
                id="f-short"
                className={cn("fieldInput", errors.shortDescription && "fieldInput--error")}
                value={draft.shortDescription}
                maxLength={120}
                onChange={(event) => set("shortDescription", event.target.value)}
                placeholder="Одно предложение, которое видно в карточке списка"
              />
              {errors.shortDescription ? (
                <p className="formHint formHint--error">{errors.shortDescription}</p>
              ) : null}
            </div>

            <div className="appFormField appFormField--wide">
              <label className="fieldLabel" htmlFor="f-description">
                Описание <span className="fieldOptional">своими словами</span>
              </label>
              <textarea
                id="f-description"
                className={cn("textarea", errors.description && "fieldInput--error")}
                rows={5}
                maxLength={600}
                value={draft.description}
                onChange={(event) => set("description", event.target.value)}
                placeholder="Что происходит на занятии, кому подходит, чем отличается от соседних анкет."
              />
              <p className="formHint">
                {draft.description.trim().length}/600 · без описания блок просто не показываем.
              </p>
              {errors.description ? <p className="formHint formHint--error">{errors.description}</p> : null}
            </div>
          </section>
        ) : null}

        {step === "groups" ? (
          <section className="appFormFieldset" aria-label="Группы и расписание">
            <div className="appFormSetHead">
              <h2>Группы</h2>
              <button
                type="button"
                className="btn btn--soft btn--sm"
                onClick={() =>
                  setDraft((current) => ({
                    ...current,
                    groups: [...current.groups, emptyGroup(current.locations[0]?.id ?? "pending")],
                  }))
                }
              >
                <Plus size={15} /> Группа
              </button>
            </div>
            <p className="appFormSetHint">
              Название, возраст, цена, расписание — у группы. Точка на группу одна: те же часы в
              другом зале заводят отдельной группой.
            </p>

            {draft.groups.map((group, index) => {
              const canDelete = draft.groups.length > 1;
              return (
                <article className="appFormCard" key={group.id}>
                  <div className="appFormCardHead">
                    <h3>Группа {index + 1}</h3>
                    <div className="appFormCardActions">
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm"
                        disabled={!canDelete}
                        title={
                          canDelete
                            ? "Удалить группу"
                            : "Последняя группа не удаляется — в анкете их минимум одна"
                        }
                        onClick={() =>
                          canDelete &&
                          setDraft((current) => ({
                            ...current,
                            groups: current.groups.filter((item) => item.id !== group.id),
                          }))
                        }
                      >
                        <Trash2 size={14} /> Удалить
                      </button>
                    </div>
                  </div>

                  <div className="appFormGrid">
                    <div className="appFormField">
                      <label className="fieldLabel" htmlFor={`g-title-${group.id}`}>
                        Название <span className="fieldOptional">можно пусто</span>
                      </label>
                      <input
                        id={`g-title-${group.id}`}
                        className="fieldInput"
                        value={group.title ?? ""}
                        maxLength={40}
                        placeholder="старшая группа"
                        onChange={(event) =>
                          patchGroup(group.id, {
                            title: event.target.value || undefined,
                          })
                        }
                      />
                      <p className="formHint">Пусто — в карточке показываем возраст.</p>
                    </div>

                    {draft.kind === "activity" ? (
                      <>
                        <div className="appFormField">
                          <label className="fieldLabel" htmlFor={`g-from-${group.id}`}>
                            Возраст от <span className="fieldRequired">обязательно</span>
                          </label>
                          <input
                            id={`g-from-${group.id}`}
                            className={cn(
                              "fieldInput",
                              errors[`groups.${group.id}.ageFrom`] && "fieldInput--error",
                            )}
                            type="number"
                            min={0}
                            max={99}
                            value={group.ageFrom ?? ""}
                            onChange={(event) =>
                              patchGroup(group.id, {
                                ageFrom: event.target.value === "" ? null : Number(event.target.value),
                              })
                            }
                          />
                        </div>
                        <div className="appFormField">
                          <label className="fieldLabel" htmlFor={`g-to-${group.id}`}>
                            Возраст до <span className="fieldRequired">обязательно</span>
                          </label>
                          <input
                            id={`g-to-${group.id}`}
                            className={cn(
                              "fieldInput",
                              errors[`groups.${group.id}.ageTo`] && "fieldInput--error",
                            )}
                            type="number"
                            min={0}
                            max={99}
                            value={group.ageTo ?? ""}
                            onChange={(event) =>
                              patchGroup(group.id, {
                                ageTo: event.target.value === "" ? null : Number(event.target.value),
                              })
                            }
                          />
                          <p className="formHint">Без верхней границы: 18 для детских, 99 для взрослых.</p>
                        </div>
                      </>
                    ) : null}

                    <div className="appFormField">
                      <label className="fieldLabel" htmlFor={`g-price-${group.id}`}>
                        Цена от, руб. ПМР <span className="fieldRequired">обязательно</span>
                      </label>
                      <input
                        id={`g-price-${group.id}`}
                        className={cn(
                          "fieldInput",
                          errors[`groups.${group.id}.priceFrom`] && "fieldInput--error",
                        )}
                        type="number"
                        min={0}
                        step={10}
                        value={group.priceFrom ?? ""}
                        onChange={(event) =>
                          patchGroup(group.id, {
                            priceFrom: event.target.value === "" ? null : Number(event.target.value),
                          })
                        }
                      />
                      <p className="formHint">0 = бесплатно — в карточке выйдет плашкой.</p>
                    </div>

                    <div className="appFormField">
                      <label className="fieldLabel" htmlFor={`g-price-to-${group.id}`}>
                        Цена до <span className="fieldOptional">если разная</span>
                      </label>
                      <input
                        id={`g-price-to-${group.id}`}
                        className={cn(
                          "fieldInput",
                          errors[`groups.${group.id}.priceTo`] && "fieldInput--error",
                        )}
                        type="number"
                        min={0}
                        step={10}
                        value={group.priceTo ?? ""}
                        onChange={(event) =>
                          patchGroup(group.id, {
                            priceTo: event.target.value === "" ? undefined : Number(event.target.value),
                          })
                        }
                      />
                    </div>

                    <div className="appFormField">
                      <label className="fieldLabel" htmlFor={`g-period-${group.id}`}>
                        За какой период{" "}
                        {group.priceFrom !== null && group.priceFrom > 0 ? (
                          <span className="fieldRequired">обязательно</span>
                        ) : (
                          <span className="fieldOptional">не нужно при 0</span>
                        )}
                      </label>
                      <select
                        id={`g-period-${group.id}`}
                        className={cn(
                          "fieldSelect",
                          errors[`groups.${group.id}.pricePeriod`] && "fieldInput--error",
                        )}
                        value={group.pricePeriod ?? ""}
                        onChange={(event) =>
                          patchGroup(group.id, {
                            pricePeriod: (event.target.value || undefined) as AgeGroup["pricePeriod"],
                          })
                        }
                      >
                        <option value="">Без периода</option>
                        {PERIODS.map((period) => (
                          <option key={period} value={period}>
                            {period}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="appFormField">
                      <label className="fieldLabel" htmlFor={`g-seats-${group.id}`}>
                        Сколько мест <span className="fieldOptional">можно пусто</span>
                      </label>
                      <input
                        id={`g-seats-${group.id}`}
                        className="fieldInput"
                        type="number"
                        min={1}
                        value={group.seats ?? ""}
                        onChange={(event) =>
                          patchGroup(group.id, {
                            seats: event.target.value === "" ? undefined : Number(event.target.value),
                          })
                        }
                      />
                      <p className="formHint">Пусто — «осталось N мест» не показываем.</p>
                    </div>

                    <div className="appFormField appFormField--wide">
                      <label className="fieldLabel" htmlFor={`g-loc-${group.id}`}>
                        Точка проведения <span className="fieldRequired">обязательно</span>
                      </label>
                      <select
                        id={`g-loc-${group.id}`}
                        className={cn(
                          "fieldSelect",
                          errors[`groups.${group.id}.locationId`] && "fieldInput--error",
                        )}
                        value={group.locationId}
                        onChange={(event) => patchGroup(group.id, { locationId: event.target.value })}
                      >
                        {draft.locations.map((location, locationIndex) => (
                          <option key={location.id} value={location.id}>
                            {location.name || location.address || `Точка ${locationIndex + 1}`} ·{" "}
                            {cities.find((city) => city.slug === location.citySlug)?.title ?? "город не выбран"}
                          </option>
                        ))}
                      </select>
                      {errors[`groups.${group.id}.locationId`] ? (
                        <p className="formHint formHint--error">{errors[`groups.${group.id}.locationId`]}</p>
                      ) : (
                        <p className="formHint">
                          Точки добавляются на шаге «Точки проведения» — они принадлежат организации.
                        </p>
                      )}
                    </div>
                  </div>

                  {draft.kind === "activity" ? (
                    <div className="appFormSchedule">
                      <div className="appFormSetHead">
                        <h4>
                          <CalendarClock size={15} /> Расписание
                        </h4>
                        <button
                          type="button"
                          className="btn btn--soft btn--sm"
                          disabled={group.schedule.length >= MAX_SCHEDULE_ROWS}
                          title={
                            group.schedule.length >= MAX_SCHEDULE_ROWS
                              ? `Максимум ${MAX_SCHEDULE_ROWS} строк — по одной на день недели`
                              : "Добавить строку расписания"
                          }
                          onClick={() =>
                            patchGroup(group.id, {
                              schedule: [
                                ...group.schedule,
                                { day: DAYS[Math.min(group.schedule.length, 6)], start: "17:00", end: "18:30" },
                              ],
                            })
                          }
                        >
                          <Plus size={15} /> Строка
                        </button>
                      </div>
                      <p className="appFormSetHint">
                        «Пн, Ср, Пт 17:00–18:30» — это три строки. Фильтр «день и время» работает
                        только по ним, одной текстовой строчкой расписание не считается.
                      </p>
                      {group.schedule.map((row, rowIndex) => {
                        const rowError = errors[`groups.${group.id}.row.${rowIndex}`];
                        return (
                          <div className="appFormRow" key={`${group.id}-${rowIndex}`}>
                            <select
                              className="fieldSelect appFormRowDay"
                              value={row.day}
                              aria-label={`День недели, строка ${rowIndex + 1}`}
                              onChange={(event) =>
                                patchSchedule(group.id, rowIndex, { day: event.target.value as Weekday })
                              }
                            >
                              {DAYS.map((day) => (
                                <option key={day} value={day}>
                                  {day} — {DAY_NAMES[day]}
                                </option>
                              ))}
                            </select>
                            <input
                              className={cn("fieldInput appFormRowTime", rowError && "fieldInput--error")}
                              type="time"
                              value={row.start}
                              aria-label={`Начало, строка ${rowIndex + 1}`}
                              onChange={(event) =>
                                patchSchedule(group.id, rowIndex, { start: event.target.value })
                              }
                            />
                            <input
                              className={cn("fieldInput appFormRowTime", rowError && "fieldInput--error")}
                              type="time"
                              value={row.end}
                              aria-label={`Конец, строка ${rowIndex + 1}`}
                              onChange={(event) =>
                                patchSchedule(group.id, rowIndex, { end: event.target.value })
                              }
                            />
                            <input
                              className="fieldInput appFormRowNote"
                              value={row.note ?? ""}
                              maxLength={60}
                              placeholder="примечание, как пример: сбор в 16:45"
                              aria-label={`Примечание, строка ${rowIndex + 1}`}
                              onChange={(event) =>
                                patchSchedule(group.id, rowIndex, {
                                  note: event.target.value || undefined,
                                })
                              }
                            />
                            <button
                              type="button"
                              className="appFormRowRemove"
                              disabled={group.schedule.length <= 1}
                              title={
                                group.schedule.length <= 1
                                  ? "У группы минимум одна строка расписания"
                                  : "Убрать строку"
                              }
                              aria-label={`Убрать строку ${rowIndex + 1}`}
                              onClick={() =>
                                group.schedule.length > 1 &&
                                patchGroup(group.id, {
                                  schedule: group.schedule.filter((_, i) => i !== rowIndex),
                                })
                              }
                            >
                              <X size={15} />
                            </button>
                          </div>
                        );
                      })}
                      {firstRowError(errors, group.id) ? (
                        <p className="formHint formHint--error">{firstRowError(errors, group.id)}</p>
                      ) : null}
                      {errors[`groups.${group.id}.schedule`] ? (
                        <p className="formHint formHint--error">{errors[`groups.${group.id}.schedule`]}</p>
                      ) : null}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </section>
        ) : null}

        {step === "points" ? (
          <section className="appFormFieldset" aria-label="Точки проведения">
            <div className="appFormSetHead">
              <h2>Точки проведения</h2>
              <button
                type="button"
                className="btn btn--soft btn--sm"
                onClick={() =>
                  setDraft((current) => ({
                    ...current,
                    locations: [...current.locations, emptyLocation(current.locations[0]?.citySlug ?? cities[0]?.slug ?? "tiraspol")],
                  }))
                }
              >
                <Plus size={15} /> Точка
              </button>
            </div>
            <p className="appFormSetHint">
              Точки общие для организации, занятие выбирает нужные. Филиал — точка внутри этой же
              анкеты, а не вторая карточка.
            </p>

            {draft.locations.map((location, index) => {
              const canDelete = draft.locations.length > 1;
              const cityDistricts = districtsFor(location.citySlug);
              return (
                <article className="appFormCard" key={location.id}>
                  <div className="appFormCardHead">
                    <h3>
                      <MapPin size={15} /> Точка {index + 1}
                    </h3>
                    <div className="appFormCardActions">
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm"
                        disabled={!canDelete}
                        title={canDelete ? "Удалить точку" : "Последняя точка не удаляется — в анкете их минимум одна"}
                        onClick={() =>
                          canDelete &&
                          setDraft((current) => {
                            const locations = current.locations.filter((item) => item.id !== location.id);
                            return {
                              ...current,
                              locations,
                              groups: current.groups.map((group) =>
                                group.locationId === location.id
                                  ? { ...group, locationId: locations[0].id }
                                  : group,
                              ),
                            };
                          })
                        }
                      >
                        <Trash2 size={14} /> Удалить
                      </button>
                    </div>
                  </div>

                  <div className="appFormGrid">
                    <div className="appFormField">
                      <label className="fieldLabel" htmlFor={`l-name-${location.id}`}>
                        Название <span className="fieldOptional">можно пусто</span>
                      </label>
                      <input
                        id={`l-name-${location.id}`}
                        className="fieldInput"
                        maxLength={40}
                        value={location.name ?? ""}
                        placeholder="Основной зал"
                        onChange={(event) =>
                          patchLocation(location.id, { name: event.target.value || undefined })
                        }
                      />
                      <p className="formHint">Пусто — показываем адрес.</p>
                    </div>

                    <div className="appFormField">
                      <label className="fieldLabel" htmlFor={`l-city-${location.id}`}>
                        Город <span className="fieldRequired">обязательно</span>
                      </label>
                      <select
                        id={`l-city-${location.id}`}
                        className={cn(
                          "fieldSelect",
                          errors[`locations.${location.id}.citySlug`] && "fieldInput--error",
                        )}
                        value={location.citySlug}
                        onChange={(event) =>
                          patchLocation(location.id, {
                            citySlug: event.target.value,
                            districtSlug: undefined,
                          })
                        }
                      >
                        {cities.map((city) => (
                          <option key={city.slug} value={city.slug}>
                            {city.title}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="appFormField">
                      <label className="fieldLabel" htmlFor={`l-district-${location.id}`}>
                        Район{" "}
                        <span className="fieldOptional">
                          {cityDistricts.length ? "необязательно" : "в этом городе районов нет"}
                        </span>
                      </label>
                      <select
                        id={`l-district-${location.id}`}
                        className="fieldSelect"
                        value={location.districtSlug ?? ""}
                        disabled={!cityDistricts.length}
                        onChange={(event) =>
                          patchLocation(location.id, {
                            districtSlug: event.target.value || undefined,
                          })
                        }
                      >
                        <option value="">Без района</option>
                        {cityDistricts.map((district) => (
                          <option key={district.slug} value={district.slug}>
                            {district.title}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="appFormField appFormField--wide">
                      <label className="fieldLabel" htmlFor={`l-address-${location.id}`}>
                        Адрес <span className="fieldRequired">обязательно</span>
                      </label>
                      <input
                        id={`l-address-${location.id}`}
                        className={cn(
                          "fieldInput",
                          errors[`locations.${location.id}.address`] && "fieldInput--error",
                        )}
                        maxLength={90}
                        value={location.address}
                        placeholder="ул. 10 лет Победы, 3"
                        onChange={(event) => patchLocation(location.id, { address: event.target.value })}
                      />
                      <p className="formHint">Улица и дом, без города — он уже в справочнике.</p>
                      {errors[`locations.${location.id}.address`] ? (
                        <p className="formHint formHint--error">{errors[`locations.${location.id}.address`]}</p>
                      ) : null}
                    </div>

                    <div className="appFormField">
                      <label className="fieldLabel" htmlFor={`l-lat-${location.id}`}>
                        Широта <span className="fieldRequired">для публикации</span>
                      </label>
                      <input
                        id={`l-lat-${location.id}`}
                        className={cn(
                          "fieldInput",
                          errors[`locations.${location.id}.coords`] && "fieldInput--error",
                        )}
                        type="number"
                        step="0.00001"
                        value={location.lat || ""}
                        placeholder="46.84160"
                        onChange={(event) => patchLocation(location.id, { lat: Number(event.target.value) })}
                      />
                    </div>

                    <div className="appFormField">
                      <label className="fieldLabel" htmlFor={`l-lng-${location.id}`}>
                        Долгота <span className="fieldRequired">для публикации</span>
                      </label>
                      <input
                        id={`l-lng-${location.id}`}
                        className={cn(
                          "fieldInput",
                          errors[`locations.${location.id}.coords`] && "fieldInput--error",
                        )}
                        type="number"
                        step="0.00001"
                        value={location.lng || ""}
                        placeholder="29.64400"
                        onChange={(event) => patchLocation(location.id, { lng: Number(event.target.value) })}
                      />
                    </div>

                    {errors[`locations.${location.id}.coords`] ? (
                      <p className="formHint formHint--error appFormField--wide">
                        {errors[`locations.${location.id}.coords`]}
                      </p>
                    ) : null}

                    <div className="appFormField">
                      <label className="fieldLabel" htmlFor={`l-phone-${location.id}`}>
                        Телефон точки <span className="fieldOptional">если отличается</span>
                      </label>
                      <input
                        id={`l-phone-${location.id}`}
                        className={cn(
                          "fieldInput",
                          errors[`locations.${location.id}.phone`] && "fieldInput--error",
                        )}
                        value={location.phone ?? ""}
                        placeholder="+373 777 12345"
                        onChange={(event) =>
                          patchLocation(location.id, {
                            phone: event.target.value || undefined,
                          })
                        }
                      />
                      {errors[`locations.${location.id}.phone`] ? (
                        <p className="formHint formHint--error">{errors[`locations.${location.id}.phone`]}</p>
                      ) : (
                        <p className="formHint">Пусто — в карточке показываем телефон организации.</p>
                      )}
                    </div>
                  </div>

                  <div className="appFormGroupsOnPoint">
                    {draft.groups.filter((group) => group.locationId === location.id).length
                      ? `${draft.groups.filter((group) => group.locationId === location.id).length} ${plural(
                          draft.groups.filter((group) => group.locationId === location.id).length,
                          "группа",
                          "группы",
                          "групп",
                        )} занимается на этой точке`
                      : "На этой точке пока не назначена ни одна группа — в каталоге она не появится."}
                  </div>
                </article>
              );
            })}
          </section>
        ) : null}

        {step === "contacts" ? (
          <section className="appFormFieldset" aria-label="Контакты">
            <p className="appFormSetHint">
              Пустые поля берутся из профиля организации: телефон и мессенджеры точки — приоритетнее
              общих.
            </p>
            <div className="appFormGrid">
              <div className="appFormField">
                <label className="fieldLabel" htmlFor="c-phone">
                  Телефон анкеты <span className="fieldOptional">если отличается</span>
                </label>
                <div className="requestInputWrap">
                  <Phone size={16} />
                  <input
                    id="c-phone"
                    className={cn("fieldInput", errors.phone && "fieldInput--error")}
                    value={draft.phone}
                    placeholder="+373 777 12345"
                    onChange={(event) => set("phone", event.target.value)}
                  />
                </div>
                {errors.phone ? <p className="formHint formHint--error">{errors.phone}</p> : null}
              </div>

              {(["telegram", "viber", "whatsapp", "instagram"] as const).map((key) => (
                <div className="appFormField" key={key}>
                  <label className="fieldLabel" htmlFor={`c-${key}`}>
                    {key === "telegram"
                      ? "Telegram"
                      : key === "viber"
                        ? "Viber"
                        : key === "whatsapp"
                          ? "WhatsApp"
                          : "Instagram"}{" "}
                    <span className="fieldOptional">необязательно</span>
                  </label>
                  <input
                    id={`c-${key}`}
                    className="fieldInput"
                    value={draft.messengers[key] ?? ""}
                    placeholder="@nickname или ссылка"
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        messengers: { ...current.messengers, [key]: event.target.value || undefined },
                      }))
                    }
                  />
                </div>
              ))}
            </div>
            <p className="formHint">
              Мессенджеров максимум четыре, по одному на тип — каждый в карточке своей кликабельной
              строкой.
            </p>
          </section>
        ) : null}

        {step === "media" ? (
          <section className="appFormFieldset" aria-label="Фото и видео">
            <div className="appFormSetHead">
              <h2>Медиа</h2>
              <span className="appFormSetCount">
                {draft.photos.length} из {MAX_MEDIA}
              </span>
            </div>
            <p className="appFormSetHint">
              jpg, png, webp — на бою сжимаем до {MEDIA_LONG_SIDE} px по длинной стороне; видео — mp4
              (H.264/AAC) до {MAX_VIDEO_SECONDS} с. Первое по порядку = обложка карточки.
            </p>

            <input
              ref={fileInput}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,video/mp4"
              className="srOnly"
              onChange={(event) => void addMedia(event.target.files)}
            />

            {draft.photos.length ? (
              <ul className="mediaAdminGrid">
                {draft.photos.map((src, index) => (
                  <li
                    key={`${src}-${index}`}
                    className={cn("mediaAdminItem", dragIndex === index && "isDragging")}
                    draggable
                    onDragStart={() => setDragIndex(index)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => {
                      if (dragIndex !== null) moveMedia(dragIndex, index);
                      setDragIndex(null);
                    }}
                    onDragEnd={() => setDragIndex(null)}
                  >
                    <span className="mediaAdminThumb">
                      {draft.videos.includes(src) ? (
                        <video src={src} muted playsInline />
                      ) : (
                        <img src={src} alt="" />
                      )}
                      {index === 0 ? <span className="mediaAdminCover">Обложка</span> : null}
                    </span>
                    <span className="mediaAdminTools">
                      <GripVertical size={14} />
                      <button
                        type="button"
                        aria-label="Поднять выше"
                        disabled={index === 0}
                        onClick={() => moveMedia(index, index - 1)}
                      >
                        <ArrowUp size={14} />
                      </button>
                      <button
                        type="button"
                        aria-label="Опустить ниже"
                        disabled={index === draft.photos.length - 1}
                        onClick={() => moveMedia(index, index + 1)}
                      >
                        <ChevronDown size={14} />
                      </button>
                      <button
                        type="button"
                        aria-label="Убрать файл"
                        onClick={() =>
                          setDraft((current) => ({
                            ...current,
                            photos: current.photos.filter((_, i) => i !== index),
                          }))
                        }
                      >
                        <Trash2 size={14} />
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <button type="button" className="mediaAdminEmpty" onClick={() => fileInput.current?.click()}>
                <ImagePlus size={22} />
                <span>Фото пока не выбраны</span>
                <small>Без фото анкета не уходит на проверку: обложка — первое изображение.</small>
              </button>
            )}

            <div className="mediaAdminActions">
              <button
                type="button"
                className="btn btn--soft"
                disabled={mediaBusy || draft.photos.length >= MAX_MEDIA}
                onClick={() => fileInput.current?.click()}
              >
                <ImagePlus size={16} /> {mediaBusy ? "Обрабатываем…" : "Добавить файлы"}
              </button>
              <Link href="/about" className="btn btn--ghost">
                Откуда брать свободные фото
              </Link>
            </div>
            {errors.photos ? <p className="formHint formHint--error">{errors.photos}</p> : null}
          </section>
        ) : null}
      </div>

      <footer className="appFormFoot">
        <button
          type="button"
          className="btn btn--ghost"
          onClick={goPrev}
          disabled={STEPS.findIndex((item) => item.id === step) === 0}
        >
          <ChevronLeft size={16} /> Назад
        </button>
        <div className="appFormFootRight">
          <Link href="/account" className="btn btn--ghost">
            <X size={16} /> В кабинет
          </Link>
          {step === "media" ? (
            <button type="button" className="btn btn--primary btn--lg" onClick={submit}>
              <Send size={16} /> Отправить на проверку
            </button>
          ) : (
            <button type="button" className="btn btn--primary" onClick={goNext}>
              Далее: {STEPS[STEPS.findIndex((item) => item.id === step) + 1]?.label} <ChevronRight size={16} />
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}

function firstRowError(errors: Errors, id: string) {
  const key = Object.keys(errors).find((item) => item.startsWith(`groups.${id}.row.`));
  return key ? errors[key] : "";
}
