CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP);

INSERT INTO users (username) VALUES ('admin'), ('nicken')
ON CONFLICT (username) DO NOTHING;

CREATE TABLE IF NOT EXISTS cities (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    order_num SMALLINT NOT NULL DEFAULT 0
);

-- Бэкенд пока читает из cards только id, name, city_id, age_from, age_to и status
-- (internal/repository/repo.go), но поля ниже соответствуют models.Card целиком.
-- Словарь status нигде не ограничен на уровне БД: 'published' читает каталог,
-- 'on_moderation' и 'rejected' подразумевает кабинет модератора (§3.9).
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

INSERT INTO cities (id, name, order_num) VALUES
    (1, 'Тирасполь', 1),
    (2, 'Бендеры', 2),
    (3, 'Рыбница', 3),
    (4, 'Дубоссары', 4),
    (5, 'Каменка', 5),
    (6, 'Слободзея', 6)
ON CONFLICT (id) DO NOTHING;

SELECT setval(pg_get_serial_sequence('cities', 'id'), (SELECT MAX(id) FROM cities));

INSERT INTO cards
    (id, name, organization_id, city_id, district, age_from, age_to, link, description, price, category, status)
VALUES
    (1, 'Студия рисования «Палитра»', 1, 1, 'Центр', 7, 12, NULL,
     'Масло, акварель и скетчинг по субботам.', 300, 'Рисование', 'published'),
    (2, 'Футбольная секция «Днестр»', 2, 1, 'Населёнка', 10, 15, 'https://example.test/dnestr',
     'Тренировки на открытом поле два раза в неделю.', NULL, 'Футбол', 'published'),
    (3, 'Кружок робототехники', 3, 2, 'Восточный', 8, 14, NULL,
     'Лего и Arduino, подготовка к соревнованиям.', 450, 'Робототехника', 'published'),
    (4, 'Бальные танцы', 4, 2, 'Центр', NULL, NULL, NULL,
     'Возрастные группы уточняются у преподавателя.', 200, 'Спортивные танцы', 'published'),
    (5, 'Подготовка к школе', 5, 3, 'Центр', 5, 7, NULL,
     'Чтение, счёт и логика, три раза в неделю.', 250, 'Подготовка к школе', 'published'),
    (6, 'Шахматная гостиная', 6, 4, NULL, NULL, 99, NULL,
     'Разборы партий и блиц-турниры по воскресеньям.', 0, 'Шахматы', 'published'),
    (7, 'Курс кулинарии для подростков', 7, 5, 'Центр', 12, 17, NULL,
     'Анкета ещё не опубликована — проверяется модератором.', 500, 'Кулинария', 'on_moderation'),
    (8, 'Секция лёгкой атлетики', 8, 6, 'Западный', 9, 13, NULL,
     'Отклонена: не указан адрес проведения.', 150, 'Лёгкая атлетика', 'rejected')
ON CONFLICT (id) DO NOTHING;

SELECT setval(pg_get_serial_sequence('cards', 'id'), (SELECT MAX(id) FROM cards));
