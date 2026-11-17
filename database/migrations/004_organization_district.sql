BEGIN;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS district_id BIGINT REFERENCES public.districts(id);
CREATE INDEX IF NOT EXISTS idx_organizations_district_id ON public.organizations(district_id);
COMMIT;
