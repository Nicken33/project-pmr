-- Подтверждение почты при обычной регистрации. Применить до обновления API.
-- Существующих пользователей и их данные не изменяет. Повторный запуск безопасен.
BEGIN;
CREATE TABLE IF NOT EXISTS public.pending_registrations (
    email TEXT PRIMARY KEY,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    account_type TEXT NOT NULL CHECK (account_type IN ('user', 'section_owner', 'service_owner')),
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMIT;
