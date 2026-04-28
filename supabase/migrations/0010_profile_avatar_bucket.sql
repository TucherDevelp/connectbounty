-- ============================================================================
-- ConnectBounty - Schema v10: Profile avatar bucket
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('profile-avatars', 'profile-avatars', true)
on conflict (id) do nothing;
