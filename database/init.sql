-- Схема тестового стенда Talentro. Всё идемпотентно: скрипт можно запускать
-- поверх живой базы повторно и столько раз, сколько нужно.
--
-- Данные ниже — тестовые. Контакты намеренно в зарезервированной зоне
-- example.test (RFC 2606), телефоны не заполнены: реальных номеров у стенда
-- нет, а «проверяемый» номер в интерфейсе был бы выдумкой.

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP);

-- Провайдеры входа: 'local' — учётная запись стенда, 'google' — вход по ID-токену,
-- 'tester' — аккаунт проверки. Роль влияет на витрину, а не на права записи:
-- бэкенд по-прежнему не принимает ни одного изменения каталога.
ALTER TABLE users ADD COLUMN IF NOT EXISTS email       VARCHAR(160);
ALTER TABLE users ADD COLUMN IF NOT EXISTS name        VARCHAR(120);
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url  VARCHAR(500);
ALTER TABLE users ADD COLUMN IF NOT EXISTS provider    VARCHAR(20) NOT NULL DEFAULT 'local';
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_sub  VARCHAR(64);
ALTER TABLE users ADD COLUMN IF NOT EXISTS role        VARCHAR(20) NOT NULL DEFAULT 'user';

CREATE UNIQUE INDEX IF NOT EXISTS users_email_key    ON users (email);
CREATE UNIQUE INDEX IF NOT EXISTS users_google_sub_key ON users (google_sub);

INSERT INTO users (username) VALUES ('admin'), ('nicken')
ON CONFLICT (username) DO NOTHING;

CREATE TABLE IF NOT EXISTS cities (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    order_num SMALLINT NOT NULL DEFAULT 0
);

-- Бэкенд читает из cards id, name, city_id, age_from, age_to, а с задачи №15 —
-- и остальные поля models.Card. Словарь status нигде не ограничен на уровне БД:
-- 'published' читает каталог, 'on_moderation' и 'rejected' подразумевает
-- кабинет модератора (§3.9).
CREATE TABLE IF NOT EXISTS cards (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    organization_id INTEGER NOT NULL DEFAULT 0,
    city_id INTEGER NOT NULL REFERENCES cities (id),
    district VARCHAR(100),
    age_from INTEGER,
    age_to INTEGER,
    link VARCHAR(500),
    description TEXT,
    price NUMERIC(10, 2),
    category VARCHAR(100),
    status VARCHAR(32) NOT NULL DEFAULT 'draft',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS cards_city_id_idx ON cards (city_id);
CREATE INDEX IF NOT EXISTS cards_status_idx ON cards (status);

-- Организации: страница /organizations/[slug] и контакты в карточке.
CREATE TABLE IF NOT EXISTS organizations (
    id SERIAL PRIMARY KEY,
    slug VARCHAR(80) NOT NULL UNIQUE,
    name VARCHAR(200) NOT NULL,
    city_id INTEGER NOT NULL REFERENCES cities (id),
    description TEXT,
    phone VARCHAR(50),
    email VARCHAR(120),
    address TEXT,
    link VARCHAR(500)
);

-- Справочники направлений (§4.5). Иконки здесь не хранятся: это презентация,
-- она живёт во фронтенде и для неизвестного слага даёт заглушку.
CREATE TABLE IF NOT EXISTS supercategories (
    slug VARCHAR(80) PRIMARY KEY,
    title VARCHAR(150) NOT NULL,
    short_title VARCHAR(80) NOT NULL,
    order_num SMALLINT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    slug VARCHAR(80) NOT NULL UNIQUE,
    title VARCHAR(150) NOT NULL,
    super_slug VARCHAR(80) NOT NULL REFERENCES supercategories (slug),
    kind VARCHAR(16) NOT NULL DEFAULT 'both',
    order_num SMALLINT NOT NULL DEFAULT 0
);

-- Фильтр по направлению в repo.go был закомментирован именно потому, что
-- колонки не существовало.
ALTER TABLE cards ADD COLUMN IF NOT EXISTS direction_id INTEGER REFERENCES categories (id);
CREATE INDEX IF NOT EXISTS cards_direction_id_idx ON cards (direction_id);

-- Точки проведения: у занятия их несколько (§3.9.1), координаты кормят карту.
-- Рамка Приднестровья 45.9–48.9 / 27.4–30.6 её проверяет validateCoordinates().
CREATE TABLE IF NOT EXISTS card_locations (
    id BIGSERIAL PRIMARY KEY,
    card_id BIGINT NOT NULL REFERENCES cards (id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    address TEXT,
    district VARCHAR(100),
    lat NUMERIC(9, 6) NOT NULL,
    lng NUMERIC(9, 6) NOT NULL,
    CONSTRAINT card_locations_card_name_key UNIQUE (card_id, name)
);

CREATE INDEX IF NOT EXISTS card_locations_card_id_idx ON card_locations (card_id);

-- Иллюстрации тестового стенда: подписи «фото занятия» не делают, в UI это
-- картинка карточки без утверждения, что она настоящая.
CREATE TABLE IF NOT EXISTS card_photos (
    id BIGSERIAL PRIMARY KEY,
    card_id BIGINT NOT NULL REFERENCES cards (id) ON DELETE CASCADE,
    url VARCHAR(500) NOT NULL,
    alt VARCHAR(200),
    order_num SMALLINT NOT NULL DEFAULT 0,
    CONSTRAINT card_photos_card_url_key UNIQUE (card_id, url)
);

CREATE INDEX IF NOT EXISTS card_photos_card_id_idx ON card_photos (card_id);

-- Ограничения выше применяются только к свежей базе. Если таблицы уже созданы
-- без них (и если в них успели попасть дубликаты с прошлых прогонов), чистим
-- и навешиваем здесь — иначе повторный запуск скрипта плодит строки дальше.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'card_locations_card_name_key'
    ) THEN
        DELETE FROM card_locations a
        USING card_locations b
        WHERE a.card_id = b.card_id AND a.name = b.name AND a.id > b.id;
        ALTER TABLE card_locations
            ADD CONSTRAINT card_locations_card_name_key UNIQUE (card_id, name);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'card_photos_card_url_key'
    ) THEN
        DELETE FROM card_photos a
        USING card_photos b
        WHERE a.card_id = b.card_id AND a.url = b.url AND a.id > b.id;
        ALTER TABLE card_photos
            ADD CONSTRAINT card_photos_card_url_key UNIQUE (card_id, url);
    END IF;
END $$;

-- ---------------------------------------------------------------- сид

INSERT INTO cities (id, name, order_num) VALUES
    (1, 'Тирасполь', 1),
    (2, 'Бендеры', 2),
    (3, 'Рыбница', 3),
    (4, 'Дубоссары', 4),
    (5, 'Каменка', 5),
    (6, 'Слободзея', 6),
    (7, 'Григориополь', 7),
    (8, 'Днестровск', 8)
ON CONFLICT (id) DO NOTHING;

SELECT setval(pg_get_serial_sequence('cities', 'id'), (SELECT MAX(id) FROM cities));

INSERT INTO supercategories (slug, title, short_title, order_num) VALUES
    ('tvorchestvo', 'Творчество и искусство', 'Творчество', 1),
    ('sport', 'Спорт и физическая активность', 'Спорт', 2),
    ('tech', 'Технологии и игры', 'Технологии', 3),
    ('education', 'Обучение и занятия для детей', 'Обучение', 4),
    ('nature', 'Животные и природа', 'Природа', 5),
    ('travel', 'Путешествия и активный отдых', 'Путешествия', 6),
    ('practical', 'Практические навыки', 'Практика', 7),
    ('social', 'Социальная деятельность', 'Сообщество', 8),
    ('other', 'Другое', 'Другое', 9)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO categories (slug, title, super_slug, kind, order_num) VALUES
    ('risovanie', 'Рисование', 'tvorchestvo', 'both', 1),
    ('muzyka', 'Музыка', 'tvorchestvo', 'both', 2),
    ('tancy', 'Танцы', 'tvorchestvo', 'both', 3),
    ('foto-video', 'Фото и видео', 'tvorchestvo', 'both', 4),
    ('rukodelie', 'Рукоделие', 'tvorchestvo', 'both', 5),
    ('kulinariya', 'Кулинария', 'tvorchestvo', 'both', 6),
    ('scena', 'Сцена и выступления', 'tvorchestvo', 'both', 7),

    ('futbol', 'Футбол', 'sport', 'both', 1),
    ('basketbol', 'Баскетбол', 'sport', 'both', 2),
    ('voleybol', 'Волейбол', 'sport', 'both', 3),
    ('edinoborstva', 'Бокс и единоборства', 'sport', 'both', 4),
    ('plavanie', 'Плавание', 'sport', 'both', 5),
    ('atletika', 'Лёгкая атлетика', 'sport', 'both', 6),
    ('fitnes-yoga', 'Фитнес и йога', 'sport', 'both', 7),
    ('gimnastika', 'Гимнастика', 'sport', 'both', 8),
    ('sport-dance', 'Спортивные танцы', 'sport', 'both', 9),

    ('programmirovanie', 'Программирование', 'tech', 'both', 1),
    ('robototehnika', 'Робототехника', 'tech', 'both', 2),
    ('kompyuternye-igry', 'Компьютерные игры', 'tech', 'both', 3),
    ('nastolnye-igry', 'Настольные игры', 'tech', 'both', 4),
    ('shahmaty', 'Шахматы', 'tech', 'both', 5),
    ('3d-dizain', '3D и дизайн', 'tech', 'both', 6),

    ('inostrannye-yazyki', 'Иностранные языки', 'education', 'both', 1),
    ('podgotovka-k-shkole', 'Подготовка к школе', 'education', 'both', 2),
    ('razvitie-rechi', 'Развитие речи', 'education', 'both', 3),
    ('logika', 'Логика', 'education', 'both', 4),
    ('matematika', 'Математика', 'education', 'both', 5),
    ('chtenie', 'Чтение', 'education', 'both', 6),
    ('skorochtenie', 'Скорочтение', 'education', 'both', 7),

    ('uhod-za-zhivotnymi', 'Уход за животными', 'nature', 'both', 1),
    ('kinologiya', 'Кинология и дрессировка', 'nature', 'both', 2),
    ('sadovodstvo', 'Садоводство', 'nature', 'both', 3),
    ('ekologiya', 'Экология', 'nature', 'both', 4),
    ('verhovaya-ezda', 'Верховая езда', 'nature', 'both', 5),

    ('turizm', 'Туризм', 'travel', 'both', 1),
    ('pohody', 'Походы', 'travel', 'both', 2),
    ('keming', 'Кемпинг', 'travel', 'both', 3),
    ('orientirovanie', 'Ориентирование', 'travel', 'both', 4),

    ('stolyarnoe-delo', 'Столярное дело', 'practical', 'both', 1),
    ('remont-tehniki', 'Ремонт техники', 'practical', 'both', 2),
    ('masterstvo', 'Мастерская «сделай сам»', 'practical', 'both', 3),

    ('volonterstvo', 'Волонтёрство', 'social', 'both', 1),
    ('organizaciya-meropriyatiy', 'Организация мероприятий', 'social', 'both', 2),
    ('kluby', 'Клубы по интересам', 'social', 'both', 3),

    ('massazh-spa', 'Массаж и SPA', 'other', 'service', 1),
    ('manikyur', 'Маникюр и уход', 'other', 'service', 2),
    ('gruming', 'Груминг', 'other', 'service', 3),
    ('repetitorstvo', 'Репетиторство', 'other', 'service', 4),
    ('fotouslugi', 'Фотоуслуги', 'other', 'service', 5)
ON CONFLICT (slug) DO NOTHING;

SELECT setval(pg_get_serial_sequence('categories', 'id'), (SELECT MAX(id) FROM categories));

INSERT INTO organizations (id, slug, name, city_id, description, phone, email, address, link) VALUES
    (1, 'dom-tvorchestva-palitra', 'Дом творчества «Палитра»', 1,
     'Изостудия, керамика и скетчинг.', NULL, 'palitra@example.test',
     'Тирасполь, ул. 25 Октября, 12', 'https://example.test/palitra'),
    (2, 'fk-dnestr', 'ФК «Днестр»', 1,
     'Детские и юношеские тренировки на открытом поле.', NULL, 'dnestr@example.test',
     'Тирасполь, ул. Котовского, 44', 'https://example.test/dnestr'),
    (3, 'cnt-vostok', 'Центр научно-технического творчества «Восток»', 2,
     'Робототехника, программирование и инженерные кружки.', NULL, 'vostok@example.test',
     'Бендеры, ул. Советская, 71', NULL),
    (4, 'studio-ballnyh-tancev', 'Студия бальных танцев', 2,
     'Парные и групповые занятия, отчётные концерты.', NULL, 'dance@example.test',
     'Бендеры, ул. 40 лет Гвардейской, 5', NULL),
    (5, 'centr-razvitiya-rostok', 'Центр развития «Росток»', 3,
     'Подготовка к школе, логика и развитие речи.', NULL, 'rostok@example.test',
     'Рыбница, ул. К. Либкнехта, 3', NULL),
    (6, 'shahmatnyj-klub', 'Шахматный клуб', 4,
     'Группы разборов партий, блиц-турниры по воскресеньям.', NULL, 'shahmaty@example.test',
     'Дубоссары, ул. Советская, 60', NULL),
    (7, 'kulinar-naya-studiya', 'Кулинарная студия', 5,
     'Практические курсы для подростков.', NULL, 'kitchen@example.test',
     'Каменка, ул. Ленина, 18', NULL),
    (8, 'stadion-dnestr-slob', 'Стадион «Днестр»', 6,
     'Легкоатлетические секции на открытом стадионе.', NULL, 'stadium@example.test',
     'Слободзея, ул. Мира, 2', NULL)
ON CONFLICT (id) DO NOTHING;

SELECT setval(pg_get_serial_sequence('organizations', 'id'), (SELECT MAX(id) FROM organizations));

INSERT INTO cards
    (id, name, organization_id, city_id, district, age_from, age_to, link, description, price, category, status, direction_id)
VALUES
    (1, 'Студия рисования «Палитра»', 1, 1, 'Центр', 7, 12, NULL,
     'Масло, акварель и скетчинг по субботам.', 300, 'Рисование', 'published',
     (SELECT id FROM categories WHERE slug = 'risovanie')),
    (2, 'Футбольная секция «Днестр»', 2, 1, 'Населёнка', 10, 15, 'https://example.test/dnestr',
     'Тренировки на открытом поле два раза в неделю.', NULL, 'Футбол', 'published',
     (SELECT id FROM categories WHERE slug = 'futbol')),
    (3, 'Кружок робототехники', 3, 2, 'Восточный', 8, 14, NULL,
     'Лего и Arduino, подготовка к соревнованиям.', 450, 'Робототехника', 'published',
     (SELECT id FROM categories WHERE slug = 'robototehnika')),
    (4, 'Бальные танцы', 4, 2, 'Центр', NULL, NULL, NULL,
     'Возрастные группы уточняются у преподавателя.', 200, 'Спортивные танцы', 'published',
     (SELECT id FROM categories WHERE slug = 'sport-dance')),
    (5, 'Подготовка к школе', 5, 3, 'Центр', 5, 7, NULL,
     'Чтение, счёт и логика, три раза в неделю.', 250, 'Подготовка к школе', 'published',
     (SELECT id FROM categories WHERE slug = 'podgotovka-k-shkole')),
    (6, 'Шахматная гостиная', 6, 4, NULL, NULL, 99, NULL,
     'Разборы партий и блиц-турниры по воскресеньям.', 0, 'Шахматы', 'published',
     (SELECT id FROM categories WHERE slug = 'shahmaty')),
    (7, 'Курс кулинарии для подростков', 7, 5, 'Центр', 12, 17, NULL,
     'Анкета ещё не опубликована — проверяется модератором.', 500, 'Кулинария', 'on_moderation',
     (SELECT id FROM categories WHERE slug = 'kulinariya')),
    (8, 'Секция лёгкой атлетики', 8, 6, 'Западный', 9, 13, NULL,
     'Отклонена: не указан адрес проведения.', 150, 'Лёгкая атлетика', 'rejected',
     (SELECT id FROM categories WHERE slug = 'atletika'))
ON CONFLICT (id) DO NOTHING;

SELECT setval(pg_get_serial_sequence('cards', 'id'), (SELECT MAX(id) FROM cards));

-- Анкеты, созданные до появления колонки, её не получают: INSERT срабатывает на
-- ON CONFLICT и пропускает строку целиком. Проставляем по совпадению category
-- с title справочника — повторный запуск ничего не меняет.
UPDATE cards c
SET direction_id = cat.id
FROM categories cat
WHERE c.direction_id IS NULL AND cat.title = c.category;

-- Координаты — центры соответствующих городов с небольшим смещением, чтобы
-- точки разных занятий не легли одна на другую.
INSERT INTO card_locations (card_id, name, address, district, lat, lng) VALUES
    (1, 'Дом творчества, основной зал', 'Тирасполь, ул. 25 Октября, 12', 'Центр', 46.843000, 29.642000),
    (1, 'Учебный класс керамики', 'Тирасполь, ул. 25 Октября, 12, корпус 2', 'Центр', 46.840100, 29.647100),
    (2, 'Открытое поле', 'Тирасполь, ул. Котовского, 44', 'Населёнка', 46.835000, 29.635000),
    (3, 'Лаборатория «Востока»', 'Бендеры, ул. Советская, 71', 'Восточный', 46.830000, 29.260000),
    (4, 'Зал студии', 'Бендеры, ул. 40 лет Гвардейской, 5', 'Центр', 46.834000, 29.254000),
    (5, 'Кабинет «Ростка»', 'Рыбница, ул. К. Либкнехта, 3', 'Центр', 47.777000, 29.584000),
    (6, 'Игровой зал клуба', 'Дубоссары, ул. Советская, 60', NULL, 46.862000, 29.621000),
    (7, 'Кулинарная студия', 'Каменка, ул. Ленина, 18', 'Центр', 48.040000, 29.308000),
    (8, 'Легкоатлетический манеж', 'Слободзея, ул. Мира, 2', 'Западный', 46.711000, 29.768000)
ON CONFLICT (card_id, name) DO NOTHING;

INSERT INTO card_photos (card_id, url, alt, order_num) VALUES
    (1, '/images/drawing.jpg', 'Занятие по рисованию', 1),
    (2, '/images/soccer.jpg', 'Футбольная тренировка', 1),
    (3, '/images/robot.jpg', 'Занятие по робототехнике', 1),
    (4, '/images/ballet.jpg', 'Занятие по бальным танцам', 1),
    (5, '/images/kids.jpg', 'Подготовка к школе', 1),
    (6, '/images/chess.jpg', 'Шахматный клуб', 1),
    (7, '/images/cooking.jpg', 'Кулинарное занятие', 1),
    (8, '/images/gym.jpg', 'Легкоатлетическое занятие', 1)
ON CONFLICT (card_id, url) DO NOTHING;

-- organization_id был INTEGER без ограничения; вешаем FK, когда ссылки существуют.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'cards_organization_id_fkey'
    ) THEN
        ALTER TABLE cards
            ADD CONSTRAINT cards_organization_id_fkey
            FOREIGN KEY (organization_id) REFERENCES organizations (id);
    END IF;
END $$;
