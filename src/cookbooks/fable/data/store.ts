import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { createMMKV } from "react-native-mmkv";
import { messagesFor, olderMessagesFor, type DocumentAttachment, type Message, type MessageStatus, type ReplyQuote } from "./messages";
import type { ScheduledMessage } from "./scheduled";
import { PEOPLE_BY_ID, type AvatarFace } from "./people";
import { CHATS } from "./chats";
import { seedLastReadId, unreadCount } from "./unread";

const storage = createMMKV({ id: "fable-local-v1" });
let sequence = 0;
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
export type MyStory = { uri: string; at: number };
export type Group = {
  id: string;
  name: string;
  memberIds: string[];
  /** Person ids that may rename the group, manage members, and add people. */
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
export function groupDisplayName(group: Group): string {
  if (group.name.trim()) return group.name;
  const names = group.memberIds
    .map((id) => (id === "me" ? "You" : PEOPLE_BY_ID[id]?.first))
    .filter((n): n is string => !!n);
  return names.length > 0 ? names.join(", ") : "Group";
}
/** Groups created before admins existed treat the owner as sole admin. */
export function groupAdminIds(group: Group): string[] {
  const ids = group.adminIds ?? [];
  return ids.length > 0 ? ids : ["me"];
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

type State = {
  threads: Record<string, Message[]>;
  /**
   * Id of the last message the user has read, per thread. Unread counts and
   * jump-to-first-unread derive from this (see data/unread.ts).
   */
  lastRead: Record<string, string>;
  /** Thread currently open on screen; arrivals here are read immediately. */
  openThreadId: string | null;
  setOpenThread: (id: string | null) => void;
  muted: Record<string, boolean>;
  /** Thread ids pinned to the top of the inbox, most-recent pin first. */
  pinned: string[];
  /** Thread ids the user deleted from the inbox (hidden everywhere). */
  deleted: string[];
  /** Unsent composer text per thread — the inbox shows these as drafts. */
  drafts: Record<string, string>;
  /** Your posted stories, newest first (persisted photo-library URIs). */
  myStories: MyStory[];
  /** Group chats you created, keyed by id. */
  groups: Record<string, Group>;
  postStory: (uri: string) => void;
  removeStory: (uri: string) => void;
  createGroup: (name: string, memberIds: string[]) => string;
  /** Add people to an existing group (deduped). */
  addGroupMembers: (groupId: string, memberIds: string[]) => void;
  /** Rename a group. No-op unless the caller is an admin. */
  setGroupName: (groupId: string, name: string) => void;
  /** Remove a member (and their admin flag). Admins only; never the last admin. */
  removeGroupMember: (groupId: string, memberId: string) => void;
  /** Promote/demote a member. Admins only; never demotes the last admin. */
  setGroupAdmin: (groupId: string, memberId: string, admin: boolean) => void;
  /** How many older-history pages have been prepended per thread. */
  historyPage: Record<string, number>;
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
      /** Group threads: which member sent this. */
      senderId?: string;
      /** File attachment; `text` falls back to the file name. */
      document?: DocumentAttachment;
    },
  ) => void;
  /** Prepends the next page of older history; no-op when exhausted. */
  loadEarlier: (id: string) => void;
  markRead: (id: string) => void;
  toggleRead: (id: string) => void;
  /** Messages queued to send later. Persisted, flushed by flushScheduled. */
  scheduled: ScheduledMessage[];
  /** Queue a message for later. Ignores empty text and past times. */
  scheduleMessage: (
    threadId: string,
    text: string,
    at: number,
    replyTo?: ReplyQuote,
  ) => void;
  cancelScheduled: (id: string) => void;
  /** Sends every due scheduled message into its thread as an outgoing message. */
  flushScheduled: () => void;
  /** Removes a single message from a thread (context-menu delete). */
  deleteMessage: (id: string, messageId: string, scope: "me" | "everyone") => void;
  /** Edits an outgoing text message in place; marks it edited. */
  editMessage: (id: string, messageId: string, text: string) => void;
  /** Advances an outgoing message's delivery ticks. */
  setMessageStatus: (id: string, messageId: string, status: MessageStatus) => void;
  /** Removes every message from a thread. */
  clearThread: (id: string) => void;
  /** Per-thread chat wallpaper photo-library URIs. */
  wallpapers: Record<string, string | Wallpaper>;
  setWallpaper: (id: string, wallpaper: Wallpaper | null) => void;
  /** Image picked for wallpaper editing but not yet saved. */
  pendingWallpaper: { threadId: string; uri: string } | null;
  setPendingWallpaper: (
    pending: { threadId: string; uri: string } | null,
  ) => void;
  /**
   * Transient in-window alert. Rendered by GlassAlertHost in the same window
   * (not a native Modal) so the glass card can blur the screen behind it.
   */
  alert: GlassAlertSpec | null;
  showAlert: (spec: GlassAlertSpec) => void;
  dismissAlert: () => void;
  setTheme: (theme: State["theme"]) => void;
  toggleReaction: (id: string, messageId: string, emoji: string) => void;
  toggleMute: (id: string) => void;
  togglePin: (id: string) => void;
  deleteThread: (id: string) => void;
  setDraft: (id: string, text: string) => void;
  /** Disappearing-message lifetime per thread, in ms (absent = off). */
  disappearing: Record<string, number>;
  setDisappearing: (id: string, ms: number) => void;
  /** App lock PIN (null = not set). Persisted; the unlocked flag is not. */
  appPin: string | null;
  setAppPin: (pin: string | null) => void;
  /** In-memory only: whether the app lock is currently unlocked. */
  appUnlocked: boolean;
  setAppUnlocked: (unlocked: boolean) => void;
  /** Whether the welcome/login onboarding was completed or skipped. */
  onboarded: boolean;
  setOnboarded: (done: boolean) => void;
  /** Deletes messages whose expiry passed; repairs lastRead markers. */
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
/** Full message list for a thread: stored overrides, else the mock seed. */
function threadMessages(
  state: Pick<State, "threads">,
  id: string,
): Message[] {
  const person = PEOPLE_BY_ID[id];
  return (
    state.threads[id] ?? (person ? messagesFor(id, person.first) : [])
  );
}

/** Converts the mock `Chat.unread` counts into initial lastRead markers. */
function seedLastRead(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const chat of CHATS) {
    const person = PEOPLE_BY_ID[chat.personId];
    if (!person) continue;
    const id = seedLastReadId(
      messagesFor(chat.id, person.first),
      chat.unread,
    );
    if (id) out[chat.id] = id;
  }
  return out;
}
export const useFable = create<State>()(
  persist(
    (set, get) => ({
      threads: {},
      lastRead: seedLastRead(),
      openThreadId: null,
      setOpenThread: (id) => set({ openThreadId: id }),
      muted: {},
      pinned: [],
      drafts: {},
      deleted: [],
      myStories: [],
      groups: {},
      disappearing: {},
      setDisappearing: (id, ms) =>
        set((state) => {
          const disappearing = { ...state.disappearing };
          if (ms > 0) disappearing[id] = ms;
          else delete disappearing[id];
          return { disappearing };
        }),
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
      postStory: (uri) =>
        set((state) => ({
          myStories: [{ uri, at: Date.now() }, ...state.myStories],
        })),
      removeStory: (uri) =>
        set((state) => ({
          myStories: state.myStories.filter((s) => s.uri !== uri),
        })),
      createGroup: (name, memberIds) => {
        const id = `group-${Date.now()}`;
        set((state) => ({
          groups: {
            ...state.groups,
            [id]: {
              id,
              name,
              memberIds,
              adminIds: ["me"],
              createdAt: Date.now(),
            },
          },
        }));
        return id;
      },
      setGroupName: (groupId, name) =>
        set((state) => {
          const group = getGroup(state.groups, groupId);
          if (!group || !isGroupAdmin(group, "me")) return state;
          return {
            groups: {
              ...state.groups,
              [groupId]: { ...group, name: name.trim() },
            },
          };
        }),
      removeGroupMember: (groupId, memberId) =>
        set((state) => {
          const group = getGroup(state.groups, groupId);
          if (!group || !isGroupAdmin(group, "me")) return state;
          // The last admin can't be removed — a group always keeps one.
          const admins = groupAdminIds(group);
          if (admins.includes(memberId) && admins.length === 1) return state;
          return {
            groups: {
              ...state.groups,
              [groupId]: {
                ...group,
                memberIds: group.memberIds.filter((m) => m !== memberId),
                adminIds: admins.filter((m) => m !== memberId),
              },
            },
          };
        }),
      setGroupAdmin: (groupId, memberId, admin) =>
        set((state) => {
          const group = getGroup(state.groups, groupId);
          if (!group || !isGroupAdmin(group, "me")) return state;
          if (!group.memberIds.includes(memberId)) return state;
          const admins = groupAdminIds(group);
          if (admin && admins.includes(memberId)) return state;
          // Demoting the last admin is a no-op.
          if (!admin && admins.length === 1 && admins[0] === memberId)
            return state;
          return {
            groups: {
              ...state.groups,
              [groupId]: {
                ...group,
                adminIds: admin
                  ? [...admins, memberId]
                  : admins.filter((m) => m !== memberId),
              },
            },
          };
        }),
      addGroupMembers: (groupId, memberIds) =>
        set((state) => {
          const group = state.groups[groupId];
          if (!group || !isGroupAdmin(group, "me")) return state;
          const merged = [
            ...group.memberIds,
            ...memberIds.filter((m) => !group.memberIds.includes(m)),
          ];
          return {
            groups: {
              ...state.groups,
              [groupId]: { ...group, memberIds: merged },
            },
          };
        }),
      historyPage: {},
      theme: "system",
      profile: {
        name: "Tariq",
        about: "Hey there! I'm using Poffu.",
        face: "me",
      },
      setProfile: (patch) =>
        set((state) => ({ profile: { ...state.profile, ...patch } })),
      settings: {
        readReceipts: true,
        typingIndicators: true,
        notifications: true,
      },
      setSettings: (patch) =>
        set((state) => ({ settings: { ...state.settings, ...patch } })),
      append: (id, text, from = "me", photo = false, opts) => {
        const person = PEOPLE_BY_ID[id];
        const group = getGroup(get().groups, id);
        if ((!person && !group) || (!photo && !text.trim() && !opts?.document))
          return;
        const lifetime = get().disappearing[id] ?? 0;
        const message: Message = {
          id: `local-${Date.now()}-${++sequence}`,
          from,
          text:
            opts?.document && !text.trim() ? opts.document.name : text.trim(),
          at: "now",
          photo,
          ...(opts?.photoUri ? { photoUri: opts.photoUri } : {}),
          ...(opts?.replyTo ? { replyTo: opts.replyTo } : {}),
          ...(opts?.senderId ? { senderId: opts.senderId } : {}),
          ...(opts?.document ? { document: opts.document } : {}),
          ...(lifetime > 0 ? { expiresAt: Date.now() + lifetime } : {}),
          // Outgoing messages start at one tick; delivery progresses below.
          ...(from === "me" ? { status: "sent" as const } : {}),
        };
        set((state) => ({
          threads: {
            ...state.threads,
            [id]: [
              ...(state.threads[id] ??
                (person ? messagesFor(id, person.first) : [])),
              message,
            ],
          },
          // A message landing in the open thread is read immediately.
          ...(state.openThreadId === id
            ? { lastRead: { ...state.lastRead, [id]: message.id } }
            : {}),
        }));
        // Simulated network: delivered shortly after sending, read once the
        // other side "sees" it. With read receipts off it caps at delivered.
        if (from === "me") {
          const messageId = message.id;
          const later = (ms: number, fn: () => void) => {
            const t = setTimeout(fn, ms) as unknown as {
              unref?: () => void;
            };
            // Node (tests): simulated ticks must not hold the process open.
            // Hermes has no unref — the call is a no-op there.
            t.unref?.();
          };
          later(2000, () => get().setMessageStatus(id, messageId, "delivered"));
          later(9000, () =>
            get().setMessageStatus(
              id,
              messageId,
              get().settings.readReceipts ? "read" : "delivered",
            ),
          );
        }
      },
      loadEarlier: (id) => {
        const person = PEOPLE_BY_ID[id];
        if (!person) return;
        const page = get().historyPage[id] ?? 0;
        const older = olderMessagesFor(id, person.first, page);
        if (older.length === 0) return;
        set((state) => ({
          threads: {
            ...state.threads,
            [id]: [
              ...older,
              ...(state.threads[id] ?? messagesFor(id, person.first)),
            ],
          },
          historyPage: { ...state.historyPage, [id]: page + 1 },
        }));
      },
      markRead: (id) => {
        const state = get();
        const last = threadMessages(state, id).at(-1);
        if (last && state.lastRead[id] !== last.id)
          set({ lastRead: { ...state.lastRead, [id]: last.id } });
      },
      toggleRead: (id) => {
        const state = get();
        const messages = threadMessages(state, id);
        if (unreadCount(messages, state.lastRead[id]) > 0) {
          const last = messages.at(-1);
          if (last) set({ lastRead: { ...state.lastRead, [id]: last.id } });
          return;
        }
        // Mark unread: rewind to just before the latest incoming message.
        let idx = messages.length - 1;
        while (idx >= 0 && messages[idx].from === "me") idx--;
        if (idx < 0) return;
        set((s) => {
          const lastRead = { ...s.lastRead };
          const prev = messages[idx - 1];
          if (prev) lastRead[id] = prev.id;
          else delete lastRead[id];
          return { lastRead };
        });
      },
      toggleReaction: (id, messageId, emoji) => {
        const person = PEOPLE_BY_ID[id];
        if (!person) return;
        set((state) => ({
          threads: {
            ...state.threads,
            [id]: (state.threads[id] ?? messagesFor(id, person.first)).map(
              (m) =>
                m.id === messageId
                  ? {
                      ...m,
                      reactions: (m.reactions ?? []).includes(emoji)
                        ? (m.reactions ?? []).filter((e) => e !== emoji)
                        : [...(m.reactions ?? []), emoji],
                    }
                  : m,
            ),
          },
        }));
      },
      setTheme: (theme) => set({ theme }),
      deleteMessage: (id, messageId, scope) =>
        set((state) => {
          const current =
            state.threads[id] ??
            messagesFor(id, PEOPLE_BY_ID[id]?.first ?? "");
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
        }),
      editMessage: (id, messageId, text) =>
        set((state) => {
          const trimmed = text.trim();
          if (!trimmed) return state;
          const current =
            state.threads[id] ??
            messagesFor(id, PEOPLE_BY_ID[id]?.first ?? "");
          return {
            threads: {
              ...state.threads,
              [id]: current.map((m) =>
                m.id === messageId &&
                m.from === "me" &&
                !m.photo &&
                !m.document &&
                !m.deletedForEveryone
                  ? { ...m, text: trimmed, edited: true }
                  : m,
              ),
            },
          };
        }),
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
      toggleMute: (id) =>
        set((state) => ({
          muted: { ...state.muted, [id]: !state.muted[id] },
        })),
      togglePin: (id) =>
        set((state) => ({
          pinned: state.pinned.includes(id)
            ? state.pinned.filter((p) => p !== id)
            : [id, ...state.pinned],
        })),
      deleteThread: (id) =>
        set((state) => {
          const threads = { ...state.threads };
          delete threads[id];
          const drafts = { ...state.drafts };
          delete drafts[id];
          const muted = { ...state.muted };
          delete muted[id];
          const lastRead = { ...state.lastRead };
          delete lastRead[id];
          const disappearing = { ...state.disappearing };
          delete disappearing[id];
          return {
            threads,
            drafts,
            muted,
            lastRead,
            disappearing,
            pinned: state.pinned.filter((p) => p !== id),
            scheduled: state.scheduled.filter((m) => m.threadId !== id),
            deleted: state.deleted.includes(id)
              ? state.deleted
              : [...state.deleted, id],
          };
        }),
      setDraft: (id, text) =>
        set((state) => {
          if ((state.drafts[id] ?? "") === text) return state;
          const drafts = { ...state.drafts };
          if (text.trim()) drafts[id] = text;
          else delete drafts[id];
          return { drafts };
        }),
      clearThread: (id) =>
        set((state) => {
          const lastRead = { ...state.lastRead };
          delete lastRead[id];
          return {
            threads: { ...state.threads, [id]: [] },
            lastRead,
          };
        }),
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
      scheduleMessage: (threadId, text, at, replyTo) => {
        const clean = text.trim();
        if (!clean || at <= Date.now()) return;
        set((state) => ({
          scheduled: [
            ...state.scheduled,
            {
              id: `sched-${Date.now()}-${++sequence}`,
              threadId,
              text: clean,
              at,
              ...(replyTo ? { replyTo } : {}),
            },
          ],
        }));
      },
      cancelScheduled: (id) =>
        set((state) => ({
          scheduled: state.scheduled.filter((m) => m.id !== id),
        })),
      flushScheduled: () => {
        const now = Date.now();
        const due = get().scheduled.filter((m) => m.at <= now);
        if (!due.length) return;
        set((state) => {
          const threads = { ...state.threads };
          const lastRead = { ...state.lastRead };
          for (const m of due) {
            const person = PEOPLE_BY_ID[m.threadId];
            const group = getGroup(state.groups, m.threadId);
            if (!person && !group) continue;
            const lifetime = state.disappearing[m.threadId] ?? 0;
            const message: Message = {
              id: `local-${Date.now()}-${++sequence}`,
              from: "me",
              text: m.text,
              at: "now",
              ...(lifetime > 0 ? { expiresAt: Date.now() + lifetime } : {}),
              ...(m.replyTo ? { replyTo: m.replyTo } : {}),
            };
            threads[m.threadId] = [
              ...(threads[m.threadId] ??
                (person ? messagesFor(m.threadId, person.first) : [])),
              message,
            ];
            // It sends into the open thread: already read.
            if (state.openThreadId === m.threadId)
              lastRead[m.threadId] = message.id;
          }
          return {
            threads,
            lastRead,
            scheduled: state.scheduled.filter((m) => m.at > now),
          };
        });
      },
      reset: () =>
        set({
          threads: {},
          lastRead: {},
          openThreadId: null,
          deleted: [],
          historyPage: {},
          wallpapers: {},
          pendingWallpaper: null,
          alert: null,
          scheduled: [],
          disappearing: {},
        }),
    }),
    {
      name: "fable-state",
      storage: createJSONStorage(() => ({
        getItem: (key) => storage.getString(key) ?? null,
        setItem: (key, value) => storage.set(key, value),
        removeItem: (key) => storage.remove(key),
      })),
      // The app-lock unlocked flag is in-memory only: a fresh launch
      // always starts locked when a PIN exists.
      partialize: (state) => {
        const { appUnlocked, ...persisted } = state;
        return persisted;
      },
    },
  ),
);
