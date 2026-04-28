-- ============================================================================
-- ConnectBounty - Schema v8: Sensitive profile fields
-- ============================================================================
-- Adds address fields that are editable only with step-up auth (aal2 in app).
-- Data is still protected by existing RLS (self row only / admin).

alter table public.profiles
  add column if not exists address_line1 text,
  add column if not exists address_line2 text,
  add column if not exists address_postal_code text,
  add column if not exists address_city text,
  add column if not exists address_country char(2);

alter table public.profiles
  drop constraint if exists profiles_address_line1_len,
  drop constraint if exists profiles_address_line2_len,
  drop constraint if exists profiles_address_postal_len,
  drop constraint if exists profiles_address_city_len,
  drop constraint if exists profiles_address_country_fmt;

alter table public.profiles
  add constraint profiles_address_line1_len
    check (address_line1 is null or char_length(address_line1) between 3 and 120),
  add constraint profiles_address_line2_len
    check (address_line2 is null or char_length(address_line2) <= 120),
  add constraint profiles_address_postal_len
    check (address_postal_code is null or char_length(address_postal_code) between 3 and 20),
  add constraint profiles_address_city_len
    check (address_city is null or char_length(address_city) between 2 and 80),
  add constraint profiles_address_country_fmt
    check (address_country is null or address_country ~ '^[A-Z]{2}$');
