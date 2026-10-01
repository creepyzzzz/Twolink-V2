/**
 * Fable store — live Supabase backing, zero mock data.
 *
 * Chat list, people directory, threads, receipts, stories, scheduled
 * messages and groups all come from the backend (`src/lib/chat.ts`).
 * The public action names are unchanged so screens keep working; actions
 * that hit the network are now async.
 */
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { createMMKV } from "react-native-mmkv";
import {
  type DocumentAttachment,
  type Message,
  type MessageStatus,
  type ReplyQuote,
} from "./messages";
import type { ScheduledMessage } from "./scheduled";
import {
  AVATAR_FACES,
  faceForAvatarUrl,
  photoForAvatarUrl,
  type AvatarFace,
  type Person,
} from "./people";
import { unreadCount } from "./unread";
import {
  addGroupMembers as addGroupMembersDb,
  cancelScheduledDb,
  createGroupChat,
  deleteMessageForEveryoneDb,
  deleteStoryDb,
  editMessageDb,
  ensureProfile,
  fetchChats,
  fetchMessageById,
  fetchMessages,
  fetchProfiles,
  fetchReceiptRollup,
  fetchReactions,
  fetchScheduledDb,
  fetchStories,
  flushDueScheduledDb,
  getMyUserId,
  hideAllMessagesDb,
  hideMessageDb,
  markChatRead,
  markDelivered,
  postStoryDb,
  removeGroupMember as removeGroupMemberDb,
  scheduleMessageDb,
  sendMessage,
  setChatLastReadAt,
  setChatMuted,
  setChatPinned,
  setDisappearing as setDisappearingDb,
  setGroupAdmin as setGroupAdminDb,
  setGroupName as setGroupNameDb,
  signedMediaUrl,
  subscribeToChatEvents,
  toggleReactionDb,
  updateMyProfile,
  uploadAvatar,
  uploadChatMedia,
  uploadStoryMedia,
  formatMessageTime,
  type ChatRow,
  type DbMessage,
  type DbProfile,
  type DbScheduled,
  type DbReceipt,
  type StoryItem,
} from "../../../lib/chat";

/** Re-exported for screens/components that consume live stories. */
export type { StoryItem } from "../../../lib/chat";

const storage = createMMKV({ id: "fable-local-v1" });
let sequence = 0;

/** Maps a live profile row to the UI Person shape. */
export function dbProfileToPerson(p: DbProfile): Person {
  const display = p.display_name?.trim() || "Unknown";
  return {
    id: p.id,
    name: display,
    first: display.split(" ")[0] || "Unknown",
    avatar: faceForAvatarUrl(p.avatar_url, p.id),
    photoUrl: photoForAvatarUrl(p.avatar_url),
    username: p.username,
    about: p.about,
  };
}

export type Profile = {
  name: string;
  about: string;
  face: AvatarFace;
  /** Optional photo-library avatar; takes precedence over `face`. */
  photoUri?: string;
};
export type AppSettings = {
  readReceipts: boolean;
  typingIndicators: boolean;
  notifications: boolean;
};
export type Group = {
  id: string;
  name: string;
  memberIds: string[];
  /** User ids that may rename the group, manage members, and add people. */
  adminIds: string[];
  createdAt: number;
};
/** Prototype-safe group lookup (ids like "constructor" must not match). */
export function getGroup(
  groups: Record<string, Group>,
  id: string,
): Group | undefined {
  return Object.prototype.hasOwnProperty.call(groups, id)
    ? groups[id]
    : undefined;
}
/**
 * Chat-row/header title for a group: the set name wins; when no name is set
 * it falls back to the members' first names (WhatsApp-style).
 */
export function groupDisplayName(
  group: Group,
  people: Record<string, Person>,
  myId: string | null,
): string {
  if (group.name.trim()) return group.name;
  const names = group.memberIds
    .map((id) => (id === myId ? "You" : people[id]?.first))
    .filter((n): n is string => !!n);
  return names.length > 0 ? names.join(", ") : "Group";
}
/** Groups created before admins existed treat the owner as sole admin. */
export function groupAdminIds(group: Group): string[] {
  const ids = group.adminIds ?? [];
  return ids.length > 0 ? ids : [];
}
export function isGroupAdmin(group: Group, personId: string): boolean {
  return groupAdminIds(group).includes(personId);
}
/** Per-thread chat wallpaper: photo-library URI plus edit adjustments. */
export type Wallpaper = {
  uri: string;
  /** 0..1 — image opacity over the panel. */
  opacity: number;
  /** 0..1 — mapped to blurRadius 0..25. */
  blur: number;
};

/** One button in the in-window glass alert. */
export type GlassAlertAction = {
  text: string;
  style?: "default" | "cancel" | "destructive";
  onPress?: () => void;
};

/** Spec for the in-window glass alert (replaces the platform Alert). */
export type GlassAlertSpec = {
  title: string;
  message?: string;
  actions: GlassAlertAction[];
};

/**
 * Reads a stored wallpaper, tolerating the plain-URI shape written before
 * the editor existed.
 */
export function normalizeWallpaper(
  raw: string | Wallpaper | undefined,
): Wallpaper | undefined {
  if (!raw) return undefined;
  return typeof raw === "string"
    ? { uri: raw, opacity: 1, blur: 0 }
    : raw;
}

/* ------------------------------------------------------------------ */
/* DB → UI mapping                                                     */
/* ------------------------------------------------------------------ */

const signedCache = new Map<string, string>();
async function signedUrlFor(path: string): Promise<string | undefined> {
  const hit = signedCache.get(path);
  if (hit) return hit;
  try {
    const url = await signedMediaUrl(path);
    signedCache.set(path, url);
    return url;
  } catch {
    return undefined;
  }
}

function previewForMessage(m: Message): string {
  if (m.deletedForEveryone) return "This message was deleted";
  if (m.photo) return "Photo";
  if (m.document) return m.document.name || "File";
  return m.text;
}

function sortChats(rows: ChatRow[]): ChatRow[] {
  return [...rows].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.previewAtMs - a.previewAtMs;
  });
}

type State = {
  /* ---- live identity ---- */
  /** My Supabase user id (uuid). Null until bootstrap. */
  myId: string | null;
  bootstrapped: boolean;
  /** Loads profile, chats, stories, scheduled; starts realtime. Idempotent. */
  bootstrap: () => Promise<void>;
  /** Stops realtime and clears live state (logout). */
  shutdown: () => void;

  /* ---- live directory ---- */
  /** Inbox rows from Supabase, pinned-first then most-recent. */
  chats: ChatRow[];
  chatsLoaded: boolean;
  refreshChats: () => Promise<void>;
  /** All known users by id (chat members + me). */
  people: Record<string, Person>;

  /* ---- live threads ---- */
  threads: Record<string, Message[]>;
  threadsLoaded: Record<string, boolean>;
  historyExhausted: Record<string, boolean>;
  /** Loads a chat's messages on demand (no-op when already loaded). */
  ensureThread: (id: string) => Promise<void>;
  /** Prepends the next older page; no-op when exhausted. */
  loadEarlier: (id: string) => Promise<void>;

  /* ---- live stories ---- */
  stories: StoryItem[];
  refreshStories: () => Promise<void>;
  postStory: (uri: string) => Promise<void>;
  removeStory: (id: string) => Promise<void>;

  /* ---- the rest (same names as before) ---- */
  lastRead: Record<string, string>;
  openThreadId: string | null;
  setOpenThread: (id: string | null) => void;
  muted: Record<string, boolean>;
  pinned: string[];
  deleted: string[];
  drafts: Record<string, string>;
  groups: Record<string, Group>;
  createGroup: (name: string, memberIds: string[]) => Promise<string>;
  addGroupMembers: (groupId: string, memberIds: string[]) => Promise<void>;
  setGroupName: (groupId: string, name: string) => Promise<void>;
  removeGroupMember: (groupId: string, memberId: string) => Promise<void>;
  setGroupAdmin: (
    groupId: string,
    memberId: string,
    admin: boolean,
  ) => Promise<void>;
  theme: "system" | "light" | "dark";
  profile: Profile;
  setProfile: (patch: Partial<Profile>) => void;
  settings: AppSettings;
  setSettings: (patch: Partial<AppSettings>) => void;
  append: (
    id: string,
    text: string,
    from?: Message["from"],
    photo?: boolean,
    opts?: {
      photoUri?: string;
      replyTo?: ReplyQuote;
      document?: DocumentAttachment;
    },
  ) => Promise<void>;
  /** Forwards a message's content to another chat as a new outgoing message. */
  forwardMessage: (targetChatId: string, message: Message) => Promise<void>;
  markRead: (id: string) => void;
  toggleRead: (id: string) => void;
  scheduled: ScheduledMessage[];
  scheduleMessage: (
    threadId: string,
    text: string,
    at: number,
    replyTo?: ReplyQuote,
  ) => Promise<void>;
  cancelScheduled: (id: string) => Promise<void>;
  flushScheduled: () => Promise<void>;
  deleteMessage: (
    id: string,
    messageId: string,
    scope: "me" | "everyone",
  ) => Promise<void>;
  editMessage: (id: string, messageId: string, text: string) => Promise<void>;
  setMessageStatus: (
    id: string,
    messageId: string,
    status: MessageStatus,
  ) => void;
  clearThread: (id: string) => Promise<void>;
  wallpapers: Record<string, string | Wallpaper>;
  setWallpaper: (id: string, wallpaper: Wallpaper | null) => void;
  pendingWallpaper: { threadId: string; uri: string } | null;
  setPendingWallpaper: (
    pending: { threadId: string; uri: string } | null,
  ) => void;
  alert: GlassAlertSpec | null;
  showAlert: (spec: GlassAlertSpec) => void;
  dismissAlert: () => void;
  setTheme: (theme: State["theme"]) => void;
  toggleReaction: (
    id: string,
    messageId: string,
    emoji: string,
  ) => Promise<void>;
  toggleMute: (id: string) => Promise<void>;
  togglePin: (id: string) => Promise<void>;
  deleteThread: (id: string) => Promise<void>;
  setDraft: (id: string, text: string) => void;
  disappearing: Record<string, number>;
  setDisappearing: (id: string, ms: number) => Promise<void>;
  appPin: string | null;
  setAppPin: (pin: string | null) => void;
  appUnlocked: boolean;
  setAppUnlocked: (unlocked: boolean) => void;
  onboarded: boolean;
  setOnboarded: (done: boolean) => void;
  sweepExpired: () => void;
  reset: () => void;
};
/** WhatsApp-style disappearing-message presets (label + lifetime ms). */
export const DAY_MS = 86_400_000;
export const DISAPPEARING_OPTIONS = [
  { label: "Off", ms: 0 },
  { label: "24 hours", ms: DAY_MS },
  { label: "7 days", ms: 7 * DAY_MS },
  { label: "90 days", ms: 90 * DAY_MS },
] as const;

/** Full message list for a thread (live only — no seeds). */
function threadMessages(
  state: Pick<State, "threads">,
  id: string,
): Message[] {
  return state.threads[id] ?? [];
}

/** Maps one DB row to the UI Message shape. */
async function mapDbMessage(row: DbMessage, st: State): Promise<Message> {
  const myId = st.myId ?? "";
  const from = row.sender_id === myId ? "me" : "them";
  const chat = st.chats.find((c) => c.id === row.chat_id);

  let photoUri: string | undefined;
  let document: DocumentAttachment | undefined;
  if (row.media_url) {
    const remote = row.media_url.startsWith("http")
      ? row.media_url
      : await signedUrlFor(row.media_url);
    if (row.kind === "image") photoUri = remote;
    else if (row.kind === "document" && remote) {
      document = {
        name: row.media_name ?? "File",
        size: row.media_size ?? 0,
        mimeType: row.mime_type ?? "application/octet-stream",
        uri: remote,
      };
    }
  }

  let replyTo: ReplyQuote | undefined;
  if (row.reply_to) {
    const cached = (st.threads[row.chat_id] ?? []).find(
      (m) => m.id === row.reply_to,
    );
    if (cached) {
      replyTo = {
        id: cached.id,
        from: cached.from,
        text: cached.text,
        photo: cached.photo,
      };
    } else {
      const q = await fetchMessageById(row.reply_to).catch(() => null);
      if (q) {
        replyTo = {
          id: q.id,
          from: q.sender_id === myId ? "me" : "them",
          text: q.deleted_for_everyone ? "" : (q.body ?? ""),
          photo: q.kind === "image",
        };
      }
    }
  }

  const createdAtMs = new Date(row.created_at).getTime();
  const disappearingMs = chat?.disappearingMs ?? 0;
  return {
    id: row.id,
    from,
    text: row.deleted_for_everyone ? "" : (row.body ?? ""),
    at: formatMessageTime(row.created_at),
    createdAtMs,
    ...(from === "them" && row.sender_id
      ? { senderId: row.sender_id }
      : {}),
    ...(row.kind === "image" ? { photo: true as const } : {}),
    ...(photoUri ? { photoUri } : {}),
    ...(document ? { document } : {}),
    ...(replyTo ? { replyTo } : {}),
    ...(row.edited_at ? { edited: true as const } : {}),
    ...(row.deleted_for_everyone
      ? { deletedForEveryone: true as const }
      : {}),
    // Outgoing messages start at one tick; realtime receipts advance them.
    ...(from === "me" ? { status: "sent" as const } : {}),
    ...(disappearingMs > 0
      ? { expiresAt: createdAtMs + disappearingMs }
      : {}),
  };
}

function mapDbScheduled(row: DbScheduled): ScheduledMessage {
  return {
    id: row.id,
    threadId: row.chat_id,
    text: row.body ?? "",
    at: new Date(row.scheduled_for).getTime(),
  };
}

/* ------------------------------------------------------------------ */
/* Realtime event routing (module scope — one subscription per session) */
/* ------------------------------------------------------------------ */

let liveUnsub: (() => void) | null = null;
let bootstrapPromise: Promise<void> | null = null;
let chatRefreshTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleChatRefresh() {
  if (chatRefreshTimer) clearTimeout(chatRefreshTimer);
  chatRefreshTimer = setTimeout(() => {
    chatRefreshTimer = null;
    void useFable.getState().refreshChats().catch(() => {});
  }, 900);
}

async function handleIncomingMessage(row: DbMessage) {
  const st = useFable.getState();
  const myId = st.myId;
  if (!myId) return;
  // New chat I wasn't tracking (someone added me) → refresh the list.
  if (!st.chats.some((c) => c.id === row.chat_id)) {
    await st.refreshChats().catch(() => {});
  }
  const cur = useFable.getState();
  const list = cur.threads[row.chat_id] ?? [];
  if (list.some((m) => m.id === row.id)) return; // dedupe

  const mapped = await mapDbMessage(row, cur).catch(() => null);
  if (!mapped) return;

  if (row.sender_id === myId) {
    // My own echo: replace the optimistic pending bubble when found.
    useFable.setState((s) => {
      const current = [...(s.threads[row.chat_id] ?? [])];
      const pendIdx = current.findIndex(
        (m) =>
          m.id.startsWith("pending-") &&
          m.text === mapped.text &&
          m.from === "me",
      );
      if (pendIdx >= 0) current[pendIdx] = { ...mapped, status: current[pendIdx].status ?? "sent" };
      else current.push(mapped);
      return {
        threads: { ...s.threads, [row.chat_id]: current },
      };
    });
    return;
  }

  useFable.setState((s) => ({
    threads: {
      ...s.threads,
      [row.chat_id]: [...(s.threads[row.chat_id] ?? []), mapped],
    },
    // A chat with a new arrival reappears in the inbox.
    deleted: s.deleted.filter((d) => d !== row.chat_id),
  }));
  // Real delivery receipt — this is what turns the sender's ticks.
  void markDelivered([row.id]).catch(() => {});
  const open = useFable.getState().openThreadId === row.chat_id;
  useFable.setState((s) => ({
    chats: sortChats(
      s.chats.map((c) =>
        c.id === row.chat_id
          ? {
              ...c,
              preview: previewForMessage(mapped),
              previewAt: mapped.at,
              previewAtMs: mapped.createdAtMs ?? Date.now(),
              previewFromMe: false,
              unread: open ? 0 : c.unread + 1,
            }
          : c,
      ),
    ),
  }));
  if (open) useFable.getState().markRead(row.chat_id);
}

async function handleMessageUpdate(row: DbMessage) {
  const st = useFable.getState();
  const list = st.threads[row.chat_id];
  if (!list || !list.some((m) => m.id === row.id)) return;
  const mapped = await mapDbMessage(row, st).catch(() => null);
  if (!mapped) return;
  useFable.setState((s) => ({
    threads: {
      ...s.threads,
      [row.chat_id]: (s.threads[row.chat_id] ?? []).map((m) =>
        m.id === row.id ? { ...mapped, status: m.status ?? mapped.status } : m,
      ),
    },
  }));
  // Keep the inbox preview in sync with edits/deletes.
  useFable.setState((s) => ({
    chats: s.chats.map((c) =>
      c.id === row.chat_id &&
      c.previewAtMs <= (mapped.createdAtMs ?? 0) + 1000 &&
      c.previewAtMs >= (mapped.createdAtMs ?? 0) - 1000
        ? { ...c, preview: previewForMessage(mapped) }
        : c,
    ),
  }));
}

async function handleReceipt(r: DbReceipt) {
  const st = useFable.getState();
  const myId = st.myId;
  if (!myId || r.user_id === myId) return;
  for (const [chatId, list] of Object.entries(st.threads)) {
    const m = list.find((x) => x.id === r.message_id && x.from === "me");
    if (!m) continue;
    const chat = st.chats.find((c) => c.id === chatId);
    const rollup = await fetchReceiptRollup(
      [r.message_id],
      chat?.memberCount ?? 2,
    ).catch(() => null);
    const res = rollup?.[r.message_id];
    if (!res) continue;
    const status: MessageStatus = res.read
      ? "read"
      : res.delivered
        ? "delivered"
        : "sent";
    if (m.status === status) continue;
    useFable.setState((s) => ({
      threads: {
        ...s.threads,
        [chatId]: (s.threads[chatId] ?? []).map((x) =>
          x.id === r.message_id ? { ...x, status } : x,
        ),
      },
    }));
    break;
  }
}

/* ------------------------------------------------------------------ */

export const useFable = create<State>()(
  persist(
    (set, get) => ({
      myId: null,
      bootstrapped: false,
      bootstrap: () => {
        if (!bootstrapPromise) {
          bootstrapPromise = (async () => {
            try {
              const myId = await getMyUserId();
              if (!myId) return;
              const prof = await ensureProfile();
              const faceKey = prof.avatar_url?.startsWith("face:")
                ? prof.avatar_url.slice(5)
                : null;
              set({
                myId,
                profile: {
                  name: prof.display_name || "You",
                  about: prof.about || "",
                  face:
                    faceKey && faceKey in AVATAR_FACES
                      ? (faceKey as AvatarFace)
                      : "me",
                  ...(prof.avatar_url?.startsWith("http")
                    ? { photoUri: prof.avatar_url }
                    : {}),
                },
              });
              await get().refreshChats();
              await get().refreshStories();
              const sched = await fetchScheduledDb().catch(
                () => [] as DbScheduled[],
              );
              set({ scheduled: sched.map(mapDbScheduled) });
              void get().flushScheduled().catch(() => {});
              if (liveUnsub) liveUnsub();
              liveUnsub = subscribeToChatEvents({
                onMessage: (row) => void handleIncomingMessage(row),
                onMessageUpdate: (row) => void handleMessageUpdate(row),
                onReceipt: (r) => void handleReceipt(r),
                onChatChange: () => scheduleChatRefresh(),
              });
              set({ bootstrapped: true });
            } finally {
              if (!get().bootstrapped) bootstrapPromise = null;
            }
          })();
        }
        return bootstrapPromise;
      },
      shutdown: () => {
        if (liveUnsub) {
          liveUnsub();
          liveUnsub = null;
        }
        bootstrapPromise = null;
        set({
          myId: null,
          bootstrapped: false,
          chats: [],
          chatsLoaded: false,
          people: {},
          threads: {},
          threadsLoaded: {},
          historyExhausted: {},
          stories: [],
          scheduled: [],
          groups: {},
          lastRead: {},
          openThreadId: null,
          muted: {},
          pinned: [],
          disappearing: {},
        });
      },

      chats: [],
      chatsLoaded: false,
      refreshChats: async () => {
        const myId = get().myId ?? (await getMyUserId().catch(() => null));
        if (!myId) return;
        if (!get().myId) set({ myId });
        const rows = await fetchChats();
        const deleted = get().deleted;
        const chats = sortChats(rows.filter((r) => !deleted.includes(r.id)));
        // People directory: me + every member of my chats.
        const ids = new Set<string>([myId]);
        for (const c of chats) for (const m of c.memberIds) ids.add(m);
        const profiles = await fetchProfiles([...ids]).catch(() => []);
        const people: Record<string, Person> = {};
        for (const p of profiles) {
          const display = p.display_name?.trim() || "Unknown";
          people[p.id] = {
            id: p.id,
            name: display,
            first: display.split(" ")[0] || "Unknown",
            avatar: faceForAvatarUrl(p.avatar_url, p.id),
            photoUrl: photoForAvatarUrl(p.avatar_url),
            username: p.username,
            about: p.about,
          };
        }
        const groups: Record<string, Group> = {};
        const muted: Record<string, boolean> = {};
        const pinned: string[] = [];
        const disappearing: Record<string, number> = {};
        for (const c of chats) {
          if (c.type === "group") {
            const adminIds = Object.entries(c.roles)
              .filter(([, r]) => r === "creator" || r === "admin")
              .map(([uid]) => uid);
            groups[c.id] = {
              id: c.id,
              name: c.name,
              memberIds: c.memberIds,
              adminIds: adminIds.length > 0 ? adminIds : [myId],
              createdAt: c.previewAtMs,
            };
          }
          if (c.muted) muted[c.id] = true;
          if (c.pinned) pinned.push(c.id);
          if (c.disappearingMs > 0) disappearing[c.id] = c.disappearingMs;
        }
        set({ chats, people, groups, muted, pinned, disappearing, chatsLoaded: true });
      },
      people: {},

      threads: {},
      threadsLoaded: {},
      historyExhausted: {},
      ensureThread: async (id) => {
        const st = get();
        if (st.threadsLoaded[id] || !st.myId) return;
        set((s) => ({
          threadsLoaded: { ...s.threadsLoaded, [id]: true },
        }));
        try {
          const rows = await fetchMessages(id);
          const cur = get();
          const chat = cur.chats.find((c) => c.id === id);
          const myMsgIds = rows
            .filter((r) => r.sender_id === cur.myId)
            .map((r) => r.id);
          const [rollup, reactions] = await Promise.all([
            fetchReceiptRollup(myMsgIds, chat?.memberCount ?? 2).catch(
              () => ({} as Record<string, { delivered: boolean; read: boolean }>),
            ),
            fetchReactions(rows.map((r) => r.id)).catch(
              () => ({} as Record<string, string[]>),
            ),
          ]);
          const msgs: Message[] = [];
          for (const row of rows) {
            const m = await mapDbMessage(row, get()).catch(() => null);
            if (!m) continue;
            const r = rollup[row.id];
            if (m.from === "me" && r) {
              m.status = r.read ? "read" : r.delivered ? "delivered" : "sent";
            }
            const rx = reactions[row.id];
            if (rx && rx.length > 0) m.reactions = [...new Set(rx)];
            msgs.push(m);
          }
          // Seed lastRead from the DB read marker so "mark unread" math works.
          const lastReadAt = chat?.lastReadAt
            ? new Date(chat.lastReadAt).getTime()
            : 0;
          let marker: string | undefined;
          for (let i = msgs.length - 1; i >= 0; i--) {
            if ((msgs[i].createdAtMs ?? 0) <= lastReadAt) {
              marker = msgs[i].id;
              break;
            }
          }
          set((s) => ({
            threads: { ...s.threads, [id]: msgs },
            ...(marker && !s.lastRead[id]
              ? { lastRead: { ...s.lastRead, [id]: marker } }
              : {}),
          }));
        } catch {
          set((s) => ({
            threadsLoaded: { ...s.threadsLoaded, [id]: false },
          }));
        }
      },
      loadEarlier: async (id) => {
        const st = get();
        if (st.historyExhausted[id] || !st.myId) return;
        const current = st.threads[id] ?? [];
        if (current.length === 0) {
          await st.ensureThread(id);
          return;
        }
        const beforeMs = current[0].createdAtMs;
        if (!beforeMs) {
          set((s) => ({
            historyExhausted: { ...s.historyExhausted, [id]: true },
          }));
          return;
        }
        const rows = await fetchMessages(id, {
          before: new Date(beforeMs).toISOString(),
        }).catch(() => [] as DbMessage[]);
        if (rows.length === 0) {
          set((s) => ({
            historyExhausted: { ...s.historyExhausted, [id]: true },
          }));
          return;
        }
        const cur = get();
        const chat = cur.chats.find((c) => c.id === id);
        const myMsgIds = rows
          .filter((r) => r.sender_id === cur.myId)
          .map((r) => r.id);
        const [rollup, reactions] = await Promise.all([
          fetchReceiptRollup(myMsgIds, chat?.memberCount ?? 2).catch(
            () => ({} as Record<string, { delivered: boolean; read: boolean }>),
          ),
          fetchReactions(rows.map((r) => r.id)).catch(
            () => ({} as Record<string, string[]>),
          ),
        ]);
        const older: Message[] = [];
        for (const row of rows) {
          const m = await mapDbMessage(row, get()).catch(() => null);
          if (!m) continue;
          const r = rollup[row.id];
          if (m.from === "me" && r) {
            m.status = r.read ? "read" : r.delivered ? "delivered" : "sent";
          }
          const rx = reactions[row.id];
          if (rx && rx.length > 0) m.reactions = [...new Set(rx)];
          older.push(m);
        }
        set((s) => ({
          threads: {
            ...s.threads,
            [id]: [...older, ...(s.threads[id] ?? [])],
          },
        }));
      },

      stories: [],
      refreshStories: async () => {
        const stories = await fetchStories().catch(() => [] as StoryItem[]);
        set({ stories });
      },
      postStory: async (uri) => {
        const url = await uploadStoryMedia(uri);
        await postStoryDb(url);
        await get().refreshStories();
      },
      removeStory: async (id) => {
        await deleteStoryDb(id).catch(() => {});
        set((s) => ({ stories: s.stories.filter((x) => x.id !== id) }));
      },

      lastRead: {},
      openThreadId: null,
      setOpenThread: (id) => {
        set({ openThreadId: id });
        if (id) void get().ensureThread(id).catch(() => {});
      },
      muted: {},
      pinned: [],
      drafts: {},
      deleted: [],
      groups: {},
      disappearing: {},
      setDisappearing: async (id, ms) => {
        set((state) => {
          const disappearing = { ...state.disappearing };
          if (ms > 0) disappearing[id] = ms;
          else delete disappearing[id];
          return {
            disappearing,
            chats: state.chats.map((c) =>
              c.id === id ? { ...c, disappearingMs: ms } : c,
            ),
          };
        });
        try {
          await setDisappearingDb(id, ms);
        } catch {
          get().showAlert({
            title: "Couldn't update",
            message: "The disappearing timer didn't save. Try again.",
            actions: [{ text: "OK", style: "default" }],
          });
        }
      },
      appPin: null,
      setAppPin: (pin) => set({ appPin: pin }),
      appUnlocked: false,
      setAppUnlocked: (unlocked) => set({ appUnlocked: unlocked }),
      onboarded: false,
      setOnboarded: (done) => set({ onboarded: done }),
      sweepExpired: () => {
        const now = Date.now();
        set((state) => {
          let changed = false;
          const threads: Record<string, Message[]> = { ...state.threads };
          const lastRead = { ...state.lastRead };
          for (const id of Object.keys(threads)) {
            const kept = threads[id].filter(
              (m) => !(m.expiresAt != null && m.expiresAt <= now),
            );
            if (kept.length === threads[id].length) continue;
            changed = true;
            threads[id] = kept;
            const marker = lastRead[id];
            if (marker && !kept.some((m) => m.id === marker)) {
              const fallback = kept.at(-1);
              if (fallback) lastRead[id] = fallback.id;
              else delete lastRead[id];
            }
          }
          return changed ? { threads, lastRead } : state;
        });
      },
      createGroup: async (name, memberIds) => {
        const id = await createGroupChat(name, memberIds);
        await get().refreshChats();
        return id;
      },
      setGroupName: async (groupId, name) => {
        const group = getGroup(get().groups, groupId);
        if (!group || !isGroupAdmin(group, get().myId ?? "")) return;
        await setGroupNameDb(groupId, name);
        await get().refreshChats();
      },
      removeGroupMember: async (groupId, memberId) => {
        const group = getGroup(get().groups, groupId);
        if (!group || !isGroupAdmin(group, get().myId ?? "")) return;
        const admins = groupAdminIds(group);
        if (admins.includes(memberId) && admins.length === 1) return;
        await removeGroupMemberDb(groupId, memberId);
        await get().refreshChats();
      },
      setGroupAdmin: async (groupId, memberId, admin) => {
        const group = getGroup(get().groups, groupId);
        if (!group || !isGroupAdmin(group, get().myId ?? "")) return;
        if (!group.memberIds.includes(memberId)) return;
        const admins = groupAdminIds(group);
        if (admin && admins.includes(memberId)) return;
        if (!admin && admins.length === 1 && admins[0] === memberId) return;
        await setGroupAdminDb(groupId, memberId, admin);
        await get().refreshChats();
      },
      addGroupMembers: async (groupId, memberIds) => {
        const group = getGroup(get().groups, groupId);
        if (!group || !isGroupAdmin(group, get().myId ?? "")) return;
        const fresh = memberIds.filter((m) => !group.memberIds.includes(m));
        if (fresh.length === 0) return;
        await addGroupMembersDb(groupId, fresh);
        await get().refreshChats();
      },
      theme: "system",
      profile: {
        name: "You",
        about: "Hey there! I'm using Poffu.",
        face: "me",
      },
      setProfile: (patch) => {
        set((state) => ({ profile: { ...state.profile, ...patch } }));
        // Best-effort background sync of name/about/avatar to Supabase.
        void (async () => {
          try {
            if (!get().myId) return;
            const dbPatch: Record<string, string> = {};
            if (patch.name !== undefined) dbPatch.display_name = patch.name;
            if (patch.about !== undefined) dbPatch.about = patch.about;
            if (patch.face !== undefined && patch.photoUri === undefined)
              dbPatch.avatar_url = `face:${patch.face}`;
            if (
              patch.photoUri !== undefined &&
              patch.photoUri.startsWith("file:")
            ) {
              const url = await uploadAvatar(patch.photoUri);
              dbPatch.avatar_url = url;
              set((s) => ({
                profile: { ...s.profile, photoUri: url },
              }));
            } else if (
              patch.photoUri !== undefined &&
              patch.photoUri.startsWith("http")
            ) {
              dbPatch.avatar_url = patch.photoUri;
            }
            if (Object.keys(dbPatch).length > 0)
              await updateMyProfile(dbPatch);
          } catch {
            /* profile sync is best-effort */
          }
        })();
      },
      settings: {
        readReceipts: true,
        typingIndicators: true,
        notifications: true,
      },
      setSettings: (patch) =>
        set((state) => ({ settings: { ...state.settings, ...patch } })),
      append: async (id, text, from = "me", photo = false, opts) => {
        const st = get();
        if (!st.myId || from !== "me") return;
        if (!photo && !text.trim() && !opts?.document) return;
        const tempId = `pending-${Date.now()}-${++sequence}`;
        const lifetime =
          st.chats.find((c) => c.id === id)?.disappearingMs ?? 0;
        const optimistic: Message = {
          id: tempId,
          from: "me",
          text:
            opts?.document && !text.trim() ? opts.document.name : text.trim(),
          at: "now",
          createdAtMs: Date.now(),
          photo,
          ...(opts?.photoUri ? { photoUri: opts.photoUri } : {}),
          ...(opts?.replyTo ? { replyTo: opts.replyTo } : {}),
          ...(opts?.document ? { document: opts.document } : {}),
          ...(lifetime > 0 ? { expiresAt: Date.now() + lifetime } : {}),
          status: "sent",
        };
        set((state) => ({
          threads: {
            ...state.threads,
            [id]: [...(state.threads[id] ?? []), optimistic],
          },
          ...(state.openThreadId === id
            ? { lastRead: { ...state.lastRead, [id]: tempId } }
            : {}),
        }));
        try {
          let kind: "text" | "image" | "document" = "text";
          let mediaUrl: string | undefined;
          let mediaName: string | undefined;
          let mediaSize: number | undefined;
          let mimeType: string | undefined;
          if (photo && opts?.photoUri) {
            const up = await uploadChatMedia(
              id,
              opts.photoUri,
              `photo-${Date.now()}.jpg`,
              "image/jpeg",
            );
            kind = "image";
            mediaUrl = up.url;
            mediaName = up.name;
            mediaSize = up.size;
            mimeType = "image/jpeg";
          } else if (opts?.document && opts.document.uri) {
            const up = await uploadChatMedia(
              id,
              opts.document.uri,
              opts.document.name,
              opts.document.mimeType,
            );
            kind = "document";
            mediaUrl = up.url;
            mediaName = up.name;
            mediaSize = up.size;
            mimeType = opts.document.mimeType;
          }
          const row = await sendMessage(id, {
            body: text.trim() || (mediaName ?? ""),
            kind,
            mediaUrl,
            mediaName,
            mediaSize,
            mimeType,
            replyTo: opts?.replyTo?.id ?? null,
          });
          const mapped = await mapDbMessage(row, get()).catch(() => null);
          set((state) => {
            const list = (state.threads[id] ?? []).map((m) =>
              m.id === tempId
                ? { ...(mapped ?? m), id: row.id, status: "sent" as const }
                : m,
            );
            const lastRead =
              state.openThreadId === id
                ? { ...state.lastRead, [id]: row.id }
                : state.lastRead;
            return { threads: { ...state.threads, [id]: list }, lastRead };
          });
          // The inbox preview follows immediately (realtime also confirms).
          const previewText =
            kind === "image"
              ? "Photo"
              : kind === "document"
                ? (mediaName ?? "File")
                : text.trim();
          set((s) => ({
            chats: sortChats(
              s.chats.map((c) =>
                c.id === id
                  ? {
                      ...c,
                      preview: previewText,
                      previewAt: "now",
                      previewAtMs: Date.now(),
                      previewFromMe: true,
                    }
                  : c,
              ),
            ),
          }));
        } catch {
          set((state) => ({
            threads: {
              ...state.threads,
              [id]: (state.threads[id] ?? []).filter(
                (m) => m.id !== tempId,
              ),
            },
          }));
          get().showAlert({
            title: "Couldn't send",
            message: "Check your connection and try again.",
            actions: [{ text: "OK", style: "default" }],
          });
        }
      },
      forwardMessage: async (targetChatId, message) => {
        if (message.deletedForEveryone) return;
        const st = get();
        if (message.photo && message.photoUri) {
          await st.append(targetChatId, "", "me", true, {
            photoUri: message.photoUri,
          });
        } else if (message.document) {
          await st.append(targetChatId, message.document.name, "me", false, {
            document: message.document,
          });
        } else if (message.text.trim()) {
          await st.append(targetChatId, message.text, "me", false);
        }
      },
      markRead: (id) => {
        const state = get();
        const last = threadMessages(state, id).at(-1);
        if (last && state.lastRead[id] !== last.id) {
          set({ lastRead: { ...state.lastRead, [id]: last.id } });
          void markChatRead(id).catch(() => {});
        }
      },
      toggleRead: (id) => {
        const state = get();
        const messages = threadMessages(state, id);
        if (unreadCount(messages, state.lastRead[id]) > 0) {
          get().markRead(id);
          return;
        }
        // Mark unread: rewind to just before the latest incoming message.
        let idx = messages.length - 1;
        while (idx >= 0 && messages[idx].from === "me") idx--;
        if (idx < 0) return;
        const prev = messages[idx - 1];
        const newMarker = prev?.id;
        set((s) => {
          const lastRead = { ...s.lastRead };
          if (newMarker) lastRead[id] = newMarker;
          else delete lastRead[id];
          return { lastRead };
        });
        // Persist the rewind so the inbox badge agrees.
        const atMs = prev?.createdAtMs;
        void setChatLastReadAt(
          id,
          atMs ? new Date(atMs).toISOString() : null,
        ).catch(() => {});
        void get().refreshChats().catch(() => {});
      },
      toggleReaction: async (id, messageId, emoji) => {
        try {
          const added = await toggleReactionDb(messageId, emoji);
          set((state) => ({
            threads: {
              ...state.threads,
              [id]: (state.threads[id] ?? []).map((m) =>
                m.id === messageId
                  ? {
                      ...m,
                      reactions: added
                        ? [...(m.reactions ?? []), emoji]
                        : (m.reactions ?? []).filter((e) => e !== emoji),
                    }
                  : m,
              ),
            },
          }));
        } catch {
          get().showAlert({
            title: "Reactions aren't available yet",
            message:
              "They'll switch on automatically once the next backend update rolls out.",
            actions: [{ text: "OK", style: "default" }],
          });
        }
      },
      setTheme: (theme) => set({ theme }),
      deleteMessage: async (id, messageId, scope) => {
        try {
          if (scope === "everyone") await deleteMessageForEveryoneDb(messageId);
          else await hideMessageDb(messageId);
        } catch {
          get().showAlert({
            title: "Couldn't delete",
            message: "Check your connection and try again.",
            actions: [{ text: "OK", style: "default" }],
          });
          return;
        }
        set((state) => {
          const current = state.threads[id] ?? [];
          return {
            threads: {
              ...state.threads,
              [id]:
                scope === "everyone"
                  ? current.map((m) =>
                      m.id === messageId
                        ? {
                            ...m,
                            text: "",
                            photo: false,
                            photoUri: undefined,
                            document: undefined,
                            reactions: undefined,
                            replyTo: undefined,
                            deletedForEveryone: true,
                          }
                        : m,
                    )
                  : current.filter((m) => m.id !== messageId),
            },
          };
        });
      },
      editMessage: async (id, messageId, text) => {
        const trimmed = text.trim();
        if (!trimmed) return;
        try {
          await editMessageDb(messageId, trimmed);
        } catch {
          get().showAlert({
            title: "Couldn't edit",
            message: "Check your connection and try again.",
            actions: [{ text: "OK", style: "default" }],
          });
          return;
        }
        set((state) => ({
          threads: {
            ...state.threads,
            [id]: (state.threads[id] ?? []).map((m) =>
              m.id === messageId ? { ...m, text: trimmed, edited: true } : m,
            ),
          },
        }));
      },
      setMessageStatus: (id, messageId, status) =>
        set((state) => {
          const current = state.threads[id];
          if (!current) return state;
          return {
            threads: {
              ...state.threads,
              [id]: current.map((m) =>
                m.id === messageId && m.from === "me"
                  ? { ...m, status }
                  : m,
              ),
            },
          };
        }),
      toggleMute: async (id) => {
        const next = !get().muted[id];
        set((state) => ({
          muted: { ...state.muted, [id]: next },
          chats: state.chats.map((c) =>
            c.id === id ? { ...c, muted: next } : c,
          ),
        }));
        try {
          await setChatMuted(id, next);
        } catch {
          set((state) => ({
            muted: { ...state.muted, [id]: !next },
            chats: state.chats.map((c) =>
              c.id === id ? { ...c, muted: !next } : c,
            ),
          }));
        }
      },
      togglePin: async (id) => {
        const wasPinned = get().pinned.includes(id);
        const prevPinned = get().pinned;
        const next = wasPinned
          ? prevPinned.filter((p) => p !== id)
          : [id, ...prevPinned];
        set((state) => ({
          pinned: next,
          chats: sortChats(
            state.chats.map((c) =>
              c.id === id ? { ...c, pinned: !wasPinned } : c,
            ),
          ),
        }));
        try {
          await setChatPinned(id, !wasPinned);
        } catch {
          set((state) => ({
            pinned: prevPinned,
            chats: sortChats(
              state.chats.map((c) =>
                c.id === id ? { ...c, pinned: wasPinned } : c,
              ),
            ),
          }));
        }
      },
      deleteThread: async (id) => {
        // Delete-for-me across the whole thread; the chat stays so future
        // messages still arrive (and it reappears in the inbox then).
        await hideAllMessagesDb(id).catch(() => {});
        set((state) => {
          const threads = { ...state.threads };
          delete threads[id];
          const threadsLoaded = { ...state.threadsLoaded };
          delete threadsLoaded[id];
          const historyExhausted = { ...state.historyExhausted };
          delete historyExhausted[id];
          const drafts = { ...state.drafts };
          delete drafts[id];
          const lastRead = { ...state.lastRead };
          delete lastRead[id];
          const disappearing = { ...state.disappearing };
          delete disappearing[id];
          return {
            threads,
            threadsLoaded,
            historyExhausted,
            drafts,
            lastRead,
            disappearing,
            chats: state.chats.filter((c) => c.id !== id),
            deleted: state.deleted.includes(id)
              ? state.deleted
              : [...state.deleted, id],
            scheduled: state.scheduled.filter((m) => m.threadId !== id),
          };
        });
      },
      setDraft: (id, text) =>
        set((state) => {
          if ((state.drafts[id] ?? "") === text) return state;
          const drafts = { ...state.drafts };
          if (text.trim()) drafts[id] = text;
          else delete drafts[id];
          return { drafts };
        }),
      clearThread: async (id) => {
        await hideAllMessagesDb(id).catch(() => {});
        set((state) => {
          const lastRead = { ...state.lastRead };
          delete lastRead[id];
          return {
            threads: { ...state.threads, [id]: [] },
            lastRead,
          };
        });
      },
      wallpapers: {},
      setWallpaper: (id, wallpaper) =>
        set((state) => {
          const wallpapers = { ...state.wallpapers };
          if (wallpaper) wallpapers[id] = wallpaper;
          else delete wallpapers[id];
          return { wallpapers };
        }),
      pendingWallpaper: null,
      setPendingWallpaper: (pending) => set({ pendingWallpaper: pending }),
      alert: null,
      showAlert: (spec) => set({ alert: spec }),
      dismissAlert: () => set({ alert: null }),
      scheduled: [],
      scheduleMessage: async (threadId, text, at, replyTo) => {
        const clean = text.trim();
        if (!clean || at <= Date.now()) return;
        const row = await scheduleMessageDb(
          threadId,
          clean,
          new Date(at),
          replyTo?.id ?? null,
        );
        set((state) => ({
          scheduled: [
            ...state.scheduled,
            { id: row.id, threadId, text: clean, at, replyTo },
          ],
        }));
      },
      cancelScheduled: async (id) => {
        await cancelScheduledDb(id).catch(() => {});
        set((state) => ({
          scheduled: state.scheduled.filter((m) => m.id !== id),
        }));
      },
      flushScheduled: async () => {
        const sent = await flushDueScheduledDb().catch(() => []);
        if (sent.length === 0) return;
        // Sent messages arrive via realtime; just refresh the queue.
        const rows = await fetchScheduledDb().catch(() => [] as DbScheduled[]);
        set({ scheduled: rows.map(mapDbScheduled) });
      },
      reset: () =>
        set({
          myId: null,
          bootstrapped: false,
          chats: [],
          chatsLoaded: false,
          people: {},
          threads: {},
          threadsLoaded: {},
          historyExhausted: {},
          stories: [],
          openThreadId: null,
          deleted: [],
          lastRead: {},
          muted: {},
          pinned: [],
          disappearing: {},
          groups: {},
          wallpapers: {},
          pendingWallpaper: null,
          alert: null,
          scheduled: [],
        }),
    }),
    {
      name: "fable-state",
      storage: createJSONStorage(() => ({
        getItem: (key) => storage.getString(key) ?? null,
        setItem: (key, value) => storage.set(key, value),
        removeItem: (key) => storage.remove(key),
      })),
      // Live data (threads, chats, people, stories) is refetched every
      // session. The app-lock unlocked flag is in-memory only.
      partialize: (state) => {
        const {
          appUnlocked,
          alert,
          threads,
          threadsLoaded,
          historyExhausted,
          chats,
          chatsLoaded,
          people,
          stories,
          groups,
          muted,
          pinned,
          disappearing,
          scheduled,
          myId,
          bootstrapped,
          ...persisted
        } = state;
        return persisted;
      },
    },
  ),
);
