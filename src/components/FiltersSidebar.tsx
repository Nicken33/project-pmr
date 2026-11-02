import React, { useState } from 'react';
import { ArrowLeft } from 'lucide-react';

export interface FilterState {
  geo: string[];
  category: string[];
  priceMode: 'range' | 'free';
  priceMin: number | null;
  priceMax: number | null;
  format: string[];
  ageMin: number | null;
  ageMax: number | null;
  weekday: string[];
  time: string[];
  verified: boolean;
  nearby: boolean;
  photo: boolean;
}

interface FiltersSidebarProps {
  filterState: FilterState;
  onFilterChange: (newState: FilterState) => void;
  onResetFilters: () => void;
  onBack?: () => void;
}

export const FiltersSidebar: React.FC<FiltersSidebarProps> = ({
  filterState,
  onFilterChange,
  onResetFilters,
  onBack,
}) => {
  // Accordion open/close state for top-level filter blocks
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    geo: false,
    category: false,
    price: false,
    format: false,
    age: false,
    weekday: false,
    time: false,
  });

  // Tree node open/close state for nested categories and cities
  const [openNodes, setOpenNodes] = useState<Record<string, boolean>>({
    'Тирасполь': true,
    'Бендеры': false,
    'Рыбница': false,
    'Каменка': false,
    'Слободзея': false,
    'Дубоссары': false,
    'Григориополь': false,
    'Занятия': true,
    'Занятия/Танцы': true,
    'Занятия/Обучение': false,
    'Занятия/Обучение/Репетиторство': false,
    'Занятия/Обучение/Курсы': false,
    'Занятия/Спорт': false,
    'Занятия/Творчество': false,
    'Услуги': false,
    'Услуги/Красота и уход': false,
    'Услуги/Ремонт': false,
    'Услуги/Фото и видео': false,
    'Услуги/Животные': false,
  });

  const toggleSection = (sectionKey: string) => {
    setOpenSections((prev) => ({
      ...prev,
      [sectionKey]: !prev[sectionKey],
    }));
  };

  const toggleNode = (nodePath: string) => {
    setOpenNodes((prev) => ({
      ...prev,
      [nodePath]: !prev[nodePath],
    }));
  };

  // Helper for single toggle
  const toggleArrayItem = (key: 'geo' | 'category' | 'format' | 'weekday' | 'time', item: string) => {
    const list = filterState[key];
    const nextList = list.includes(item)
      ? list.filter((x) => x !== item)
      : [...list, item];
    onFilterChange({
      ...filterState,
      [key]: nextList,
    });
  };

  // Helper for branch check (select/unselect all children)
  const toggleBranch = (key: 'geo' | 'category', children: string[], select: boolean) => {
    const current = filterState[key];
    let nextList: string[];
    if (select) {
      const set = new Set([...current, ...children]);
      nextList = Array.from(set);
    } else {
      nextList = current.filter((x) => !children.includes(x));
    }
    onFilterChange({
      ...filterState,
      [key]: nextList,
    });
  };

  // Geo hierarchy data
  const geoData = [
    {
      city: 'Тирасполь',
      districts: ['Центр', 'Балка', 'Западный', 'Бородинка', 'Кировский', 'Красные Казармы', 'Суклея'],
    },
    {
      city: 'Бендеры',
      districts: ['Центр', 'Солнечный', 'Борисовка', 'Северный', 'Ленинский'],
    },
    {
      city: 'Рыбница',
      districts: ['Центр', 'Вальченко'],
    },
    {
      city: 'Каменка',
      districts: ['Центр'],
    },
    {
      city: 'Слободзея',
      districts: ['Центр'],
    },
    {
      city: 'Дубоссары',
      districts: ['Центр'],
    },
    {
      city: 'Григориополь',
      districts: ['Центр'],
    },
  ];

  // Category hierarchy data
  const categoryTree = [
    {
      title: 'Занятия',
      path: 'Занятия',
      subGroups: [
        {
          title: 'Танцы',
          path: 'Занятия/Танцы',
          items: ['Хип-хоп', 'Современные танцы', 'Классические танцы'],
        },
        {
          title: 'Обучение',
          path: 'Занятия/Обучение',
          nested: [
            {
              title: 'Репетиторство',
              path: 'Занятия/Обучение/Репетиторство',
              items: ['Английский язык', 'Математика'],
            },
            {
              title: 'Курсы',
              path: 'Занятия/Обучение/Курсы',
              items: ['Программирование', 'Дизайн'],
            },
          ],
        },
        {
          title: 'Спорт',
          path: 'Занятия/Спорт',
          items: ['Футбол', 'Плавание', 'Гимнастика'],
        },
        {
          title: 'Творчество',
          path: 'Занятия/Творчество',
          items: ['Рисование', 'Лепка', 'Вокал'],
        },
      ],
    },
    {
      title: 'Услуги',
      path: 'Услуги',
      subGroups: [
        {
          title: 'Красота и уход',
          path: 'Услуги/Красота и уход',
          items: ['Стрижка', 'Макияж'],
        },
        {
          title: 'Ремонт',
          path: 'Услуги/Ремонт',
          items: ['Ремонт техники', 'Мелкий ремонт'],
        },
        {
          title: 'Фото и видео',
          path: 'Услуги/Фото и видео',
          items: ['Фотосъёмка', 'Видеосъёмка'],
        },
        {
          title: 'Животные',
          path: 'Услуги/Животные',
          items: ['Груминг'],
        },
      ],
    },
  ];

  // Helper summaries for collapsed filters
  const getGeoSummary = (): string[] => {
    const list = filterState.geo;
    if (!list.length) return [];
    const grouped: Record<string, string[]> = {};
    list.forEach((path) => {
      const [city, dist] = path.split('/');
      if (!grouped[city]) grouped[city] = [];
      if (dist) grouped[city].push(dist);
    });
    return Object.entries(grouped).map(([city, dists]) => {
      return dists.length ? `${city} — ${dists.join(', ')}` : city;
    });
  };

  const getCategorySummary = (): string[] => {
    const list = filterState.category;
    if (!list.length) return [];
    return list.map((item) => item.split('/').pop() || item);
  };

  const getPriceSummary = (): string[] => {
    if (filterState.priceMode === 'free') return ['Бесплатно'];
    const min = filterState.priceMin;
    const max = filterState.priceMax;
    if (min !== null && max !== null) return [`От ${min} до ${max} руб.`];
    if (min !== null) return [`От ${min} руб.`];
    if (max !== null) return [`До ${max} руб.`];
    return [];
  };

  const getAgeSummary = (): string[] => {
    const min = filterState.ageMin;
    const max = filterState.ageMax;
    if (min !== null && max !== null) return [`${min}–${max} лет`];
    if (min !== null) return [`От ${min} лет`];
    if (max !== null) return [`До ${max} лет`];
    return [];
  };

  return (
    <aside aria-label="Фильтры поиска" className="filters approved">
      {/* Head */}
      <div className="filterhead flex items-center justify-between">
        <div className="flex items-center gap-2">
          {onBack && (
            <button
              className="p-1.5 -ml-1 text-[#6545C6] hover:bg-[#EEEAFB] rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
              type="button"
              onClick={onBack}
              title="Назад"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Назад</span>
            </button>
          )}
          <strong>Фильтры</strong>
        </div>
        <button
          className="reset cursor-pointer"
          type="button"
          onClick={onResetFilters}
          title="Сбросить все выбранные фильтры"
        >
          ↶ Сбросить всё
        </button>
      </div>

      {/* Scrollable Filters Accordion */}
      <div className="filter-scroll" tabIndex={0} aria-label="Список фильтров">
        {/* 1. Расположение */}
        <section className={`filter-block ${openSections.geo ? 'open' : ''}`} data-section="geo">
          <button
            type="button"
            className="frow"
            onClick={() => toggleSection('geo')}
            aria-expanded={openSections.geo}
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
            {filterState.geo.length > 0 && (
              <span className="filter-count" aria-label={`Выбрано ${filterState.geo.length}`}>
                {filterState.geo.length}
              </span>
            )}
            <span aria-hidden="true" className="sign">
              {openSections.geo ? '−' : '+'}
            </span>
          </button>

          {/* Selected Summary Chip when collapsed */}
          {!openSections.geo && getGeoSummary().length > 0 && (
            <div className="selected-summary">
              {getGeoSummary().map((chip, idx) => (
                <span key={idx} className="selected-chip">
                  {chip}
                </span>
              ))}
            </div>
          )}

          {/* Body when open */}
          {openSections.geo && (
            <div className="fbody">
              <p className="microcopy">Выберите город, затем район</p>
              <div className="tree-root">
                {geoData.map((cityGroup) => {
                  const isOpen = !!openNodes[cityGroup.city];
                  const childPaths = cityGroup.districts.map((d) => `${cityGroup.city}/${d}`);
                  const checkedCount = childPaths.filter((p) => filterState.geo.includes(p)).length;
                  const isAllChecked = childPaths.length > 0 && checkedCount === childPaths.length;
                  const isIndeterminate = checkedCount > 0 && checkedCount < childPaths.length;

                  return (
                    <div key={cityGroup.city} className="tree-node" data-depth="0">
                      <div className="tree-line">
                        <button
                          type="button"
                          className={`twisty ${isOpen ? 'is-open' : ''}`}
                          onClick={() => toggleNode(cityGroup.city)}
                          aria-expanded={isOpen}
                          aria-label={`Раскрыть ${cityGroup.city}`}
                        >
                          {isOpen ? '−' : '+'}
                        </button>
                        <input
                          type="checkbox"
                          className="branch-check"
                          checked={isAllChecked}
                          ref={(el) => {
                            if (el) el.indeterminate = isIndeterminate;
                          }}
                          onChange={(e) => toggleBranch('geo', childPaths, e.target.checked)}
                          aria-label={`Выбрать весь город ${cityGroup.city}`}
                        />
                        <span className="tree-text">{cityGroup.city}</span>
                      </div>

                      {isOpen && (
                        <div className="tree-kids">
                          {cityGroup.districts.map((d) => {
                            const fullPath = `${cityGroup.city}/${d}`;
                            const isChecked = filterState.geo.includes(fullPath);
                            return (
                              <label key={d} className="tree-leaf">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleArrayItem('geo', fullPath)}
                                />
                                <span>{d}</span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {/* 2. Категория */}
        <section className={`filter-block ${openSections.category ? 'open' : ''}`} data-section="category">
          <button
            type="button"
            className="frow"
            onClick={() => toggleSection('category')}
            aria-expanded={openSections.category}
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
            {filterState.category.length > 0 && (
              <span className="filter-count" aria-label={`Выбрано ${filterState.category.length}`}>
                {filterState.category.length}
              </span>
            )}
            <span aria-hidden="true" className="sign">
              {openSections.category ? '−' : '+'}
            </span>
          </button>

          {!openSections.category && getCategorySummary().length > 0 && (
            <div className="selected-summary">
              {getCategorySummary().map((chip, idx) => (
                <span key={idx} className="selected-chip">
                  {chip}
                </span>
              ))}
            </div>
          )}

          {openSections.category && (
            <div className="fbody">
              <p className="microcopy">Тип → направление → поднаправление</p>
              <div className="tree-root">
                {categoryTree.map((topNode) => {
                  const isTopOpen = !!openNodes[topNode.path];
                  return (
                    <div key={topNode.path} className="tree-node" data-depth="0">
                      <div className="tree-line">
                        <button
                          type="button"
                          className={`twisty ${isTopOpen ? 'is-open' : ''}`}
                          onClick={() => toggleNode(topNode.path)}
                          aria-expanded={isTopOpen}
                          aria-label={`Раскрыть ${topNode.title}`}
                        >
                          {isTopOpen ? '−' : '+'}
                        </button>
                        <span className="tree-text font-bold">{topNode.title}</span>
                      </div>

                      {isTopOpen && (
                        <div className="tree-kids">
                          {topNode.subGroups.map((sub) => {
                            const isSubOpen = !!openNodes[sub.path];

                            if (sub.nested) {
                              return (
                                <div key={sub.path} className="tree-node" data-depth="1">
                                  <div className="tree-line">
                                    <button
                                      type="button"
                                      className={`twisty ${isSubOpen ? 'is-open' : ''}`}
                                      onClick={() => toggleNode(sub.path)}
                                      aria-expanded={isSubOpen}
                                    >
                                      {isSubOpen ? '−' : '+'}
                                    </button>
                                    <span className="tree-text">{sub.title}</span>
                                  </div>

                                  {isSubOpen && (
                                    <div className="tree-kids">
                                      {sub.nested.map((nst) => {
                                        const isNstOpen = !!openNodes[nst.path];
                                        const nstLeaves = nst.items.map((i) => `${nst.path}/${i}`);
                                        const nstChecked = nstLeaves.filter((p) => filterState.category.includes(p)).length;
                                        return (
                                          <div key={nst.path} className="tree-node" data-depth="2">
                                            <div className="tree-line">
                                              <button
                                                type="button"
                                                className={`twisty ${isNstOpen ? 'is-open' : ''}`}
                                                onClick={() => toggleNode(nst.path)}
                                              >
                                                {isNstOpen ? '−' : '+'}
                                              </button>
                                              <input
                                                type="checkbox"
                                                className="branch-check"
                                                checked={nstLeaves.length > 0 && nstChecked === nstLeaves.length}
                                                ref={(el) => {
                                                  if (el) el.indeterminate = nstChecked > 0 && nstChecked < nstLeaves.length;
                                                }}
                                                onChange={(e) => toggleBranch('category', nstLeaves, e.target.checked)}
                                              />
                                              <span className="tree-text">{nst.title}</span>
                                            </div>
                                            {isNstOpen && (
                                              <div className="tree-kids">
                                                {nst.items.map((item) => {
                                                  const full = `${nst.path}/${item}`;
                                                  return (
                                                    <label key={item} className="tree-leaf">
                                                      <input
                                                        type="checkbox"
                                                        checked={filterState.category.includes(full)}
                                                        onChange={() => toggleArrayItem('category', full)}
                                                      />
                                                      <span>{item}</span>
                                                    </label>
                                                  );
                                                })}
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            }

                            // Sub group with items directly
                            const leaves = (sub.items || []).map((i) => `${sub.path}/${i}`);
                            const checkedLeaves = leaves.filter((p) => filterState.category.includes(p)).length;
                            const isAllChecked = leaves.length > 0 && checkedLeaves === leaves.length;
                            const isIndeterminate = checkedLeaves > 0 && checkedLeaves < leaves.length;

                            return (
                              <div key={sub.path} className="tree-node" data-depth="1">
                                <div className="tree-line">
                                  <button
                                    type="button"
                                    className={`twisty ${isSubOpen ? 'is-open' : ''}`}
                                    onClick={() => toggleNode(sub.path)}
                                    aria-expanded={isSubOpen}
                                  >
                                    {isSubOpen ? '−' : '+'}
                                  </button>
                                  <input
                                    type="checkbox"
                                    className="branch-check"
                                    checked={isAllChecked}
                                    ref={(el) => {
                                      if (el) el.indeterminate = isIndeterminate;
                                    }}
                                    onChange={(e) => toggleBranch('category', leaves, e.target.checked)}
                                  />
                                  <span className="tree-text">{sub.title}</span>
                                </div>

                                {isSubOpen && (
                                  <div className="tree-kids">
                                    {(sub.items || []).map((item) => {
                                      const full = `${sub.path}/${item}`;
                                      return (
                                        <label key={item} className="tree-leaf">
                                          <input
                                            type="checkbox"
                                            checked={filterState.category.includes(full)}
                                            onChange={() => toggleArrayItem('category', full)}
                                          />
                                          <span>{item}</span>
                                        </label>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {/* 3. Цена */}
        <section className={`filter-block ${openSections.price ? 'open' : ''}`} data-section="price">
          <button
            type="button"
            className="frow"
            onClick={() => toggleSection('price')}
            aria-expanded={openSections.price}
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
            {(filterState.priceMode === 'free' || filterState.priceMin !== null || filterState.priceMax !== null) && (
              <span className="filter-count">1</span>
            )}
            <span aria-hidden="true" className="sign">
              {openSections.price ? '−' : '+'}
            </span>
          </button>

          {!openSections.price && getPriceSummary().length > 0 && (
            <div className="selected-summary">
              {getPriceSummary().map((chip, idx) => (
                <span key={idx} className="selected-chip">
                  {chip}
                </span>
              ))}
            </div>
          )}

          {openSections.price && (
            <div className="fbody">
              <div aria-label="Способ выбора цены" className="price-mode" role="radiogroup">
                <label className="mode">
                  <input
                    type="radio"
                    name="price-mode"
                    value="range"
                    checked={filterState.priceMode === 'range'}
                    onChange={() => onFilterChange({ ...filterState, priceMode: 'range' })}
                  />
                  <span>Диапазон</span>
                </label>
                <label className="mode">
                  <input
                    type="radio"
                    name="price-mode"
                    value="free"
                    checked={filterState.priceMode === 'free'}
                    onChange={() => onFilterChange({ ...filterState, priceMode: 'free' })}
                  />
                  <span>Бесплатно</span>
                </label>
              </div>

              <div className="range-fields">
                <label>
                  <span>От, руб.</span>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    disabled={filterState.priceMode === 'free'}
                    value={filterState.priceMin ?? ''}
                    onChange={(e) => {
                      const v = e.target.value === '' ? null : Number(e.target.value);
                      onFilterChange({ ...filterState, priceMin: v });
                    }}
                  />
                </label>
                <label>
                  <span>До, руб.</span>
                  <input
                    type="number"
                    min="0"
                    placeholder="5000"
                    disabled={filterState.priceMode === 'free'}
                    value={filterState.priceMax ?? ''}
                    onChange={(e) => {
                      const v = e.target.value === '' ? null : Number(e.target.value);
                      onFilterChange({ ...filterState, priceMax: v });
                    }}
                  />
                </label>
              </div>
              <small className="range-note">Можно указать одну или обе границы</small>
            </div>
          )}
        </section>

        {/* 4. Формат */}
        <section className={`filter-block ${openSections.format ? 'open' : ''}`} data-section="format">
          <button
            type="button"
            className="frow"
            onClick={() => toggleSection('format')}
            aria-expanded={openSections.format}
          >
            <span aria-hidden="true" className="filicon">
              <svg aria-hidden="true" className="fil-svg" fill="none" height="20" viewBox="0 0 24 24" width="20">
                <defs>
                  <clipPath id="format-rounded">
                    <rect height="19.2" rx="4" width="19.2" x="2.4" y="2.4" />
                  </clipPath>
                </defs>
                <g clipPath="url(#format-rounded)">
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
            {filterState.format.length > 0 && (
              <span className="filter-count">{filterState.format.length}</span>
            )}
            <span aria-hidden="true" className="sign">
              {openSections.format ? '−' : '+'}
            </span>
          </button>

          {!openSections.format && filterState.format.length > 0 && (
            <div className="selected-summary">
              {filterState.format.map((fmt) => (
                <span key={fmt} className="selected-chip">
                  {fmt}
                </span>
              ))}
            </div>
          )}

          {openSections.format && (
            <div className="fbody">
              <div className="check-list">
                {['Онлайн', 'Офлайн'].map((fmt) => (
                  <label key={fmt}>
                    <input
                      type="checkbox"
                      checked={filterState.format.includes(fmt)}
                      onChange={() => toggleArrayItem('format', fmt)}
                    />
                    <span>{fmt}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* 5. Возраст */}
        <section className={`filter-block ${openSections.age ? 'open' : ''}`} data-section="age">
          <button
            type="button"
            className="frow"
            onClick={() => toggleSection('age')}
            aria-expanded={openSections.age}
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
            {(filterState.ageMin !== null || filterState.ageMax !== null) && (
              <span className="filter-count">1</span>
            )}
            <span aria-hidden="true" className="sign">
              {openSections.age ? '−' : '+'}
            </span>
          </button>

          {!openSections.age && getAgeSummary().length > 0 && (
            <div className="selected-summary">
              {getAgeSummary().map((chip, idx) => (
                <span key={idx} className="selected-chip">
                  {chip}
                </span>
              ))}
            </div>
          )}

          {openSections.age && (
            <div className="fbody">
              <div className="range-fields">
                <label>
                  <span>От, лет</span>
                  <input
                    type="number"
                    min="0"
                    max="99"
                    placeholder="0"
                    value={filterState.ageMin ?? ''}
                    onChange={(e) => {
                      const v = e.target.value === '' ? null : Number(e.target.value);
                      onFilterChange({ ...filterState, ageMin: v });
                    }}
                  />
                </label>
                <label>
                  <span>До, лет</span>
                  <input
                    type="number"
                    min="0"
                    max="99"
                    placeholder="99"
                    value={filterState.ageMax ?? ''}
                    onChange={(e) => {
                      const v = e.target.value === '' ? null : Number(e.target.value);
                      onFilterChange({ ...filterState, ageMax: v });
                    }}
                  />
                </label>
              </div>
              <small className="range-note">Допустимый возраст: 0–99 лет</small>
            </div>
          )}
        </section>

        {/* 6. День недели */}
        <section className={`filter-block ${openSections.weekday ? 'open' : ''}`} data-section="weekday">
          <button
            type="button"
            className="frow"
            onClick={() => toggleSection('weekday')}
            aria-expanded={openSections.weekday}
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
            {filterState.weekday.length > 0 && (
              <span className="filter-count">{filterState.weekday.length}</span>
            )}
            <span aria-hidden="true" className="sign">
              {openSections.weekday ? '−' : '+'}
            </span>
          </button>

          {!openSections.weekday && filterState.weekday.length > 0 && (
            <div className="selected-summary">
              {filterState.weekday.map((d) => (
                <span key={d} className="selected-chip">
                  {d}
                </span>
              ))}
            </div>
          )}

          {openSections.weekday && (
            <div className="fbody">
              <div className="check-list">
                {[
                  'Понедельник',
                  'Вторник',
                  'Среда',
                  'Четверг',
                  'Пятница',
                  'Суббота',
                  'Воскресенье',
                ].map((d) => (
                  <label key={d}>
                    <input
                      type="checkbox"
                      checked={filterState.weekday.includes(d)}
                      onChange={() => toggleArrayItem('weekday', d)}
                    />
                    <span>{d}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* 7. Время */}
        <section className={`filter-block ${openSections.time ? 'open' : ''}`} data-section="time">
          <button
            type="button"
            className="frow"
            onClick={() => toggleSection('time')}
            aria-expanded={openSections.time}
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
            {filterState.time.length > 0 && (
              <span className="filter-count">{filterState.time.length}</span>
            )}
            <span aria-hidden="true" className="sign">
              {openSections.time ? '−' : '+'}
            </span>
          </button>

          {!openSections.time && filterState.time.length > 0 && (
            <div className="selected-summary">
              {filterState.time.map((t) => (
                <span key={t} className="selected-chip">
                  {t}
                </span>
              ))}
            </div>
          )}

          {openSections.time && (
            <div className="fbody">
              <div className="check-list time-list">
                {[
                  { key: 'Утро', label: 'Утро', span: '07:00–12:00' },
                  { key: 'День', label: 'День', span: '12:00–17:00' },
                  { key: 'Вечер', label: 'Вечер', span: '17:00–22:00' },
                ].map(({ key, label, span }) => (
                  <label key={key}>
                    <input
                      type="checkbox"
                      checked={filterState.time.includes(key)}
                      onChange={() => toggleArrayItem('time', key)}
                    />
                    <span>
                      {label} <small>{span}</small>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </section>

        <div className="filters-help">
          Откройте нужный фильтр с помощью «+». Все изменения сразу обновляют каталог на лету.
        </div>
      </div>

      {/* Footer Toggles */}
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
            type="checkbox"
            className="sr-only"
            checked={filterState.verified}
            onChange={(e) => onFilterChange({ ...filterState, verified: e.target.checked })}
          />
          <span aria-hidden="true" className={`switch ${filterState.verified ? 'on' : ''}`}>
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
            type="checkbox"
            className="sr-only"
            checked={filterState.nearby}
            onChange={(e) => onFilterChange({ ...filterState, nearby: e.target.checked })}
          />
          <span aria-hidden="true" className={`switch ${filterState.nearby ? 'on' : ''}`}>
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
            type="checkbox"
            className="sr-only"
            checked={filterState.photo}
            onChange={(e) => onFilterChange({ ...filterState, photo: e.target.checked })}
          />
          <span aria-hidden="true" className={`switch ${filterState.photo ? 'on' : ''}`}>
            <span className="knob" />
          </span>
        </label>
        {/* Note: As requested by the user, NO "Показать N результатов" button is rendered here because the site updates live automatically on every filter change */}
      </div>
    </aside>
  );
};
