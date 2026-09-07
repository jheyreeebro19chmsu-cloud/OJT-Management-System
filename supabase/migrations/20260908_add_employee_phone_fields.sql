-- Add contact_phone, phone, and campus columns to employees table if not already present
alter table public.employees
  add column if not exists contact_phone text,
  add column if not exists phone text,
  add column if not exists campus text,
  add column if not exists school_name text;
