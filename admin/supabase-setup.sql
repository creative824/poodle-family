-- One-time setup for the admin panel. Paste into Supabase → SQL Editor → Run.
-- Then: Authentication → Users → Add user (the client's email + password),
-- and add that email to the admins table at the bottom of this file.
-- Also turn off "Allow new users to sign up" (Authentication → Sign In / Providers).

create table if not exists public.content (
  id text primary key,          -- 'site' (all texts) or 'gallery' (photo list)
  data jsonb not null,
  updated_at timestamptz not null default now()
);
create table if not exists public.admins (
  email text primary key
);

alter table public.content enable row level security;
alter table public.admins enable row level security;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins where email = auth.jwt() ->> 'email')
$$;

-- Anyone may read the site content; only admins may change it.
drop policy if exists "content read" on public.content;
create policy "content read" on public.content for select using (true);
drop policy if exists "content insert" on public.content;
create policy "content insert" on public.content for insert to authenticated with check (public.is_admin());
drop policy if exists "content update" on public.content;
create policy "content update" on public.content for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Photos: public bucket, uploads only by admins.
insert into storage.buckets (id, name, public) values ('images', 'images', true)
  on conflict (id) do update set public = true;
drop policy if exists "images upload" on storage.objects;
create policy "images upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'images' and public.is_admin());

-- The client's login email (the same one created under Authentication → Users):
insert into public.admins (email) values ('CLIENT_EMAIL_HERE') on conflict do nothing;
