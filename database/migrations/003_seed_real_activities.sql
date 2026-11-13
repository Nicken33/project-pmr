-- ============================================================================
-- Миграция: 11 реальных секций Приднестровья из реестра Talentro
-- ============================================================================

-- 1. Организации
INSERT INTO organizations (id, slug, name, type, description, phone, email, website, city_id, address, publication_basis)
VALUES
    (101, 'sdyushor-borby-boksa', 'СДЮШОР борьбы и бокса', 'Спортшкола', 'Специализированная детско-юношеская школа олимпийского резерва борьбы и бокса г. Тирасполь.', '+373 533 44604', NULL, 'https://instagram.com/tsdushor', 1, 'ул. Мира, д. 21(и)', 'municipal'),
    (102, 'color-fit', 'Фитнес-клуб «Color Fit»', 'Студия', 'Фитнес-студия для детей и подростков в ТЦ Причерноморье.', '+373 777 50183', NULL, 'https://instagram.com/color.fit.tiraspol', 1, 'ул. Юности, д. 6', 'commercial'),
    (103, 'graciya-dance', 'Танцевальный коллектив «Грация»', 'Студия', 'Образцовый танцевальный ансамбль «Грация».', '+373 777 03433', NULL, 'https://instagram.com/gracetiras2002', 1, 'ул. Советская, д. 121', 'commercial'),
    (104, 'sdyushor-ushuu-strelba', 'СДЮШОР (ушу и стрельба)', 'Спортшкола', 'Секции традиционного ушу и пулевой стрельбы.', '+373 777 04911', NULL, NULL, 1, 'ул. 9-й Молдавской дивизии, д. 20', 'municipal'),
    (105, 'ansambl-nadezhda', 'Образцовая студия народного танца «Надежда»', 'Дворец культуры', 'Студия народного танца при Городском Дворце культуры.', '+373 778 96704', NULL, 'https://instagram.com/folkdancestudio_nadejda', 1, 'ул. 25 Октября (Дворец культуры)', 'municipal'),
    (106, 'andronic-dance', 'Andronic Dance Academy', 'Академия танца', 'Дом танца Andronic / Dance Academy: спортивно-бальные танцы для детей и взрослых.', '+373 533 61861', NULL, 'https://instagram.com/andronic_dance_academy', 1, 'ул. Восстания, д. 4', 'commercial'),
    (107, 'federaciya-vorkauta-pmr', 'Федерация Воркаута ПМР', 'Федерация', 'Воркаут, общая физическая подготовка и гимнастические элементы.', '+373 777 35988', NULL, NULL, 1, 'ул. 25 Октября (ТЦ Тирасполь)', 'ngo'),
    (108, 'revansh-black-pearl', 'Танцевальный клуб REVANSH / BLACK PEARL', 'Клуб', 'Современные направления: Hip-Hop, K-Pop Cover Dance, Street dance.', '+373 533 44884', NULL, 'https://instagram.com/revashdanceclub', 1, 'ул. Юности, 64А', 'commercial'),
    (109, 'ddyut-tiraspol', 'ДДЮТ (музыкально-хоровая школа)', 'МУ ДО ДДЮТ', 'Дворец детско-юношеского творчества г. Тирасполь: хоровое и вокальное мастерство.', '+373 778 65521', NULL, 'https://instagram.com/ddut1_ru', 1, 'ул. 25 Октября (ДДЮТ)', 'municipal'),
    (110, 'sdyushor-3-badminton', 'СДЮШОР-3 (бадминтон)', 'Спортшкола', 'СДЮШОР №3, отделение бадминтона на базе СШ №10.', '+373 779 52933', NULL, 'https://instagram.com/tiraspol_school_10', 1, 'ул. Космонавтов, д. 3', 'municipal'),
    (111, 'klub-bogatyr', 'Клуб восточных единоборств «Богатырь»', 'Клуб', 'Карате и восточные единоборства для детей от 3 лет и взрослых в Тирасполе и Днестровске.', '+373 778 92438', NULL, 'https://karatepmr.org', 1, 'ул. Калинина, 66', 'commercial')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    phone = EXCLUDED.phone,
    website = EXCLUDED.website;

SELECT setval(pg_get_serial_sequence('organizations', 'id'), GREATEST((SELECT MAX(id) FROM organizations), 111));

-- 2. Точки проведения (Locations)
INSERT INTO locations (id, org_id, name, city_id, district_id, address, lat, lng, enrollment_type, phone)
VALUES
    (101, 101, 'Зал ушу',               1, 1, 'ул. Мира, д. 21(и)', 46.8370, 29.6520, 'звонок', '+373 533 44604'),
    (102, 102, 'Зал в ТЦ Причерноморье', 1, 2, 'ул. Юности, д. 6',   46.8285, 29.6250, 'звонок', '+373 777 50183'),
    (103, 103, 'Зал на Советской',       1, 1, 'ул. Советская, д. 121', 46.8415, 29.6380, 'звонок', '+373 777 03433'),
    (104, 104, 'Спортивный зал',        1, 1, 'ул. 9-й Молдавской дивизии, д. 20', 46.8450, 29.6200, 'звонок', '+373 777 04911'),
    (105, 105, 'Дворец культуры',       1, 1, 'ул. 25 Октября',      46.8365, 29.6140, 'лично',  '+373 778 96704'),
    (106, 106, 'Дом танца Andronic',     1, 1, 'ул. Восстания, д. 4', 46.8420, 29.6310, 'звонок', '+373 533 61861'),
    (107, 107, 'ТЦ Тирасполь',          1, 1, 'ул. 25 Октября',      46.8380, 29.6210, 'звонок', '+373 777 35988'),
    (108, 108, 'ФЕЛМА',                 1, 2, 'ул. Юности, 64А',     46.8240, 29.6190, 'звонок', '+373 533 44884'),
    (109, 109, 'ДДЮТ',                  1, 1, 'ул. 25 Октября',      46.8375, 29.6260, 'лично',  '+373 778 65521'),
    (110, 110, 'Школа №10',             1, 2, 'ул. Космонавтов, д. 3', 46.8290, 29.6280, 'звонок', '+373 779 52933'),
    (111, 111, 'Зал на Калинина',       1, 1, 'ул. Калинина, 66',     46.8430, 29.6350, 'звонок', '+373 778 92438'),
    (112, 111, 'ДДЮШ Днестровск',       8, NULL, 'Бульвар Энергетиков', 46.6160, 29.9190, 'звонок', '+373 778 92438')
ON CONFLICT (id) DO UPDATE SET
    address = EXCLUDED.address,
    phone = EXCLUDED.phone;

SELECT setval(pg_get_serial_sequence('locations', 'id'), GREATEST((SELECT MAX(id) FROM locations), 112));

-- 3. Карточки (Cards)
INSERT INTO cards (id, slug, name, description, org_id, kind, category_id, lesson_type, format, status, contacts_verified_at)
VALUES
    (101, 'sdyushor-ushu-tiraspol', 'СДЮШОР борьбы и бокса (ушу)', 'Традиционное и спортивное ушу для детей от 7 лет и старше. Тренер: Бобой С.И.', 101, 'activity', 23, 'group', 'offline', 'published', now()),
    (102, 'color-fit-tiraspol', 'Color Fit (ТЦ Причерноморье)', 'Фитнес-программы для детей и подростков от 9 до 18 лет. Тренер: Валерия Смирнова.', 102, 'activity', 26, 'group', 'offline', 'published', now()),
    (103, 'graciya-tiraspol', 'Танцевальный коллектив «Грация»', 'Хореография, эстрадные и спортивные танцы для детей от 3 лет. Тренер: Аркадия Еленева Павловна.', 103, 'activity', 28, 'group', 'offline', 'published', now()),
    (104, 'sdyushor-ushu-strelba', 'СДЮШОР (ушу и стрельба)', 'Бесплатные занятия ушу и пулевой стрельбой. Тренер: Леонид Олейниченко.', 104, 'activity', 23, 'group', 'offline', 'published', now()),
    (105, 'studiya-nadezhda-tiraspol', 'Образцовая студия народного танца «Надежда»', 'Народный сценический танец для детей от 4 до 18 лет. Руководитель: О.Н. Вайдук (Гайдук).', 105, 'activity', 12, 'group', 'offline', 'published', now()),
    (106, 'andronic-dance-academy', 'Спортивно-бальные танцы (Andronic Dance Academy)', 'Латиноамериканская и европейская программы, детские развивающие группы. Тренер: Андроник Андрей.', 106, 'activity', 28, 'group', 'offline', 'published', now()),
    (107, 'federaciya-vorkauta-pmr', 'Федерация Воркаута ПМР', 'Воркаут, ОФП, силовая гимнастика для ребят от 7 до 18 лет. Тренер: Илья Деревянко.', 107, 'activity', 25, 'group', 'offline', 'published', now()),
    (108, 'revansh-black-pearl', 'Хип-хоп танцы; K-pop Cover dance (REVANSH / BLACK PEARL)', 'Street dance, Hip-Hop и K-pop Cover направления для подростков от 14 лет. Тренер: Баранецкий В.М.', 108, 'activity', 28, 'group', 'offline', 'published', now()),
    (109, 'ddyut-horovaya-shkola', 'ДДЮТ (музыкально-хоровая школа)', 'Музыкальное и хоровое развитие детей 6–12 лет. Педагог: Чернышева Людмила Александровна.', 109, 'activity', 11, 'group', 'offline', 'published', now()),
    (110, 'sdyushor-3-badminton', 'СДЮШОР-3 (бадминтон)', 'Спортивная секция бадминтона на базе СШ №10. Тренер: Кононенко Л.Л.', 110, 'activity', 20, 'group', 'offline', 'published', now()),
    (111, 'klub-karate-bogatyr', 'Богатырь (карате)', 'Секции карате в Тирасполе и Днестровске для детей от 3 лет и взрослых. Тренер: Бурлачук Людмила.', 111, 'activity', 23, 'group', 'offline', 'published', now())
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    status = 'published',
    contacts_verified_at = now();

SELECT setval(pg_get_serial_sequence('cards', 'id'), GREATEST((SELECT MAX(id) FROM cards), 111));

-- 4. Возрастные группы (Groups)
INSERT INTO groups (id, card_id, name, age_from, age_to, price_from, price_to, price_period, location_id)
VALUES
    -- 1. СДЮШОР ушу
    (101, 101, 'Г1 (7–11 лет)',   7,  11, 0, NULL, NULL,    101),
    (102, 101, 'Г2 (11–14 лет)',  11, 14, 0, NULL, NULL,    101),
    (103, 101, 'Г3 (14+ лет)',    14, 25, 0, NULL, NULL,    101),
    -- 2. Color Fit
    (104, 102, '9–18 лет',        9,  18, 350, NULL, 'month', 102),
    -- 3. Грация
    (105, 103, 'Г1 (3–6 лет)',    3,  6,  250, NULL, 'month', 103),
    (106, 103, 'Г2 (6–10 лет)',   6,  10, 250, NULL, 'month', 103),
    (107, 103, 'Г3 (10–18 лет)',  10, 18, 250, NULL, 'month', 103),
    -- 4. Ушу и стрельба
    (108, 104, 'Общая группа',    7,  18, 0, NULL, NULL,    104),
    -- 5. Надежда
    (109, 105, '4–18 лет',        4,  18, 250, NULL, 'month', 105),
    -- 6. Andronic Dance
    (110, 106, 'Г1 (3–7 лет)',    3,  7,  0, NULL, NULL,    106),
    (111, 106, 'Г2 (8–11 лет)',   8,  11, 0, NULL, NULL,    106),
    (112, 106, 'Г3 (12–20 лет)',  12, 20, 0, NULL, NULL,    106),
    -- 7. Воркаут
    (113, 107, '7–18 лет',        7,  18, 350, NULL, 'month', 107),
    -- 8. REVANSH / BLACK PEARL
    (114, 108, 'От 14 лет',       14, 25, 400, NULL, 'month', 108),
    -- 9. ДДЮТ
    (115, 109, '6–12 лет',        6,  12, 0, NULL, NULL,    109),
    -- 10. Бадминтон
    (116, 110, '10–18 лет',       10, 18, 0, NULL, NULL,    110),
    -- 11. Богатырь карате
    (117, 111, 'Г1 (4–12 лет)',   4,  12, 300, NULL, 'month', 111),
    (118, 111, 'Г2 (3–9 лет)',    3,  9,  300, NULL, 'month', 111),
    (119, 111, 'Г3 (12+ лет)',    12, 40, 350, NULL, 'month', 112)
ON CONFLICT (id) DO UPDATE SET
    price_from = EXCLUDED.price_from;

SELECT setval(pg_get_serial_sequence('groups', 'id'), GREATEST((SELECT MAX(id) FROM groups), 119));
