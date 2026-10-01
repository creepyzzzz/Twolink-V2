-- Poffu: Friend requests, blocks, and message-request privacy.
-- Applied 2026-10-01 via Management API.

create table if not exists public.friendships (
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status text not null check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (requester_id, addressee_id),
  check (requester_id != addressee_id)
);

create table if not exists public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id != blocked_id)
);

alter table public.profiles
  add column if not exists allow_message_requests boolean not null default true;

alter table public.friendships enable row level security;
alter table public.blocks enable row level security;

-- RLS: users see/manage only friendships they're part of.
create policy friendships_select_own on public.friendships
  for select to authenticated
  using (requester_id = auth.uid() or addressee_id = auth.uid());
create policy friendships_insert_own on public.friendships
  for insert to authenticated
  with check (requester_id = auth.uid());
create policy friendships_update_own on public.friendships
  for update to authenticated
  using (requester_id = auth.uid() or addressee_id = auth.uid())
  with check (requester_id = auth.uid() or addressee_id = auth.uid());
create policy friendships_delete_own on public.friendships
  for delete to authenticated
  using (requester_id = auth.uid() or addressee_id = auth.uid());

-- RLS: users see/manage only their own blocks.
create policy blocks_select_own on public.blocks
  for select to authenticated
  using (blocker_id = auth.uid() or blocked_id = auth.uid());
create policy blocks_insert_own on public.blocks
  for insert to authenticated
  with check (blocker_id = auth.uid());
create policy blocks_delete_own on public.blocks
  for delete to authenticated
  using (blocker_id = auth.uid());

-- RPC: get_or_create_direct_chat enforces block + request-privacy rules,
-- creates a pending friendship on first message to a non-friend.
-- RPC: accept_friend_request / decline_friend_request / block_user
-- (see function definitions in the live database).
