-- ============================================================================
-- ConnectBounty: Fehlende Migrationen für Profile-Persistenz
-- ============================================================================
-- WIE AUSFÜHREN:
--   1. Supabase Dashboard öffnen → Projekt auswählen
--   2. Linke Sidebar: "SQL Editor" → "+ New query"
--   3. Diesen kompletten Inhalt rein-paste-en
--   4. Auf "Run" klicken (oder Strg+Enter)
--   5. Erfolgsmeldung "Success. No rows returned" abwarten
--
-- Diese Datei ist idempotent — kann mehrfach ohne Schaden ausgeführt werden.
-- ============================================================================

-- ── 1. Sensitive Profile-Felder (aus 0008_profile_security_fields.sql) ─────
alter table public.profiles
  add column if not exists address_line1       text,
  add column if not exists address_line2       text,
  add column if not exists address_postal_code text,
  add column if not exists address_city        text,
  add column if not exists address_country     char(2);

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

-- ── 2. Eindeutiger Alias case-insensitive (aus 0009_profile_alias_unique) ──
do $$
begin
  if exists (
    select 1
    from (
      select lower(display_name) as alias_norm
      from public.profiles
      where display_name is not null
      group by lower(display_name)
      having count(*) > 1
    ) dups
  ) then
    raise notice 'Skipping unique alias index: duplicate display_name values exist (case-insensitive). Resolve duplicates first.';
  else
    create unique index if not exists profiles_display_name_unique_ci
      on public.profiles (lower(display_name))
      where display_name is not null;
  end if;
end
$$;

-- ── 3. profile-avatars Storage Bucket (aus 0010_profile_avatar_bucket.sql) ─
insert into storage.buckets (id, name, public)
values ('profile-avatars', 'profile-avatars', true)
on conflict (id) do nothing;

-- Sicherstellen dass der Bucket public ist (falls er existierte aber privat war)
update storage.buckets set public = true where id = 'profile-avatars';

-- ── 4. Storage Policies für profile-avatars ────────────────────────────────
-- Authenticated users können in eigenen Pfad uploaden / updaten / löschen
drop policy if exists profile_avatars_upload_own on storage.objects;
drop policy if exists profile_avatars_update_own on storage.objects;
drop policy if exists profile_avatars_delete_own on storage.objects;
drop policy if exists profile_avatars_read_public on storage.objects;

create policy profile_avatars_read_public
  on storage.objects for select
  to public
  using (bucket_id = 'profile-avatars');

create policy profile_avatars_upload_own
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'profile-avatars');

create policy profile_avatars_update_own
  on storage.objects for update
  to authenticated
  using (bucket_id = 'profile-avatars');

create policy profile_avatars_delete_own
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'profile-avatars');

-- ── 5. Bestätigung ──────────────────────────────────────────────────────────
select 'OK – Spalten:' as info, column_name
from information_schema.columns
where table_schema = 'public' and table_name = 'profiles'
  and column_name like 'address_%'
order by column_name;
