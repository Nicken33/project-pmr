// Прогон: node --experimental-strip-types src/lib/filter.test.ts
import assert from 'node:assert/strict';
import {
  categoryOptions,
  defaultFilters,
  filterOrganizations,
  isAge,
  mergeFilters,
  priceOptions,
} from './filter.ts';
import { cities, mockOrganizations } from '../mocks/data.ts';
import type { Organization } from '../types/index.ts';

const byId = (list: Organization[]) => list.map((org) => org.id).sort().join(',');

const cases: [string, () => void][] = [
  ['без фильтров видны все организации', () => {
    assert.equal(filterOrganizations(mockOrganizations, defaultFilters).length, 4);
  }],

  ['город Тирасполь', () => {
    assert.equal(byId(filterOrganizations(mockOrganizations, { city: 'Тирасполь' })), '1,3');
  }],

  ['город Бендеры', () => {
    assert.equal(byId(filterOrganizations(mockOrganizations, { city: 'Бендеры' })), '2,4');
  }],

  ['фильтр по городу не сравнивает текст адреса', () => {
    const [onlyTiraspol] = filterOrganizations(mockOrganizations, { city: 'Тирасполь' });
    assert.equal(onlyTiraspol.city, 'Тирасполь');
    assert.equal(
      filterOrganizations(mockOrganizations, { city: 'Слободзея' }).length, 0,
      'город без секций должен давать пустой результат',
    );
  }],

  ['категории', () => {
    for (const { value } of categoryOptions) {
      const found = filterOrganizations(mockOrganizations, { category: value });
      assert.ok(found.every((org) => org.category === value));
      assert.ok(found.length > 0, `категория ${value} есть в моке`);
    }
    assert.equal(byId(filterOrganizations(mockOrganizations, { category: 'sport' })), '1');
  }],

  ['значения селектов — машинные ключи, а не русские подписи', () => {
    const categoryValues = categoryOptions.map((option) => option.value);
    const priceValues = priceOptions.map((option) => option.value);
    assert.ok(
      categoryValues.every((value) => /^[a-z]+$/.test(value)),
      'категории заданы латиницей',
    );
    assert.ok(priceValues.every((value) => /^[a-z]+$/.test(value)), 'тип оплаты задан латиницей');
    for (const org of mockOrganizations) {
      assert.ok(categoryValues.includes(org.category), `категория ${org.category} в списке`);
      assert.ok(priceValues.includes(org.priceType), `цена ${org.priceType} в списке`);
    }
  }],

  ['тип оплаты', () => {
    assert.equal(byId(filterOrganizations(mockOrganizations, { priceType: 'free' })), '4');
    assert.equal(byId(filterOrganizations(mockOrganizations, { priceType: 'paid' })), '1,2,3');
    assert.equal(priceOptions.length, 2);
  }],

  ['возраст — одно число, а не диапазон (§5.2)', () => {
    assert.equal(byId(filterOrganizations(mockOrganizations, { age: 6 })), '2');
    assert.equal(byId(filterOrganizations(mockOrganizations, { age: 9 })), '1,2,4');
    assert.equal(byId(filterOrganizations(mockOrganizations, { age: 18 })), '2');
    assert.equal(filterOrganizations(mockOrganizations, { age: undefined }).length, 4);
  }],

  ['комбинация город + категория + возраст', () => {
    assert.equal(
      byId(filterOrganizations(mockOrganizations, { city: 'Бендеры', category: 'art', age: 7 })),
      '2',
    );
    assert.equal(
      byId(filterOrganizations(mockOrganizations, { city: 'Тирасполь', category: 'art', age: 7 })),
      '',
    );
  }],

  ['поиск по названию, тегу и городу', () => {
    assert.equal(byId(filterOrganizations(mockOrganizations, { searchQuery: 'динамо' })), '1');
    assert.equal(byId(filterOrganizations(mockOrganizations, { searchQuery: 'ШАХМАТЫ' })), '4');
    assert.equal(byId(filterOrganizations(mockOrganizations, { searchQuery: 'Бендеры' })), '2,4');
    assert.equal(byId(filterOrganizations(mockOrganizations, { searchQuery: '  ' })), '1,2,3,4');
  }],

  ['частичное изменение не сбрасывает остальные поля', () => {
    const state = mergeFilters(defaultFilters, { city: 'Бендеры' });
    assert.equal(state.city, 'Бендеры');
    const next = mergeFilters(state, { category: 'art' });
    assert.deepEqual(next, { ...defaultFilters, city: 'Бендеры', category: 'art' });
    assert.equal(next.priceType, '');
    assert.equal(
      byId(filterOrganizations(mockOrganizations, next)), '2',
      'фильтр применяется по обоим полям сразу',
    );
  }],

  ['mergeFilters не мутирует исходное состояние', () => {
    const before = { ...defaultFilters };
    mergeFilters(before, { city: 'Рыбница' });
    assert.deepEqual(before, defaultFilters);
  }],

  ['валидация возраста', () => {
    assert.equal(isAge('10'), true);
    assert.equal(isAge(''), false);
    assert.equal(isAge('abc'), false);
    assert.equal(isAge('0'), false);
    assert.equal(isAge('-5'), false);
    assert.equal(isAge('120'), false);
  }],

  ['данные мока соответствуют типам', () => {
    for (const org of mockOrganizations) {
      assert.ok(cities.includes(org.city), `город ${org.city} в справочнике`);
      assert.ok(org.address.startsWith(org.city), 'город согласован с адресом');
      assert.equal(typeof org.coordinates.lat, 'number');
      assert.equal(typeof org.coordinates.lng, 'number');
      assert.ok(Number.isFinite(org.coordinates.lat) && Number.isFinite(org.coordinates.lng));
      const [min, max] = org.ageRange;
      assert.ok(min <= max, 'диапазон возраста не перевёрнут');
      assert.ok(['free', 'paid'].includes(org.priceType));
      assert.ok(['sport', 'art', 'language', 'other'].includes(org.category));
    }
  }],
];

let failed = 0;
for (const [name, run] of cases) {
  try {
    run();
    console.log(`ok — ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL — ${name}\n  ${(error as Error).message}`);
  }
}
console.log(`\n${cases.length - failed}/${cases.length} тестов пройдено`);
if (failed > 0) process.exit(1);
