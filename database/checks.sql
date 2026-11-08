-- Проверки целостности по §7.8 (пункт 8) и §15.2: CI обязан падать, если
-- хотя бы одна «ошибка» ненулевая. Запуск:
--
--     PGCLIENTENCODING=UTF8 psql -v ON_ERROR_STOP=1 -d "$DATABASE" -f database/checks.sql
--
-- Разделение на «ошибку» и «предупреждение» взято из самого ТЗ, а не из
-- convenience: «направление без карточек» (§13.4) и «устаревшие проверки»
-- (§14.7) ТЗ просит *считать*, а не запрещать; фото необязательны (таблица 1,
-- п. 12 — вместо обложки заглушка). Ошибкой остаётся то, что ломает обещание
-- каталога: §7.10–7.12 «пустых списков не бывает», координаты для публикации,
-- дубли, противоречие статуса и признака активности.
--
-- Публикацией считаем ровно то, что отдаёт каталог: статус published, карточка
-- и организация активны.

CREATE TEMP TABLE check_results AS
SELECT * FROM (
    -- ---------------------------------------------------------------------
    -- ОШИБКИ
    -- ---------------------------------------------------------------------
    -- §7.12: у опубликованного занятия минимум одна группа.
    SELECT
        1 AS n,
        'ошибка'::text AS severity,
        'published_card_without_group'::text AS name,
        count(*) AS bad,
        left(string_agg(slug, ', '), 160) AS samples
    FROM (
        SELECT c.slug
        FROM cards c
        JOIN organizations o ON o.id = c.org_id
        WHERE c.status = 'published' AND c.is_active AND o.is_active
          AND NOT EXISTS (SELECT 1 FROM "groups" g WHERE g.card_id = c.id)
    ) t

    UNION ALL
    -- §7.11: занятие без точки не публикуется; связь идёт через группу (§7.10),
    -- поэтому «нет живой точки» = ни одна группа не ссылается на активную точку.
    SELECT
        2, 'ошибка', 'published_card_without_active_location', count(*),
        left(string_agg(slug, ', '), 160)
    FROM (
        SELECT c.slug
        FROM cards c
        JOIN organizations o ON o.id = c.org_id
        WHERE c.status = 'published' AND c.is_active AND o.is_active
          AND NOT EXISTS (
              SELECT 1
              FROM "groups" g
              JOIN locations l ON l.id = g.location_id
              WHERE g.card_id = c.id AND l.is_active
          )
    ) t

    UNION ALL
    -- Таблица 1-Б, п. 7: координаты обязательны для публикации — иначе нет метки
    -- на карте и не работает фильтр «рядом со мной» (§3.5).
    SELECT
        3, 'ошибка', 'published_card_without_coords', count(*),
        left(string_agg(slug, ', '), 160)
    FROM (
        SELECT DISTINCT c.slug
        FROM cards c
        JOIN "groups" g ON g.card_id = c.id
        JOIN locations l ON l.id = g.location_id
        WHERE c.status = 'published' AND c.is_active
          AND (l.lat IS NULL OR l.lng IS NULL)
    ) t

    UNION ALL
    -- Таблица 1, п. 10: телефон карточки необязателен, но где-то он обязан быть —
    -- на карточке, в организации (таблица 2, п. 5) или на точке.
    SELECT
        4, 'ошибка', 'published_card_without_phone', count(*),
        left(string_agg(slug, ', '), 160)
    FROM (
        SELECT DISTINCT c.slug
        FROM cards c
        JOIN organizations o ON o.id = c.org_id
        JOIN "groups" g ON g.card_id = c.id
        JOIN locations l ON l.id = g.location_id
        WHERE c.status = 'published' AND c.is_active
          AND coalesce(btrim(c.phone), btrim(o.phone), btrim(l.phone), '') = ''
    ) t

    UNION ALL
    -- Таблица 1-А, п. 10: группа без строк расписания не проходит checks.sql.
    SELECT
        5, 'ошибка', 'group_without_schedule', count(*),
        left(string_agg(info, ', '), 160)
    FROM (
        SELECT g.id || ':' || c.slug AS info
        FROM "groups" g
        JOIN cards c ON c.id = g.card_id
        WHERE c.status = 'published' AND c.is_active
          AND NOT EXISTS (SELECT 1 FROM schedules s WHERE s.group_id = g.id)
    ) t

    UNION ALL
    -- Таблица 1-А, п. 4: возраст обязателен для занятия.
    SELECT
        6, 'ошибка', 'activity_group_without_age', count(*),
        left(string_agg(info, ', '), 160)
    FROM (
        SELECT g.id || ':' || c.slug AS info
        FROM "groups" g
        JOIN cards c ON c.id = g.card_id
        WHERE c.status = 'published' AND c.is_active AND c.kind = 'activity'
          AND g.age_from IS NULL
    ) t

    UNION ALL
    -- Таблица 1-А, п. 4: у услуги возраста не бывает. С возрастом на группе
    -- услуга начала бы попадать в выдачу с фильтром по возрасту (§5.2).
    SELECT
        7, 'ошибка', 'service_group_with_age', count(*),
        left(string_agg(info, ', '), 160)
    FROM (
        SELECT g.id || ':' || c.slug AS info
        FROM "groups" g
        JOIN cards c ON c.id = g.card_id
        WHERE c.kind = 'service'
          AND (g.age_from IS NOT NULL OR g.age_to IS NOT NULL)
    ) t

    UNION ALL
    -- §7.6 + §7.18: «published» при снятом признаке активности — в каталоге
    -- такой строки нет, а в админке она выглядит живой.
    SELECT
        8, 'ошибка', 'published_but_inactive', count(*),
        left(string_agg(slug, ', '), 160)
    FROM (
        SELECT c.slug
        FROM cards c
        WHERE c.status = 'published' AND NOT c.is_active
    ) t

    UNION ALL
    -- §5.4 + таблица 1-Б, п. 5: район принадлежит своему городу, иначе фильтр
    -- «район + город» и адрес на карточке расходятся.
    SELECT
        9, 'ошибка', 'district_from_another_city', count(*),
        left(string_agg(info, ', '), 160)
    FROM (
        SELECT l.id || ':' || d.name AS info
        FROM locations l
        JOIN districts d ON d.id = l.district_id
        WHERE d.city_id <> l.city_id
    ) t

    UNION ALL
    -- §14.5: дубль = одинаковые нормализованное название и адрес. Вторая точка
    -- той же организации — не дубль, поэтому сравниваем пару «карточка + точка».
    SELECT
        10, 'ошибка', 'duplicate_card_name_and_address', count(*),
        left(string_agg(info, ', '), 160)
    FROM (
        SELECT fold(c.name) || ' @ ' || btrim(l.address) || ' (' || ci.name || ')' AS info
        FROM cards c
        JOIN "groups" g ON g.card_id = c.id
        JOIN locations l ON l.id = g.location_id
        JOIN cities ci ON ci.id = l.city_id
        WHERE c.status = 'published' AND c.is_active
        GROUP BY fold(c.name), btrim(l.address), ci.name
        HAVING count(DISTINCT c.id) > 1
    ) t

    UNION ALL
    -- ---------------------------------------------------------------------
    -- ПРЕДУПРЕЖДЕНИЯ — счётчики, которые ТЗ просит видеть
    -- ---------------------------------------------------------------------
    -- §7.8 «направление без карточек» + §13.4: проверка считает карточки на
    -- каждое направление; пустое направление = справочник шире наполнения.
    SELECT
        11, 'предупреждение', 'category_without_published_cards', count(*),
        left(string_agg(slug, ', '), 160)
    FROM (
        SELECT cat.slug
        FROM categories cat
        WHERE cat.parent_id IS NOT NULL
          AND NOT EXISTS (
              SELECT 1 FROM cards c
              WHERE c.status = 'published' AND c.is_active AND c.category_id = cat.id
          )
    ) t

    UNION ALL
    -- Таблица 1, п. 12: фото необязательны (вместо обложки заглушка), но §7.8
    -- просит держать счётчик таких карточек.
    SELECT
        12, 'предупреждение', 'published_card_without_photo', count(*),
        left(string_agg(slug, ', '), 160)
    FROM (
        SELECT c.slug
        FROM cards c
        WHERE c.status = 'published' AND c.is_active
          AND NOT EXISTS (
              SELECT 1 FROM media m
              WHERE m.entity = 'card' AND m.entity_id = c.id AND m.kind = 'photo'
          )
    ) t

    UNION ALL
    -- §14.7 + §5.5: контакты проверены давно. Молча чинить нельзя — перепроверка
    -- звонком, поэтому это счётчик, а не ошибка.
    SELECT
        13, 'предупреждение', 'stale_contact_verification', count(*),
        left(string_agg(slug, ', '), 160)
    FROM (
        SELECT c.slug
        FROM cards c
        WHERE c.status = 'published' AND c.is_active
          AND c.contacts_verified_at < current_date - 90
    ) t
) checks;

-- Отчёт: сначала ошибки, внутри — по убыванию количества.
SELECT severity, name, bad AS count, samples
FROM check_results
ORDER BY (severity = 'ошибка') DESC, bad DESC, n;

DO $$
DECLARE
    errors  integer;
    failing text;
BEGIN
    SELECT coalesce(sum(bad), 0) INTO errors
    FROM check_results
    WHERE severity = 'ошибка';

    IF errors = 0 THEN
        RAISE NOTICE 'checks.sql: ошибок целостности нет (§7.8)';
        RETURN;
    END IF;

    SELECT string_agg(name || '=' || bad, ', ' ORDER BY n) INTO failing
    FROM check_results
    WHERE severity = 'ошибка' AND bad > 0;

    RAISE EXCEPTION 'checks.sql: % ошибка(ок) целостности (§7.8): %', errors, failing;
END
$$;
