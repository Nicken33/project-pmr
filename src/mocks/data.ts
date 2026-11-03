import type { CityName, Coordinates, Organization } from '@/types';

/** Города справочника (§8, таблица 3). Единый источник списка — этот файл. */
export const cities: CityName[] = [
  'Тирасполь',
  'Бендеры',
  'Рыбница',
  'Дубоссары',
  'Каменка',
  'Слободзея',
  'Григориополь',
  'Днестровск',
];

/** Центр города — используется картой при выборе города в фильтре (§5.9). */
export const cityCoordinates: Record<CityName, Coordinates> = {
  'Тирасполь': { lat: 46.8386, lng: 29.6437 },
  'Бендеры': { lat: 46.8307, lng: 29.4711 },
  'Рыбница': { lat: 47.8382, lng: 29.8969 },
  'Дубоссары': { lat: 47.3382, lng: 29.2285 },
  'Каменка': { lat: 47.7747, lng: 29.3142 },
  'Слободзея': { lat: 46.8333, lng: 29.6133 },
  'Григориополь': { lat: 47.3644, lng: 29.6222 },
  'Днестровск': { lat: 47.2547, lng: 29.6347 },
};

export const mockOrganizations: Organization[] = [
  {
    id: '1',
    name: 'Футбольная секция "Динамо"',
    description: 'Профессиональная подготовка юных футболистов',
    address: 'Тирасполь, ул. Ленина, 45',
    city: 'Тирасполь',
    contacts: '+373 777 12345',
    ageRange: [8, 16],
    tags: ['футбол', 'спорт', 'команда'],
    coordinates: { lat: 46.8403, lng: 29.6323 },
    priceType: 'paid',
    category: 'sport',
    reviews: [
      {
        id: 'r1',
        author: 'Иван Петров',
        text: 'Отличная секция, профессиональные тренеры!',
        date: '2024-01-15'
      }
    ]
  },
  {
    id: '2',
    name: 'Художественная школа "Палитра"',
    description: 'Обучение рисованию для детей и подростков',
    address: 'Бендеры, ул. Советская, 12',
    city: 'Бендеры',
    contacts: '+373 777 54321',
    ageRange: [6, 18],
    tags: ['рисование', 'творчество', 'искусство'],
    coordinates: { lat: 46.8307, lng: 29.4711 },
    priceType: 'paid',
    category: 'art'
  },
  {
    id: '3',
    name: 'Клуб английского языка "Lingvo"',
    description: 'Курсы английского для школьников',
    address: 'Тирасполь, ул. 25 Октября, 78',
    city: 'Тирасполь',
    contacts: '+373 777 98765',
    ageRange: [10, 17],
    tags: ['английский', 'языки', 'образование'],
    coordinates: { lat: 46.8352, lng: 29.6114 },
    priceType: 'paid',
    category: 'language'
  },
  {
    id: '4',
    name: 'Шахматный клуб "Гамбит"',
    description: 'Обучение шахматам для детей',
    address: 'Бендеры, ул. Пушкина, 34',
    city: 'Бендеры',
    contacts: '+373 777 45678',
    ageRange: [7, 14],
    tags: ['шахматы', 'логика', 'развитие'],
    coordinates: { lat: 46.8276, lng: 29.4813 },
    priceType: 'free',
    category: 'other'
  }
];
