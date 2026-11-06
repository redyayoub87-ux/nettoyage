-- ============================================================
--  À coller dans Supabase > SQL Editor > New query > Run
--  (une seule fois)
-- ============================================================

-- 1. Espace de stockage privé pour les photos (5 Mo max, images seulement)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 5242880, array['image/jpeg'])
on conflict (id) do nothing;

-- 2. Les résidents (sans compte) peuvent SEULEMENT envoyer une photo.
--    Ils ne peuvent ni voir, ni lister, ni supprimer les photos.
create policy "residents_envoient_photo"
on storage.objects for insert to anon
with check (bucket_id = 'photos');

-- 3. Le personnel connecté peut voir et supprimer les photos.
create policy "personnel_voit_photos"
on storage.objects for select to authenticated
using (bucket_id = 'photos');

create policy "personnel_supprime_photos"
on storage.objects for delete to authenticated
using (bucket_id = 'photos');
