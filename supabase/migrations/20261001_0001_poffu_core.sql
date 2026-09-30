-- ============================================================
-- Poffu backend — core schema v1
-- Executed via Supabase Management API (HTTPS), chunk by chunk.
-- NOTE: single quotes are avoided throughout (dollar-quoting),
-- because the Management API query endpoint mangles them.
-- Safe to re-run: IF NOT EXISTS / DROP IF EXISTS everywhere.
-- Order matters: tables BEFORE the helper functions that read them.
-- ============================================================

-- CHUNK: extensions-tables
create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  phone text unique,
  display_name text not null default $$$$,
  username text unique,
  avatar_url text,
  about text not null default $$$$,
  last_seen timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.chats (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ($$direct$$, $$group$$)),
  name text,
  avatar_url text,
  created_by uuid references public.profiles(id) on delete set null,
  disappearing_duration interval,
  created_at timestamptz not null default now()
);

create table if not exists public.chat_members (
  chat_id uuid not null references public.chats(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default $$member$$ check (role in ($$creator$$, $$admin$$, $$member$$)),
  muted boolean not null default false,
  pinned boolean not null default false,
  last_read_at timestamptz,
  joined_at timestamptz not null default now(),
  primary key (chat_id, user_id)
);
create index if not exists chat_members_user_idx on public.chat_members (user_id);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats(id) on delete cascade,
  sender_id uuid references public.profiles(id) on delete set null,
  kind text not null default $$text$$
    check (kind in ($$text$$, $$image$$, $$video$$, $$document$$, $$system$$)),
  body text,
  media_url text,
  media_name text,
  media_size bigint,
  mime_type text,
  reply_to uuid references public.messages(id) on delete set null,
  edited_at timestamptz,
  deleted_for_everyone boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists messages_chat_created_idx
  on public.messages (chat_id, created_at desc);

create table if not exists public.message_hides (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  primary key (message_id, user_id)
);

create table if not exists public.message_receipts (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  delivered_at timestamptz,
  read_at timestamptz,
  primary key (message_id, user_id)
);

create table if not exists public.scheduled_messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null default $$text$$
    check (kind in ($$text$$, $$image$$, $$video$$, $$document$$)),
  body text,
  media_url text,
  media_name text,
  reply_to uuid references public.messages(id) on delete set null,
  scheduled_for timestamptz not null,
  sent_at timestamptz,
  cancelled boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists scheduled_messages_due_idx
  on public.scheduled_messages (scheduled_for)
  where sent_at is null and cancelled = false;

create table if not exists public.stories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  media_url text not null,
  media_kind text not null default $$image$$ check (media_kind in ($$image$$, $$video$$)),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval $$24 hours$$
);
create index if not exists stories_user_created_idx
  on public.stories (user_id, created_at desc);

create table if not exists public.story_views (
  story_id uuid not null references public.stories(id) on delete cascade,
  viewer_id uuid not null references public.profiles(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (story_id, viewer_id)
);

create table if not exists public.push_tokens (
  user_id uuid not null references public.profiles(id) on delete cascade,
  token text not null,
  platform text not null default $$android$$,
  created_at timestamptz not null default now(),
  primary key (user_id, token)
);

-- CHUNK: helpers-triggers
create or replace function public.is_chat_member(p_chat_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $func$
  select exists (
    select 1 from public.chat_members
    where chat_id = p_chat_id and user_id = auth.uid()
  );
$func$;

create or replace function public.chat_role(p_chat_id uuid)
returns text
language sql
security definer
stable
set search_path = public
as $func$
  select role from public.chat_members
  where chat_id = p_chat_id and user_id = auth.uid()
  limit 1;
$func$;

-- auto-create a profile row on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $func$
begin
  insert into public.profiles (id, display_name, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> $$display_name$$, $$$$),
    nullif(new.phone, $$$$)
  )
  on conflict (id) do nothing;
  return new;
end;
$func$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- only admins/creators may change member roles (trigger-level guard)
create or replace function public.protect_member_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $func$
begin
  if new.role <> old.role
     and coalesce(public.chat_role(old.chat_id), $$$$) not in ($$creator$$, $$admin$$) then
    raise exception $$only group admins can change member roles$$;
  end if;
  return new;
end;
$func$;

drop trigger if exists protect_member_role on public.chat_members;
create trigger protect_member_role
  before update on public.chat_members
  for each row execute function public.protect_member_role();

-- CHUNK: rls-policies
alter table public.profiles enable row level security;
alter table public.chats enable row level security;
alter table public.chat_members enable row level security;
alter table public.messages enable row level security;
alter table public.message_hides enable row level security;
alter table public.message_receipts enable row level security;
alter table public.scheduled_messages enable row level security;
alter table public.stories enable row level security;
alter table public.story_views enable row level security;
alter table public.push_tokens enable row level security;

-- profiles: anyone signed in can read; users edit only themselves
drop policy if exists "profiles_select_all" on public.profiles;
create policy "profiles_select_all" on public.profiles
  for select to authenticated using (true);
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);

-- chats: members read; creator inserts; admins rename/avatar
drop policy if exists "chats_select_member" on public.chats;
create policy "chats_select_member" on public.chats
  for select to authenticated using (public.is_chat_member(id));
drop policy if exists "chats_insert_creator" on public.chats;
create policy "chats_insert_creator" on public.chats
  for insert to authenticated with check (created_by = auth.uid());
drop policy if exists "chats_update_admin" on public.chats;
create policy "chats_update_admin" on public.chats
  for update to authenticated
  using (public.chat_role(id) in ($$creator$$, $$admin$$))
  with check (public.chat_role(id) in ($$creator$$, $$admin$$));

-- chat_members: members read; self-join only on own created chat, else admin adds
drop policy if exists "members_select_member" on public.chat_members;
create policy "members_select_member" on public.chat_members
  for select to authenticated using (public.is_chat_member(chat_id));
drop policy if exists "members_insert" on public.chat_members;
create policy "members_insert" on public.chat_members
  for insert to authenticated
  with check (
    (user_id = auth.uid() and exists (
       select 1 from public.chats c where c.id = chat_id and c.created_by = auth.uid()
    ))
    or public.chat_role(chat_id) in ($$creator$$, $$admin$$)
  );
drop policy if exists "members_update_own_settings" on public.chat_members;
create policy "members_update_own_settings" on public.chat_members
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "members_admin_manage" on public.chat_members;
create policy "members_admin_manage" on public.chat_members
  for all to authenticated
  using (public.chat_role(chat_id) in ($$creator$$, $$admin$$))
  with check (public.chat_role(chat_id) in ($$creator$$, $$admin$$));
drop policy if exists "members_delete_self_or_admin" on public.chat_members;
create policy "members_delete_self_or_admin" on public.chat_members
  for delete to authenticated
  using (user_id = auth.uid() or public.chat_role(chat_id) in ($$creator$$, $$admin$$));

-- messages: members read; members send as themselves; senders edit/delete
drop policy if exists "messages_select_member" on public.messages;
create policy "messages_select_member" on public.messages
  for select to authenticated using (public.is_chat_member(chat_id));
drop policy if exists "messages_insert_member" on public.messages;
create policy "messages_insert_member" on public.messages
  for insert to authenticated
  with check (public.is_chat_member(chat_id) and sender_id = auth.uid());
drop policy if exists "messages_update_own" on public.messages;
create policy "messages_update_own" on public.messages
  for update to authenticated
  using (sender_id = auth.uid() and public.is_chat_member(chat_id))
  with check (sender_id = auth.uid());
drop policy if exists "messages_delete_own" on public.messages;
create policy "messages_delete_own" on public.messages
  for delete to authenticated
  using (sender_id = auth.uid() and public.is_chat_member(chat_id));

-- message_hides (delete-for-me): own rows only
drop policy if exists "hides_own" on public.message_hides;
create policy "hides_own" on public.message_hides
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- receipts: recipients write own; chat members read
drop policy if exists "receipts_write_own" on public.message_receipts;
create policy "receipts_write_own" on public.message_receipts
  for all to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.messages m
      where m.id = message_id and public.is_chat_member(m.chat_id)
    )
  );
drop policy if exists "receipts_select_member" on public.message_receipts;
create policy "receipts_select_member" on public.message_receipts
  for select to authenticated
  using (
    exists (
      select 1 from public.messages m
      where m.id = message_receipts.message_id and public.is_chat_member(m.chat_id)
    )
  );

-- scheduled_messages (Send Later): own only
drop policy if exists "scheduled_own" on public.scheduled_messages;
create policy "scheduled_own" on public.scheduled_messages
  for all to authenticated
  using (sender_id = auth.uid()) with check (sender_id = auth.uid());

-- stories: signed-in read; owners write
drop policy if exists "stories_select_auth" on public.stories;
create policy "stories_select_auth" on public.stories
  for select to authenticated using (true);
drop policy if exists "stories_insert_own" on public.stories;
create policy "stories_insert_own" on public.stories
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "stories_delete_own" on public.stories;
create policy "stories_delete_own" on public.stories
  for delete to authenticated using (user_id = auth.uid());

-- story_views: viewers log own; owners see viewers
drop policy if exists "story_views_insert_own" on public.story_views;
create policy "story_views_insert_own" on public.story_views
  for insert to authenticated with check (viewer_id = auth.uid());
drop policy if exists "story_views_select" on public.story_views;
create policy "story_views_select" on public.story_views
  for select to authenticated
  using (
    viewer_id = auth.uid()
    or exists (
      select 1 from public.stories s
      where s.id = story_id and s.user_id = auth.uid()
    )
  );

-- push_tokens: own only
drop policy if exists "push_tokens_own" on public.push_tokens;
create policy "push_tokens_own" on public.push_tokens
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- CHUNK: storage-realtime
insert into storage.buckets (id, name, public)
values ($$avatars$$, $$avatars$$, true), ($$chat-media$$, $$chat-media$$, false)
on conflict (id) do nothing;

-- avatars bucket: public read, users manage own folder
drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read" on storage.objects
  for select to public using (bucket_id = $$avatars$$);
drop policy if exists "avatars_auth_insert_own" on storage.objects;
create policy "avatars_auth_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = $$avatars$$ and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "avatars_auth_update_own" on storage.objects;
create policy "avatars_auth_update_own" on storage.objects
  for update to authenticated
  using (bucket_id = $$avatars$$ and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = $$avatars$$ and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "avatars_auth_delete_own" on storage.objects;
create policy "avatars_auth_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = $$avatars$$ and (storage.foldername(name))[1] = auth.uid()::text);

-- chat-media bucket: only members of the chat in the object path
drop policy if exists "chatmedia_select_member" on storage.objects;
create policy "chatmedia_select_member" on storage.objects
  for select to authenticated
  using (bucket_id = $$chat-media$$
         and public.is_chat_member(((storage.foldername(name))[1])::uuid));
drop policy if exists "chatmedia_insert_member" on storage.objects;
create policy "chatmedia_insert_member" on storage.objects
  for insert to authenticated
  with check (bucket_id = $$chat-media$$
               and public.is_chat_member(((storage.foldername(name))[1])::uuid));
drop policy if exists "chatmedia_delete_member" on storage.objects;
create policy "chatmedia_delete_member" on storage.objects
  for delete to authenticated
  using (bucket_id = $$chat-media$$
         and public.is_chat_member(((storage.foldername(name))[1])::uuid));

-- realtime payloads for edits/deletes
alter table public.messages replica identity full;
alter table public.message_receipts replica identity full;
alter table public.chat_members replica identity full;
alter table public.chats replica identity full;

do $blk$
begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object then null;
end $blk$;
do $blk$
begin
  alter publication supabase_realtime add table public.message_receipts;
exception when duplicate_object then null;
end $blk$;
do $blk$
begin
  alter publication supabase_realtime add table public.chat_members;
exception when duplicate_object then null;
end $blk$;
do $blk$
begin
  alter publication supabase_realtime add table public.chats;
exception when duplicate_object then null;
end $blk$;

-- CHUNK: cron-purge
create extension if not exists pg_cron;
do $blk$
begin
  perform cron.unschedule($$poffu-purge-expired$$);
exception when others then null;
end $blk$;
select cron.schedule(
  $$poffu-purge-expired$$,
  $$0 * * * *$$,
  $cron$
    delete from public.messages m
    using public.chats c
    where m.chat_id = c.id
      and c.disappearing_duration is not null
      and m.created_at < now() - c.disappearing_duration;
    delete from public.stories where expires_at < now();
  $cron$
);
