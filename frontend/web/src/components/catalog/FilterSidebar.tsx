"use client";

import { useMemo, useState } from "react";
import {
  BadgeCheck,
  Banknote,
  CalendarDays,
  ChevronDown,
  Clock3,
  Filter,
  Globe2,
  MapPin,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import type { Category, City, District, FilterState, SuperCategory } from "@/lib/types";
import { defaultFilters } from "@/lib/filters";
import { cn } from "@/lib/utils";
import { CategoryIcon } from "@/components/ui/Icon";

const WEEKDAY_OPTIONS: { value: string; label: string; full: string }[] = [
  { value: "1", label: "Пн", full: "Понедельник" },
  { value: "2", label: "Вт", full: "Вторник" },
  { value: "3", label: "Ср", full: "Среда" },
  { value: "4", label: "Чт", full: "Четверг" },
  { value: "5", label: "Пт", full: "Пятница" },
  { value: "6", label: "Сб", full: "Суббота" },
  { value: "7", label: "Вс", full: "Воскресенье" },
];

interface FilterCounts {
  bySuper: Record<string, number>;
  byCategory: Record<string, number>;
  total: number;
}

interface FilterSidebarProps {
  filters: FilterState;
  onChange: (patch: Partial<FilterState>) => void;
  onReset: () => void;
  resultCount: number;
  categories: Category[];
  superCategories: SuperCategory[];
  cities: City[];
  districts: District[];
  /** Счётчики по направлениям. На живом каталоге их нет — показывать моковские числа нельзя. */
  counts?: FilterCounts;
  /**
   * Список пришёл из `/api/v1`. Контролы, которых у канона нет, при `true`
   * скрываются: мёртвая кнопка хуже отсутствующей (§3.1.3).
   */
  canon?: boolean;
  className?: string;
  onApply?: () => void;
}

const pricePresets = [500, 1000, 2000, 3000];
const agePresets = [
  { value: "3", label: "3+" },
  { value: "5", label: "5+" },
  { value: "7", label: "7+" },
  { value: "10", label: "10+" },
  { value: "12", label: "12+" },
  { value: "15", label: "15+" },
  { value: "18", label: "18+" },
];

function Section({
  id,
  icon,
  title,
  summary,
  badge,
  open,
  onToggle,
  children,
}: {
  id: string;
  icon: React.ReactNode;
  title: string;
  summary: string;
  badge?: number;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("filterSection", open && "isOpen")}>
      <button
        type="button"
        className="filterSectionHead"
        aria-expanded={open}
        aria-controls={`filter-${id}`}
        onClick={onToggle}
      >
        <span className="filterSectionIcon">{icon}</span>
        <span className="filterSectionText">
          <strong>
            {title}
            {badge ? <em className="filterCount">{badge}</em> : null}
          </strong>
          <small>{summary}</small>
        </span>
        <ChevronDown size={18} className="filterChevron" />
      </button>
      {open ? (
        <div className="filterSectionBody" id={`filter-${id}`}>
          {children}
        </div>
      ) : null}
    </section>
  );
}

function Switch({
  checked,
  onChange,
  label,
  hint,
  icon,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  hint?: string;
  icon?: React.ReactNode;
}) {
  return (
    <label className="switchRow">
      {icon ? <span className="switchIcon">{icon}</span> : null}
      <span className="switchText">
        <strong>{label}</strong>
        {hint ? <small>{hint}</small> : null}
      </span>
      <input
        type="checkbox"
        className="switchInput"
        checked={checked}
        onChange={onChange}
        aria-label={label}
      />
      <span className="switchUi" aria-hidden="true" />
    </label>
  );
}

export function FilterSidebar({
  filters,
  onChange,
  onReset,
  resultCount,
  categories,
  superCategories,
  cities,
  districts,
  counts,
  canon = false,
  className,
  onApply,
}: FilterSidebarProps) {
  const [open, setOpen] = useState<Record<string, boolean>>({
    location: true,
    category: true,
  });

  const [draft, setDraft] = useState<FilterState>(filters);
  const filtersKey = JSON.stringify(filters);
  const [lastFiltersKey, setLastFiltersKey] = useState(filtersKey);
  if (lastFiltersKey !== filtersKey) {
    setLastFiltersKey(filtersKey);
    setDraft(filters);
  }

  const patchDraft = (patch: Partial<FilterState>) => {
    setDraft((current) => {
      const next: FilterState = { ...current, ...patch };
      if (patch.free === true) next.priceMax = "";
      return next;
    });
  };

  const handleApply = () => {
    onChange(draft);
    if (onApply) onApply();
  };

  const handleReset = () => {
    const resetState = { ...defaultFilters, view: draft.view, sort: draft.sort };
    setDraft(resetState);
    onReset();
  };

  const toggle = (key: string) =>
    setOpen((current) => ({ ...current, [key]: !current[key] }));

  const cityDistricts = useMemo(
    () => (draft.city ? districts.filter((district) => district.citySlug === draft.city) : []),
    [districts, draft.city],
  );

  const availableCategories = useMemo(
    () =>
      draft.superCategory
        ? categories.filter((category) => category.superSlug === draft.superCategory)
        : categories,
    [categories, draft.superCategory],
  );

  const hasActive =
    Boolean(draft.q) ||
    Boolean(draft.kind) ||
    Boolean(draft.superCategory) ||
    Boolean(draft.category) ||
    Boolean(draft.city) ||
    draft.district.length > 0 ||
    Boolean(draft.age) ||
    Boolean(draft.priceMax) ||
    draft.free ||
    Boolean(draft.format) ||
    draft.verified ||
    Boolean(draft.day) ||
    Boolean(draft.time) ||
    draft.near;

  const isOther = (sc: SuperCategory) =>
    sc.slug === "other" ||
    sc.slug === "12" ||
    sc.title.toLowerCase() === "другое" ||
    sc.shortTitle.toLowerCase() === "другое";

  const otherCategory = superCategories.find(isOther);
  const otherSlug = otherCategory?.slug ?? "other";
  const isOtherActive =
    draft.superCategory === otherSlug ||
    (Boolean(otherCategory) && draft.superCategory === "other");

  const activeSuper = superCategories.find((item) => item.slug === draft.superCategory || (draft.superCategory === "other" && isOther(item)));

  return (
    <aside className={cn("filterSidebar", className)} aria-label="Фильтры каталога">
      <div className="filterHead">
        <div>
          <span className="eyebrow">Подборка</span>
          <h2>Фильтры</h2>
        </div>
        <button
          type="button"
          className={cn("filterReset", !hasActive && "isMuted")}
          onClick={handleReset}
          disabled={!hasActive}
        >
          <RotateCcw size={14} /> Сбросить
        </button>
      </div>

      <div className="filterScroll">
        <Section
          id="location"
          icon={<MapPin size={19} />}
          title="Расположение"
          summary={draft.city ? cities.find((c) => c.slug === draft.city)?.title ?? "Город, район" : "Город · район"}
          badge={draft.city ? 1 : 0}
          open={!!open.location}
          onToggle={() => toggle("location")}
        >
          <div className="filterCityGrid">
            {cities.map((city) => (
              <button
                key={city.slug}
                type="button"
                className={cn("choicePill", draft.city === city.slug && "isActive")}
                onClick={() =>
                  patchDraft({
                    city: draft.city === city.slug ? "" : city.slug,
                    district: [],
                    near: false,
                  })
                }
              >
                {city.title}
              </button>
            ))}
          </div>
          {draft.city ? (
            <div className="filterSubBlock">
              <span className="filterLabel">Район</span>
              <div className="filterCityGrid">
                {cityDistricts.length ? (
                  cityDistricts.map((district) => {
                    const selected = draft.district.includes(district.slug);
                    return (
                      <button
                        key={district.slug}
                        type="button"
                        className={cn("choicePill choicePill--sm", selected && "isActive")}
                        onClick={() =>
                          patchDraft({
                            district: selected
                              ? draft.district.filter((value) => value !== district.slug)
                              : [...draft.district, district.slug],
                          })
                        }
                      >
                        {district.title}
                      </button>
                    );
                  })
                ) : (
                  <p className="filterHint">Для этого города районы пока не размечены.</p>
                )}
              </div>
            </div>
          ) : null}
          <div className="filterSubBlock">
            <Switch
              checked={draft.near}
              onChange={() => patchDraft({ near: !draft.near })}
              label="Рядом с центром города"
              hint={draft.city ? "В радиусе выбранного города" : "Сначала выберите город"}
              icon={<MapPin size={16} />}
            />
            {draft.near ? (
              <select
                className="filterSelect"
                value={draft.radius}
                aria-label="Радиус поиска"
                onChange={(event) => patchDraft({ radius: event.target.value })}
              >
                <option value="1000">до 1 км</option>
                <option value="3000">до 3 км</option>
                <option value="5000">до 5 км</option>
                <option value="10000">до 10 км</option>
              </select>
            ) : null}
          </div>
        </Section>

        <Section
          id="category"
          icon={<CategoryIcon name="layout-grid" size={19} />}
          title="Категория"
          summary={activeSuper ? activeSuper.shortTitle : "Услуги · занятия"}
          badge={draft.category || draft.superCategory ? 1 : 0}
          open={!!open.category}
          onToggle={() => toggle("category")}
        >
          <div className="filterCategoryList">
            <button
              type="button"
              className={cn("filterCategoryOption", !draft.superCategory && !draft.kind && "isActive")}
              onClick={() => patchDraft({ superCategory: "", category: "", kind: "" })}
            >
              <span className="filterCategoryIco" style={{ color: "#7C3AED", background: "#7C3AED14" }}>
                <CategoryIcon name="layout-grid" size={16} />
              </span>
              <span>
                <strong>Все занятия</strong>
                {counts ? <small>{counts.total} вариантов</small> : null}
              </span>
              {!draft.superCategory && !draft.kind ? <BadgeCheck size={15} /> : null}
            </button>
            {superCategories
              .filter((superCategory) => !isOther(superCategory))
              .map((superCategory) => (
                <button
                  key={superCategory.slug}
                  type="button"
                  className={cn(
                    "filterCategoryOption",
                    draft.superCategory === superCategory.slug && !draft.category && "isActive",
                  )}
                  onClick={() =>
                    patchDraft({
                      superCategory:
                        draft.superCategory === superCategory.slug ? "" : superCategory.slug,
                      category: "",
                      kind: "",
                    })
                  }
                >
                  <span
                    className="filterCategoryIco"
                    style={{ color: superCategory.color, background: `${superCategory.color}14` }}
                  >
                    <CategoryIcon name={superCategory.icon} size={16} />
                  </span>
                  <span>
                    <strong>{superCategory.shortTitle}</strong>
                    {counts ? <small>{counts.bySuper[superCategory.slug] ?? 0} вариантов</small> : null}
                  </span>
                  {draft.superCategory === superCategory.slug ? <BadgeCheck size={15} /> : null}
                </button>
              ))}
            <button
              type="button"
              className={cn("filterCategoryOption", draft.kind === "service" && "isActive")}
              onClick={() => patchDraft({ kind: draft.kind === "service" ? "" : "service", superCategory: "", category: "" })}
            >
              <span
                className="filterCategoryIco"
                style={{ color: "#8B5CF6", background: "#8B5CF614" }}
              >
                <CategoryIcon name="sparkles" size={16} />
              </span>
              <span>
                <strong>Только услуги</strong>
                <small>Мастера и салоны</small>
              </span>
              {draft.kind === "service" ? <BadgeCheck size={15} /> : null}
            </button>
            {otherCategory ? (
              <button
                key={otherSlug}
                type="button"
                className={cn(
                  "filterCategoryOption",
                  isOtherActive && !draft.category && "isActive",
                )}
                onClick={() =>
                  patchDraft({
                    superCategory: isOtherActive ? "" : otherSlug,
                    category: "",
                    kind: "",
                  })
                }
              >
                <span
                  className="filterCategoryIco"
                  style={{ color: otherCategory.color || "#8064D8", background: `${otherCategory.color || "#8064D8"}14` }}
                >
                  <CategoryIcon name={otherCategory.icon || "layout-grid"} size={16} />
                </span>
                <span>
                  <strong>{otherCategory.shortTitle}</strong>
                  {counts ? <small>{counts.bySuper[otherCategory.slug] ?? 0} вариантов</small> : null}
                </span>
                {isOtherActive ? <BadgeCheck size={15} /> : null}
              </button>
            ) : null}
          </div>
          {draft.superCategory ? (
            <div className="filterSubBlock">
              <span className="filterLabel">Уточнить категорию</span>
              <div className="filterCityGrid">
                {availableCategories.map((category) => {
                  const active = draft.category === category.slug;
                  return (
                    <button
                      key={category.slug}
                      type="button"
                      className={cn("choicePill choicePill--sm", active && "isActive")}
                      onClick={() => patchDraft({ category: active ? "" : category.slug })}
                    >
                      {category.title}
                      {counts ? (
                        <span className="choiceCount">{counts.byCategory[category.slug] ?? 0}</span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </Section>

        <Section
          id="price"
          icon={<Banknote size={19} />}
          title="Цена"
          summary={draft.free ? "Бесплатно" : draft.priceMax ? `до ${draft.priceMax} ₽` : "Диапазон или бесплатно"}
          badge={draft.priceMax || draft.free ? 1 : 0}
          open={!!open.price}
          onToggle={() => toggle("price")}
        >
          <div className="priceSliderHead">
            <span>до</span>
            <strong>{draft.priceMax ? `${Number(draft.priceMax).toLocaleString("ru-RU")} руб.` : "любая цена"}</strong>
          </div>
          <input
            type="range"
            min={0}
            max={5000}
            step={100}
            value={draft.priceMax || 5000}
            aria-label="Максимальная цена"
            onChange={(event) => {
              const value = Number(event.target.value);
              patchDraft({ priceMax: value >= 5000 ? "" : String(value) });
            }}
            className="rangeInput"
          />
          <div className="rangeScale">
            <span>0</span>
            <span>5 000 ₽</span>
          </div>
          <div className="filterCityGrid">
            {pricePresets.map((price) => (
              <button
                key={price}
                type="button"
                className={cn("choicePill choicePill--sm", draft.priceMax === String(price) && "isActive")}
                onClick={() =>
                  patchDraft({ priceMax: draft.priceMax === String(price) ? "" : String(price) })
                }
              >
                до {price.toLocaleString("ru-RU")}
              </button>
            ))}
          </div>
          <div className="filterSubBlock">
            <Switch
              checked={draft.free}
              onChange={() => patchDraft({ free: !draft.free })}
              label="Только бесплатно"
              hint="Без оплаты за занятие"
              icon={<Sparkles size={16} />}
            />
          </div>
        </Section>

        <Section
          id="format"
          icon={<Globe2 size={19} />}
          title="Формат"
          summary={
            draft.format === "online"
              ? "Онлайн"
              : draft.format === "offline"
                ? "Офлайн"
                : "Онлайн · офлайн"
          }
          badge={draft.format ? 1 : 0}
          open={!!open.format}
          onToggle={() => toggle("format")}
        >
          <div className="segmented segmented--stack">
            {[
              { value: "", label: "Любой формат" },
              { value: "offline", label: "Офлайн" },
              { value: "online", label: "Онлайн" },
              { value: "both", label: "Офлайн и онлайн" },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                className={cn("segment", draft.format === option.value && "isActive")}
                onClick={() => patchDraft({ format: option.value as FilterState["format"] })}
              >
                {option.label}
              </button>
            ))}
          </div>
        </Section>

        <Section
          id="age"
          icon={<Users size={19} />}
          title="Возраст"
          summary={draft.age ? `От ${draft.age} лет` : "От 0 до 99 лет"}
          badge={draft.age ? 1 : 0}
          open={!!open.age}
          onToggle={() => toggle("age")}
        >
          <div className="filterCityGrid">
            {agePresets.map((age) => (
              <button
                key={age.value}
                type="button"
                className={cn("choicePill choicePill--sm", draft.age === age.value && "isActive")}
                onClick={() => patchDraft({ age: draft.age === age.value ? "" : age.value })}
              >
                {age.label}
              </button>
            ))}
          </div>
          <p className="filterHint">
            Показываем занятия, в которых есть группа подходящего возраста.
          </p>
        </Section>

        <Section
          id="day"
          icon={<CalendarDays size={19} />}
          title="День недели"
          summary={(() => {
            const current = WEEKDAY_OPTIONS.find(
              (item) => item.value === draft.day || item.label === draft.day || item.full === draft.day,
            );
            if (!current) return "Пн – Вс";
            return canon ? current.full : `${current.full} · ${draft.time ? "время выбрано" : "любое время"}`;
          })()}
          badge={draft.day ? 1 : 0}
          open={!!open.day}
          onToggle={() => toggle("day")}
        >
          <div className="segmented segmented--stack">
            {[
              { value: "", label: "Любой день" },
              ...WEEKDAY_OPTIONS.map((item) => ({ value: item.value, label: item.full, short: item.label })),
            ].map((option) => {
              const active =
                option.value === ""
                  ? !draft.day
                  : draft.day === option.value || draft.day === (option as { short?: string }).short;
              return (
                <button
                  key={option.value || "any"}
                  type="button"
                  className={cn("segment", active && "isActive")}
                  onClick={() => patchDraft({ day: active && option.value !== "" ? "" : option.value })}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </Section>

        {/* Части дня у канона нет: бэкенд ждёт в `time` момент «ЧЧ:ММ», а не
            «утро/день/вечер», поэтому на живом списке блок не рисуется (§3.1.3). */}
        {canon ? null : (
          <Section
            id="time"
            icon={<Clock3 size={19} />}
            title="Время"
            summary={
              draft.time === "morning"
                ? "Утро · до 12:00"
                : draft.time === "day"
                  ? "День · 12:00–17:00"
                  : draft.time === "evening"
                    ? "Вечер · после 17:00"
                    : "Утро · день · вечер"
            }
            badge={draft.time ? 1 : 0}
            open={!!open.time}
            onToggle={() => toggle("time")}
          >
            <div className="segmented segmented--stack">
              {[
                { value: "", label: "Любое время" },
                { value: "morning", label: "Утро · до 12:00" },
                { value: "day", label: "День · 12:00–17:00" },
                { value: "evening", label: "Вечер · после 17:00" },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={cn("segment", draft.time === option.value && "isActive")}
                  onClick={() => patchDraft({ time: option.value as FilterState["time"] })}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </Section>
        )}
      </div>

      <div className="filterFoot">
        <Switch
          checked={draft.verified}
          onChange={() => patchDraft({ verified: !draft.verified })}
          label="Проверенные"
          hint="Данные подтверждены"
          icon={<BadgeCheck size={16} />}
        />
        <button type="button" className="btn btn--primary btn--block filterApply" onClick={handleApply}>
          <Filter size={16} />
          Применить
        </button>
      </div>
    </aside>
  );
}

export function MobileFilterSheet({
  open,
  onClose,
  ...props
}: FilterSidebarProps & { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="filterSheet" role="dialog" aria-modal="true" aria-label="Фильтры">
      <button type="button" className="filterSheetBackdrop" aria-label="Закрыть фильтры" onClick={onClose} />
      <div className="filterSheetPanel">
        <button type="button" className="modalClose filterSheetClose" aria-label="Закрыть фильтры" onClick={onClose}>
          <X size={20} />
        </button>
        <FilterSidebar {...props} className="filterSidebar--sheet" onApply={onClose} />
      </div>
    </div>
  );
}
