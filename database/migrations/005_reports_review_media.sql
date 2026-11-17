-- Additive migration; existing reviews/media are preserved.
BEGIN;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS hidden_reason TEXT;
ALTER TABLE public.media ADD COLUMN IF NOT EXISTS review_id BIGINT REFERENCES public.reviews(id) ON DELETE CASCADE;
ALTER TABLE public.media ADD COLUMN IF NOT EXISTS source_url TEXT;
ALTER TABLE public.media ADD COLUMN IF NOT EXISTS license TEXT;
ALTER TABLE public.media ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_media_review_order ON public.media(review_id, sort_order, id);
CREATE TABLE IF NOT EXISTS public.reports (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 reporter_id BIGINT REFERENCES public.users(id) ON DELETE SET NULL,
 activity_id BIGINT NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
 review_id BIGINT REFERENCES public.reviews(id) ON DELETE CASCADE,
 media_id BIGINT REFERENCES public.media(id) ON DELETE CASCADE,
 target_type TEXT NOT NULL CHECK (target_type IN ('card','review','media')),
 target_id BIGINT NOT NULL,
 target_excerpt TEXT NOT NULL,
 reason TEXT NOT NULL CHECK (length(btrim(reason)) BETWEEN 1 AND 120),
 detail TEXT NOT NULL DEFAULT '' CHECK (length(detail) <= 2000),
 status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','hidden','dismissed')),
 hide_reason TEXT,
 resolved_by BIGINT REFERENCES public.users(id) ON DELETE SET NULL,
 resolved_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 CHECK ((target_type='card' AND target_id=activity_id AND review_id IS NULL AND media_id IS NULL)
     OR (target_type='review' AND target_id=review_id AND review_id IS NOT NULL AND media_id IS NULL)
     OR (target_type='media' AND target_id=media_id AND media_id IS NOT NULL)),
 CHECK (status <> 'hidden' OR (hide_reason IS NOT NULL AND length(btrim(hide_reason)) > 0)),
 CHECK (status='open' OR resolved_at IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS reports_one_open_per_user_target ON public.reports(reporter_id,target_type,target_id) WHERE status='open';
CREATE INDEX IF NOT EXISTS reports_queue ON public.reports(status,target_type,created_at,id);
COMMIT;
