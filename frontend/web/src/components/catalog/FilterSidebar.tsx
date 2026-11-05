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
import { cn } from "@/lib/utils";
import { weekdays } from "@/lib/filters";
import { CategoryIcon } from "@/components/ui/Icon";

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

  const toggle = (key: string) =>
    setOpen((current) => ({ ...current, [key]: !current[key] }));

  const cityDistricts = useMemo(
    () => (filters.city ? districts.filter((district) => district.citySlug === filters.city) : []),
    [districts, filters.city],
  );

  const availableCategories = useMemo(
    () =>
      filters.superCategory
        ? categories.filter((category) => category.superSlug === filters.superCategory)
        : categories,
    [categories, filters.superCategory],
  );

  const hasActive =
    Boolean(filters.q) ||
    Boolean(filters.kind) ||
    Boolean(filters.superCategory) ||
    Boolean(filters.category) ||
    Boolean(filters.city) ||
    filters.district.length > 0 ||
    Boolean(filters.age) ||
    Boolean(filters.priceMax) ||
    filters.free ||
    Boolean(filters.format) ||
    filters.verified ||
    Boolean(filters.day) ||
    Boolean(filters.time) ||
    filters.near;

  const activeSuper = superCategories.find((item) => item.slug === filters.superCategory);

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
          onClick={onReset}
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
          summary={filters.city ? cities.find((c) => c.slug === filters.city)?.title ?? "Город, район" : "Город · район"}
          badge={filters.city ? 1 : 0}
          open={!!open.location}
          onToggle={() => toggle("location")}
        >
          <div className="filterCityGrid">
            {cities.map((city) => (
              <button
                key={city.slug}
                type="button"
                className={cn("choicePill", filters.city === city.slug && "isActive")}
                onClick={() =>
                  onChange({
                    city: filters.city === city.slug ? "" : city.slug,
                    district: [],
                    near: false,
                  })
                }
              >
                {city.title}
              </button>
            ))}
          </div>
          {filters.city ? (
            <div className="filterSubBlock">
              <span className="filterLabel">Район</span>
              <div className="filterCityGrid">
                {cityDistricts.length ? (
                  cityDistricts.map((district) => {
                    const selected = filters.district.includes(district.slug);
                    return (
                      <button
                        key={district.slug}
                        type="button"
                        className={cn("choicePill choicePill--sm", selected && "isActive")}
                        onClick={() =>
                          onChange({
                            district: selected
                              ? filters.district.filter((value) => value !== district.slug)
                              : [...filters.district, district.slug],
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
              checked={filters.near}
              onChange={() => onChange({ near: !filters.near })}
              label="Рядом со мной"
              hint={filters.city ? "В радиусе выбранного города" : "Сначала выберите город"}
              icon={<MapPin size={16} />}
            />
            {filters.near ? (
              <select
                className="filterSelect"
                value={filters.radius}
                aria-label="Радиус поиска"
                onChange={(event) => onChange({ radius: event.target.value })}
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
          badge={filters.category || filters.superCategory ? 1 : 0}
          open={!!open.category}
          onToggle={() => toggle("category")}
        >
          <div className="filterCategoryList">
            <button
              type="button"
              className={cn("filterCategoryOption", !filters.superCategory && !filters.kind && "isActive")}
              onClick={() => onChange({ superCategory: "", category: "", kind: "" })}
            >
              <span className="filterCategoryIco">
                <Sparkles size={16} />
              </span>
              <span>
                <strong>Все занятия</strong>
                {counts ? <small>{counts.total} вариантов</small> : null}
              </span>
            </button>
            {superCategories.map((superCategory) => (
              <button
                key={superCategory.slug}
                type="button"
                className={cn(
                  "filterCategoryOption",
                  filters.superCategory === superCategory.slug && !filters.category && "isActive",
                )}
                onClick={() =>
                  onChange({
                    superCategory:
                      filters.superCategory === superCategory.slug ? "" : superCategory.slug,
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
                {filters.superCategory === superCategory.slug ? <BadgeCheck size={15} /> : null}
              </button>
            ))}
            <button
              type="button"
              className={cn("filterCategoryOption", filters.kind === "service" && "isActive")}
              onClick={() => onChange({ kind: filters.kind === "service" ? "" : "service", superCategory: "", category: "" })}
            >
              <span className="filterCategoryIco">
                <SlidersHorizontal size={16} />
              </span>
              <span>
                <strong>Только услуги</strong>
                <small>Мастера и салоны</small>
              </span>
            </button>
          </div>
          {filters.superCategory ? (
            <div className="filterSubBlock">
              <span className="filterLabel">Уточнить категорию</span>
              <div className="filterCityGrid">
                {availableCategories.map((category) => {
                  const active = filters.category === category.slug;
                  return (
                    <button
                      key={category.slug}
                      type="button"
                      className={cn("choicePill choicePill--sm", active && "isActive")}
                      onClick={() => onChange({ category: active ? "" : category.slug })}
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
          summary={filters.free ? "Бесплатно" : filters.priceMax ? `до ${filters.priceMax} ₽` : "Диапазон или бесплатно"}
          badge={filters.priceMax || filters.free ? 1 : 0}
          open={!!open.price}
          onToggle={() => toggle("price")}
        >
          <div className="priceSliderHead">
            <span>до</span>
            <strong>{filters.priceMax ? `${Number(filters.priceMax).toLocaleString("ru-RU")} руб.` : "любая цена"}</strong>
          </div>
          <input
            type="range"
            min={0}
            max={5000}
            step={100}
            value={filters.priceMax || 5000}
            aria-label="Максимальная цена"
            onChange={(event) => {
              const value = Number(event.target.value);
              onChange({ priceMax: value >= 5000 ? "" : String(value) });
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
                className={cn("choicePill choicePill--sm", filters.priceMax === String(price) && "isActive")}
                onClick={() =>
                  onChange({ priceMax: filters.priceMax === String(price) ? "" : String(price) })
                }
              >
                до {price.toLocaleString("ru-RU")}
              </button>
            ))}
          </div>
          <div className="filterSubBlock">
            <Switch
              checked={filters.free}
              onChange={() => onChange({ free: !filters.free })}
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
            filters.format === "online"
              ? "Онлайн"
              : filters.format === "offline"
                ? "Офлайн"
                : "Онлайн · офлайн"
          }
          badge={filters.format ? 1 : 0}
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
                className={cn("segment", filters.format === option.value && "isActive")}
                onClick={() => onChange({ format: option.value as FilterState["format"] })}
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
          summary={filters.age ? `От ${filters.age} лет` : "От 0 до 99 лет"}
          badge={filters.age ? 1 : 0}
          open={!!open.age}
          onToggle={() => toggle("age")}
        >
          <div className="filterCityGrid">
            {agePresets.map((age) => (
              <button
                key={age.value}
                type="button"
                className={cn("choicePill choicePill--sm", filters.age === age.value && "isActive")}
                onClick={() => onChange({ age: filters.age === age.value ? "" : age.value })}
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
          summary={
            filters.day
              ? canon
                ? filters.day
                : `${filters.day} · ${filters.time ? "время выбрано" : "любое время"}`
              : "Пн – Вс"
          }
          badge={filters.day ? 1 : 0}
          open={!!open.day}
          onToggle={() => toggle("day")}
        >
          <div className="dayGrid">
            {weekdays.map((day) => (
              <button
                key={day}
                type="button"
                className={cn("dayButton", filters.day === day && "isActive")}
                onClick={() => onChange({ day: filters.day === day ? "" : day })}
              >
                {day}
              </button>
            ))}
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
              filters.time === "morning"
                ? "Утро · до 12:00"
                : filters.time === "day"
                  ? "День · 12:00–17:00"
                  : filters.time === "evening"
                    ? "Вечер · после 17:00"
                    : "Утро · день · вечер"
            }
            badge={filters.time ? 1 : 0}
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
                  className={cn("segment", filters.time === option.value && "isActive")}
                  onClick={() => onChange({ time: option.value as FilterState["time"] })}
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
          checked={filters.verified}
          onChange={() => onChange({ verified: !filters.verified })}
          label="Проверенные"
          hint="Данные подтверждены"
          icon={<BadgeCheck size={16} />}
        />
        <Switch
          checked={filters.near}
          onChange={() => onChange({ near: !filters.near })}
          label="Рядом со мной"
          icon={<MapPin size={16} />}
        />
        <button type="button" className="btn btn--primary btn--block filterApply" onClick={onApply}>
          <Filter size={16} />
          Показать {resultCount}
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
