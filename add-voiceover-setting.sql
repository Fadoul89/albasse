-- Message vocal (voix off) que l'admin peut televerser depuis les
-- parametres du site, joue automatiquement au client une fois par 24h.
alter table store_settings add column if not exists voiceover_url text;

insert into storage.buckets (id, name, public)
values ('voiceover', 'voiceover', true)
on conflict (id) do nothing;

drop policy if exists "voiceover_public_read" on storage.objects;
create policy "voiceover_public_read" on storage.objects for select
  using (bucket_id = 'voiceover');

drop policy if exists "voiceover_admin_write" on storage.objects;
create policy "voiceover_admin_write" on storage.objects for all to authenticated
  using (bucket_id = 'voiceover' and public.is_admin())
  with check (bucket_id = 'voiceover' and public.is_admin());
