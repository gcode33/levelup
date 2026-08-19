-- Private storage bucket for resumes + owner-only policies

insert into storage.buckets (id, name, public)
values ('resumes', 'resumes', false)
on conflict (id) do nothing;

-- Files are stored at {user_id}/{filename}; the first path segment is the owner id.
create policy "resumes_read_own" on storage.objects
  for select using (bucket_id = 'resumes' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "resumes_insert_own" on storage.objects
  for insert with check (bucket_id = 'resumes' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "resumes_update_own" on storage.objects
  for update using (bucket_id = 'resumes' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "resumes_delete_own" on storage.objects
  for delete using (bucket_id = 'resumes' and auth.uid()::text = (storage.foldername(name))[1]);
