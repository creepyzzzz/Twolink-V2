/**
 * Live Supabase data-access layer for Poffu chat.
 *
 * Pure data functions — no UI, no store. The fable store (`data/store.ts`)
 * calls these; screens keep consuming the store. All mock seeds are gone:
 * every function here hits the real backend.
 */
import { getSupabase } from "./supabase";

/* ------------------------------------------------------------------ */
/* DB row types                                                        */
/* ------------------------------------------------------------------ */

export type DbProfile = {
  id: string;
  display_name: string;
  username: string | null;
  avatar_url: string | null;
  about: string;
  last_seen: string;
  created_at: string;
};

export type DbChat = {
  id: string;
  type: "direct" | "group";
  name: string | null;
  avatar_url: string | null;
  created_by: string | null;
  disappearing_duration: string | null; // postgres interval, e.g. "1 day"
  created_at: string;
};

export type DbChatMember = {
  chat_id: string;
  user_id: string;
  role: "creator" | "admin" | "member";
  muted: boolean;
  pinned: boolean;
  last_read_at: string | null;
  joined_at: string;
};

export type DbMessage = {
  id: string;
  chat_id: string;
  sender_id: string | null;
  kind: "text" | "image" | "video" | "document" | "system";
  body: string | null;
  media_url: string | null;
  media_name: string | null;
  media_size: number | null;
  mime_type: string | null;
  reply_to: string | null;
  edited_at: string | null;
  deleted_for_everyone: boolean;
  created_at: string;
};

export type DbReceipt = {
  message_id: string;
  user_id: string;
  delivered_at: string | null;
  read_at: string | null;
};

export type DbStory = {
  id: string;
  user_id: string;
  media_url: string;
  media_kind: "image" | "video";
  created_at: string;
  expires_at: string;
};

export type DbScheduled = {
  id: string;
  chat_id: string;
  sender_id: string;
  kind: "text" | "image" | "video" | "document";
  body: string | null;
  media_url: string | null;
  media_name: string | null;
  reply_to: string | null;
  scheduled_for: string;
  sent_at: string | null;
  cancelled: boolean;
  created_at: string;
};

/* ------------------------------------------------------------------ */
/* UI-facing shapes                                                    */
/* ------------------------------------------------------------------ */

/** One inbox row, fully derived from live tables. */
export type ChatRow = {
  id: string;
  type: "direct" | "group";
  /** Group name, or the other member's display name for direct chats. */
  name: string;
  avatarUrl: string | null;
  /** Direct chats: the other participant's user id. */
  otherUserId: string | null;
  memberIds: string[];
  memberCount: number;
  preview: string;
  previewAt: string;
  previewAtMs: number;
  previewFromMe: boolean;
  unread: number;
  muted: boolean;
  pinned: boolean;
  disappearingMs: number;
  lastReadAt: string | null;
  roles: Record<string, "creator" | "admin" | "member">;
};

/* ------------------------------------------------------------------ */
/* Session + profile                                                   */
/* ------------------------------------------------------------------ */

export async function getMyUserId(): Promise<string | null> {
  const supabase = getSupabase();
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

/** Fetches my profile row, creating it from the auth user when missing. */
export async function ensureProfile(): Promise<DbProfile> {
  const supabase = getSupabase();
  const userId = await getMyUserId();
  if (!userId) throw new Error("Not signed in");
  const { data: existing } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (existing) return existing as DbProfile;
  const { data: user } = await supabase.auth.getUser();
  const email = user.user?.email ?? "";
  const fallback = email.split("@")[0] || "poffu-user";
  const { data, error } = await supabase
    .from("profiles")
    .insert({
      id: userId,
      display_name: fallback,
      about: "Hey there! I'm using Poffu.",
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as DbProfile;
}

export async function updateMyProfile(
  patch: Partial<Pick<DbProfile, "display_name" | "about" | "avatar_url" | "username">>,
): Promise<void> {
  const supabase = getSupabase();
  const userId = await getMyUserId();
  if (!userId) throw new Error("Not signed in");
  const { error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", userId);
  if (error) throw error;
}

export async function fetchProfiles(userIds: string[]): Promise<DbProfile[]> {
  if (userIds.length === 0) return [];
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .in("id", [...new Set(userIds)]);
  if (error) throw error;
  return (data ?? []) as DbProfile[];
}

/** Find people to start a chat with — by username or display name. */
export async function searchUsers(query: string): Promise<DbProfile[]> {
  const supabase = getSupabase();
  const myId = await getMyUserId();
  const q = query.trim();
  if (!q) return [];
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
    .neq("id", myId ?? "")
    .limit(20);
  if (error) throw error;
  const rows = (data ?? []) as DbProfile[];
  if (rows.length === 0 || !myId) return rows;

  // Filter: hide non-discoverable users (unless friends), and blocked either way.
  const friendIds = await getFriendIds().catch(() => [] as string[]);
  const knownIds = new Set([...friendIds]);
  try {
    const { data: pend } = await supabase
      .from("friendships")
      .select("requester_id,addressee_id")
      .eq("status", "pending")
      .or(`requester_id.eq.${myId},addressee_id.eq.${myId}`);
    for (const r of (pend ?? []) as { requester_id: string; addressee_id: string }[]) {
      knownIds.add(r.requester_id === myId ? r.addressee_id : r.requester_id);
    }
  } catch {}
  const blockedIds = new Set<string>();
  try {
    const { data: blocks } = await supabase
      .from("blocks")
      .select("blocker_id,blocked_id")
      .or(`blocker_id.eq.${myId},blocked_id.eq.${myId}`);
    for (const b of (blocks ?? []) as { blocker_id: string; blocked_id: string }[]) {
      blockedIds.add(b.blocker_id === myId ? b.blocked_id : b.blocker_id);
    }
  } catch {}
  return rows.filter((r) => {
    if (blockedIds.has(r.id)) return false;
    if (knownIds.has(r.id)) return true;
    return (r as DbProfile & { allow_message_requests?: boolean }).allow_message_requests !== false;
  });
}

/* ------------------------------------------------------------------ */
/* Time formatting (matches the old mock `at` shapes)                  */
/* ------------------------------------------------------------------ */

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/** "9:41" today, "Yesterday 21:05", "Tuesday 14:02", else "12/09/26 21:05". */
export function formatMessageTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const hh = d.getHours();
  const mm = String(d.getMinutes()).padStart(2, "0");
  const clock = `${hh}:${mm}`;
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const msgDay = new Date(d);
  msgDay.setHours(0, 0, 0, 0);
  const diffDays = Math.round(
    (dayStart.getTime() - msgDay.getTime()) / 86_400_000,
  );
  if (diffDays <= 0) return clock;
  if (diffDays === 1) return `Yesterday ${clock}`;
  if (diffDays < 7) return `${WEEKDAYS[d.getDay()]} ${clock}`;
  return `${d.getDate()}/${d.getMonth() + 1}/${String(d.getFullYear()).slice(2)} ${clock}`;
}

/** "12m", "3h", "Yesterday" — for story ages. */
export function formatAgo(iso: string): string {
  const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h`;
  return "Yesterday";
}

/** Postgres interval ("1 day", "7 days", "00:00:00") → milliseconds. */
export function intervalToMs(interval: string | null): number {
  if (!interval) return 0;
  const days = interval.match(/(\d+)\s+days?/);
  if (days) return Number(days[1]) * 86_400_000;
  const hms = interval.match(/(\d+):(\d+):(\d+)/);
  if (hms)
    return (
      (Number(hms[1]) * 3600 + Number(hms[2]) * 60 + Number(hms[3])) * 1000
    );
  return 0;
}

/* ------------------------------------------------------------------ */
/* Chats                                                               */
/* ------------------------------------------------------------------ */

export async function fetchChats(): Promise<ChatRow[]> {
  const supabase = getSupabase();
  const myId = await getMyUserId();
  if (!myId) return [];

  // My memberships (RLS scopes to chats I'm in).
  const { data: memberships, error: memErr } = await supabase
    .from("chat_members")
    .select("*, chats!inner(*)")
    .eq("user_id", myId);
  if (memErr) throw memErr;

  const rows: ChatRow[] = [];
  for (const m of (memberships ?? []) as (DbChatMember & { chats: DbChat })[]) {
    const chat = m.chats;
    // All members + their profiles (for names/avatars).
    const { data: members } = await supabase
      .from("chat_members")
      .select("user_id")
      .eq("chat_id", chat.id);
    const memberIds = ((members ?? []) as { user_id: string }[]).map(
      (x) => x.user_id,
    );
    const profiles = await fetchProfiles(memberIds);
    const byId = new Map(profiles.map((p) => [p.id, p]));

    // Latest visible message.
    const { data: lastMsgs } = await supabase
      .from("messages")
      .select("id,body,kind,sender_id,created_at,deleted_for_everyone")
      .eq("chat_id", chat.id)
      .order("created_at", { ascending: false })
      .limit(1);
    const last = (lastMsgs ?? [])[0] as
      | Pick<DbMessage, "id" | "body" | "kind" | "sender_id" | "created_at" | "deleted_for_everyone">
      | undefined;

    // Unread: messages after my last_read_at, not from me.
    let unread = 0;
    if (last) {
      let q = supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("chat_id", chat.id)
        .neq("sender_id", myId);
      if (m.last_read_at) q = q.gt("created_at", m.last_read_at);
      const { count } = await q;
      unread = count ?? 0;
    }

    const otherId =
      chat.type === "direct"
        ? (memberIds.find((id) => id !== myId) ?? null)
        : null;
    const other = otherId ? byId.get(otherId) : undefined;
    const name =
      chat.type === "group"
        ? (chat.name?.trim() || "Group")
        : (other?.display_name || "Chat");
    const preview = last
      ? last.deleted_for_everyone
        ? "This message was deleted"
        : last.body?.trim() || (last.kind === "image" ? "Photo" : last.kind === "video" ? "Video" : "File")
      : "";
    const previewAtMs = last ? new Date(last.created_at).getTime() : 0;

    rows.push({
      id: chat.id,
      type: chat.type,
      name,
      avatarUrl: chat.type === "group" ? chat.avatar_url : (other?.avatar_url ?? null),
      otherUserId: otherId,
      memberIds,
      memberCount: memberIds.length,
      preview,
      previewAt: last ? formatMessageTime(last.created_at) : "",
      previewAtMs,
      previewFromMe: last ? last.sender_id === myId : false,
      unread,
      muted: m.muted,
      pinned: m.pinned,
      disappearingMs: intervalToMs(chat.disappearing_duration),
      lastReadAt: m.last_read_at,
      roles: {},
    });
  }

  // Member roles per chat (drives group admin UI).
  for (const row of rows) {
    const { data: roleRows } = await supabase
      .from("chat_members")
      .select("user_id, role")
      .eq("chat_id", row.id);
    for (const r of (roleRows ?? []) as { user_id: string; role: "creator" | "admin" | "member" }[]) {
      row.roles[r.user_id] = r.role;
    }
  }

  // Pinned first, then most recent activity.
  rows.sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.previewAtMs - a.previewAtMs;
  });
  return rows;
}

/** Returns the existing direct chat with a user, or creates one. */
export async function getOrCreateDirectChat(otherUserId: string): Promise<string> {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc("get_or_create_direct_chat", {
    other_user_id: otherUserId,
  });
  if (error) throw error;
  if (!data) throw new Error("Failed to create chat");
  return data as string;
}

/* ---- Friend requests & blocks ---- */

export type FriendshipStatus = "pending" | "accepted" | null;

export type Friendship = {
  requesterId: string;
  addresseeId: string;
  status: "pending" | "accepted";
};

/** Get the friendship status with another user (either direction). */
export async function getFriendship(otherUserId: string): Promise<FriendshipStatus> {
  const supabase = getSupabase();
  const myId = await getMyUserId();
  if (!myId) return null;
  const { data } = await supabase
    .from("friendships")
    .select("status")
    .or(
      `and(requester_id.eq.${myId},addressee_id.eq.${otherUserId}),and(requester_id.eq.${otherUserId},addressee_id.eq.${myId})`,
    )
    .limit(1)
    .maybeSingle();
  return (data as { status: "pending" | "accepted" } | null)?.status ?? null;
}

/** Am I the recipient of a pending request from this user? */
export async function isIncomingRequest(otherUserId: string): Promise<boolean> {
  const supabase = getSupabase();
  const myId = await getMyUserId();
  if (!myId) return false;
  const { data } = await supabase
    .from("friendships")
    .select("requester_id")
    .eq("requester_id", otherUserId)
    .eq("addressee_id", myId)
    .eq("status", "pending")
    .limit(1)
    .maybeSingle();
  return !!data;
}

/** List my friends' user IDs (accepted friendships, either direction). */
export async function getFriendIds(): Promise<string[]> {
  const supabase = getSupabase();
  const myId = await getMyUserId();
  if (!myId) return [];
  const { data } = await supabase
    .from("friendships")
    .select("requester_id,addressee_id")
    .eq("status", "accepted")
    .or(`requester_id.eq.${myId},addressee_id.eq.${myId}`);
  const ids = new Set<string>();
  for (const r of (data ?? []) as { requester_id: string; addressee_id: string }[]) {
    ids.add(r.requester_id === myId ? r.addressee_id : r.requester_id);
  }
  return [...ids];
}

/** Incoming pending requests (requester IDs). */
export async function getIncomingRequestIds(): Promise<string[]> {
  const supabase = getSupabase();
  const myId = await getMyUserId();
  if (!myId) return [];
  const { data } = await supabase
    .from("friendships")
    .select("requester_id")
    .eq("addressee_id", myId)
    .eq("status", "pending");
  return ((data ?? []) as { requester_id: string }[]).map((r) => r.requester_id);
}

export async function acceptFriendRequest(requesterId: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.rpc("accept_friend_request", {
    requester_id: requesterId,
  });
  if (error) throw error;
}

export async function declineFriendRequest(requesterId: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.rpc("decline_friend_request", {
    requester_id: requesterId,
  });
  if (error) throw error;
}

export async function blockUser(userId: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.rpc("block_user", { blocked_id: userId });
  if (error) throw error;
}

/** True if I blocked them or they blocked me. */
export async function hasBlockWith(otherUserId: string): Promise<boolean> {
  const supabase = getSupabase();
  const myId = await getMyUserId();
  if (!myId) return false;
  const { data, error } = await supabase
    .from("blocks")
    .select("blocker_id")
    .or(
      `and(blocker_id.eq.${myId},blocked_id.eq.${otherUserId}),and(blocker_id.eq.${otherUserId},blocked_id.eq.${myId})`,
    )
    .limit(1);
  if (error) return false;
  return (data?.length ?? 0) > 0;
}

export async function unblockUser(userId: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.rpc("unblock_user", { blocked_id: userId });
  if (error) throw error;
}

/** Users I have blocked, with profiles for display. */
export async function getBlockedUsers(): Promise<DbProfile[]> {
  const supabase = getSupabase();
  const myId = await getMyUserId();
  if (!myId) return [];
  const { data, error } = await supabase
    .from("blocks")
    .select("blocked_id")
    .eq("blocker_id", myId);
  if (error) return [];
  const ids = ((data ?? []) as { blocked_id: string }[]).map(
    (r) => r.blocked_id,
  );
  if (ids.length === 0) return [];
  return fetchProfiles(ids);
}

/** Privacy toggle: can strangers send me message requests? */
export async function getAllowMessageRequests(): Promise<boolean> {
  const supabase = getSupabase();
  const myId = await getMyUserId();
  if (!myId) return true;
  const { data } = await supabase
    .from("profiles")
    .select("allow_message_requests")
    .eq("id", myId)
    .maybeSingle();
  return (data as { allow_message_requests: boolean } | null)?.allow_message_requests ?? true;
}

export async function setAllowMessageRequests(allow: boolean): Promise<void> {
  const supabase = getSupabase();
  const myId = await getMyUserId();
  if (!myId) throw new Error("Not signed in");
  const { error } = await supabase
    .from("profiles")
    .update({ allow_message_requests: allow })
    .eq("id", myId);
  if (error) throw error;
}

export async function createGroupChat(
  name: string,
  memberIds: string[],
): Promise<string> {
  const supabase = getSupabase();
  const myId = await getMyUserId();
  if (!myId) throw new Error("Not signed in");
  const clean = name.trim();
  const { data: chat, error: chatErr } = await supabase
    .from("chats")
    .insert({ type: "group", name: clean || null, created_by: myId })
    .select("id")
    .single();
  if (chatErr) throw chatErr;
  const chatId = (chat as { id: string }).id;
  const rows = [
    { chat_id: chatId, user_id: myId, role: "creator" as const },
    ...memberIds
      .filter((id) => id !== myId)
      .map((id) => ({ chat_id: chatId, user_id: id, role: "member" as const })),
  ];
  const { error: memErr } = await supabase.from("chat_members").insert(rows);
  if (memErr) throw memErr;
  return chatId;
}

export async function setChatMuted(chatId: string, muted: boolean): Promise<void> {
  const supabase = getSupabase();
  const myId = await getMyUserId();
  if (!myId) return;
  await supabase
    .from("chat_members")
    .update({ muted })
    .eq("chat_id", chatId)
    .eq("user_id", myId);
}

export async function setChatPinned(chatId: string, pinned: boolean): Promise<void> {
  const supabase = getSupabase();
  const myId = await getMyUserId();
  if (!myId) return;
  await supabase
    .from("chat_members")
    .update({ pinned })
    .eq("chat_id", chatId)
    .eq("user_id", myId);
}

/** Marks a chat read: bumps last_read_at and receipts for incoming messages. */
export async function markChatRead(chatId: string): Promise<void> {
  const supabase = getSupabase();
  const myId = await getMyUserId();
  if (!myId) return;
  const now = new Date().toISOString();
  await supabase
    .from("chat_members")
    .update({ last_read_at: now })
    .eq("chat_id", chatId)
    .eq("user_id", myId);
  // Receipts for every incoming message in this chat.
  const { data: incoming } = await supabase
    .from("messages")
    .select("id")
    .eq("chat_id", chatId)
    .neq("sender_id", myId);
  const ids = ((incoming ?? []) as { id: string }[]).map((m) => m.id);
  if (ids.length === 0) return;
  const { data: existing } = await supabase
    .from("message_receipts")
    .select("message_id")
    .eq("user_id", myId)
    .in("message_id", ids);
  const seen = new Set(((existing ?? []) as { message_id: string }[]).map((r) => r.message_id));
  const missing = ids.filter((id) => !seen.has(id));
  if (missing.length > 0) {
    await supabase.from("message_receipts").insert(
      missing.map((message_id) => ({
        message_id,
        user_id: myId,
        delivered_at: now,
        read_at: now,
      })),
    );
  }
  const needsRead = ids.filter((id) => seen.has(id));
  if (needsRead.length > 0) {
    await supabase
      .from("message_receipts")
      .update({ read_at: now })
      .eq("user_id", myId)
      .in("message_id", needsRead);
  }
}

/** Leave a chat (removes my membership). */
export async function leaveChat(chatId: string): Promise<void> {
  const supabase = getSupabase();
  const myId = await getMyUserId();
  if (!myId) return;
  await supabase
    .from("chat_members")
    .delete()
    .eq("chat_id", chatId)
    .eq("user_id", myId);
}

export async function setGroupName(chatId: string, name: string): Promise<void> {
  const supabase = getSupabase();
  await supabase.from("chats").update({ name: name.trim() || null }).eq("id", chatId);
}

export async function addGroupMembers(chatId: string, userIds: string[]): Promise<void> {
  const supabase = getSupabase();
  if (userIds.length === 0) return;
  await supabase.from("chat_members").insert(
    userIds.map((user_id) => ({ chat_id: chatId, user_id, role: "member" as const })),
  );
}

export async function removeGroupMember(chatId: string, userId: string): Promise<void> {
  const supabase = getSupabase();
  await supabase
    .from("chat_members")
    .delete()
    .eq("chat_id", chatId)
    .eq("user_id", userId);
}

export async function setGroupAdmin(chatId: string, userId: string, admin: boolean): Promise<void> {
  const supabase = getSupabase();
  await supabase
    .from("chat_members")
    .update({ role: admin ? "admin" : "member" })
    .eq("chat_id", chatId)
    .eq("user_id", userId);
}

export async function setDisappearing(chatId: string, ms: number): Promise<void> {
  const supabase = getSupabase();
  // Postgres interval from milliseconds.
  const { error } = await supabase
    .from("chats")
    .update({
      disappearing_duration: ms > 0 ? `${Math.round(ms / 1000)} seconds` : null,
    })
    .eq("id", chatId);
  if (error) throw error;
}

/* ------------------------------------------------------------------ */
/* Messages                                                            */
/* ------------------------------------------------------------------ */

export type SendInput = {
  body?: string;
  kind?: "text" | "image" | "video" | "document";
  mediaUrl?: string;
  mediaName?: string;
  mediaSize?: number;
  mimeType?: string;
  replyTo?: string | null;
};

export async function fetchMessages(
  chatId: string,
  opts?: { limit?: number; before?: string },
): Promise<DbMessage[]> {
  const supabase = getSupabase();
  const limit = opts?.limit ?? 50;
  let q = supabase
    .from("messages")
    .select("*")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (opts?.before) q = q.lt("created_at", opts.before);
  const { data, error } = await q;
  if (error) throw error;
  const rows = ((data ?? []) as DbMessage[]).reverse();
  // Exclude messages I hid (delete for me).
  const myId = await getMyUserId();
  if (myId && rows.length > 0) {
    const { data: hides } = await supabase
      .from("message_hides")
      .select("message_id")
      .eq("user_id", myId)
      .in(
        "message_id",
        rows.map((r) => r.id),
      );
    const hidden = new Set(((hides ?? []) as { message_id: string }[]).map((h) => h.message_id));
    return rows.filter((r) => !hidden.has(r.id));
  }
  return rows;
}

/**
 * Receipt rollup for my outgoing messages: delivered/read are true once
 * every other member reached that state (WhatsApp group semantics; for a
 * direct chat "every other member" is just the one person).
 */
export async function fetchReceiptRollup(
  messageIds: string[],
  memberCount: number,
): Promise<Record<string, { delivered: boolean; read: boolean }>> {
  const out: Record<string, { delivered: boolean; read: boolean }> = {};
  if (messageIds.length === 0) return out;
  const supabase = getSupabase();
  const myId = await getMyUserId();
  const { data } = await supabase
    .from("message_receipts")
    .select("message_id, delivered_at, read_at")
    .in("message_id", messageIds)
    .neq("user_id", myId ?? "");
  const need = Math.max(1, memberCount - 1);
  const agg = new Map<string, { d: number; r: number }>();
  for (const row of (data ?? []) as Pick<DbReceipt, "message_id" | "delivered_at" | "read_at">[]) {
    const a = agg.get(row.message_id) ?? { d: 0, r: 0 };
    if (row.delivered_at || row.read_at) a.d += 1;
    if (row.read_at) a.r += 1;
    agg.set(row.message_id, a);
  }
  for (const [id, a] of agg) {
    out[id] = { delivered: a.d >= need, read: a.r >= need };
  }
  return out;
}

export async function sendMessage(
  chatId: string,
  input: SendInput,
): Promise<DbMessage> {
  const supabase = getSupabase();
  const myId = await getMyUserId();
  if (!myId) throw new Error("Not signed in");
  const { data, error } = await supabase
    .from("messages")
    .insert({
      chat_id: chatId,
      sender_id: myId,
      kind: input.kind ?? "text",
      body: input.body?.trim() || null,
      media_url: input.mediaUrl ?? null,
      media_name: input.mediaName ?? null,
      media_size: input.mediaSize ?? null,
      mime_type: input.mimeType ?? null,
      reply_to: input.replyTo ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as DbMessage;
}

export async function editMessageDb(messageId: string, body: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from("messages")
    .update({ body: body.trim(), edited_at: new Date().toISOString() })
    .eq("id", messageId);
  if (error) throw error;
}

/** Delete for me: hides the row only for me. */
export async function hideMessageDb(messageId: string): Promise<void> {
  const supabase = getSupabase();
  const myId = await getMyUserId();
  if (!myId) throw new Error("Not signed in");
  const { error } = await supabase
    .from("message_hides")
    .insert({ message_id: messageId, user_id: myId });
  if (error) throw error;
}

/** Delete for everyone: tombstones the row for all members. */
export async function deleteMessageForEveryoneDb(messageId: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from("messages")
    .update({
      body: null,
      media_url: null,
      media_name: null,
      deleted_for_everyone: true,
    })
    .eq("id", messageId);
  if (error) throw error;
}

/** Record delivery of incoming messages (called when they arrive). */
export async function markDelivered(messageIds: string[]): Promise<void> {  if (messageIds.length === 0) return;
  const supabase = getSupabase();
  const myId = await getMyUserId();
  if (!myId) return;
  const now = new Date().toISOString();
  const { data: existing } = await supabase
    .from("message_receipts")
    .select("message_id")
    .eq("user_id", myId)
    .in("message_id", messageIds);
  const seen = new Set(((existing ?? []) as { message_id: string }[]).map((r) => r.message_id));
  const missing = messageIds.filter((id) => !seen.has(id));
  if (missing.length > 0) {
    await supabase.from("message_receipts").insert(
      missing.map((message_id) => ({ message_id, user_id: myId, delivered_at: now })),
    );
  }
}

/* ------------------------------------------------------------------ */
/* Realtime                                                            */
/* ------------------------------------------------------------------ */

export type ChatEventHandlers = {
  onMessage?: (msg: DbMessage) => void;
  onMessageUpdate?: (msg: DbMessage) => void;
  onReceipt?: (receipt: DbReceipt) => void;
  onChatChange?: () => void;
  onFriendshipChange?: () => void;
};

/**
 * One global subscription, RLS-scoped to chats I'm in. Routes events to
 * the handlers; callers filter by chat id.
 */
export function subscribeToChatEvents(handlers: ChatEventHandlers): () => void {
  const supabase = getSupabase();
  const channel = supabase
    .channel("poffu-chat-events")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages" },
      (payload) => handlers.onMessage?.(payload.new as DbMessage),
    )
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "messages" },
      (payload) => handlers.onMessageUpdate?.(payload.new as DbMessage),
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "message_receipts" },
      (payload) =>
        handlers.onReceipt?.(
          (payload.new ?? payload.old) as DbReceipt,
        ),
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "chats" },
      () => handlers.onChatChange?.(),
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "chat_members" },
      () => handlers.onChatChange?.(),
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "friendships" },
      () => handlers.onFriendshipChange?.(),
    )
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}

/* ------------------------------------------------------------------ */
/* Stories                                                             */
/* ------------------------------------------------------------------ */

export type StoryItem = {
  id: string;
  userId: string;
  mediaUrl: string;
  mediaKind: "image" | "video";
  createdAt: string;
  ago: string;
  viewed: boolean;
  profile: DbProfile | null;
};

export async function fetchStories(): Promise<StoryItem[]> {
  const supabase = getSupabase();
  const myId = await getMyUserId();
  if (!myId) return [];
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { data, error } = await supabase
    .from("stories")
    .select("*")
    .gt("expires_at", new Date().toISOString())
    .gt("created_at", since)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as DbStory[];
  if (rows.length === 0) return [];
  const { data: views } = await supabase
    .from("story_views")
    .select("story_id")
    .eq("viewer_id", myId);
  const seen = new Set(((views ?? []) as { story_id: string }[]).map((v) => v.story_id));
  const profiles = await fetchProfiles(rows.map((r) => r.user_id));
  const byId = new Map(profiles.map((p) => [p.id, p]));
  return rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    mediaUrl: r.media_url,
    mediaKind: r.media_kind,
    createdAt: r.created_at,
    ago: formatAgo(r.created_at),
    viewed: seen.has(r.id),
    profile: byId.get(r.user_id) ?? null,
  }));
}

export async function postStoryDb(mediaUrl: string): Promise<void> {
  const supabase = getSupabase();
  const myId = await getMyUserId();
  if (!myId) throw new Error("Not signed in");
  const { error } = await supabase.from("stories").insert({
    user_id: myId,
    media_url: mediaUrl,
    media_kind: "image",
  });
  if (error) throw error;
}

export async function markStoryViewed(storyId: string): Promise<void> {
  const supabase = getSupabase();
  const myId = await getMyUserId();
  if (!myId) return;
  await supabase
    .from("story_views")
    .upsert({ story_id: storyId, viewer_id: myId }, { onConflict: "story_id,viewer_id" });
}

/* ------------------------------------------------------------------ */
/* Scheduled messages                                                  */
/* ------------------------------------------------------------------ */

export async function fetchScheduledDb(): Promise<DbScheduled[]> {
  const supabase = getSupabase();
  const myId = await getMyUserId();
  if (!myId) return [];
  const { data, error } = await supabase
    .from("scheduled_messages")
    .select("*")
    .eq("sender_id", myId)
    .is("sent_at", null)
    .eq("cancelled", false)
    .order("scheduled_for", { ascending: true });
  if (error) throw error;
  return (data ?? []) as DbScheduled[];
}

export async function scheduleMessageDb(
  chatId: string,
  body: string,
  at: Date,
  replyTo?: string | null,
): Promise<DbScheduled> {
  const supabase = getSupabase();
  const myId = await getMyUserId();
  if (!myId) throw new Error("Not signed in");
  const { data, error } = await supabase
    .from("scheduled_messages")
    .insert({
      chat_id: chatId,
      sender_id: myId,
      kind: "text",
      body: body.trim(),
      reply_to: replyTo ?? null,
      scheduled_for: at.toISOString(),
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as DbScheduled;
}

export async function cancelScheduledDb(id: string): Promise<void> {
  const supabase = getSupabase();
  await supabase.from("scheduled_messages").update({ cancelled: true }).eq("id", id);
}

/** Sends every due scheduled message. Called on app foreground / interval. */
export async function flushDueScheduledDb(): Promise<DbMessage[]> {
  const supabase = getSupabase();
  const myId = await getMyUserId();
  if (!myId) return [];
  const { data, error } = await supabase
    .from("scheduled_messages")
    .select("*")
    .eq("sender_id", myId)
    .is("sent_at", null)
    .eq("cancelled", false)
    .lte("scheduled_for", new Date().toISOString());
  if (error) throw error;
  const due = (data ?? []) as DbScheduled[];
  const sent: DbMessage[] = [];
  for (const s of due) {
    try {
      const msg = await sendMessage(s.chat_id, {
        body: s.body ?? "",
        kind: s.kind,
        mediaUrl: s.media_url ?? undefined,
        mediaName: s.media_name ?? undefined,
        replyTo: s.reply_to,
      });
      sent.push(msg);
      await supabase
        .from("scheduled_messages")
        .update({ sent_at: new Date().toISOString() })
        .eq("id", s.id);
    } catch {
      // Leave it queued; the next flush retries.
    }
  }
  return sent;
}

/* ------------------------------------------------------------------ */
/* Media upload                                                        */
/* ------------------------------------------------------------------ */

export async function uploadChatMedia(
  chatId: string,
  localUri: string,
  fileName: string,
  mimeType: string,
): Promise<{ url: string; name: string; size: number }> {
  const supabase = getSupabase();
  const myId = await getMyUserId();
  if (!myId) throw new Error("Not signed in");
  const res = await fetch(localUri);
  const blob = await res.blob();
  const path = `${chatId}/${myId}/${Date.now()}-${fileName}`;
  const { error } = await supabase.storage
    .from("chat-media")
    .upload(path, blob, { contentType: mimeType, upsert: false });
  if (error) throw error;
  // Private bucket: media_url stores the path; the app resolves it to a
  // signed URL at render time.
  return { url: path, name: fileName, size: blob.size };
}

/** Resolves a chat-media storage path to a short-lived signed URL. */
const signedUrlCache = new Map<string, { url: string; exp: number }>();
export async function signedMediaUrl(path: string): Promise<string> {
  const cached = signedUrlCache.get(path);
  if (cached && cached.exp > Date.now() + 60_000) return cached.url;
  const supabase = getSupabase();
  const { data, error } = await supabase.storage
    .from("chat-media")
    .createSignedUrl(path, 3600);
  if (error) throw error;
  const url = (data as { signedUrl: string }).signedUrl;
  signedUrlCache.set(path, { url, exp: Date.now() + 3600_000 });
  return url;
}

/* ------------------------------------------------------------------ */
/* Reactions (message_reactions table — added by migration 0002)        */
/* ------------------------------------------------------------------ */

export async function fetchReactions(
  messageIds: string[],
): Promise<Record<string, string[]>> {
  const out: Record<string, string[]> = {};
  if (messageIds.length === 0) return out;
  const supabase = getSupabase();
  const { data } = await supabase
    .from("message_reactions")
    .select("message_id, emoji")
    .in("message_id", messageIds);
  for (const row of (data ?? []) as { message_id: string; emoji: string }[]) {
    (out[row.message_id] ??= []).push(row.emoji);
  }
  return out;
}

export async function toggleReactionDb(
  messageId: string,
  emoji: string,
): Promise<boolean> {
  const supabase = getSupabase();
  const myId = await getMyUserId();
  if (!myId) throw new Error("Not signed in");
  const { data: existing, error: selErr } = await supabase
    .from("message_reactions")
    .select("id")
    .eq("message_id", messageId)
    .eq("user_id", myId)
    .eq("emoji", emoji)
    .maybeSingle();
  if (selErr) throw selErr;
  if ((existing as { id: string } | null)?.id) {
    const { error: delErr } = await supabase
      .from("message_reactions")
      .delete()
      .eq("id", (existing as { id: string }).id);
    if (delErr) throw delErr;
    return false;
  }
  const { error: insErr } = await supabase
    .from("message_reactions")
    .insert({ message_id: messageId, user_id: myId, emoji });
  if (insErr) throw insErr;
  return true;
}

/* ------------------------------------------------------------------ */
/* Store helpers                                                       */
/* ------------------------------------------------------------------ */

/** Single message by id (for reply-quote resolution). */
export async function fetchMessageById(id: string): Promise<DbMessage | null> {
  const supabase = getSupabase();
  const { data } = await supabase.from("messages").select("*").eq("id", id).maybeSingle();
  return (data as DbMessage | null) ?? null;
}

/** Hide every message in a chat for me (delete-thread semantics). */
export async function hideAllMessagesDb(chatId: string): Promise<void> {
  const supabase = getSupabase();
  const myId = await getMyUserId();
  if (!myId) return;
  const { data } = await supabase.from("messages").select("id").eq("chat_id", chatId);
  const ids = ((data ?? []) as { id: string }[]).map((m) => m.id);
  if (ids.length === 0) return;
  // Insert in chunks to stay well under parameter limits.
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    await supabase.from("message_hides").upsert(
      chunk.map((message_id) => ({ message_id, user_id: myId })),
      { onConflict: "message_id,user_id", ignoreDuplicates: true },
    );
  }
}

/** Sets last_read_at to an arbitrary timestamp (mark-unread support). */
export async function setChatLastReadAt(chatId: string, iso: string | null): Promise<void> {
  const supabase = getSupabase();
  const myId = await getMyUserId();
  if (!myId) return;
  await supabase
    .from("chat_members")
    .update({ last_read_at: iso })
    .eq("chat_id", chatId)
    .eq("user_id", myId);
}

/** Uploads my avatar photo to the public avatars bucket; returns its URL. */
export async function uploadAvatar(localUri: string): Promise<string> {
  const supabase = getSupabase();
  const myId = await getMyUserId();
  if (!myId) throw new Error("Not signed in");
  const res = await fetch(localUri);
  const blob = await res.blob();
  const path = `${myId}/avatar-${Date.now()}.jpg`;
  const { error } = await supabase.storage
    .from("avatars")
    .upload(path, blob, { contentType: "image/jpeg", upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return data.publicUrl;
}

/** Uploads a story photo to the public avatars bucket; returns its URL. */
export async function uploadStoryMedia(localUri: string): Promise<string> {
  const supabase = getSupabase();
  const myId = await getMyUserId();
  if (!myId) throw new Error("Not signed in");
  const res = await fetch(localUri);
  const blob = await res.blob();
  const path = `${myId}/story-${Date.now()}.jpg`;
  const { error } = await supabase.storage
    .from("avatars")
    .upload(path, blob, { contentType: "image/jpeg", upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return data.publicUrl;
}

export async function deleteStoryDb(storyId: string): Promise<void> {
  const supabase = getSupabase();
  await supabase.from("stories").delete().eq("id", storyId);
}

/* ---- Friends (for group member picker) ---- */

/** Search only among my friends. */
export async function searchFriends(query: string): Promise<DbProfile[]> {
  const supabase = getSupabase();
  const myId = await getMyUserId();
  const q = query.trim();
  if (!q || !myId) return [];
  const friendIds = await getFriendIds().catch(() => [] as string[]);
  if (friendIds.length === 0) return [];
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
    .in("id", friendIds)
    .neq("id", myId)
    .limit(20);
  if (error) throw error;
  return (data ?? []) as DbProfile[];
}

/** Get full profiles for my friends. */
export async function getFriendProfiles(): Promise<DbProfile[]> {
  const supabase = getSupabase();
  const myId = await getMyUserId();
  if (!myId) return [];
  const friendIds = await getFriendIds().catch(() => [] as string[]);
  if (friendIds.length === 0) return [];
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .in("id", friendIds)
    .limit(100);
  if (error) throw error;
  return (data ?? []) as DbProfile[];
}
