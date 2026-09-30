import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { createMMKV } from "react-native-mmkv";
import { messagesFor, olderMessagesFor, type Message, type ReplyQuote } from "./messages";
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
  glassIntensity: number;
};
export type MyStory = { uri: string; at: number };
export type Group = {
  id: string;
  name: string;
  memberIds: string[];
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
    },
  ) => void;
  /** Prepends the next page of older history; no-op when exhausted. */
  loadEarlier: (id: string) => void;
  markRead: (id: string) => void;
  toggleRead: (id: string) => void;
  /** Removes a single message from a thread (context-menu delete). */
  deleteMessage: (id: string, messageId: string) => void;
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
  reset: () => void;
};
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
            [id]: { id, name, memberIds, createdAt: Date.now() },
          },
        }));
        return id;
      },
      historyPage: {},
      theme: "system",
      profile: {
        name: "Tariq",
        about: "Hey there! I'm using TwoLink.",
        face: "me",
      },
      setProfile: (patch) =>
        set((state) => ({ profile: { ...state.profile, ...patch } })),
      settings: {
        readReceipts: true,
        typingIndicators: true,
        notifications: true,
        glassIntensity: 0.55,
      },
      setSettings: (patch) =>
        set((state) => ({ settings: { ...state.settings, ...patch } })),
      append: (id, text, from = "me", photo = false, opts) => {
        const person = PEOPLE_BY_ID[id];
        const group = getGroup(get().groups, id);
        if ((!person && !group) || (!photo && !text.trim())) return;
        const message: Message = {
          id: `local-${Date.now()}-${++sequence}`,
          from,
          text: text.trim(),
          at: "now",
          photo,
          ...(opts?.photoUri ? { photoUri: opts.photoUri } : {}),
          ...(opts?.replyTo ? { replyTo: opts.replyTo } : {}),
          ...(opts?.senderId ? { senderId: opts.senderId } : {}),
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
      deleteMessage: (id, messageId) =>
        set((state) => {
          const current =
            state.threads[id] ??
            messagesFor(id, PEOPLE_BY_ID[id]?.first ?? "");
          return {
            threads: {
              ...state.threads,
              [id]: current.filter((m) => m.id !== messageId),
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
          return {
            threads,
            drafts,
            muted,
            lastRead,
            pinned: state.pinned.filter((p) => p !== id),
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
        }),
    }),
    {
      name: "fable-state",
      storage: createJSONStorage(() => ({
        getItem: (key) => storage.getString(key) ?? null,
        setItem: (key, value) => storage.set(key, value),
        removeItem: (key) => storage.remove(key),
      })),
    },
  ),
);
