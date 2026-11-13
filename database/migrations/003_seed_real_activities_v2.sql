-- ============================================================================
-- Миграция: 11 реальных секций Приднестровья для схемы БД v2 (Talentro Go Backend)
-- Таблицы: organizations, locations, activities, age_groups, schedules
-- ============================================================================

-- Вспомогательная функция для безопасного получения ID направления
DO $$
BEGIN
    -- 1. Организации
    INSERT INTO organizations (id, slug, name, organization_type, description, phone, email, website, city_id, address, latitude, longitude, publication_basis, contacts_checked_at)
    VALUES
        (101, 'sdyushor-borby-boksa', 'СДЮШОР борьбы и бокса', 'Спортшкола', 'Специализированная детско-юношеская школа олимпийского резерва борьбы и бокса г. Тирасполь.', '+373 533 44604', NULL, 'https://instagram.com/tsdushor', 1, 'ул. Мира, д. 21(и)', 46.8370, 29.6520, 'municipal', now()),
        (102, 'color-fit', 'Фитнес-клуб «Color Fit»', 'Студия', 'Фитнес-студия для детей и подростков в ТЦ Причерноморье.', '+373 777 50183', NULL, 'https://instagram.com/color.fit.tiraspol', 1, 'ул. Юности, д. 6', 46.8285, 29.6250, 'commercial', now()),
        (103, 'graciya-dance', 'Танцевальный коллектив «Грация»', 'Студия', 'Образцовый танцевальный ансамбль «Грация».', '+373 777 03433', NULL, 'https://instagram.com/gracetiras2002', 1, 'ул. Советская, д. 121', 46.8415, 29.6380, 'commercial', now()),
        (104, 'sdyushor-ushuu-strelba', 'СДЮШОР (ушу и стрельба)', 'Спортшкола', 'Секции традиционного ушу и пулевой стрельбы.', '+373 777 04911', NULL, NULL, 1, 'ул. 9-й Молдавской дивизии, д. 20', 46.8450, 29.6200, 'municipal', now()),
        (105, 'ansambl-nadezhda', 'Образцовая студия народного танца «Надежда»', 'Дворец культуры', 'Студия народного танца при Городском Дворце культуры.', '+373 778 96704', NULL, 'https://instagram.com/folkdancestudio_nadejda', 1, 'ул. 25 Октября (Дворец культуры)', 46.8365, 29.6140, 'municipal', now()),
        (106, 'andronic-dance', 'Andronic Dance Academy', 'Академия танца', 'Дом танца Andronic / Dance Academy: спортивно-бальные танцы для детей и взрослых.', '+373 533 61861', NULL, 'https://instagram.com/andronic_dance_academy', 1, 'ул. Восстания, д. 4', 46.8420, 29.6310, 'commercial', now()),
        (107, 'federaciya-vorkauta-pmr', 'Федерация Воркаута ПМР', 'Федерация', 'Воркаут, общая физическая подготовка и гимнастические элементы.', '+373 777 35988', NULL, NULL, 1, 'ул. 25 Октября (ТЦ Тирасполь)', 46.8380, 29.6210, 'ngo', now()),
        (108, 'revansh-black-pearl', 'Танцевальный клуб REVANSH / BLACK PEARL', 'Клуб', 'Современные направления: Hip-Hop, K-Pop Cover Dance, Street dance.', '+373 533 44884', NULL, 'https://instagram.com/revashdanceclub', 1, 'ул. Юности, 64А', 46.8240, 29.6190, 'commercial', now()),
        (109, 'ddyut-tiraspol', 'ДДЮТ (музыкально-хоровая школа)', 'МУ ДО ДДЮТ', 'Дворец детско-юношеского творчества г. Тирасполь: хоровое и вокальное мастерство.', '+373 778 65521', NULL, 'https://instagram.com/ddut1_ru', 1, 'ул. 25 Октября (ДДЮТ)', 46.8375, 29.6260, 'municipal', now()),
        (110, 'sdyushor-3-badminton', 'СДЮШОР-3 (бадминтон)', 'Спортшкола', 'СДЮШОР №3, отделение бадминтона на базе СШ №10.', '+373 779 52933', NULL, 'https://instagram.com/tiraspol_school_10', 1, 'ул. Космонавтов, д. 3', 46.8290, 29.6280, 'municipal', now()),
        (111, 'klub-bogatyr', 'Клуб восточных единоборств «Богатырь»', 'Клуб', 'Карате и восточные единоборства для детей от 3 лет и взрослых в Тирасполе и Днестровске.', '+373 778 92438', NULL, 'https://karatepmr.org', 1, 'ул. Калинина, 66', 46.8430, 29.6350, 'commercial', now())
    ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        phone = EXCLUDED.phone,
        website = EXCLUDED.website;

    PERFORM setval(pg_get_serial_sequence('organizations', 'id'), GREATEST((SELECT MAX(id) FROM organizations), 111));

    -- 2. Точки проведения (Locations)
    INSERT INTO locations (id, organization_id, name, city_id, district_id, address, latitude, longitude, source_type, phone)
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

    PERFORM setval(pg_get_serial_sequence('locations', 'id'), GREATEST((SELECT MAX(id) FROM locations), 112));

    -- 3. Секции (Activities)
    -- Разрешаем direction_id по таблице directions (или fallback на доступный ID)
    INSERT INTO activities (id, slug, name, description, organization_id, record_type, direction_id, class_type, class_format, phone, status, contacts_verified_at, created_at, updated_at)
    VALUES
        (101, 'sdyushor-ushu-tiraspol', 'СДЮШОР борьбы и бокса (ушу)', 'Традиционное и спортивное ушу для детей от 7 лет и старше. Тренер: Бобой С.И.', 101, 'activity', COALESCE((SELECT id FROM directions WHERE name ILIKE '%единоборств%' OR name ILIKE '%бокс%' LIMIT 1), 1), 'group', 'offline', '+373 533 44604', 'published', now(), now(), now()),
        (102, 'color-fit-tiraspol', 'Color Fit (ТЦ Причерноморье)', 'Фитнес-программы для детей и подростков от 9 до 18 лет. Тренер: Валерия Смирнова.', 102, 'activity', COALESCE((SELECT id FROM directions WHERE name ILIKE '%фитнес%' OR name ILIKE '%спорт%' LIMIT 1), 1), 'group', 'offline', '+373 777 50183', 'published', now(), now(), now()),
        (103, 'graciya-tiraspol', 'Танцевальный коллектив «Грация»', 'Хореография, эстрадные и спортивные танцы для детей от 3 лет. Тренер: Аркадия Еленева Павловна.', 103, 'activity', COALESCE((SELECT id FROM directions WHERE name ILIKE '%танц%' LIMIT 1), 1), 'group', 'offline', '+373 777 03433', 'published', now(), now(), now()),
        (104, 'sdyushor-ushu-strelba', 'СДЮШОР (ушу и стрельба)', 'Бесплатные занятия ушу и пулевой стрельбой. Тренер: Леонид Олейниченко.', 104, 'activity', COALESCE((SELECT id FROM directions WHERE name ILIKE '%единоборств%' OR name ILIKE '%бокс%' OR name ILIKE '%спорт%' LIMIT 1), 1), 'group', 'offline', '+373 777 04911', 'published', now(), now(), now()),
        (105, 'studiya-nadezhda-tiraspol', 'Образцовая студия народного танца «Надежда»', 'Народный сценический танец для детей от 4 до 18 лет. Руководитель: О.Н. Вайдук (Гайдук).', 105, 'activity', COALESCE((SELECT id FROM directions WHERE name ILIKE '%танц%' LIMIT 1), 1), 'group', 'offline', '+373 778 96704', 'published', now(), now(), now()),
        (106, 'andronic-dance-academy', 'Спортивно-бальные танцы (Andronic Dance Academy)', 'Латиноамериканская и европейская программы, детские развивающие группы. Тренер: Андроник Андрей.', 106, 'activity', COALESCE((SELECT id FROM directions WHERE name ILIKE '%танц%' LIMIT 1), 1), 'group', 'offline', '+373 533 61861', 'published', now(), now(), now()),
        (107, 'federaciya-vorkauta-pmr', 'Федерация Воркаута ПМР', 'Воркаут, ОФП, силовая гимнастика для ребят от 7 до 18 лет. Тренер: Илья Деревянко.', 107, 'activity', COALESCE((SELECT id FROM directions WHERE name ILIKE '%фитнес%' OR name ILIKE '%спорт%' LIMIT 1), 1), 'group', 'offline', '+373 777 35988', 'published', now(), now(), now()),
        (108, 'revansh-black-pearl', 'Хип-хоп танцы; K-pop Cover dance (REVANSH / BLACK PEARL)', 'Street dance, Hip-Hop и K-pop Cover направления для подростков от 14 лет. Тренер: Баранецкий В.М.', 108, 'activity', COALESCE((SELECT id FROM directions WHERE name ILIKE '%танц%' LIMIT 1), 1), 'group', 'offline', '+373 533 44884', 'published', now(), now(), now()),
        (109, 'ddyut-horovaya-shkola', 'ДДЮТ (музыкально-хоровая школа)', 'Музыкальное и хоровое развитие детей 6–12 лет. Педагог: Чернышева Людмила Александровна.', 109, 'activity', COALESCE((SELECT id FROM directions WHERE name ILIKE '%музык%' OR name ILIKE '%творч%' LIMIT 1), 1), 'group', 'offline', '+373 778 65521', 'published', now(), now(), now()),
        (110, 'sdyushor-3-badminton', 'СДЮШОР-3 (бадминтон)', 'Спортивная секция бадминтона на базе СШ №10. Тренер: Кононенко Л.Л.', 110, 'activity', COALESCE((SELECT id FROM directions WHERE name ILIKE '%спорт%' OR name ILIKE '%атлетик%' LIMIT 1), 1), 'group', 'offline', '+373 779 52933', 'published', now(), now(), now()),
        (111, 'klub-karate-bogatyr', 'Богатырь (карате)', 'Секции карате в Тирасполе и Днестровске для детей от 3 лет и взрослых. Тренер: Бурлачук Людмила.', 111, 'activity', COALESCE((SELECT id FROM directions WHERE name ILIKE '%единоборств%' OR name ILIKE '%бокс%' LIMIT 1), 1), 'group', 'offline', '+373 778 92438', 'published', now(), now(), now())
    ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        status = 'published',
        contacts_verified_at = now();

    PERFORM setval(pg_get_serial_sequence('activities', 'id'), GREATEST((SELECT MAX(id) FROM activities), 111));

    -- 4. Возрастные группы (Age Groups)
    INSERT INTO age_groups (id, activity_id, name, age_from, age_to, price_from, price_to, price_period, location_id)
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

    PERFORM setval(pg_get_serial_sequence('age_groups', 'id'), GREATEST((SELECT MAX(id) FROM age_groups), 119));

    -- 5. Расписания (Schedules)
    -- weekday: 1=Пн, 2=Вт, 3=Ср, 4=Чт, 5=Пт, 6=Сб, 7=Вс
    DELETE FROM schedules WHERE age_group_id BETWEEN 101 AND 119;

    INSERT INTO schedules (age_group_id, weekday, start_time, end_time, note)
    VALUES
        -- 1. СДЮШОР ушу: Г1 (7-11 лет)
        (101, 1, '14:30', '16:00', NULL),
        (101, 3, '14:30', '16:00', NULL),
        (101, 5, '14:30', '16:00', NULL),
        -- СДЮШОР ушу: Г2 (11-14 лет)
        (102, 1, '16:00', '17:30', NULL),
        (102, 3, '16:00', '17:30', NULL),
        (102, 5, '16:00', '17:30', NULL),
        -- СДЮШОР ушу: Г3 (14+ лет)
        (103, 2, '16:00', '17:30', NULL),
        (103, 4, '16:00', '17:30', NULL),
        (103, 6, '16:00', '17:30', NULL),

        -- 2. Color Fit (9-18 лет)
        (104, 1, '16:00', '17:00', NULL),
        (104, 3, '16:00', '17:00', NULL),
        (104, 5, '16:00', '17:00', NULL),

        -- 3. Грация: Г1 (3-6 лет)
        (105, 2, '16:30', '17:30', NULL),
        (105, 4, '16:30', '17:30', NULL),
        -- Грация: Г2 (6-10 лет)
        (106, 2, '17:30', '18:45', NULL),
        (106, 4, '17:30', '18:45', NULL),
        -- Грация: Г3 (10-18 лет)
        (107, 2, '18:45', '20:00', NULL),
        (107, 4, '18:45', '20:00', NULL),
        (107, 6, '15:00', '16:30', NULL),

        -- 4. СДЮШОР ушу и стрельба: Общая группа
        (108, 1, '15:00', '16:30', NULL),
        (108, 3, '15:00', '16:30', NULL),
        (108, 5, '15:00', '16:30', NULL),

        -- 5. Надежда (4-18 лет)
        (109, 1, '16:00', '18:00', NULL),
        (109, 3, '16:00', '18:00', NULL),
        (109, 5, '16:00', '18:00', NULL),

        -- 6. Andronic Dance: Г1 (3-7 лет)
        (110, 2, '17:00', '18:00', NULL),
        (110, 4, '17:00', '18:00', NULL),
        -- Andronic Dance: Г2 (8-11 лет)
        (111, 2, '18:00', '19:15', NULL),
        (111, 4, '18:00', '19:15', NULL),
        -- Andronic Dance: Г3 (12-20 лет)
        (112, 1, '18:30', '20:00', NULL),
        (112, 3, '18:30', '20:00', NULL),
        (112, 5, '18:30', '20:00', NULL),

        -- 7. Воркаут (7-18 лет)
        (113, 2, '16:30', '18:00', NULL),
        (113, 4, '16:30', '18:00', NULL),
        (113, 6, '14:00', '15:30', NULL),

        -- 8. REVANSH / BLACK PEARL (от 14 лет)
        (114, 1, '18:00', '19:30', NULL),
        (114, 3, '18:00', '19:30', NULL),
        (114, 5, '18:00', '19:30', NULL),

        -- 9. ДДЮТ хоровая школа (6-12 лет)
        (115, 2, '14:00', '15:30', NULL),
        (115, 4, '14:00', '15:30', NULL),

        -- 10. Бадминтон (10-18 лет)
        (116, 1, '15:30', '17:00', NULL),
        (116, 3, '15:30', '17:00', NULL),
        (116, 5, '15:30', '17:00', NULL),

        -- 11. Богатырь карате: Г1 (4-12 лет, зал Калинина)
        (117, 1, '17:00', '18:30', NULL),
        (117, 3, '17:00', '18:30', NULL),
        (117, 5, '17:00', '18:30', NULL),
        -- Богатырь карате: Г2 (3-9 лет, зал Калинина)
        (118, 2, '17:00', '18:15', NULL),
        (118, 4, '17:00', '18:15', NULL),
        -- Богатырь карате: Г3 (12+ лет, Днестровск)
        (119, 2, '18:30', '20:00', NULL),
        (119, 4, '18:30', '20:00', NULL),
        (119, 6, '11:00', '12:30', NULL);

    PERFORM setval(pg_get_serial_sequence('schedules', 'id'), (SELECT COALESCE(MAX(id), 1) FROM schedules));

END
$$;
