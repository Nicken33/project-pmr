export interface Coordinates {
  lat: number;
  lng: number;
}

/** Направления верхнего уровня (§4): в каталоге они двухуровневые, здесь — базовый набор. */
export type OrganizationCategory = 'sport' | 'art' | 'language' | 'other';

export type PriceType = 'free' | 'paid';

/** Города из справочника (§8, таблица 3). Точный список ведёт один источник — src/mocks/data.ts. */
export type CityName =
  | 'Тирасполь'
  | 'Бендеры'
  | 'Рыбница'
  | 'Дубоссары'
  | 'Каменка'
  | 'Слободзея'
  | 'Григориополь'
  | 'Днестровск';

export interface Review {
  id: string;
  author: string;
  text: string;
  date: string;
}

export interface Organization {
  id: string;
  name: string;
  description: string;
  address: string;
  /** Город из справочника: фильтрация и «рядом со мной» считаются по нему, а не по тексту адреса (§5.9). */
  city: CityName;
  contacts: string;
  ageRange: [number, number];
  tags: string[];
  coordinates: Coordinates;
  reviews?: Review[];
  priceType: PriceType;
  category: OrganizationCategory;
}

/**
 * Параметры фильтрации. Все поля необязательные: undefined = «не важно».
 * Значения — машинные (latini/английские ключи), подписи в UI — русские,
 * иначе значение селекта не совпадёт с полем организации (§4.5).
 */
export interface Filters {
  city?: CityName | '';
  category?: OrganizationCategory | '';
  /** Возраст ребёнка — одно число (§5.2), а не диапазон. */
  age?: number;
  priceType?: PriceType | '';
  searchQuery?: string;
}
