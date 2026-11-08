import type { Filters, Organization, OrganizationCategory, PriceType } from '@/types';

/** Подписи к машинным значениям (§4.5): значение селекта всегда совпадает с полем организации. */
export const categoryOptions: { value: OrganizationCategory; label: string }[] = [
  { value: 'sport', label: 'Спорт' },
  { value: 'art', label: 'Творчество' },
  { value: 'language', label: 'Языки' },
  { value: 'other', label: 'Другое' },
];

export const priceOptions: { value: PriceType; label: string }[] = [
  { value: 'free', label: 'Бесплатно' },
  { value: 'paid', label: 'Платно' },
];

export const defaultFilters: Filters = {
  city: '',
  category: '',
  priceType: '',
  searchQuery: '',
};

/** Возраст ребёнка — одно число (§5.2). Пустое/некорректное значение = «не важно». */
export function isAge(value: string): boolean {
  if (value.trim() === '') return false;
  const age = Number(value);
  return Number.isFinite(age) && age > 0 && age < 120;
}

/** Слияние частичных изменений с текущим состоянием: пустые поля других селектов не затираются. */
export function mergeFilters(current: Filters, patch: Partial<Filters>): Filters {
  return { ...current, ...patch };
}

function matchesSearch(org: Organization, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (needle === '') return true;
  const haystack = [org.name, org.description, org.address, org.city, ...org.tags]
    .join(' ')
    .toLowerCase();
  return haystack.includes(needle);
}

export function filterOrganizations(
  organizations: Organization[],
  filters: Filters,
): Organization[] {
  return organizations.filter((org) => {
    if (filters.city && org.city !== filters.city) return false;
    if (filters.category && org.category !== filters.category) return false;
    if (filters.priceType && org.priceType !== filters.priceType) return false;
    if (filters.age !== undefined && Number.isFinite(filters.age)) {
      const [min, max] = org.ageRange;
      if (filters.age < min || filters.age > max) return false;
    }
    if (!matchesSearch(org, filters.searchQuery ?? '')) return false;
    return true;
  });
}
