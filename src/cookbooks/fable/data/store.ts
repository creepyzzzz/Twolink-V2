import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { createMMKV } from "react-native-mmkv";
import { messagesFor, olderMessagesFor, type Message, type ReplyQuote } from "./messages";
import { PEOPLE_BY_ID, type AvatarFace } from "./people";

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
type State = {
  threads: Record<string, Message[]>;
  read: string[];
  muted: Record<string, boolean>;
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
  /** Removes a single message from a thread (context-menu delete). */
  deleteMessage: (id: string, messageId: string) => void;
  /** Removes every message from a thread. */
  clearThread: (id: string) => void;
  /** Per-thread chat wallpaper photo-library URIs. */
  wallpapers: Record<string, string>;
  setWallpaper: (id: string, uri: string | null) => void;
  setTheme: (theme: State["theme"]) => void;
  toggleReaction: (id: string, messageId: string, emoji: string) => void;
  toggleMute: (id: string) => void;
  reset: () => void;
};
export const useFable = create<State>()(
  persist(
    (set, get) => ({
      threads: {},
      read: [],
      muted: {},
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
        set((state) => ({
          threads: {
            ...state.threads,
            [id]: [
              ...(state.threads[id] ??
                (person ? messagesFor(id, person.first) : [])),
              {
                id: `local-${Date.now()}-${++sequence}`,
                from,
                text: text.trim(),
                at: "now",
                photo,
                ...(opts?.photoUri ? { photoUri: opts.photoUri } : {}),
                ...(opts?.replyTo ? { replyTo: opts.replyTo } : {}),
                ...(opts?.senderId ? { senderId: opts.senderId } : {}),
              },
            ],
          },
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
        if (!get().read.includes(id))
          set((state) => ({ read: [...state.read, id] }));
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
      clearThread: (id) =>
        set((state) => ({
          threads: { ...state.threads, [id]: [] },
          read: state.read.filter((r) => r !== id),
        })),
      wallpapers: {},
      setWallpaper: (id, uri) =>
        set((state) => {
          const wallpapers = { ...state.wallpapers };
          if (uri) wallpapers[id] = uri;
          else delete wallpapers[id];
          return { wallpapers };
        }),
      reset: () =>
        set({ threads: {}, read: [], historyPage: {}, wallpapers: {} }),
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
