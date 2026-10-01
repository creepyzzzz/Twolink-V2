-- Poffu migration 0002: message reactions.
-- The app ships tapback reactions; they need a table. Run in the Supabase
-- SQL editor (Dashboard → SQL → New query) — takes a few seconds.

create table if not exists public.message_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  unique (message_id, user_id, emoji)
);
create index if not exists message_reactions_message_idx
  on public.message_reactions (message_id);

alter table public.message_reactions enable row level security;

drop policy if exists "reactions_select_member" on public.message_reactions;
create policy "reactions_select_member" on public.message_reactions
  for select to authenticated
  using (
    exists (
      select 1 from public.messages m
      where m.id = message_reactions.message_id
        and public.is_chat_member(m.chat_id)
    )
  );

drop policy if exists "reactions_insert_member" on public.message_reactions;
create policy "reactions_insert_member" on public.message_reactions
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.messages m
      where m.id = message_reactions.message_id
        and public.is_chat_member(m.chat_id)
    )
  );

drop policy if exists "reactions_delete_own" on public.message_reactions;
create policy "reactions_delete_own" on public.message_reactions
  for delete to authenticated
  using (user_id = auth.uid());
