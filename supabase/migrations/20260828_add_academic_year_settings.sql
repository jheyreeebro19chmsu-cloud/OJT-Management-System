alter table public.app_settings
  add column if not exists academic_years jsonb not null default '["2025-2026"]'::jsonb,
  add column if not exists active_academic_year text not null default '2025-2026';
