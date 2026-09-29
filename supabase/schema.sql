-- TwoLink v2 — Supabase schema (scaffold, not yet wired to the app).
--
-- Run this in the Supabase SQL editor. It only creates tables; add your own
-- Row Level Security policies afterwards (examples sketched in comments).
-- Storage buckets (e.g. "media", "vault") are created in the dashboard, not here.

-- ---------------------------------------------------------------- profiles
-- One row per user, keyed to auth.users. Username is the friend-request handle.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);
-- RLS: users can read all profiles (needed for friend search) but only
-- update their own row.

-- ------------------------------------------------------- friend_requests
create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  from_profile uuid not null references public.profiles(id) on delete cascade,
  to_profile uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined')),
  created_at timestamptz not null default now(),
  unique (from_profile, to_profile),
  check (from_profile <> to_profile)
);
-- RLS: a user can see requests they sent or received; only the recipient can
-- update status.

-- ------------------------------------------------------------ friendships
-- Symmetric friendship rows are derived when a request is accepted.
-- Store one row per pair (order the pair so user_a < user_b) to avoid dupes.
create table if not exists public.friendships (
  user_a uuid not null references public.profiles(id) on delete cascade,
  user_b uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_a, user_b),
  check (user_a < user_b)
);
-- RLS: a user can only see friendships they are part of.

-- ---------------------------------------------------------- conversations
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  is_group boolean not null default false,
  title text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
-- RLS: only members (see conversation_members) can read/write.

-- --------------------------------------------------- conversation_members
create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','admin','member')),
  joined_at timestamptz not null default now(),
  primary key (conversation_id, profile_id)
);
-- RLS: members can read the member list; only owners/admins can add/remove.

-- --------------------------------------------------------------- messages
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text,
  kind text not null default 'text' check (kind in ('text','image','video','audio','file')),
  reply_to uuid references public.messages(id) on delete set null,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz
);
create index if not exists messages_conversation_created_idx
  on public.messages (conversation_id, created_at desc);
-- RLS: only conversation members can read/insert; senders can edit/delete
-- their own messages.

-- ------------------------------------------------------------------ media
-- Metadata for message attachments stored in a Supabase Storage bucket.
create table if not exists public.media (
  id uuid primary key default gen_random_uuid(),
  message_id uuid references public.messages(id) on delete cascade,
  storage_path text not null,          -- path inside the storage bucket
  mime_type text,
  size_bytes bigint,
  width int,
  height int,
  thumb_path text,
  created_at timestamptz not null default now()
);
-- RLS: mirror the parent message's visibility.

-- ------------------------------------------------------------ vault_items
-- The private media vault: items live behind the secret-code gate.
create table if not exists public.vault_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null,          -- path inside a private bucket
  mime_type text,
  note text,
  locked_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists vault_items_owner_idx
  on public.vault_items (owner_id, locked_at desc);
-- RLS: strictly owner-only — no other profile may read these rows.
