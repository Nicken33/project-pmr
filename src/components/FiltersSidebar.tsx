import React, { useState, useId } from 'react';
import { TopCategoryId, ActivityKind, FormatType } from '../types';

interface FiltersSidebarProps {
  selectedDistrict: string;
  onDistrictChange: (district: string) => void;
  selectedAge: number | null;
  onAgeChange: (age: number | null) => void;
  selectedKind: ActivityKind;
  onKindChange: (kind: ActivityKind) => void;
  selectedTopCategories: TopCategoryId[];
  onToggleCategory: (cat: TopCategoryId) => void;
  isFreeOnly: boolean;
  onToggleFreeOnly: (val: boolean) => void;
  isVerifiedOnly: boolean;
  onToggleVerifiedOnly: (val: boolean) => void;
  maxPrice: number;
  onMaxPriceChange: (val: number) => void;
  minPrice?: number;
  onMinPriceChange?: (val: number) => void;
  selectedFormat: FormatType | 'all';
  onFormatChange: (format: FormatType | 'all') => void;
  timeOfDay: 'all' | 'morning' | 'afternoon' | 'evening';
  onTimeOfDayChange: (time: 'all' | 'morning' | 'afternoon' | 'evening') => void;
  totalFilteredCount: number;
  onResetFilters: () => void;
  onApplyFilters?: () => void;
}

export const FiltersSidebar: React.FC<FiltersSidebarProps> = ({
  selectedDistrict,
  onDistrictChange,
  selectedAge,
  onAgeChange,
  selectedKind,
  onKindChange,
  selectedTopCategories,
  onToggleCategory,
  isFreeOnly,
  onToggleFreeOnly,
  isVerifiedOnly,
  onToggleVerifiedOnly,
  maxPrice,
  onMaxPriceChange,
  minPrice = 0,
  onMinPriceChange,
  selectedFormat,
  onFormatChange,
  timeOfDay,
  onTimeOfDayChange,
  totalFilteredCount,
  onResetFilters,
  onApplyFilters,
}) => {
  const formatClipId = useId();

  // Open/closed states for accordion sections
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    geo: false,
    category: false,
    price: false,
    format: false,
    age: false,
    weekday: false,
    time: false,
  });

  // Open/closed states for tree nodes
  const [treeOpen, setTreeOpen] = useState<Record<string, boolean>>({
    'Тирасполь': true,
    'Бендеры': false,
    'Рыбница': false,
    'Каменка': false,
    'Слободзея': false,
    'Дубоссары': false,
    'Григориополь': false,
    'Занятия': true,
    'Танцы': true,
    'Обучение': false,
    'Репетиторство': false,
    'Курсы': false,
    'Спорт': false,
    'Творчество': false,
    'Услуги': false,
    'Красота и уход': false,
    'Ремонт': false,
    'Фото и видео': false,
    'Животные': false,
  });

  // Selected weekdays state
  const [selectedWeekdays, setSelectedWeekdays] = useState<string[]>([]);
  // Nearby switch
  const [isNearbyOnly, setIsNearbyOnly] = useState(false);
  // Photo only switch
  const [isPhotoOnly, setIsPhotoOnly] = useState(false);

  // Age input values
  const [ageMinInput, setAgeMinInput] = useState<string>(selectedAge !== null ? String(selectedAge) : '');
  const [ageMaxInput, setAgeMaxInput] = useState<string>('');

  // Price input values
  const [priceMinInput, setPriceMinInput] = useState<string>(minPrice > 0 ? String(minPrice) : '');
  const [priceMaxInput, setPriceMaxInput] = useState<string>(maxPrice < 5000 ? String(maxPrice) : '');

  const toggleSection = (section: string) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const toggleTree = (key: string) => {
    setTreeOpen(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Helper declension of result numbers
  const getDeclension = (n: number) => {
    const lastTwo = n % 100;
    const lastDigit = n % 10;
    if (lastTwo >= 11 && lastTwo <= 19) return 'результатов';
    if (lastDigit === 1) return 'результат';
    if (lastDigit >= 2 && lastDigit <= 4) return 'результата';
    return 'результатов';
  };

  // Helper to calculate selected count in each section
  const getGeoCount = () => {
    return selectedDistrict !== 'Все районы' ? 1 : 0;
  };

  const getCategoryCount = () => {
    return selectedTopCategories.length;
  };

  const getPriceCount = () => {
    return isFreeOnly || priceMinInput !== '' || priceMaxInput !== '' ? 1 : 0;
  };

  const getFormatCount = () => {
    return selectedFormat !== 'all' ? 1 : 0;
  };

  const getAgeCount = () => {
    return selectedAge !== null || ageMinInput !== '' || ageMaxInput !== '' ? 1 : 0;
  };

  const getWeekdayCount = () => {
    return selectedWeekdays.length;
  };

  const getTimeCount = () => {
    return timeOfDay !== 'all' ? 1 : 0;
  };

  const handleResetAll = () => {
    onResetFilters();
    setSelectedWeekdays([]);
    setIsNearbyOnly(false);
    setIsPhotoOnly(false);
    setAgeMinInput('');
    setAgeMaxInput('');
    setPriceMinInput('');
    setPriceMaxInput('');
    setOpenSections({
      geo: false,
      category: false,
      price: false,
      format: false,
      age: false,
      weekday: false,
      time: false,
    });
  };

  return (
    <aside aria-label="Фильтры поиска" className="filters variant1 approved">
      {/* Header */}
      <div className="filterhead">
        <strong>Фильтры</strong>
        <button className="reset" type="button" onClick={handleResetAll}>
          ↶ Сбросить всё
        </button>
      </div>

      {/* Scrollable list of sections */}
      <div
        aria-label="Список фильтров: прокрутите внутри панели, нижняя кнопка закреплена"
        className="filter-scroll"
        tabIndex={0}
      >
        {/* 1. РАСПОЛОЖЕНИЕ */}
        <section className={`filter-block ${openSections.geo ? 'open' : ''}`} data-section="geo">
          <button
            type="button"
            className="frow"
            aria-expanded={openSections.geo}
            onClick={() => toggleSection('geo')}
          >
            <span aria-hidden="true" className="filicon">
              <svg aria-hidden="true" className="fil-svg" fill="none" height="20" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width="20">
                <path d="M20 10c0 5.5-8 11-8 11S4 15.5 4 10a8 8 0 1 1 16 0Z" />
                <circle cx="12" cy="10" r="2.8" />
              </svg>
            </span>
            <span className="frow-label">
              <strong>Расположение</strong>
              <small>Город · район</small>
            </span>
            {getGeoCount() > 0 && (
              <span className="filter-count" aria-label={`Выбрано ${getGeoCount()}`}>
                {getGeoCount()}
              </span>
            )}
            <span aria-hidden="true" className="sign">{openSections.geo ? '−' : '+'}</span>
          </button>

          {!openSections.geo && selectedDistrict !== 'Все районы' && (
            <div className="selected-summary" aria-label={`Выбрано: ${selectedDistrict}`}>
              <span className="selected-chip">Тирасполь — {selectedDistrict}</span>
            </div>
          )}

          {openSections.geo && (
            <div className="fbody">
              <p className="microcopy">Выберите город, затем район</p>
              <div className="tree-root">
                {/* Тирасполь */}
                <div className="tree-node" data-depth="0">
                  <div className="tree-line">
                    <button
                      type="button"
                      className={`twisty ${treeOpen['Тирасполь'] ? 'is-open' : ''}`}
                      aria-expanded={treeOpen['Тирасполь']}
                      aria-label="Раскрыть Тирасполь"
                      onClick={() => toggleTree('Тирасполь')}
                    >
                      {treeOpen['Тирасполь'] ? '−' : '+'}
                    </button>
                    <input
                      type="checkbox"
                      className="branch-check"
                      checked={selectedDistrict === 'Все районы'}
                      onChange={() => onDistrictChange('Все районы')}
                      aria-label="Выбрать весь город Тирасполь"
                    />
                    <span className="tree-text">Тирасполь</span>
                  </div>
                  {treeOpen['Тирасполь'] && (
                    <div className="tree-kids">
                      {['Центр', 'Балка', 'Кировский', 'Западный', 'Северный'].map(d => (
                        <label key={d} className="tree-leaf">
                          <input
                            type="checkbox"
                            checked={selectedDistrict === d}
                            onChange={() => onDistrictChange(selectedDistrict === d ? 'Все районы' : d)}
                          />
                          <span>{d}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {/* Бендеры */}
                <div className="tree-node" data-depth="0">
                  <div className="tree-line">
                    <button
                      type="button"
                      className={`twisty ${treeOpen['Бендеры'] ? 'is-open' : ''}`}
                      aria-expanded={treeOpen['Бендеры']}
                      aria-label="Раскрыть Бендеры"
                      onClick={() => toggleTree('Бендеры')}
                    >
                      {treeOpen['Бендеры'] ? '−' : '+'}
                    </button>
                    <input
                      type="checkbox"
                      className="branch-check"
                      checked={selectedDistrict === 'Бендеры'}
                      onChange={() => onDistrictChange(selectedDistrict === 'Бендеры' ? 'Все районы' : 'Бендеры')}
                      aria-label="Выбрать весь город Бендеры"
                    />
                    <span className="tree-text">Бендеры</span>
                  </div>
                  {treeOpen['Бендеры'] && (
                    <div className="tree-kids">
                      {['Центр', 'Солнечный', 'Борисовка'].map(d => (
                        <label key={d} className="tree-leaf">
                          <input
                            type="checkbox"
                            checked={selectedDistrict === d}
                            onChange={() => onDistrictChange(selectedDistrict === d ? 'Все районы' : d)}
                          />
                          <span>{d}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {/* Рыбница */}
                <div className="tree-node" data-depth="0">
                  <div className="tree-line">
                    <button
                      type="button"
                      className={`twisty ${treeOpen['Рыбница'] ? 'is-open' : ''}`}
                      aria-expanded={treeOpen['Рыбница']}
                      aria-label="Раскрыть Рыбница"
                      onClick={() => toggleTree('Рыбница')}
                    >
                      {treeOpen['Рыбница'] ? '−' : '+'}
                    </button>
                    <input
                      type="checkbox"
                      className="branch-check"
                      checked={selectedDistrict === 'Рыбница'}
                      onChange={() => onDistrictChange(selectedDistrict === 'Рыбница' ? 'Все районы' : 'Рыбница')}
                    />
                    <span className="tree-text">Рыбница</span>
                  </div>
                  {treeOpen['Рыбница'] && (
                    <div className="tree-kids">
                      {['Центр', 'Вальченко'].map(d => (
                        <label key={d} className="tree-leaf">
                          <input
                            type="checkbox"
                            checked={selectedDistrict === d}
                            onChange={() => onDistrictChange(selectedDistrict === d ? 'Все районы' : d)}
                          />
                          <span>{d}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {/* Другие города ПМР */}
                {['Каменка', 'Слободзея', 'Дубоссары', 'Григориополь'].map(city => (
                  <div key={city} className="tree-node" data-depth="0">
                    <div className="tree-line">
                      <button
                        type="button"
                        className={`twisty ${treeOpen[city] ? 'is-open' : ''}`}
                        aria-expanded={treeOpen[city]}
                        aria-label={`Раскрыть ${city}`}
                        onClick={() => toggleTree(city)}
                      >
                        {treeOpen[city] ? '−' : '+'}
                      </button>
                      <input
                        type="checkbox"
                        className="branch-check"
                        checked={selectedDistrict === city}
                        onChange={() => onDistrictChange(selectedDistrict === city ? 'Все районы' : city)}
                      />
                      <span className="tree-text">{city}</span>
                    </div>
                    {treeOpen[city] && (
                      <div className="tree-kids">
                        <label className="tree-leaf">
                          <input
                            type="checkbox"
                            checked={selectedDistrict === city}
                            onChange={() => onDistrictChange(selectedDistrict === city ? 'Все районы' : city)}
                          />
                          <span>Центр</span>
                        </label>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* 2. КАТЕГОРИЯ */}
        <section className={`filter-block ${openSections.category ? 'open' : ''}`} data-section="category">
          <button
            type="button"
            className="frow"
            aria-expanded={openSections.category}
            onClick={() => toggleSection('category')}
          >
            <span aria-hidden="true" className="filicon">
              <svg aria-hidden="true" className="fil-svg" fill="none" height="20" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width="20">
                <rect height="7" rx="1.35" width="7" x="3" y="3" />
                <rect height="7" rx="1.35" width="7" x="14" y="3" />
                <rect height="7" rx="1.35" width="7" x="3" y="14" />
                <rect height="7" rx="1.35" width="7" x="14" y="14" />
              </svg>
            </span>
            <span className="frow-label">
              <strong>Категория</strong>
              <small>Услуги · занятия</small>
            </span>
            {getCategoryCount() > 0 && (
              <span className="filter-count" aria-label={`Выбрано ${getCategoryCount()}`}>
                {getCategoryCount()}
              </span>
            )}
            <span aria-hidden="true" className="sign">{openSections.category ? '−' : '+'}</span>
          </button>

          {!openSections.category && selectedTopCategories.length > 0 && (
            <div className="selected-summary">
              {selectedTopCategories.map(cat => (
                <span key={cat} className="selected-chip">
                  {cat === 'art' ? 'Творчество' : cat === 'sport' ? 'Спорт' : cat === 'tech' ? 'Технологии' : cat === 'education' ? 'Обучение' : cat}
                </span>
              ))}
            </div>
          )}

          {openSections.category && (
            <div className="fbody">
              <p className="microcopy">Тип → направление → поднаправление</p>
              <div className="tree-root">
                {/* Ветка Занятия */}
                <div className="tree-node" data-depth="0">
                  <div className="tree-line">
                    <button
                      type="button"
                      className={`twisty ${treeOpen['Занятия'] ? 'is-open' : ''}`}
                      aria-expanded={treeOpen['Занятия']}
                      aria-label="Раскрыть Занятия"
                      onClick={() => toggleTree('Занятия')}
                    >
                      {treeOpen['Занятия'] ? '−' : '+'}
                    </button>
                    <input
                      type="checkbox"
                      className="branch-check"
                      checked={selectedKind === 'activity'}
                      onChange={() => onKindChange('activity')}
                    />
                    <span className="tree-text">Занятия</span>
                  </div>
                  {treeOpen['Занятия'] && (
                    <div className="tree-kids">
                      {/* Танцы */}
                      <div className="tree-node" data-depth="1">
                        <div className="tree-line">
                          <button
                            type="button"
                            className={`twisty ${treeOpen['Танцы'] ? 'is-open' : ''}`}
                            aria-expanded={treeOpen['Танцы']}
                            aria-label="Раскрыть Танцы"
                            onClick={() => toggleTree('Танцы')}
                          >
                            {treeOpen['Танцы'] ? '−' : '+'}
                          </button>
                          <input
                            type="checkbox"
                            className="branch-check"
                            checked={selectedTopCategories.includes('art')}
                            onChange={() => onToggleCategory('art')}
                          />
                          <span className="tree-text">Танцы</span>
                        </div>
                        {treeOpen['Танцы'] && (
                          <div className="tree-kids">
                            <label className="tree-leaf">
                              <input
                                type="checkbox"
                                checked={selectedTopCategories.includes('art')}
                                onChange={() => onToggleCategory('art')}
                              />
                              <span>Хип-хоп</span>
                            </label>
                            <label className="tree-leaf">
                              <input
                                type="checkbox"
                                checked={selectedTopCategories.includes('art')}
                                onChange={() => onToggleCategory('art')}
                              />
                              <span>Современные танцы</span>
                            </label>
                            <label className="tree-leaf">
                              <input
                                type="checkbox"
                                checked={selectedTopCategories.includes('art')}
                                onChange={() => onToggleCategory('art')}
                              />
                              <span>Классические танцы</span>
                            </label>
                          </div>
                        )}
                      </div>

                      {/* Обучение */}
                      <div className="tree-node" data-depth="1">
                        <div className="tree-line">
                          <button
                            type="button"
                            className={`twisty ${treeOpen['Обучение'] ? 'is-open' : ''}`}
                            aria-expanded={treeOpen['Обучение']}
                            aria-label="Раскрыть Обучение"
                            onClick={() => toggleTree('Обучение')}
                          >
                            {treeOpen['Обучение'] ? '−' : '+'}
                          </button>
                          <input
                            type="checkbox"
                            className="branch-check"
                            checked={selectedTopCategories.includes('education')}
                            onChange={() => onToggleCategory('education')}
                          />
                          <span className="tree-text">Обучение</span>
                        </div>
                        {treeOpen['Обучение'] && (
                          <div className="tree-kids">
                            <label className="tree-leaf">
                              <input
                                type="checkbox"
                                checked={selectedTopCategories.includes('education')}
                                onChange={() => onToggleCategory('education')}
                              />
                              <span>Репетиторство (Языки, Точные науки)</span>
                            </label>
                            <label className="tree-leaf">
                              <input
                                type="checkbox"
                                checked={selectedTopCategories.includes('tech')}
                                onChange={() => onToggleCategory('tech')}
                              />
                              <span>Курсы (Программирование, IT)</span>
                            </label>
                          </div>
                        )}
                      </div>

                      {/* Спорт */}
                      <div className="tree-node" data-depth="1">
                        <div className="tree-line">
                          <button
                            type="button"
                            className={`twisty ${treeOpen['Спорт'] ? 'is-open' : ''}`}
                            aria-expanded={treeOpen['Спорт']}
                            aria-label="Раскрыть Спорт"
                            onClick={() => toggleTree('Спорт')}
                          >
                            {treeOpen['Спорт'] ? '−' : '+'}
                          </button>
                          <input
                            type="checkbox"
                            className="branch-check"
                            checked={selectedTopCategories.includes('sport')}
                            onChange={() => onToggleCategory('sport')}
                          />
                          <span className="tree-text">Спорт</span>
                        </div>
                        {treeOpen['Спорт'] && (
                          <div className="tree-kids">
                            <label className="tree-leaf">
                              <input
                                type="checkbox"
                                checked={selectedTopCategories.includes('sport')}
                                onChange={() => onToggleCategory('sport')}
                              />
                              <span>Футбол</span>
                            </label>
                            <label className="tree-leaf">
                              <input
                                type="checkbox"
                                checked={selectedTopCategories.includes('sport')}
                                onChange={() => onToggleCategory('sport')}
                              />
                              <span>Плавание</span>
                            </label>
                            <label className="tree-leaf">
                              <input
                                type="checkbox"
                                checked={selectedTopCategories.includes('sport')}
                                onChange={() => onToggleCategory('sport')}
                              />
                              <span>Гимнастика и единоборства</span>
                            </label>
                          </div>
                        )}
                      </div>

                      {/* Творчество */}
                      <div className="tree-node" data-depth="1">
                        <div className="tree-line">
                          <button
                            type="button"
                            className={`twisty ${treeOpen['Творчество'] ? 'is-open' : ''}`}
                            aria-expanded={treeOpen['Творчество']}
                            aria-label="Раскрыть Творчество"
                            onClick={() => toggleTree('Творчество')}
                          >
                            {treeOpen['Творчество'] ? '−' : '+'}
                          </button>
                          <input
                            type="checkbox"
                            className="branch-check"
                            checked={selectedTopCategories.includes('art')}
                            onChange={() => onToggleCategory('art')}
                          />
                          <span className="tree-text">Творчество</span>
                        </div>
                        {treeOpen['Творчество'] && (
                          <div className="tree-kids">
                            <label className="tree-leaf">
                              <input
                                type="checkbox"
                                checked={selectedTopCategories.includes('art')}
                                onChange={() => onToggleCategory('art')}
                              />
                              <span>Рисование и живопись</span>
                            </label>
                            <label className="tree-leaf">
                              <input
                                type="checkbox"
                                checked={selectedTopCategories.includes('art')}
                                onChange={() => onToggleCategory('art')}
                              />
                              <span>Лепка и скульптура</span>
                            </label>
                            <label className="tree-leaf">
                              <input
                                type="checkbox"
                                checked={selectedTopCategories.includes('art')}
                                onChange={() => onToggleCategory('art')}
                              />
                              <span>Вокал и музыка</span>
                            </label>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Ветка Услуги */}
                <div className="tree-node" data-depth="0">
                  <div className="tree-line">
                    <button
                      type="button"
                      className={`twisty ${treeOpen['Услуги'] ? 'is-open' : ''}`}
                      aria-expanded={treeOpen['Услуги']}
                      aria-label="Раскрыть Услуги"
                      onClick={() => toggleTree('Услуги')}
                    >
                      {treeOpen['Услуги'] ? '−' : '+'}
                    </button>
                    <input
                      type="checkbox"
                      className="branch-check"
                      checked={selectedKind === 'service'}
                      onChange={() => onKindChange('service')}
                    />
                    <span className="tree-text">Услуги</span>
                  </div>
                  {treeOpen['Услуги'] && (
                    <div className="tree-kids">
                      <label className="tree-leaf">
                        <input
                          type="checkbox"
                          checked={selectedTopCategories.includes('animals')}
                          onChange={() => onToggleCategory('animals')}
                        />
                        <span>Животные (Груминг, уход)</span>
                      </label>
                      <label className="tree-leaf">
                        <input
                          type="checkbox"
                          checked={selectedTopCategories.includes('craft')}
                          onChange={() => onToggleCategory('craft')}
                        />
                        <span>Ремонт и мастерские</span>
                      </label>
                      <label className="tree-leaf">
                        <input
                          type="checkbox"
                          checked={selectedTopCategories.includes('other')}
                          onChange={() => onToggleCategory('other')}
                        />
                        <span>Красота, фото и видео</span>
                      </label>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>

        {/* 3. ЦЕНА */}
        <section className={`filter-block ${openSections.price ? 'open' : ''}`} data-section="price">
          <button
            type="button"
            className="frow"
            aria-expanded={openSections.price}
            onClick={() => toggleSection('price')}
          >
            <span aria-hidden="true" className="filicon">
              <svg aria-hidden="true" className="fil-svg" fill="none" height="20" stroke="#6545C6" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" width="20">
                <rect x="2.2" y="5.4" width="19.6" height="13.2" rx="2.3" fill="none" stroke="#6545C6" strokeWidth="1.8" />
                <circle cx="12" cy="12" r="3" fill="none" stroke="#6545C6" strokeWidth="1.6" />
                <path d="M5 8.4 H7.1 M16.9 15.6 H19" fill="none" stroke="#6545C6" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </span>
            <span className="frow-label">
              <strong>Цена</strong>
              <small>Диапазон или бесплатно</small>
            </span>
            {getPriceCount() > 0 && (
              <span className="filter-count" aria-label={`Выбрано ${getPriceCount()}`}>
                {getPriceCount()}
              </span>
            )}
            <span aria-hidden="true" className="sign">{openSections.price ? '−' : '+'}</span>
          </button>

          {!openSections.price && (isFreeOnly || priceMinInput !== '' || priceMaxInput !== '') && (
            <div className="selected-summary">
              <span className="selected-chip">
                {isFreeOnly
                  ? 'Бесплатно'
                  : priceMinInput && priceMaxInput
                  ? `От ${priceMinInput} до ${priceMaxInput} руб`
                  : priceMinInput
                  ? `От ${priceMinInput} руб`
                  : `До ${priceMaxInput} руб`}
              </span>
            </div>
          )}

          {openSections.price && (
            <div className="fbody">
              <div aria-label="Способ выбора цены" className="price-mode" role="radiogroup">
                <label className="mode">
                  <input
                    name="price-mode"
                    type="radio"
                    value="range"
                    checked={!isFreeOnly}
                    onChange={() => onToggleFreeOnly(false)}
                  />
                  <span>Диапазон</span>
                </label>
                <label className="mode">
                  <input
                    name="price-mode"
                    type="radio"
                    value="free"
                    checked={isFreeOnly}
                    onChange={() => onToggleFreeOnly(true)}
                  />
                  <span>Бесплатно</span>
                </label>
              </div>

              <div className="range-fields" id="price-fields">
                <label>
                  <span>От, руб.</span>
                  <input
                    aria-label="Цена от"
                    id="price-min"
                    inputMode="numeric"
                    min="0"
                    placeholder="0"
                    type="number"
                    disabled={isFreeOnly}
                    value={priceMinInput}
                    onChange={(e) => {
                      setPriceMinInput(e.target.value);
                      if (onMinPriceChange) onMinPriceChange(Number(e.target.value) || 0);
                    }}
                  />
                </label>
                <label>
                  <span>До, руб.</span>
                  <input
                    aria-label="Цена до"
                    id="price-max"
                    inputMode="numeric"
                    min="0"
                    placeholder="5000"
                    type="number"
                    disabled={isFreeOnly}
                    value={priceMaxInput}
                    onChange={(e) => {
                      setPriceMaxInput(e.target.value);
                      onMaxPriceChange(Number(e.target.value) || 5000);
                    }}
                  />
                </label>
              </div>
              <small className="range-note">Можно указать одну или обе границы</small>
            </div>
          )}
        </section>

        {/* 4. ФОРМАТ */}
        <section className={`filter-block ${openSections.format ? 'open' : ''}`} data-section="format">
          <button
            type="button"
            className="frow"
            aria-expanded={openSections.format}
            onClick={() => toggleSection('format')}
          >
            <span aria-hidden="true" className="filicon">
              <svg aria-hidden="true" className="fil-svg" fill="none" height="20" viewBox="0 0 24 24" width="20">
                <defs>
                  <clipPath id={formatClipId}>
                    <rect height="19.2" rx="4" width="19.2" x="2.4" y="2.4" />
                  </clipPath>
                </defs>
                <g clipPath={`url(#${formatClipId})`}>
                  <rect fill="#FFFFFF" height="19.2" width="19.2" x="2.4" y="2.4" />
                  <path d="M12 2.4h9.6v19.2H12z" fill="#6545C6" />
                  <circle cx="7.3" cy="8" fill="#6545C6" r="2" />
                  <circle cx="16.8" cy="16" fill="#FFFFFF" r="2" />
                </g>
                <rect height="19.2" rx="4" stroke="#6545C6" strokeWidth="1.8" width="19.2" x="2.4" y="2.4" />
              </svg>
            </span>
            <span className="frow-label">
              <strong>Формат</strong>
              <small>Онлайн · офлайн</small>
            </span>
            {getFormatCount() > 0 && (
              <span className="filter-count" aria-label={`Выбрано ${getFormatCount()}`}>
                {getFormatCount()}
              </span>
            )}
            <span aria-hidden="true" className="sign">{openSections.format ? '−' : '+'}</span>
          </button>

          {!openSections.format && selectedFormat !== 'all' && (
            <div className="selected-summary">
              <span className="selected-chip">
                {selectedFormat === 'online' ? 'Онлайн' : 'Офлайн'}
              </span>
            </div>
          )}

          {openSections.format && (
            <div className="fbody">
              <div className="check-list">
                <label>
                  <input
                    type="checkbox"
                    checked={selectedFormat === 'online' || selectedFormat === 'both'}
                    onChange={() => {
                      if (selectedFormat === 'online') onFormatChange('all');
                      else onFormatChange('online');
                    }}
                  />
                  <span>Онлайн</span>
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={selectedFormat === 'offline' || selectedFormat === 'both'}
                    onChange={() => {
                      if (selectedFormat === 'offline') onFormatChange('all');
                      else onFormatChange('offline');
                    }}
                  />
                  <span>Офлайн</span>
                </label>
              </div>
            </div>
          )}
        </section>

        {/* 5. ВОЗРАСТ */}
        <section className={`filter-block ${openSections.age ? 'open' : ''}`} data-section="age">
          <button
            type="button"
            className="frow"
            aria-expanded={openSections.age}
            onClick={() => toggleSection('age')}
          >
            <span aria-hidden="true" className="filicon">
              <svg aria-hidden="true" className="fil-svg" fill="none" height="20" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width="20">
                <circle cx="8.1" cy="6.4" fill="currentColor" r="3.2" stroke="none" />
                <rect fill="currentColor" height="10" rx="2.25" stroke="none" width="11" x="2.5" y="11" />
                <circle cx="17.2" cy="11.1" fill="currentColor" r="2.3" stroke="none" />
                <path d="M13.7 19.5c0-3 1.7-4.6 3.6-4.6s3.8 1.6 3.8 4.6v1.1h-7.4z" fill="currentColor" stroke="none" />
              </svg>
            </span>
            <span className="frow-label">
              <strong>Возраст</strong>
              <small>От · до 99 лет</small>
            </span>
            {getAgeCount() > 0 && (
              <span className="filter-count" aria-label={`Выбрано ${getAgeCount()}`}>
                {getAgeCount()}
              </span>
            )}
            <span aria-hidden="true" className="sign">{openSections.age ? '−' : '+'}</span>
          </button>

          {!openSections.age && (selectedAge !== null || ageMinInput !== '' || ageMaxInput !== '') && (
            <div className="selected-summary">
              <span className="selected-chip">
                {ageMinInput && ageMaxInput
                  ? `${ageMinInput}–${ageMaxInput} лет`
                  : ageMinInput
                  ? `От ${ageMinInput} лет`
                  : `${selectedAge} лет`}
              </span>
            </div>
          )}

          {openSections.age && (
            <div className="fbody">
              <div className="range-fields">
                <label>
                  <span>От, лет</span>
                  <input
                    aria-label="Возраст от"
                    id="age-min"
                    inputMode="numeric"
                    max="99"
                    min="0"
                    placeholder="0"
                    type="number"
                    value={ageMinInput}
                    onChange={(e) => {
                      setAgeMinInput(e.target.value);
                      onAgeChange(e.target.value ? Number(e.target.value) : null);
                    }}
                  />
                </label>
                <label>
                  <span>До, лет</span>
                  <input
                    aria-label="Возраст до"
                    id="age-max"
                    inputMode="numeric"
                    max="99"
                    min="0"
                    placeholder="99"
                    type="number"
                    value={ageMaxInput}
                    onChange={(e) => setAgeMaxInput(e.target.value)}
                  />
                </label>
              </div>
              <small className="range-note">Допустимый возраст: 0–99 лет</small>
            </div>
          )}
        </section>

        {/* 6. ДЕНЬ НЕДЕЛИ */}
        <section className={`filter-block ${openSections.weekday ? 'open' : ''}`} data-section="weekday">
          <button
            type="button"
            className="frow"
            aria-expanded={openSections.weekday}
            onClick={() => toggleSection('weekday')}
          >
            <span aria-hidden="true" className="filicon">
              <svg aria-hidden="true" className="fil-svg" fill="none" height="20" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" viewBox="0 0 24 24" width="20">
                <rect height="16.7" rx="2.4" width="18.2" x="2.9" y="4.6" />
                <path d="M7.6 2.6v4M16.4 2.6v4M2.9 9.6h18.2" />
                <rect fill="currentColor" height="3.1" rx=".4" stroke="none" width="3.3" x="5.5" y="11.8" />
                <rect fill="currentColor" height="3.1" rx=".4" stroke="none" width="3.3" x="10.3" y="11.8" />
                <rect height="3.1" rx=".4" strokeWidth=".9" width="3.3" x="15.1" y="11.8" />
                <rect height="2.7" rx=".4" strokeWidth=".9" width="3.3" x="5.5" y="16.3" />
                <rect height="2.7" rx=".4" strokeWidth=".9" width="3.3" x="10.3" y="16.3" />
              </svg>
            </span>
            <span className="frow-label">
              <strong>День недели</strong>
              <small>Пн · Вт · Ср · Чт · Пт · Сб · Вс</small>
            </span>
            {getWeekdayCount() > 0 && (
              <span className="filter-count" aria-label={`Выбрано ${getWeekdayCount()}`}>
                {getWeekdayCount()}
              </span>
            )}
            <span aria-hidden="true" className="sign">{openSections.weekday ? '−' : '+'}</span>
          </button>

          {!openSections.weekday && selectedWeekdays.length > 0 && (
            <div className="selected-summary">
              {selectedWeekdays.map(d => (
                <span key={d} className="selected-chip">{d}</span>
              ))}
            </div>
          )}

          {openSections.weekday && (
            <div className="fbody">
              <div className="check-list day-list">
                {['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'].map(day => (
                  <label key={day}>
                    <input
                      type="checkbox"
                      checked={selectedWeekdays.includes(day)}
                      onChange={() => {
                        setSelectedWeekdays(prev =>
                          prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
                        );
                      }}
                    />
                    <span>{day}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* 7. ВРЕМЯ */}
        <section className={`filter-block ${openSections.time ? 'open' : ''}`} data-section="time">
          <button
            type="button"
            className="frow"
            aria-expanded={openSections.time}
            onClick={() => toggleSection('time')}
          >
            <span aria-hidden="true" className="filicon">
              <svg aria-hidden="true" className="fil-svg" fill="none" height="20" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width="20">
                <circle cx="12" cy="12" r="9.3" />
                <path d="M12 6.4v6l4.1 2.65" />
              </svg>
            </span>
            <span className="frow-label">
              <strong>Время</strong>
              <small>Утро · день · вечер</small>
            </span>
            {getTimeCount() > 0 && (
              <span className="filter-count" aria-label={`Выбрано ${getTimeCount()}`}>
                {getTimeCount()}
              </span>
            )}
            <span aria-hidden="true" className="sign">{openSections.time ? '−' : '+'}</span>
          </button>

          {!openSections.time && timeOfDay !== 'all' && (
            <div className="selected-summary">
              <span className="selected-chip">
                {timeOfDay === 'morning' ? 'Утро 07:00–12:00' : timeOfDay === 'afternoon' ? 'День 12:00–17:00' : 'Вечер 17:00–22:00'}
              </span>
            </div>
          )}

          {openSections.time && (
            <div className="fbody">
              <div className="check-list time-list">
                <label>
                  <input
                    type="checkbox"
                    checked={timeOfDay === 'morning'}
                    onChange={() => onTimeOfDayChange(timeOfDay === 'morning' ? 'all' : 'morning')}
                  />
                  <span>
                    Утро <small>07:00–12:00</small>
                  </span>
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={timeOfDay === 'afternoon'}
                    onChange={() => onTimeOfDayChange(timeOfDay === 'afternoon' ? 'all' : 'afternoon')}
                  />
                  <span>
                    День <small>12:00–17:00</small>
                  </span>
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={timeOfDay === 'evening'}
                    onChange={() => onTimeOfDayChange(timeOfDay === 'evening' ? 'all' : 'evening')}
                  />
                  <span>
                    Вечер <small>17:00–22:00</small>
                  </span>
                </label>
              </div>
            </div>
          )}
        </section>

        {/* Microcopy Helper */}
        <div className="filters-help">
          Откройте нужный фильтр с помощью «+». Остальные разделы останутся на месте, панель прокручивается отдельно.
        </div>
      </div>

      {/* Footer Controls */}
      <div className="filtersfoot">
        <label className="toggleline">
          <span className="filicon">
            <svg aria-hidden="true" className="fil-svg" fill="none" height="20" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width="20">
              <circle cx="12" cy="12" r="9" />
              <path d="m7.9 12.2 2.8 2.75 5.5-5.8" />
            </svg>
          </span>
          <span className="txt">Проверенные</span>
          <input
            aria-label="Проверенные"
            checked={isVerifiedOnly}
            onChange={(e) => onToggleVerifiedOnly(e.target.checked)}
            className="sr-only"
            role="switch"
            type="checkbox"
          />
          <span aria-hidden="true" className={`switch ${isVerifiedOnly ? 'on' : ''}`}>
            <span className="knob" />
          </span>
        </label>

        <label className="toggleline">
          <span className="filicon">
            <svg aria-hidden="true" className="fil-svg" fill="none" height="20" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width="20">
              <path d="M20 10c0 5.5-8 11-8 11S4 15.5 4 10a8 8 0 1 1 16 0Z" />
              <circle cx="12" cy="10" r="2.8" />
            </svg>
          </span>
          <span className="txt">Рядом со мной</span>
          <input
            aria-label="Рядом со мной"
            checked={isNearbyOnly}
            onChange={(e) => setIsNearbyOnly(e.target.checked)}
            className="sr-only"
            role="switch"
            type="checkbox"
          />
          <span aria-hidden="true" className={`switch ${isNearbyOnly ? 'on' : ''}`}>
            <span className="knob" />
          </span>
        </label>

        <label className="toggleline">
          <span className="filicon">
            <svg aria-hidden="true" className="fil-svg" fill="none" height="20" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width="20">
              <path d="M15 5H9L7 7.5H4.8A2.8 2.8 0 0 0 2 10.3v7A2.8 2.8 0 0 0 4.8 20h14.4a2.8 2.8 0 0 0 2.8-2.7v-7a2.8 2.8 0 0 0-2.8-2.8H17L15 5Z" />
              <circle cx="12" cy="13.6" r="3.25" />
            </svg>
          </span>
          <span className="txt">Только с фото</span>
          <input
            aria-label="Только с фото"
            checked={isPhotoOnly}
            onChange={(e) => setIsPhotoOnly(e.target.checked)}
            className="sr-only"
            role="switch"
            type="checkbox"
          />
          <span aria-hidden="true" className={`switch ${isPhotoOnly ? 'on' : ''}`}>
            <span className="knob" />
          </span>
        </label>

        <button
          className="resultsbtn"
          type="button"
          onClick={() => {
            if (onApplyFilters) onApplyFilters();
          }}
        >
          Показать {totalFilteredCount} {getDeclension(totalFilteredCount)}
        </button>
      </div>
    </aside>
  );
};
