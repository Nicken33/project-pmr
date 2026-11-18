-- Применить до выкладки бэкенда с нечётким поиском. Данные таблиц не меняются.
-- Повторный запуск безопасен. pg_trgm устанавливается в этой базе, а не на весь кластер.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;

CREATE OR REPLACE FUNCTION public.talentro_search_match(document text, term text, allow_fuzzy boolean DEFAULT true)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
    SELECT CASE
        WHEN needle = '' THEN false
        WHEN strpos(haystack, needle) > 0 THEN true
        -- Короткие слова и контакты/символы ищем буквально, чтобы не давать лишние совпадения.
        WHEN allow_fuzzy AND char_length(needle) >= 4 AND needle ~ '^[[:alpha:]]+$'
            THEN public.strict_word_similarity(needle, haystack) >= 0.5
        ELSE false
    END
    FROM (
        SELECT replace(lower(coalesce(document, '')), 'ё', 'е') AS haystack,
               replace(lower(btrim(coalesce(term, ''))), 'ё', 'е') AS needle
    ) normalized;
$$;
COMMIT;
