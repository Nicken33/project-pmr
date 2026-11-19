BEGIN;

ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS cover_path TEXT;
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS saved_in_organization BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
CREATE INDEX IF NOT EXISTS idx_activity_votes_activity_id ON public.activity_votes (activity_id);

COMMIT;
