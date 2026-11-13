-- Схема Talentro по ТЗ §7 (модель данных) и §8 (таблицы и поля).
--
-- Идемпотентность: скрипт можно гонять по кругу на чистой базе (CREATE ... IF NOT
-- EXISTS + ON CONFLICT DO NOTHING/DO UPDATE + setval). Справочник направлений —
-- исключение: он обновляется на конфликте (DO UPDATE), иначе правки иконок и
-- порядка в сидах не доезжали бы до уже развёрнутой базы. На базе со СТАРОЙ формой cards он
-- падает сразу и внятной строкой — см. guard ниже: старые колонки city_id/age_from
-- у карточки больше не существуют, потому что по §7.9–7.11 возраст и цена живут у
-- возрастной группы, а город, адрес и координаты — у точки проведения.
--
-- Данные ниже — демонстрационные для стенда и тестов: телефоны, адреса, координаты
-- и ссылки правдоподобные, но не подтверждённые. Поле contacts_verified_at у seeded
-- записей пустое, поэтому карточка по §11.3 показывается как «данные ориентировочные».

-- ============================================================================
-- Guard: база в старой форме (cards с городом и возрастом на самой карточке)
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'cards' AND column_name = 'city_id')
    THEN
        RAISE EXCEPTION
            'старая схема cards: город и возраст переехали на точки и группы (§7.9–7.11). '
            'Пересоздайте базу: dropdb && createdb && psql < database/init.sql';
    END IF;
END
$$;

-- pg_trgm нужен §5.1: он даёт gin-индекс для LIKE '%…%' по середине слова. Без
-- расширения поиск по названию организации превращается в последовательное
-- сканирование, поэтому отсутствие расширения — ошибка сборки базы, а не тихая
-- деградация: стенд должен падать сразу, а не тормозить на проде.
DO $$
BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_trgm;
EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'pg_trgm не установлен (§5.1 требует trigram-индекс): %', SQLERRM;
END
$$;

-- Нормализация §5.1: нижний регистр и ё → е.
--
-- lower() здесь НЕ подходит: он опирается на LC_CTYPE кластера, и на кластере с
-- локалью C (типовой initdb без явной локали) lower('ШАХМАТНАЯ') возвращает
-- «ШАХМАТНАЯ» нетронутой. Тогда поиск по-русски молча даёт пустую выдачу —
-- на стенде это выглядит как «фильтр не работает», а чинится только пересборкой
-- базы. translate() списывает регистр по явной таблице, поэтому fold() даёт один
-- и тот же результат при любой локали и любом ОС-рантайме.
CREATE OR REPLACE FUNCTION fold(input TEXT) RETURNS TEXT
    LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
    AS $$
        SELECT replace(
            translate(input,
                'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯABCDEFGHIJKLMNOPQRSTUVWXYZ',
                'абвгдеёжзийклмнопрстуфхцчшщъыьэюяabcdefghijklmnopqrstuvwxyz'),
            'ё', 'е');
    $$;

-- ============================================================================
-- Таблица 8: пользователь (§3.7, вход по почте и паролю)
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    email VARCHAR(254) NOT NULL UNIQUE,
    password_hash TEXT,
    name VARCHAR(120) NOT NULL,
    avatar_path VARCHAR(500),
    account_type VARCHAR(24) NOT NULL DEFAULT 'user'
        CHECK (account_type IN ('user', 'owner_activity', 'owner_service', 'moderator')),
    google_sub VARCHAR(64) UNIQUE,
    provider VARCHAR(20) NOT NULL DEFAULT 'local',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Вход по §3.7 бывает локальным и гугловским, поэтому у учётной записи есть
-- устойчивый поставщик (provider) и субьект-идентификатор из Google (google_sub).
-- Идемпотентно: на базе, созданной до этих колонок, CREATE выше ничего не меняет,
-- а ALTER доводит существующую таблицу тем же способом.
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_sub VARCHAR(64) UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS provider VARCHAR(20) NOT NULL DEFAULT 'local';
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- ============================================================================
-- Таблица: токены сброса пароля (15 минут, одноразовые)
-- ============================================================================
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '15 minutes'),
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_hash ON password_reset_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user ON password_reset_tokens(user_id);

-- CHECK на список поставщика специально нет: он бы ловил будущий вход за уши,
-- когда способ аутентификации ещё не выбран. Уникальность google_sub держит
-- одно гугловский аккаунт = одна запись.

-- Старые строки справочника users (username) в новой модели не участвуют: вход по §3.7
-- идёт по почте, а username — это имя организации, не учётная запись.

-- ============================================================================
-- Таблица 3: город (§8) — набор строго по ТЗ, восемь штук
-- ============================================================================
CREATE TABLE IF NOT EXISTS cities (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    slug VARCHAR(100) NOT NULL UNIQUE,
    order_num SMALLINT NOT NULL UNIQUE
);

INSERT INTO cities (id, name, slug, order_num) VALUES
    (1, 'Тирасполь',    'tiraspol',     1),
    (2, 'Бендеры',      'bendery',      2),
    (3, 'Рыбница',      'rybnitsa',     3),
    (4, 'Дубоссары',    'dubossary',    4),
    (5, 'Каменка',      'kamenka',      5),
    (6, 'Слободзея',    'slobodzeja',   6),
    (7, 'Григориополь', 'grigoriopol',  7),
    (8, 'Днестровск',   'dnestrovsk',   8)
ON CONFLICT (id) DO NOTHING;

SELECT setval(pg_get_serial_sequence('cities', 'id'), (SELECT MAX(id) FROM cities));

-- ============================================================================
-- Таблица 4: район (§8) — slug и порядок обязательны, уникальны внутри города.
-- Заведены только там, где деление реально различимо человеку (ТЗ: «не выдумываем
-- административное деление»), поэтому у остальных городов районов нет и карточки
-- оттуда не выпадают при фильтре «без района» (§5.4).
-- ============================================================================
CREATE TABLE IF NOT EXISTS districts (
    id BIGSERIAL PRIMARY KEY,
    city_id BIGINT NOT NULL REFERENCES cities (id),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    order_num SMALLINT NOT NULL,
    UNIQUE (city_id, name),
    UNIQUE (city_id, slug),
    UNIQUE (city_id, order_num)
);

INSERT INTO districts (id, city_id, name, slug, order_num) VALUES
    (1, 1, 'Центр',     'centr',     1),
    (2, 1, 'Балка',     'balka',     2),
    (3, 1, 'Населёнка', 'naselenka', 3),
    (4, 1, 'Тарновка',  'tarnovka',  4)
ON CONFLICT (id) DO NOTHING;

SELECT setval(pg_get_serial_sequence('districts', 'id'), (SELECT MAX(id) FROM districts));

-- ============================================================================
-- Таблица 5: справочник направлений (§4) — двухуровневый в одной таблице.
-- parent_id IS NULL = наднаправление (верхних девять, включая «Другое»),
-- строка с parent_id = направление. Одна карточка — одно направление (§4, п. 1),
-- тегов как сущности нет.
-- ============================================================================
CREATE TABLE IF NOT EXISTS categories (
    id BIGSERIAL PRIMARY KEY,
    parent_id BIGINT REFERENCES categories (id),
    name VARCHAR(120) NOT NULL,
    slug VARCHAR(120) NOT NULL UNIQUE,
    kind VARCHAR(12) NOT NULL DEFAULT 'both'
        CHECK (kind IN ('activity', 'service', 'both')),
    icon VARCHAR(64) NOT NULL DEFAULT '',
    order_num SMALLINT NOT NULL DEFAULT 0,
    level SMALLINT GENERATED ALWAYS AS (CASE WHEN parent_id IS NULL THEN 1 ELSE 2 END) STORED
);

CREATE INDEX IF NOT EXISTS categories_parent_idx ON categories (parent_id);

INSERT INTO categories (id, parent_id, name, slug, kind, icon, order_num) VALUES
    -- Девять наднаправлений, §4. Порядок — порядок списка в ТЗ.
    (1,  NULL, 'Творчество и искусство',        'creative-arts',      'both', 'palette',        1),
    (2,  NULL, 'Спорт и физическая активность', 'sport-fitness',      'both', 'dumbbell',       2),
    (3,  NULL, 'Технологии и игры',             'tech-games',         'both', 'cpu',            3),
    (4,  NULL, 'Обучение и занятия для детей',  'learning-kids',      'both', 'graduation-cap', 4),
    (5,  NULL, 'Животные и природа',            'animals-nature',     'both', 'paw-print',      5),
    (6,  NULL, 'Путешествия и активный отдых',  'travel-outdoor',     'both', 'mountain',       6),
    (7,  NULL, 'Практические навыки',           'practical-skills',   'both', 'wrench',         7),
    (8,  NULL, 'Социальная деятельность',       'social-activity',    'both', 'users',          8),
    (9,  NULL, 'Другое',                        'other',              'both', 'layout-grid',    9),

    -- 1. Творчество и искусство
    (10, 1, 'Рисование',            'drawing',          'both', 'brush',   1),
    (11, 1, 'Музыка',               'music',            'both', 'music',   2),
    (12, 1, 'Танцы',                'dance',            'both', 'dance',   3),
    (13, 1, 'Фото и видео',         'photo-video',      'both', 'camera',  4),
    (14, 1, 'Рукоделие',            'needlework',       'both', 'yarn',    5),
    (15, 1, 'Кулинария',            'cooking',          'both', 'chef',    6),
    (16, 1, 'Сцена и выступления',  'stage-performance','both', 'theater', 7),

    -- 2. Спорт и физическая активность
    (20, 2, 'Футбол',              'football',         'both', 'ball',      1),
    (21, 2, 'Баскетбол',           'basketball',       'both', 'basketball',2),
    (22, 2, 'Волейбол',            'volleyball',       'both', 'volleyball',3),
    (23, 2, 'Бокс и единоборства', 'martial-arts',     'both', 'fist',      4),
    (24, 2, 'Плавание',            'swimming',         'both', 'water',     5),
    (25, 2, 'Лёгкая атлетика',     'athletics',        'both', 'run',       6),
    (26, 2, 'Фитнес и йога',       'fitness-yoga',     'both', 'yoga',      7),
    (27, 2, 'Гимнастика',          'gymnastics',       'both', 'gym',       8),
    (28, 2, 'Спортивные танцы',    'dance-sport',      'both', 'music',     9),

    -- 3. Технологии и игры
    (30, 3, 'Программирование',   'programming',      'both', 'code',    1),
    (31, 3, 'Робототехника',      'robotics',         'both', 'robot',   2),
    (32, 3, 'Компьютерные игры',  'video-games',      'both', 'gamepad', 3),
    (33, 3, 'Настольные игры',    'board-games',      'both', 'dice',    4),
    (34, 3, 'Шахматы',            'chess',            'both', 'chess',   5),
    (35, 3, '3D и дизайн',        'design-3d',        'both', 'cube',    6),

    -- 4. Обучение и занятия для детей
    (40, 4, 'Иностранные языки',  'foreign-languages','both', 'globe',  1),
    (41, 4, 'Подготовка к школе', 'school-prep',      'both', 'school', 2),
    (42, 4, 'Развитие речи',      'speech-dev',       'both', 'speech', 3),
    (43, 4, 'Логика',             'logic',            'both', 'logic',  4),
    (44, 4, 'Математика',         'math',             'both', 'sigma',  5),
    (45, 4, 'Чтение',             'reading',          'both', 'book',   6),
    (46, 4, 'Скорочтение',        'speed-reading',    'both', 'book',   7),

    -- 5. Животные и природа
    (50, 5, 'Уход за животными',      'pet-care',           'both', 'heart',   1),
    (51, 5, 'Кинология и дрессировка','dog-training',       'both', 'dog',     2),
    (52, 5, 'Садоводство',            'gardening',          'both', 'flower',  3),
    (53, 5, 'Выращивание растений',   'plant-growing',      'both', 'leaf',    4),
    (54, 5, 'Экология',               'ecology',            'both', 'leaf',    5),

    -- 6. Путешествия и активный отдых
    (60, 6, 'Туризм',         'tourism',          'both', 'backpack', 1),
    (61, 6, 'Походы',         'hiking',           'both', 'mountain', 2),
    (62, 6, 'Кемпинг',        'camping',          'both', 'tent',     3),
    (63, 6, 'Ориентирование', 'orienteering',     'both', 'compass',  4),
    (64, 6, 'Краеведение',    'local-history',    'both', 'landmark', 5),

    -- 7. Практические навыки
    (70, 7, 'Работа с инструментом', 'toolwork',        'both', 'tool',   1),
    (71, 7, 'Столярное дело',         'carpentry',       'both', 'saw',    2),
    (72, 7, 'Слесарное дело',         'metalwork',       'both', 'wrench', 3),
    (73, 7, 'Ремонт техники',         'device-repair',   'both', 'wrench', 4),
    (74, 7, 'Мастерская «сделай сам»','diy-workshop',    'both', 'tool',   5),

    -- 8. Социальная деятельность
    (80, 8, 'Волонтёрство',           'volunteering',        'both', 'hands', 1),
    (81, 8, 'Организация мероприятий','event-organizing',    'both', 'calendar', 2),
    (82, 8, 'Благотворительность',    'charity',             'both', 'heart', 3),
    (83, 8, 'Клубы по интересам',     'interest-clubs',      'both', 'users', 4),

    -- Услуги (§4, п. 2): те же поля, но тип записи = услуга.
    (90, 9, 'Репетиторство',   'tutoring',   'service', 'user',   1),
    (91, 9, 'Массаж',          'massage',    'service', 'hand',   2),
    (92, 9, 'Маникюр',         'manicure',   'service', 'nail',   3),
    (93, 9, 'Груминг',         'grooming',   'service', 'scissors', 4),
    (94, 9, 'Фотоуслуги',      'photo-service', 'service', 'camera', 5),
    (95, 9, 'Перевозка',       'transport',  'service', 'truck',  6)
-- Справочник — не «только вставка»: повторный прогон обязан догонять правки
-- названий, порядка и иконок, иначе живая база и init.sql снова разъедутся.
ON CONFLICT (id) DO UPDATE SET
    parent_id = EXCLUDED.parent_id,
    name      = EXCLUDED.name,
    slug      = EXCLUDED.slug,
    kind      = EXCLUDED.kind,
    icon      = EXCLUDED.icon,
    order_num = EXCLUDED.order_num;

SELECT setval(pg_get_serial_sequence('categories', 'id'), (SELECT MAX(id) FROM categories));

-- ============================================================================
-- Таблица 2: организация (§8). Телефон обязателен — карточка без телефона
-- не проходит checks.sql (§7.8). Основание публикации обязательно (§11.8).
-- ============================================================================
CREATE TABLE IF NOT EXISTS organizations (
    id BIGSERIAL PRIMARY KEY,
    slug VARCHAR(140) NOT NULL UNIQUE,
    name VARCHAR(200) NOT NULL,
    type VARCHAR(32) NOT NULL
        CHECK (type IN ('школа', 'студия', 'дом творчества', 'спортшкола', 'частный мастер')),
    description TEXT,
    phone VARCHAR(32) NOT NULL,
    email VARCHAR(254),
    site VARCHAR(500),
    city_id BIGINT REFERENCES cities (id),
    address VARCHAR(300),
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    owner_id BIGINT REFERENCES users (id),
    contacts_verified_at DATE,
    publish_basis VARCHAR(500) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- Таблица 1-Б: точка проведения (§8) — принадлежит организации, не карточке.
-- Координаты заполняются только вместе и только в рамке Приднестровья (§7.3, §3.5).
-- ============================================================================
CREATE TABLE IF NOT EXISTS locations (
    id BIGSERIAL PRIMARY KEY,
    org_id BIGINT NOT NULL REFERENCES organizations (id),
    name VARCHAR(160),
    city_id BIGINT NOT NULL REFERENCES cities (id),
    district_id BIGINT REFERENCES districts (id),
    address VARCHAR(300) NOT NULL,
    lat DOUBLE PRECISION CHECK (lat BETWEEN 45.9 AND 48.9),
    lng DOUBLE PRECISION CHECK (lng BETWEEN 27.4 AND 30.6),
    phone VARCHAR(32),
    contacts_verified_at DATE,
    source VARCHAR(16) NOT NULL DEFAULT 'лично'
        CHECK (source IN ('сайт', 'звонок', 'соцсети', 'лично')),
    source_link VARCHAR(500),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- широта и долгота заполняются вместе (§8, табл. 1-Б, п. 7)
    CONSTRAINT locations_coords_pair CHECK (
        (lat IS NULL AND lng IS NULL) OR (lat IS NOT NULL AND lng IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS locations_org_id_idx ON locations (org_id);
CREATE INDEX IF NOT EXISTS locations_city_id_idx ON locations (city_id);
CREATE INDEX IF NOT EXISTS locations_coords_idx ON locations (lat, lng);

-- ============================================================================
-- Таблица 1: занятие или услуга (одна карточка = одна строка).
-- Возрастов, цен, расписаний, городов и адресов здесь нет: они у группы (1-А)
-- и у точки (1-Б) — §8, примечание после таблицы 1.
-- ============================================================================
CREATE TABLE IF NOT EXISTS cards (
    id BIGSERIAL PRIMARY KEY,
    slug VARCHAR(160) NOT NULL UNIQUE,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    org_id BIGINT NOT NULL REFERENCES organizations (id),
    kind VARCHAR(12) NOT NULL DEFAULT 'activity'
        CHECK (kind IN ('activity', 'service')),
    category_id BIGINT NOT NULL REFERENCES categories (id),
    lesson_type VARCHAR(20)
        CHECK (lesson_type IN ('individual', 'group', 'both') OR lesson_type IS NULL),
    format VARCHAR(12) NOT NULL DEFAULT 'offline'
        CHECK (format IN ('online', 'offline', 'both')),
    phone VARCHAR(32),
    contacts_verified_at DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'on_moderation', 'published', 'rejected')),
    reject_reason TEXT,
    owner_id BIGINT REFERENCES users (id),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- возраст «до» не меньше «от» живёт в группах; здесь проверяется только
    -- обязательность направления и организации (§8, табл. 1, п. 5, 7)
    CONSTRAINT cards_service_has_no_lesson_type CHECK (
        kind = 'activity' OR lesson_type IS NULL
    )
);

CREATE INDEX IF NOT EXISTS cards_status_idx ON cards (status);
CREATE INDEX IF NOT EXISTS cards_category_idx ON cards (category_id);
CREATE INDEX IF NOT EXISTS cards_org_idx ON cards (org_id);

-- Индексы поиска завязаны на fold(), а не на голый столбец: запрос каталога
-- (§5.1) сравнивает fold(name), и только с таким выражением в индексе Planner
-- вообще может его использовать. Один gin закрывает и LIKE, и оператор %.
CREATE INDEX IF NOT EXISTS cards_name_trgm_idx ON cards USING gin (fold(name) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS organizations_name_trgm_idx ON organizations USING gin (fold(name) gin_trgm_ops);

-- ============================================================================
-- Таблица 1-А: возрастная группа (§8). Группа не живёт отдельно от занятия:
-- у неё нет своего статуса, голосов и места в каталоге (§7.10).
-- ============================================================================
CREATE TABLE IF NOT EXISTS groups (
    id BIGSERIAL PRIMARY KEY,
    card_id BIGINT NOT NULL REFERENCES cards (id) ON DELETE CASCADE,
    name VARCHAR(160),
    age_from SMALLINT,
    age_to SMALLINT,
    price_from INTEGER,
    price_to INTEGER,
    price_period VARCHAR(16)
        CHECK (price_period IN ('session', 'month', 'course') OR price_period IS NULL),
    location_id BIGINT NOT NULL REFERENCES locations (id),
    seats SMALLINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT groups_age_order CHECK (age_to IS NULL OR age_from IS NULL OR age_to >= age_from),
    CONSTRAINT groups_age_both_or_none CHECK (
        (age_from IS NULL AND age_to IS NULL) OR (age_from IS NOT NULL AND age_to IS NOT NULL)
    ),
    CONSTRAINT groups_price_order CHECK (price_to IS NULL OR price_from IS NULL OR price_to >= price_from),
    CONSTRAINT groups_price_period CHECK (
        price_from IS NULL OR price_from = 0 OR price_period IS NOT NULL
    ),
    CONSTRAINT groups_seats_positive CHECK (seats IS NULL OR seats > 0)
);

CREATE INDEX IF NOT EXISTS groups_card_idx ON groups (card_id);
CREATE INDEX IF NOT EXISTS groups_location_idx ON groups (location_id);
CREATE INDEX IF NOT EXISTS groups_age_idx ON groups (age_from, age_to);

-- ============================================================================
-- Таблица 6: расписание группы (§8). Одна строка = один день; «пн, ср, пт 17:00»
-- это три строки (§8, примечание). Фильтр «день и время» работает только по ней.
-- ============================================================================
CREATE TABLE IF NOT EXISTS schedules (
    id BIGSERIAL PRIMARY KEY,
    group_id BIGINT NOT NULL REFERENCES groups (id) ON DELETE CASCADE,
    weekday SMALLINT NOT NULL CHECK (weekday BETWEEN 1 AND 7),
    time_from TIME NOT NULL,
    time_to TIME NOT NULL CHECK (time_to > time_from),
    note VARCHAR(240),
    seats SMALLINT CHECK (seats IS NULL OR seats > 0),
    UNIQUE (group_id, weekday)
);

CREATE INDEX IF NOT EXISTS schedules_group_idx ON schedules (group_id);

-- ============================================================================
-- Таблица 7: медиа (§8) — занятия, точки и отзывы в одной таблице по признаку
-- «к чему». Храним путь в томе media, а не файл (POST /upload, §9.13).
-- ============================================================================
CREATE TABLE IF NOT EXISTS media (
    id BIGSERIAL PRIMARY KEY,
    entity VARCHAR(16) NOT NULL CHECK (entity IN ('card', 'location', 'review')),
    entity_id BIGINT NOT NULL,
    path VARCHAR(500) NOT NULL,
    order_num SMALLINT NOT NULL DEFAULT 0,
    caption VARCHAR(240),
    source_url VARCHAR(500),
    author VARCHAR(160),
    kind VARCHAR(8) NOT NULL DEFAULT 'photo' CHECK (kind IN ('photo', 'video')),
    UNIQUE (entity, entity_id, order_num)
);

CREATE INDEX IF NOT EXISTS media_owner_idx ON media (entity, entity_id);

-- ============================================================================
-- Мессенджеры (§8, табл. 1 п. 11, табл. 1-Б п. 9, табл. 2 п. 8): тип + значение,
-- до четырёх, по одному на тип. Отдельная таблица — чтобы фронтенд мог вывести
-- каждый своей кликабельной строкой (§3.3.7), а не одной кнопкой по первому.
-- ============================================================================
CREATE TABLE IF NOT EXISTS messengers (
    id BIGSERIAL PRIMARY KEY,
    entity VARCHAR(20) NOT NULL CHECK (entity IN ('card', 'location', 'organization')),
    entity_id BIGINT NOT NULL,
    type VARCHAR(16) NOT NULL CHECK (type IN ('telegram', 'viber', 'whatsapp', 'instagram')),
    value VARCHAR(200) NOT NULL,
    UNIQUE (entity, entity_id, type)
);

CREATE INDEX IF NOT EXISTS messengers_owner_idx ON messengers (entity, entity_id);

-- ============================================================================
-- Модерация (§3.8–3.9, §8 таблицы 11).
--
-- Три таблицы, и все три — про решения, а не про карточку: статус занятия
-- по-прежнему живёт в cards.status (§8, табл. 1), решение модератора обновляет
-- его в той же транзакции, что и заявку с журналом. Словари намеренно не слиты
-- в один: у заявки свой (pending/approved/rejected), у карточки свой
-- (draft/on_moderation/published/rejected), «одобрено» и «опубликовано» — не
-- одно и то же (§7.18: опубликованное потом снимают с публикации, не отменяя
-- решение).
--
-- Идемпотентность как во всём скрипте: CREATE TABLE IF NOT EXISTS. Старые
-- колонки здесь не переименовываются, поэтому на живой базе достаточно просто
-- перепрогнать init.sql — существующие строки cards и users не затрагиваются.
-- ============================================================================

-- Заявка: одна строка = один прогон анкеты через модерацию (§3.9.1). Правка
-- группы или точки выводит занятие обратно на проверку (§3.8.6), поэтому
-- история «сколько раз анкета стояла в очереди» сохраняется, а не перезатирается.
CREATE TABLE IF NOT EXISTS moderation_applications (
    id BIGSERIAL PRIMARY KEY,
    card_id BIGINT NOT NULL REFERENCES cards (id) ON DELETE CASCADE,
    status VARCHAR(16) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected')),
    -- Анкету подаёт владелец (кабинет владельца, §3.8); ссылки на users, а не
    -- на строку письма: роль и имя автора берутся из таблицы 8 (§8, табл. 11).
    submitted_by BIGINT REFERENCES users (id) ON DELETE SET NULL,
    submitted_at TIMESTAMPTZ,
    decided_by BIGINT REFERENCES users (id) ON DELETE SET NULL,
    decided_at TIMESTAMPTZ,
    -- Причина отказа для владельца (§3.9.3): типовая причина плюс свободный
    -- текст, собранные в одну строку. При approve всегда NULL.
    reject_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT moderation_applications_decided_consistency CHECK (
        (status = 'pending' AND decided_at IS NULL AND decided_by IS NULL)
        OR (status <> 'pending' AND decided_at IS NOT NULL AND decided_by IS NOT NULL)
    ),
    CONSTRAINT moderation_applications_reject_has_reason CHECK (
        status <> 'rejected' OR reject_reason IS NOT NULL
    ),
    CONSTRAINT moderation_applications_has_submission_date CHECK (
        submitted_at IS NOT NULL
    )
);

CREATE INDEX IF NOT EXISTS moderation_applications_status_idx
    ON moderation_applications (status, submitted_at, id);
CREATE INDEX IF NOT EXISTS moderation_applications_card_idx
    ON moderation_applications (card_id);

-- Одна карточка — не больше одной живой заявки: иначе в очереди стоят две
-- одинаковые анкеты, и решение по одной из них не значит ничего. Частичный
-- индекс — единственный способ удержать это правило для pending, не мешая
-- истории approved/rejected по той же карточке.
CREATE UNIQUE INDEX IF NOT EXISTS moderation_applications_pending_once
    ON moderation_applications (card_id)
    WHERE status = 'pending';

-- Журнал решений (§3.9.4, §8 табл. 11): виден, но не редактируется.
-- UPDATE/DELETE по нему обработчиками не предусмотрены; если понадобится
-- «переоткрыть» анкету — это новая заявка и новая строка журнала, а не правка
-- существующей.
CREATE TABLE IF NOT EXISTS moderation_journal (
    id BIGSERIAL PRIMARY KEY,
    application_id BIGINT NOT NULL REFERENCES moderation_applications (id) ON DELETE CASCADE,
    card_id BIGINT NOT NULL REFERENCES cards (id) ON DELETE CASCADE,
    actor_id BIGINT NOT NULL REFERENCES users (id),
    action VARCHAR(12) NOT NULL CHECK (action IN ('approve', 'reject')),
    -- Пункт типового списка причин (§3.9.3) и свободный текст владельцу.
    reason VARCHAR(120),
    comment TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT moderation_journal_reject_has_reason CHECK (
        action <> 'reject' OR reason IS NOT NULL
    )
);

CREATE INDEX IF NOT EXISTS moderation_journal_created_idx
    ON moderation_journal (created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS moderation_journal_application_idx
    ON moderation_journal (application_id);

-- Вторая очередь: жалобы на отзывы, комментарии и медиа (§3.9.7).
-- target_type + target_id — тот же приём, что у media (§8 табл. 7): у отзывов
-- (§8 табл. 12) своей таблицы в этой схеме ещё нет, поэтому внешнего ключа на
-- «на что жалуются» здесь не бывает. card_id — занятие, к которому относится
-- жалоба: по нему витрина подписывает строку («на что жалуются»).
CREATE TABLE IF NOT EXISTS content_reports (
    id BIGSERIAL PRIMARY KEY,
    target_type VARCHAR(16) NOT NULL
        CHECK (target_type IN ('review', 'comment', 'media', 'card')),
    target_id BIGINT NOT NULL,
    card_id BIGINT REFERENCES cards (id) ON DELETE CASCADE,
    -- «Что за запись» в очереди (§3.9.7): фрагмент, на который жалуются. Своей
    -- таблицы у отзывов ещё нет, поэтому фрагмент хранится здесь, а не
    -- доезжается join'ом — ссылаться на несуществующую таблицу нельзя.
    target_excerpt VARCHAR(400),
    reason VARCHAR(120) NOT NULL,
    detail TEXT,
    status VARCHAR(16) NOT NULL DEFAULT 'open'
        CHECK (status IN ('open', 'hidden', 'dismissed')),
    -- Причина скрытия видна автору (§3.9.7), тексты модератор не редактирует:
    -- поэтому здесь только статус и основание, ни одного поля «новый текст».
    hide_reason VARCHAR(120),
    reporter_id BIGINT REFERENCES users (id) ON DELETE SET NULL,
    decided_by BIGINT REFERENCES users (id) ON DELETE SET NULL,
    decided_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT content_reports_hidden_has_reason CHECK (
        status <> 'hidden' OR hide_reason IS NOT NULL
    ),
    CONSTRAINT content_reports_decided_has_date CHECK (
        status = 'open' OR decided_at IS NOT NULL
    )
);

CREATE INDEX IF NOT EXISTS content_reports_status_idx
    ON content_reports (status, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS content_reports_target_idx
    ON content_reports (target_type, target_id);

-- ============================================================================
-- Демонстрационные данные
-- ============================================================================
INSERT INTO organizations
    (id, slug, name, type, description, phone, email, site, city_id, address, lat, lng, publish_basis)
VALUES
    (1, 'studiya-palitra', 'Студия рисования «Палитра»', 'студия',
     'Масло, акварель и скетчинг. Занятия в малых группах.', '+373 777 12345',
     NULL, NULL, 1, 'ул. 25 Октября, 62', 46.8435, 29.6392, 'https://example.test/palitra'),
    (2, 'dnestr-futbol', 'СДЮШОР «Днестр»', 'спортшкола',
     'Футбольная школа, тренировки на открытом поле и в зале.', '+373 777 23456',
     NULL, NULL, 1, 'ул. Котовского, 32', 46.8487, 29.6471, 'https://example.test/dnestr'),
    (3, 'dom-tvorchestva-bendery', 'Дом творчества г. Бендеры', 'дом творчества',
     'Кружки и секции для детей от 5 лет.', '+373 777 34567',
     NULL, NULL, 2, 'ул. Ленинская, 48', 46.8117, 29.5807, 'https://example.test/dt-bendery'),
    (4, 'klub-samokindal', 'Клуб «Самокиндар»', 'студия',
     'Бальные и спортивные танцы, парные постановки.', '+373 777 45678',
     NULL, NULL, 2, 'ул. Мичурина, 5', 46.8089, 29.5743, 'https://example.test/samokindal'),
    (5, 'centr-rannego-razvitiya', 'Центр раннего развития', 'студия',
     'Подготовка к школе и развивающие занятия.', '+373 777 56789',
     NULL, NULL, 3, 'ул. Кирова, 17', 47.8330, 29.6837, 'https://example.test/rannoe'),
    (6, 'shakhmatnyj-klub', 'Шахматный клуб «Гамбит»', 'студия',
     'Разборы партий, блиц-турниры, подготовка к разрядам.', '+373 777 67890',
     NULL, NULL, 4, 'ул. Советская, 91', 47.2647, 29.3264, 'https://example.test/gambit'),
    (7, 'kulinariya-prosto', 'Кулинарная мастерская «Просто»', 'частный мастер',
     'Готовим с подрострами: базовые техники и домашние рецепты.', '+373 777 78901',
     NULL, NULL, 5, 'ул. Пушкина, 12', 48.0534, 29.6103,
     'Согласие мастера на публикацию получено лично, 01.11.2026.'),
    (8, 'atletika-kamenka', 'Секция лёгкой атлетики', 'спортшкола',
     'Бег, прыжки, метания. Подготовка к школьным стартам.', '+373 777 89012',
     NULL, NULL, 6, 'ул. Гагарина, 3', 47.2564, 29.8713, 'https://example.test/atletika'),
    (9, 'master-matematiki', 'Частный репетитор', 'частный мастер',
     'Математика 5–11 класс, подготовка к экзаменам.', '+373 777 90123',
     NULL, NULL, 1, 'ул. 1-ой Конной Армии, 8', 46.8501, 29.6299,
     'Согласие мастера на публикацию получено лично, 02.11.2026.'),
    -- Название с «ё»: на нём проверяется нормализация §5.1 — запрос «веселые»
    -- (через «е») обязан найти «Весёлые».
    (10, 'dmsh-veselye-noty', 'ДМШ «Весёлые ноты»', 'дом творчества',
     'Фортепиано, скрипка, аккордеон; хоровое и сольное пение.', '+373 777 01234',
     NULL, NULL, 1, 'ул. Еврейская, 42', 46.8407, 29.6344,
     'Согласие директора получено по телефону, 03.10.2026.')
ON CONFLICT (id) DO NOTHING;

SELECT setval(pg_get_serial_sequence('organizations', 'id'), (SELECT MAX(id) FROM organizations));

INSERT INTO locations
    (id, org_id, name, city_id, district_id, address, lat, lng, source, source_link)
VALUES
    (1, 1, 'Основной зал',      1, 1, 'ул. 25 Октября, 62',  46.8435, 29.6392, 'звонок', 'https://example.test/palitra'),
    (2, 2, 'Поле на Населёнке', 1, 3, 'ул. Котовского, 32',  46.8487, 29.6471, 'звонок', 'https://example.test/dnestr'),
    (3, 2, 'Зал в манеже',      1, 2, 'ул. Суворова, 44',    46.8374, 29.6244, 'звонок', 'https://example.test/dnestr'),
    (4, 3, 'Кабинет 214',       2, NULL, 'ул. Ленинская, 48', 46.8117, 29.5807, 'сайт', 'https://example.test/dt-bendery'),
    (5, 4, 'Танцевальный зал',  2, NULL, 'ул. Мичурина, 5',   46.8089, 29.5743, 'звонок', 'https://example.test/samokindal'),
    (6, 5, 'Класс подготовки',  3, NULL, 'ул. Кирова, 17',    47.8330, 29.6837, 'соцсети', 'https://example.test/rannoe'),
    (7, 6, 'Игровой зал',       4, NULL, 'ул. Советская, 91', 47.2647, 29.3264, 'лично', NULL),
    (8, 7, 'Мастерская',        5, NULL, 'ул. Пушкина, 12',   48.0534, 29.6103, 'лично', NULL),
    (9, 8, 'Стадион «Тигрина»', 6, NULL, 'ул. Гагарина, 3',   47.2564, 29.8713, 'звонок', 'https://example.test/atletika'),
    (10, 9, NULL,               1, 1, 'ул. 1-ой Конной Армии, 8', 46.8501, 29.6299, 'лично', NULL),
    -- Точка без координат: по §7.11 карточка с ней не публикуется, checks.sql её покажет.
    (11, 8, 'Запасной зал',     6, NULL, 'ул. Ленина, 1',     NULL, NULL, 'сайт', 'https://example.test/atletika'),
    (12, 10, 'Большой зал',     1, 1, 'ул. Еврейская, 42', 46.8407, 29.6344, 'звонок', 'https://example.test/noty')
ON CONFLICT (id) DO NOTHING;

SELECT setval(pg_get_serial_sequence('locations', 'id'), (SELECT MAX(id) FROM locations));

INSERT INTO cards
    (id, slug, name, description, org_id, kind, category_id, lesson_type, format, status)
VALUES
    (1, 'tiraspol-studiya-palitra', 'Студия рисования «Палитра»',
     'Масло, акварель и скетчинг по субботам.', 1, 'activity', 10, 'group', 'offline', 'published'),
    (2, 'tiraspol-futbol-detyam', 'Футбольная секция «Днестр»',
     'Тренировки на открытом поле два раза в неделю.', 2, 'activity', 20, 'group', 'offline', 'published'),
    (3, 'bendery-robototekhnika', 'Кружок робототехники',
     'Лего и Arduino, подготовка к соревнованиям.', 3, 'activity', 31, 'group', 'offline', 'published'),
    (4, 'bendery-balnye-tancy', 'Бальные танцы',
     'Парные постановки, выступления на городских вечерах.', 4, 'activity', 12, 'both', 'offline', 'published'),
    (5, 'rybnitsa-podgotovka-k-shkole', 'Подготовка к школе',
     'Чтение, счёт и логика, три раза в неделю.', 5, 'activity', 41, 'group', 'offline', 'published'),
    (6, 'dubossary-shakhmaty', 'Шахматная гостиная',
     'Разборы партий и блиц-турниры по воскресеньям.', 6, 'activity', 34, 'both', 'offline', 'published'),
    (7, 'kamenka-kulinariya-podrostki', 'Курс кулинарии для подростков',
     'Анкета ещё не опубликована — проверяется модератором.', 7, 'activity', 15, 'group', 'offline', 'on_moderation'),
    (8, 'slobodzeja-legkaya-atletika', 'Секция лёгкой атлетики',
     'Отклонена: не указан адрес проведения по основной точке.', 8, 'activity', 25, 'group', 'offline', 'rejected'),
    -- Услуга: возраст пустой (§5.2 — участвует в выдаче только при «без возраста»).
    (9, 'tiraspol-repetitor-matematika', 'Репетитор по математике',
     'Программа 5–11 класс, разбор тем под запрос ученика.', 9, 'service', 90, NULL, 'both', 'published'),
    (10, 'tiraspol-veselye-noty', 'Детская музыкальная школа «Весёлые ноты»',
     'Фортепиано, скрипка и сольфеджио. Отчётные концерты дважды в год.',
     10, 'activity', 11, 'group', 'offline', 'published')
ON CONFLICT (id) DO NOTHING;

SELECT setval(pg_get_serial_sequence('cards', 'id'), (SELECT MAX(id) FROM cards));

-- §5.5: «проверенные» — не старше 90 дней. Одна карточка со свежей проверкой и
-- одна с устаревшей, чтобы фильтр было чем отличать, а checks.sql — что поймать.
UPDATE cards SET contacts_verified_at = current_date - 30  WHERE id = 10;
UPDATE cards SET contacts_verified_at = current_date - 200 WHERE id = 5;

INSERT INTO groups
    (id, card_id, name, age_from, age_to, price_from, price_to, price_period, location_id, seats)
VALUES
    (1, 1, '5–7 лет',      5,  7,  300, NULL, 'month', 1, 8),
    (2, 1, '8–12 лет',     8,  12, 350, 400, 'month', 1, 10),
    (3, 2, '7–10 лет',     7,  10,   0, NULL, NULL,    2, NULL),
    (4, 2, '11–15 лет',   11,  15,  250, NULL, 'month', 2, 14),
    (5, 2, 'Группа в манеже', 8, 12, 300, NULL, 'session', 3, NULL),
    (6, 3, '8–11 лет',     8, 11,   450, NULL, 'month', 4, 6),
    (7, 3, '12–14 лет',   12, 14,   500, NULL, 'month', 4, 6),
    (8, 4, 'Малыши',        4,  6,  150, NULL, 'session', 5, 12),
    (9, 4, 'Школьники',     7, 12,  200, 250, 'month', 5, NULL),
    (10, 5, '5–7 лет',      5,  7,  250, NULL, 'month', 6, 5),
    (11, 6, '6–18 лет',     6, 18,   0, NULL, NULL,    7, NULL),
    (12, 7, '12–17 лет',   12, 17,  500, NULL, 'course', 8, 4),
    (13, 8, '9–13 лет',     9, 13,  150, NULL, 'month', 9, NULL),
    (14, 9, NULL,          NULL, NULL, 400, NULL, 'session', 10, NULL),
    (15, 10, '4–6 лет',      4,  6,  200, NULL, 'month', 12, 10),
    (16, 10, '7–12 лет',     7, 12,  250, 300, 'month', 12, 12)
ON CONFLICT (id) DO NOTHING;

SELECT setval(pg_get_serial_sequence('groups', 'id'), (SELECT MAX(id) FROM groups));

-- Одна строка = один день (§8, табл. 6). «пн, ср 17:00» — две строки.
INSERT INTO schedules (group_id, weekday, time_from, time_to, note, seats) VALUES
    (1,  6, '10:00', '11:30', NULL, 8),
    (2,  6, '12:00', '13:30', 'Сбор за 10 минут', 10),
    (2,  2, '16:00', '17:30', NULL, NULL),
    (3,  1, '17:00', '18:30', NULL, NULL),
    (3,  3, '17:00', '18:30', NULL, NULL),
    (4,  2, '18:00', '19:30', NULL, 14),
    (4,  4, '18:00', '19:30', NULL, 14),
    (5,  5, '16:00', '18:00', 'Форма не нужна', NULL),
    (6,  1, '15:00', '16:30', NULL, 6),
    (6,  4, '15:00', '16:30', NULL, 6),
    (7,  2, '17:00', '18:30', NULL, NULL),
    (8,  6, '09:00', '10:00', NULL, 12),
    (9,  3, '17:00', '18:30', NULL, NULL),
    (9,  5, '17:00', '18:30', NULL, NULL),
    (10, 1, '09:30', '11:00', NULL, 5),
    (10, 3, '09:30', '11:00', NULL, 5),
    (10, 5, '09:30', '11:00', NULL, 5),
    (11, 7, '11:00', '13:00', 'Блиц-турнир', NULL),
    (12, 6, '14:00', '16:00', NULL, 4),
    (13, 2, '16:30', '18:00', NULL, NULL),
    (14, 4, '19:00', '20:00', 'Онлайн по договорённости', NULL),
    (15, 2, '15:00', '16:00', NULL, 10),
    (15, 4, '15:00', '16:00', NULL, 10),
    (16, 2, '17:00', '18:00', 'Сбор в 16:45', NULL),
    (16, 4, '17:00', '18:00', NULL, NULL)
ON CONFLICT DO NOTHING;

INSERT INTO media (entity, entity_id, path, order_num, caption, source_url, kind) VALUES
    ('card', 1, '/media/cards/1/palitra-oblozhka.jpg',    0, 'Занятие акварелью', NULL, 'photo'),
    ('card', 1, '/media/cards/1/palitra-zal.jpg',         1, 'Мольберты в зале',  NULL, 'photo'),
    ('card', 2, '/media/cards/2/dnestr-pole.jpg',         0, 'Поле на Населёнке', NULL, 'photo'),
    ('card', 3, '/media/cards/3/robo-zanyatie.jpg',       0, 'Сборка робота',     NULL, 'photo'),
    ('card', 4, '/media/cards/4/tancy-parnoe.jpg',        0, 'Парная постановка', NULL, 'photo'),
    ('card', 5, '/media/cards/5/podgotovka-klass.jpg',    0, 'Класс подготовки',  NULL, 'photo'),
    ('card', 6, '/media/cards/6/shakhmaty-turnir.jpg',    0, 'Блиц-турнир',       NULL, 'photo'),
    ('card', 9, '/media/cards/9/repetitor-urok.jpg',      0, 'Урок математики',   NULL, 'photo'),
    ('location', 1, '/media/locations/1/studiya-palitra.jpg', 0, 'Студия изнутри', NULL, 'photo'),
    ('location', 2, '/media/locations/2/dnestr-pole.jpg',     0, 'Футбольное поле', NULL, 'photo')
ON CONFLICT DO NOTHING;

INSERT INTO messengers (entity, entity_id, type, value) VALUES
    ('organization', 1, 'telegram',  '@palitra_tiraspol'),
    ('organization', 1, 'whatsapp',  '+37377712345'),
    ('organization', 2, 'viber',     '+37377723456'),
    ('organization', 2, 'telegram',  '@dnestr_football'),
    ('organization', 3, 'instagram', 'dt_bendery'),
    ('location', 1, 'telegram', '@palitra_zal')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- Модерация: учётные записи и демо-очередь (§3.8–3.9, §8 табл. 8 и 11)
-- ============================================================================
-- Паролей в сиде нет намеренно: вход по §3.7 ещё не реализован, а пустой
-- password_hash означает «войти нельзя», а не «пароль пустой» — колонка
-- nullable именно для этого (§8, табл. 8, п. «локальный или гугловский вход»).
-- Роли при этом настоящие: на них проверяется доступ к /api/v1/moderation/*.
-- ON CONFLICT без цели — чтобы повторный прогон на живой базе не падал ни на
-- коллизии id, ни на коллизии почты (уникальна по §8, табл. 8).
INSERT INTO users (id, email, name, account_type, provider)
VALUES
    (1, 'moderator@example.test',   'Ирина, модератор каталога', 'moderator',      'local'),
    (2, 'palitra@example.test',     'Студия «Палитра», владелец','owner_activity', 'local'),
    (3, 'kulinariya@example.test',  'Мастерская «Просто», мастер','owner_activity','local'),
    (4, 'veselye-noty@example.test','ДМШ «Весёлые ноты», директор', 'owner_activity', 'local'),
    (5, 'atletika@example.test',    'Секция лёгкой атлетики, тренер', 'owner_activity', 'local')
ON CONFLICT DO NOTHING;

SELECT setval(pg_get_serial_sequence('users', 'id'), (SELECT MAX(id) FROM users));

-- Очередь на две ножки: что-то давно ждёт (просрочка по §3.9.5), что-то
-- свежее, и по одному решению каждого вида, чтобы журнал был чем смотреть.
--
-- Заявка 1 — карточка 7 (kamenka-kulinariya-podrostki, cards.status
-- 'on_moderation'): классическая анкета «на проверке», ждёт 6 дней — дольше
-- норматива §3.9.5, поэтому в очереди должна подсвечиваться как просрочка.
-- Заявка 2 — карточка 10, опубликованная: владелец поправил группу или точку,
-- и анкета вернулась на проверку (§3.8.6), оставаясь в каталоге, пока
-- модератор не решит. Так заявка и карточка осознанно в разных статусах.
INSERT INTO moderation_applications
    (id, card_id, status, submitted_by, submitted_at, decided_by, decided_at,
     reject_reason, created_at, updated_at)
VALUES
    (1, 7, 'pending', 3, now() - interval '6 days', NULL, NULL, NULL,
     now() - interval '6 days', now() - interval '6 days'),
    (2, 10, 'pending', 4, now() - interval '1 day', NULL, NULL, NULL,
     now() - interval '1 day', now() - interval '1 day'),
    (3, 3, 'approved', 2, now() - interval '21 days', 1, now() - interval '19 days',
     NULL, now() - interval '21 days', now() - interval '19 days'),
    (4, 8, 'rejected', 5, now() - interval '10 days', 1, now() - interval '8 days',
     'Не указан адрес проведения по основной точке — правьте группу и точку.',
     now() - interval '10 days', now() - interval '8 days'),
    (5, 1, 'approved', 2, now() - interval '30 days', 1, now() - interval '28 days',
     NULL, now() - interval '30 days', now() - interval '28 days')
ON CONFLICT DO NOTHING;

SELECT setval(pg_get_serial_sequence('moderation_applications', 'id'),
              (SELECT MAX(id) FROM moderation_applications));

-- Журнал (§3.9.4): ровно по строке на каждое решение, включая повторные проходы
-- по одной карточке — их здесь нет намеренно, их создаёт обработчик.
INSERT INTO moderation_journal
    (id, application_id, card_id, actor_id, action, reason, comment, created_at)
VALUES
    (1, 3, 3, 1, 'approve', NULL, NULL, now() - interval '19 days'),
    (2, 4, 8, 1, 'reject', 'Адрес не указан',
     'Не указан адрес проведения по основной точке — правьте группу и точку.',
     now() - interval '8 days'),
    (3, 5, 1, 1, 'approve', NULL, 'Фото и расписание в порядке.',
     now() - interval '28 days')
ON CONFLICT DO NOTHING;

SELECT setval(pg_get_serial_sequence('moderation_journal', 'id'),
              (SELECT MAX(id) FROM moderation_journal));

-- Вторая очередь (§3.9.7): открытая жалоба, уже снятая с показом и отклонённая.
-- target_id у review/comment — условные: своих таблиц в этой схеме пока нет
-- (§8, табл. 12–14), поэтому фрагмент записи лежит в target_excerpt.
INSERT INTO content_reports
    (id, target_type, target_id, card_id, target_excerpt, reason, detail, status,
     hide_reason, reporter_id, decided_by, decided_at, created_at, updated_at)
VALUES
    (1, 'review', 1, 2, '«Тренер опоздал на 20 минут, занятия не было»',
     'Оскорбление', 'Автор переходит на личности тренера.', 'open',
     NULL, NULL, NULL, NULL, now() - interval '3 days', now() - interval '3 days'),
    (2, 'media', 1, 1, '/media/cards/1/palitra-oblozhka.jpg',
     'Фото не по занятию', NULL, 'hidden', 'Не соответствует занятию',
     4, 1, now() - interval '2 days', now() - interval '4 days', now() - interval '2 days'),
    (3, 'comment', 7, 5, '«Ищите нас в соцсетях, ссылка в профиле»',
     'Реклама', NULL, 'dismissed', NULL,
     3, 1, now() - interval '5 days', now() - interval '6 days', now() - interval '5 days')
ON CONFLICT DO NOTHING;

SELECT setval(pg_get_serial_sequence('content_reports', 'id'),
              (SELECT MAX(id) FROM content_reports));
