-- ============================================================================
-- ConnectBounty - Schema v9: Unique profile aliases
-- ============================================================================
-- Enforces case-insensitive uniqueness for display_name (alias).

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
    raise exception 'Cannot add unique alias index: duplicate display_name values exist (case-insensitive).';
  end if;
end
$$;

create unique index if not exists profiles_display_name_unique_ci
  on public.profiles (lower(display_name))
  where display_name is not null;
