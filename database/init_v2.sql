-- ============================================================================
-- Talentro Database Initialization (Unified v2 Schema)
-- Supports both Go Backend (v2) and legacy contracts.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Пользователи
CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(120) NOT NULL,
    account_type VARCHAR(32) NOT NULL DEFAULT 'user'
        CHECK (account_type IN ('user', 'section_owner', 'service_owner', 'moderator', 'admin')),
    avatar_color VARCHAR(16) NOT NULL DEFAULT '#7C3AED',
    is_blocked BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Тестовые пользователи (пароль password123 для тестов, хэш argon2id)
INSERT INTO users (id, email, password_hash, name, account_type, avatar_color)
VALUES
    (1, 'admin@talentro.pmr', '$argon2id$v=19$m=65536,t=3,p=4$kO1cRXN71iEvL24x1jT1TA$+C6m6Rn6e8omNBVgHSx9jKImAJg8kRoOfwO8tv7FN2E', 'Администратор', 'admin', '#DC2626'),
    (2, 'moder@talentro.pmr', '$argon2id$v=19$m=65536,t=3,p=4$kO1cRXN71iEvL24x1jT1TA$+C6m6Rn6e8omNBVgHSx9jKImAJg8kRoOfwO8tv7FN2E', 'Модератор', 'moderator', '#2563EB'),
    (3, 'owner@talentro.pmr', '$argon2id$v=19$m=65536,t=3,p=4$kO1cRXN71iEvL24x1jT1TA$+C6m6Rn6e8omNBVgHSx9jKImAJg8kRoOfwO8tv7FN2E', 'Владелец секции', 'section_owner', '#16A34A')
ON CONFLICT (id) DO UPDATE SET password_hash = EXCLUDED.password_hash;

SELECT setval(pg_get_serial_sequence('users', 'id'), GREATEST((SELECT MAX(id) FROM users), 3));

-- 2. Блокировки пользователей
CREATE TABLE IF NOT EXISTS blocks (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    reason TEXT,
    expires_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Сброс пароля
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    token_hash VARCHAR(64) PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Города
CREATE TABLE IF NOT EXISTS cities (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    slug VARCHAR(100) NOT NULL UNIQUE,
    sort_order INT NOT NULL DEFAULT 0,
    order_num INT NOT NULL DEFAULT 0
);

INSERT INTO cities (id, name, slug, sort_order, order_num) VALUES
    (1, 'Тирасполь',    'tiraspol',     1, 1),
    (2, 'Бендеры',      'bendery',      2, 2),
    (3, 'Рыбница',      'rybnitsa',     3, 3),
    (4, 'Дубоссары',    'dubossary',    4, 4),
    (5, 'Каменка',      'kamenka',      5, 5),
    (6, 'Слободзея',    'slobodzeja',   6, 6),
    (7, 'Григориополь', 'grigoriopol',  7, 7),
    (8, 'Днестровск',   'dnestrovsk',   8, 8)
ON CONFLICT (id) DO NOTHING;

SELECT setval(pg_get_serial_sequence('cities', 'id'), (SELECT MAX(id) FROM cities));

-- 4. Районы
CREATE TABLE IF NOT EXISTS districts (
    id BIGSERIAL PRIMARY KEY,
    city_id BIGINT NOT NULL REFERENCES cities (id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    order_num INT NOT NULL DEFAULT 0,
    UNIQUE (city_id, name)
);

INSERT INTO districts (id, city_id, name, slug, sort_order, order_num) VALUES
    (1, 1, 'Центр',     'centr',     1, 1),
    (2, 1, 'Балка',     'balka',     2, 2),
    (3, 1, 'Населёнка', 'naselenka', 3, 3),
    (4, 1, 'Тарновка',  'tarnovka',  4, 4)
ON CONFLICT (id) DO NOTHING;

SELECT setval(pg_get_serial_sequence('districts', 'id'), (SELECT MAX(id) FROM districts));

-- 5. Направления (Directions / Categories)
CREATE TABLE IF NOT EXISTS directions (
    id BIGSERIAL PRIMARY KEY,
    parent_id BIGINT REFERENCES directions (id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL,
    slug VARCHAR(120) NOT NULL UNIQUE,
    record_type VARCHAR(16) NOT NULL DEFAULT 'both' CHECK (record_type IN ('activity', 'service', 'both')),
    icon VARCHAR(64) NOT NULL DEFAULT '',
    sort_order INT NOT NULL DEFAULT 0,
    order_num INT NOT NULL DEFAULT 0
);

INSERT INTO directions (id, parent_id, name, slug, record_type, icon, sort_order, order_num) VALUES
    (1,  NULL, 'Творчество и искусство',        'creative-arts',      'both', 'palette',        1, 1),
    (2,  NULL, 'Спорт и физическая активность', 'sport-fitness',      'both', 'dumbbell',       2, 2),
    (3,  NULL, 'Технологии и игры',             'tech-games',         'both', 'cpu',            3, 3),
    (4,  NULL, 'Обучение и занятия для детей',  'learning-kids',      'both', 'graduation-cap', 4, 4),
    (5,  NULL, 'Животные и природа',            'animals-nature',     'both', 'paw-print',      5, 5),
    (6,  NULL, 'Путешествия и активный отдых',  'travel-outdoor',     'both', 'mountain',       6, 6),
    (7,  NULL, 'Практические навыки',           'practical-skills',   'both', 'wrench',         7, 7),
    (8,  NULL, 'Социальная деятельность',       'social-activity',    'both', 'users',          8, 8),
    (9,  NULL, 'Другое',                        'other',              'both', 'layout-grid',    9, 9),

    (10, 1, 'Рисование',            'drawing',          'both', 'brush',   1, 1),
    (11, 1, 'Музыка',               'music',            'both', 'music',   2, 2),
    (12, 1, 'Танцы',                'dance',            'both', 'dance',   3, 3),
    (13, 1, 'Фото и видео',         'photo-video',      'both', 'camera',  4, 4),
    (14, 1, 'Рукоделие',            'needlework',       'both', 'yarn',    5, 5),
    (15, 1, 'Кулинария',            'cooking',          'both', 'chef',    6, 6),
    (16, 1, 'Сцена и выступления',  'stage-performance','both', 'theater', 7, 7),

    (20, 2, 'Футбол',              'football',         'both', 'ball',      1, 1),
    (21, 2, 'Баскетбол',           'basketball',       'both', 'basketball',2, 2),
    (22, 2, 'Волейбол',            'volleyball',       'both', 'volleyball',3, 3),
    (23, 2, 'Бокс и единоборства', 'martial-arts',     'both', 'fist',      4, 4),
    (24, 2, 'Плавание',            'swimming',         'both', 'water',     5, 5),
    (25, 2, 'Лёгкая атлетика',     'athletics',        'both', 'run',       6, 6),
    (26, 2, 'Фитнес и йога',       'fitness-yoga',     'both', 'yoga',      7, 7),
    (27, 2, 'Гимнастика',          'gymnastics',       'both', 'gym',       8, 8),
    (28, 2, 'Спортивные танцы',    'dance-sport',      'both', 'music',     9, 9),

    (30, 3, 'Программирование',   'programming',      'both', 'code',    1, 1),
    (31, 3, 'Робототехника',      'robotics',         'both', 'robot',   2, 2),
    (32, 3, 'Компьютерные игры',  'video-games',      'both', 'gamepad', 3, 3),
    (33, 3, 'Настольные игры',    'board-games',      'both', 'dice',    4, 4),
    (34, 3, 'Шахматы',            'chess',            'both', 'chess',   5, 5),
    (35, 3, '3D и дизайн',        'design-3d',        'both', 'cube',    6, 6),

    (40, 4, 'Иностранные языки',  'foreign-languages','both', 'globe',  1, 1),
    (41, 4, 'Подготовка к школе', 'school-prep',      'both', 'school', 2, 2),
    (42, 4, 'Развитие речи',      'speech-dev',       'both', 'speech', 3, 3),
    (43, 4, 'Логика',             'logic',            'both', 'logic',  4, 4),
    (44, 4, 'Математика',         'math',             'both', 'sigma',  5, 5)
ON CONFLICT (id) DO NOTHING;

SELECT setval(pg_get_serial_sequence('directions', 'id'), (SELECT MAX(id) FROM directions));

-- Синоним categories для обратной совместимости
CREATE OR REPLACE VIEW categories AS
SELECT id, parent_id, name, slug, record_type AS kind, icon, sort_order AS order_num
FROM directions;

-- 6. Организации
CREATE TABLE IF NOT EXISTS organizations (
    id BIGSERIAL PRIMARY KEY,
    owner_id BIGINT REFERENCES users (id) ON DELETE SET NULL,
    slug VARCHAR(120) NOT NULL UNIQUE,
    name VARCHAR(200) NOT NULL,
    organization_type VARCHAR(64) NOT NULL DEFAULT 'commercial',
    description TEXT,
    phone VARCHAR(32) NOT NULL,
    email VARCHAR(255),
    website VARCHAR(255),
    city_id BIGINT REFERENCES cities (id),
    address VARCHAR(255),
    latitude NUMERIC(9, 6),
    longitude NUMERIC(9, 6),
    publication_basis VARCHAR(64) NOT NULL DEFAULT 'commercial',
    contacts_checked_at TIMESTAMPTZ,
    contacts_verified_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. Места проведения (Locations)
CREATE TABLE IF NOT EXISTS locations (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
    name VARCHAR(200),
    city_id BIGINT NOT NULL REFERENCES cities (id),
    district_id BIGINT REFERENCES districts (id),
    address VARCHAR(255) NOT NULL,
    latitude NUMERIC(9, 6),
    longitude NUMERIC(9, 6),
    phone VARCHAR(32),
    source_type VARCHAR(32) NOT NULL DEFAULT 'звонок',
    source_url VARCHAR(255),
    contacts_checked_at TIMESTAMPTZ DEFAULT now(),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. Занятия / Секции (Activities)
CREATE TABLE IF NOT EXISTS activities (
    id BIGSERIAL PRIMARY KEY,
    owner_id BIGINT REFERENCES users (id) ON DELETE SET NULL,
    slug VARCHAR(140) NOT NULL UNIQUE,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    organization_id BIGINT NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
    record_type VARCHAR(16) NOT NULL DEFAULT 'activity' CHECK (record_type IN ('activity', 'service')),
    direction_id BIGINT NOT NULL REFERENCES directions (id),
    class_type VARCHAR(20) CHECK (class_type IN ('individual', 'group', 'both') OR class_type IS NULL),
    class_format VARCHAR(16) NOT NULL DEFAULT 'offline' CHECK (class_format IN ('online', 'offline', 'both')),
    phone VARCHAR(32),
    status VARCHAR(20) NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'pending', 'published', 'rejected')),
    rejection_reason TEXT,
    contacts_checked_at TIMESTAMPTZ DEFAULT now(),
    contacts_verified_at TIMESTAMPTZ DEFAULT now(),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. Возрастные группы (Age Groups)
CREATE TABLE IF NOT EXISTS age_groups (
    id BIGSERIAL PRIMARY KEY,
    activity_id BIGINT NOT NULL REFERENCES activities (id) ON DELETE CASCADE,
    location_id BIGINT NOT NULL REFERENCES locations (id) ON DELETE CASCADE,
    name VARCHAR(120),
    age_from INT CHECK (age_from >= 0 AND age_from <= 100),
    age_to INT CHECK (age_to >= 0 AND age_to <= 100),
    price_from INT NOT NULL DEFAULT 0,
    price_to INT,
    price_period VARCHAR(16) DEFAULT 'month' CHECK (price_period IN ('session', 'month', 'course') OR price_period IS NULL),
    seats INT CHECK (seats >= 0 OR seats IS NULL)
);

-- 10. Расписание (Schedules)
CREATE TABLE IF NOT EXISTS schedules (
    id BIGSERIAL PRIMARY KEY,
    age_group_id BIGINT NOT NULL REFERENCES age_groups (id) ON DELETE CASCADE,
    weekday SMALLINT NOT NULL CHECK (weekday BETWEEN 1 AND 7),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    note VARCHAR(255),
    seats INT CHECK (seats >= 0 OR seats IS NULL)
);

-- 11. Медиа (Media)
CREATE TABLE IF NOT EXISTS media (
    id BIGSERIAL PRIMARY KEY,
    activity_id BIGINT REFERENCES activities (id) ON DELETE CASCADE,
    location_id BIGINT REFERENCES locations (id) ON DELETE CASCADE,
    media_type VARCHAR(16) NOT NULL DEFAULT 'photo' CHECK (media_type IN ('photo', 'video')),
    path VARCHAR(255) NOT NULL,
    caption VARCHAR(255),
    sort_order INT NOT NULL DEFAULT 0
);

-- 12. Мессенджеры
CREATE TABLE IF NOT EXISTS messengers (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT REFERENCES organizations (id) ON DELETE CASCADE,
    activity_id BIGINT REFERENCES activities (id) ON DELETE CASCADE,
    channel VARCHAR(32) NOT NULL CHECK (channel IN ('telegram', 'viber', 'whatsapp', 'instagram')),
    contact VARCHAR(255) NOT NULL,
    sort_order INT NOT NULL DEFAULT 0
);

-- 13. Рейтинги и голоса
CREATE TABLE IF NOT EXISTS activity_ratings (
    activity_id BIGINT PRIMARY KEY REFERENCES activities (id) ON DELETE CASCADE,
    score NUMERIC(3, 2) NOT NULL DEFAULT 0,
    votes_count INT NOT NULL DEFAULT 0,
    likes INT NOT NULL DEFAULT 0,
    dislikes INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS activity_votes (
    user_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    activity_id BIGINT NOT NULL REFERENCES activities (id) ON DELETE CASCADE,
    value SMALLINT NOT NULL CHECK (value IN (-1, 1)),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, activity_id)
);

-- 14. Отзывы
CREATE TABLE IF NOT EXISTS activity_reviews (
    id BIGSERIAL PRIMARY KEY,
    activity_id BIGINT NOT NULL REFERENCES activities (id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (activity_id, user_id)
);

CREATE TABLE IF NOT EXISTS reviews (
    id BIGSERIAL PRIMARY KEY,
    activity_id BIGINT NOT NULL REFERENCES activities (id) ON DELETE CASCADE,
    author_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'published',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (activity_id, author_id)
);

-- 15. Избранное
CREATE TABLE IF NOT EXISTS favorites (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    activity_id BIGINT NOT NULL REFERENCES activities (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, activity_id)
);

-- 16. Модерация и жалобы
CREATE TABLE IF NOT EXISTS moderation_journal (
    id BIGSERIAL PRIMARY KEY,
    moderator_id BIGINT REFERENCES users (id),
    activity_id BIGINT REFERENCES activities (id) ON DELETE CASCADE,
    action VARCHAR(32) NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 17. Сиды: 11 реальных секций Приднестровья
DO $$
BEGIN
    -- Организации
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
    ON CONFLICT (id) DO NOTHING;

    PERFORM setval(pg_get_serial_sequence('organizations', 'id'), GREATEST((SELECT MAX(id) FROM organizations), 111));

    -- Точки проведения
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
    ON CONFLICT (id) DO NOTHING;

    PERFORM setval(pg_get_serial_sequence('locations', 'id'), GREATEST((SELECT MAX(id) FROM locations), 112));

    -- Секции
    INSERT INTO activities (id, slug, name, description, organization_id, record_type, direction_id, class_type, class_format, phone, status, contacts_verified_at, created_at, updated_at)
    VALUES
        (101, 'sdyushor-ushu-tiraspol', 'СДЮШОР борьбы и бокса (ушу)', 'Традиционное и спортивное ушу для детей от 7 лет и старше. Тренер: Бобой С.И.', 101, 'activity', 23, 'group', 'offline', '+373 533 44604', 'published', now(), now(), now()),
        (102, 'color-fit-tiraspol', 'Color Fit (ТЦ Причерноморье)', 'Фитнес-программы для детей и подростков от 9 до 18 лет. Тренер: Валерия Смирнова.', 102, 'activity', 26, 'group', 'offline', '+373 777 50183', 'published', now(), now(), now()),
        (103, 'graciya-tiraspol', 'Танцевальный коллектив «Грация»', 'Хореография, эстрадные и спортивные танцы для детей от 3 лет. Тренер: Аркадия Еленева Павловна.', 103, 'activity', 12, 'group', 'offline', '+373 777 03433', 'published', now(), now(), now()),
        (104, 'sdyushor-ushu-strelba', 'СДЮШОР (ушу и стрельба)', 'Бесплатные занятия ушу и пулевой стрельбой. Тренер: Леонид Олейниченко.', 104, 'activity', 23, 'group', 'offline', '+373 777 04911', 'published', now(), now(), now()),
        (105, 'studiya-nadezhda-tiraspol', 'Образцовая студия народного танца «Надежда»', 'Народный сценический танец для детей от 4 до 18 лет. Руководитель: О.Н. Вайдук.', 105, 'activity', 12, 'group', 'offline', '+373 778 96704', 'published', now(), now(), now()),
        (106, 'andronic-dance-academy', 'Спортивно-бальные танцы (Andronic Dance Academy)', 'Латиноамериканская и европейская программы, детские развивающие группы. Тренер: Андроник Андрей.', 106, 'activity', 28, 'group', 'offline', '+373 533 61861', 'published', now(), now(), now()),
        (107, 'federaciya-vorkauta-pmr', 'Федерация Воркаута ПМР', 'Воркаут, ОФП, силовая гимнастика для ребят от 7 до 18 лет. Тренер: Илья Деревянко.', 107, 'activity', 26, 'group', 'offline', '+373 777 35988', 'published', now(), now(), now()),
        (108, 'revansh-black-pearl', 'Хип-хоп танцы; K-pop Cover dance (REVANSH / BLACK PEARL)', 'Street dance, Hip-Hop и K-pop Cover направления для подростков от 14 лет. Тренер: Баранецкий В.М.', 108, 'activity', 12, 'group', 'offline', '+373 533 44884', 'published', now(), now(), now()),
        (109, 'ddyut-horovaya-shkola', 'ДДЮТ (музыкально-хоровая школа)', 'Музыкальное и хоровое развитие детей 6–12 лет. Педагог: Чернышева Людмила Александровна.', 109, 'activity', 11, 'group', 'offline', '+373 778 65521', 'published', now(), now(), now()),
        (110, 'sdyushor-3-badminton', 'СДЮШОР-3 (бадминтон)', 'Спортивная секция бадминтона на базе СШ №10. Тренер: Кононенко Л.Л.', 110, 'activity', 25, 'group', 'offline', '+373 779 52933', 'published', now(), now(), now()),
        (111, 'klub-karate-bogatyr', 'Богатырь (карате)', 'Секции карате в Тирасполе и Днестровске для детей от 3 лет и взрослых. Тренер: Бурлачук Людмила.', 111, 'activity', 23, 'group', 'offline', '+373 778 92438', 'published', now(), now(), now())
    ON CONFLICT (id) DO NOTHING;

    PERFORM setval(pg_get_serial_sequence('activities', 'id'), GREATEST((SELECT MAX(id) FROM activities), 111));

    -- Группы
    INSERT INTO age_groups (id, activity_id, name, age_from, age_to, price_from, price_to, price_period, location_id)
    VALUES
        (101, 101, 'Г1 (7–11 лет)',   7,  11, 0, NULL, NULL,    101),
        (102, 101, 'Г2 (11–14 лет)',  11, 14, 0, NULL, NULL,    101),
        (103, 101, 'Г3 (14+ лет)',    14, 30, 0, NULL, NULL,    101),
        (104, 102, 'Группа 9–18 лет', 9,  18, 300, NULL, 'month', 102),
        (105, 103, 'Г1 (3–6 лет)',    3,  6,  300, NULL, 'month', 103),
        (106, 103, 'Г2 (6–10 лет)',   6,  10, 300, NULL, 'month', 103),
        (107, 103, 'Г3 (10–18 лет)',  10, 18, 350, NULL, 'month', 103),
        (108, 104, 'Общая группа',    7,  18, 0, NULL, NULL,    104),
        (109, 105, '4–18 лет',        4,  18, 0, NULL, NULL,    105),
        (110, 106, 'Г1 (3–7 лет)',    3,  7,  0, NULL, NULL,    106),
        (111, 106, 'Г2 (8–11 лет)',   8,  11, 0, NULL, NULL,    106),
        (112, 106, 'Г3 (12–20 лет)',  12, 20, 0, NULL, NULL,    106),
        (113, 107, '7–18 лет',        7,  18, 350, NULL, 'month', 107),
        (114, 108, 'От 14 лет',       14, 25, 400, NULL, 'month', 108),
        (115, 109, '6–12 лет',        6,  12, 0, NULL, NULL,    109),
        (116, 110, '10–18 лет',       10, 18, 0, NULL, NULL,    110),
        (117, 111, 'Г1 (4–12 лет)',   4,  12, 300, NULL, 'month', 111),
        (118, 111, 'Г2 (3–9 лет)',    3,  9,  300, NULL, 'month', 111),
        (119, 111, 'Г3 (12+ лет)',    12, 40, 350, NULL, 'month', 112)
    ON CONFLICT (id) DO NOTHING;

    PERFORM setval(pg_get_serial_sequence('age_groups', 'id'), GREATEST((SELECT MAX(id) FROM age_groups), 119));

    -- Расписания (weekday: 1=Пн..7=Вс)
    INSERT INTO schedules (age_group_id, weekday, start_time, end_time, note)
    VALUES
        (101, 1, '14:30', '16:00', NULL), (101, 3, '14:30', '16:00', NULL), (101, 5, '14:30', '16:00', NULL),
        (102, 1, '16:00', '17:30', NULL), (102, 3, '16:00', '17:30', NULL), (102, 5, '16:00', '17:30', NULL),
        (103, 2, '16:00', '17:30', NULL), (103, 4, '16:00', '17:30', NULL), (103, 6, '16:00', '17:30', NULL),
        (104, 1, '16:00', '17:00', NULL), (104, 3, '16:00', '17:00', NULL), (104, 5, '16:00', '17:00', NULL),
        (105, 2, '16:30', '17:30', NULL), (105, 4, '16:30', '17:30', NULL),
        (106, 2, '17:30', '18:45', NULL), (106, 4, '17:30', '18:45', NULL),
        (107, 2, '18:45', '20:00', NULL), (107, 4, '18:45', '20:00', NULL), (107, 6, '15:00', '16:30', NULL),
        (108, 1, '15:00', '16:30', NULL), (108, 3, '15:00', '16:30', NULL), (108, 5, '15:00', '16:30', NULL),
        (109, 1, '16:00', '18:00', NULL), (109, 3, '16:00', '18:00', NULL), (109, 5, '16:00', '18:00', NULL),
        (110, 2, '17:00', '18:00', NULL), (110, 4, '17:00', '18:00', NULL),
        (111, 2, '18:00', '19:15', NULL), (111, 4, '18:00', '19:15', NULL),
        (112, 1, '18:30', '20:00', NULL), (112, 3, '18:30', '20:00', NULL), (112, 5, '18:30', '20:00', NULL),
        (113, 2, '16:30', '18:00', NULL), (113, 4, '16:30', '18:00', NULL), (113, 6, '14:00', '15:30', NULL),
        (114, 1, '18:00', '19:30', NULL), (114, 3, '18:00', '19:30', NULL), (114, 5, '18:00', '19:30', NULL),
        (115, 2, '14:00', '15:30', NULL), (115, 4, '14:00', '15:30', NULL),
        (116, 1, '15:30', '17:00', NULL), (116, 3, '15:30', '17:00', NULL), (116, 5, '15:30', '17:00', NULL),
        (117, 1, '17:00', '18:30', NULL), (117, 3, '17:00', '18:30', NULL), (117, 5, '17:00', '18:30', NULL),
        (118, 2, '17:00', '18:15', NULL), (118, 4, '17:00', '18:15', NULL),
        (119, 2, '18:30', '20:00', NULL), (119, 4, '18:30', '20:00', NULL), (119, 6, '11:00', '12:30', NULL)
    ON CONFLICT DO NOTHING;

    PERFORM setval(pg_get_serial_sequence('schedules', 'id'), (SELECT COALESCE(MAX(id), 1) FROM schedules));
END
$$;
