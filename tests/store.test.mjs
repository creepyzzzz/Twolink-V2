import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { test } from "node:test";
import vm from "node:vm";
import ts from "typescript";

// Exercise the actual Zustand store against an in-memory fake of the
// Supabase backend (src/lib/chat.ts). Only the native MMKV boundary,
// expo-secure-store, bitmap loader, and the network layer are replaced;
// reducers, optimistic updates, and the persistence middleware run unchanged.
const root = path.resolve(import.meta.dirname, "..");
const cache = new Map();
const disks = new Map();

/* ------------------------------------------------------------------ */
/* In-memory fake of src/lib/chat.ts                                   */
/* ------------------------------------------------------------------ */
function makeChatFake() {
  let seq = 0;
  const nextId = (p) => `${p}-${++seq}`;
  const nowIso = () => new Date().toISOString();
  // All mutable backend state lives here so _reset() can drop it.
  let S = freshState();
  function freshState() {
    return {
      /** chatId -> DbMessage[] (oldest first) */
      messages: new Map(),
      /** chatId -> ChatRow */
      chats: new Map(),
      /** userId -> DbProfile */
      profiles: new Map(),
      /** messageId -> emoji[] */
      reactions: new Map(),
      fail: new Set(),
      scheduled: [],
    };
  }

  const row = (chatId, body, extra = {}) => ({
    id: nextId("msg"),
    chat_id: chatId,
    sender_id: "user-me",
    kind: "text",
    body,
    media_url: null,
    media_name: null,
    media_size: null,
    mime_type: null,
    reply_to: null,
    edited_at: null,
    deleted_for_everyone: false,
    created_at: nowIso(),
    ...extra,
  });

  const fake = {
    _reset() {
      S = freshState();
    },
    get _db() {
      return { messages: S.messages, chats: S.chats, scheduled: S.scheduled };
    },
    /* Seeding helpers (test-only, not part of the lib surface). */
    _seedChat(c) {
      S.chats.set(c.id, c);
    },
    _seedMessages(chatId, rows) {
      S.messages.set(chatId, rows);
    },
    _seedProfile(p) {
      S.profiles.set(p.id, p);
    },
    _fail(fn) {
      S.fail.add(fn);
    },
    _unfail(fn) {
      S.fail.delete(fn);
    },

    getMyUserId: async () => "user-me",
    ensureProfile: async () => ({
      id: "user-me",
      avatar_url: null,
      display_name: "Me",
      about: "",
      username: null,
    }),
    fetchChats: async () => [...S.chats.values()],
    fetchProfiles: async (ids) =>
      ids.map((id) => S.profiles.get(id)).filter(Boolean),
    fetchMessages: async (chatId, _before, _limit) => [
      ...(S.messages.get(chatId) ?? []),
    ],
    fetchMessageById: async (id) => {
      for (const rows of S.messages.values()) {
        const m = rows.find((r) => r.id === id);
        if (m) return m;
      }
      return null;
    },
    sendMessage: async (chatId, { body, kind, mediaUrl, mediaName, mediaSize, mimeType, replyTo }) => {
      if (S.fail.has("sendMessage")) throw new Error("offline");
      const r = row(chatId, body ?? "", {
        kind: kind ?? "text",
        media_url: mediaUrl ?? null,
        media_name: mediaName ?? null,
        media_size: mediaSize ?? null,
        mime_type: mimeType ?? null,
        reply_to: replyTo ?? null,
      });
      if (!S.messages.has(chatId)) S.messages.set(chatId, []);
      S.messages.get(chatId).push(r);
      return r;
    },
    editMessageDb: async (id, body) => {
      if (S.fail.has("editMessageDb")) throw new Error("offline");
      for (const rows of S.messages.values()) {
        const m = rows.find((r) => r.id === id);
        if (m) {
          m.body = body;
          m.edited_at = nowIso();
          return m;
        }
      }
      throw new Error("not found");
    },
    hideMessageDb: async () => {},
    hideAllMessagesDb: async () => {},
    deleteMessageForEveryoneDb: async (id) => {
      if (S.fail.has("deleteMessageForEveryoneDb")) throw new Error("offline");
      for (const rows of S.messages.values()) {
        const m = rows.find((r) => r.id === id);
        if (m) m.deleted_for_everyone = true;
      }
    },
    toggleReactionDb: async (messageId, emoji) => {
      if (S.fail.has("toggleReactionDb")) throw new Error("missing table");
      const list = S.reactions.get(messageId) ?? [];
      if (list.includes(emoji)) {
        S.reactions.set(
          messageId,
          list.filter((e) => e !== emoji),
        );
        return false;
      }
      S.reactions.set(messageId, [...list, emoji]);
      return true;
    },
    fetchReactions: async () => ({}),
    fetchReceiptRollup: async () => ({}),
    markChatRead: async () => {},
    setChatLastReadAt: async () => {},
    markDelivered: async () => {},
    setChatMuted: async () => {},
    setChatPinned: async () => {},
    setDisappearing: async () => {},
    uploadChatMedia: async (_chatId, _uri, name, _mime) => ({
      url: `https://cdn.test/${name}`,
      name,
      size: 42,
    }),
    signedMediaUrl: async (p) => `https://signed.test/${p}`,
    formatMessageTime: () => "now",
    subscribeToChatEvents: () => () => {},
    fetchStories: async () => [],
    postStoryDb: async () => ({ id: nextId("story") }),
    deleteStoryDb: async () => {},
    uploadStoryMedia: async () => "https://cdn.test/story.jpg",
    uploadAvatar: async () => "https://cdn.test/avatar.jpg",
    updateMyProfile: async () => {},
    fetchScheduledDb: async () => [...S.scheduled],
    scheduleMessageDb: async (threadId, text, at, replyTo) => {
      const r = { id: nextId("sched"), threadId, text, at, replyTo };
      S.scheduled.push(r);
      return r;
    },
    cancelScheduledDb: async (id) => {
      const i = S.scheduled.findIndex((s) => s.id === id);
      if (i >= 0) S.scheduled.splice(i, 1);
    },
    flushDueScheduledDb: async () => {
      const now = Date.now();
      const due = S.scheduled.filter((s) => new Date(s.at).getTime() <= now);
      for (const s of due) {
        const i = S.scheduled.findIndex((x) => x.id === s.id);
        if (i >= 0) S.scheduled.splice(i, 1);
      }
      return due;
    },
    createGroupChat: async (name, memberIds) => nextId("chat"),
    setGroupName: async () => {},
    setGroupAdmin: async () => {},
    addGroupMembers: async () => {},
    removeGroupMember: async () => {},
  };
  return fake;
}
const chatFake = makeChatFake();

function load(file) {
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} };
  cache.set(file, module);
  const require = createRequire(file);
  const localRequire = (id) => {
    if (id === "react-native-mmkv")
      return {
        createMMKV: ({ id }) => {
          if (!disks.has(id)) disks.set(id, new Map());
          const disk = disks.get(id);
          return {
            getString: (key) => disk.get(key),
            set: (key, value) => disk.set(key, value),
            remove: (key) => disk.delete(key),
          };
        },
      };
    if (id === "expo-secure-store")
      return {
        getItemAsync: async () => null,
        setItemAsync: async () => {},
        deleteItemAsync: async () => {},
      };
    if (id.startsWith(".")) {
      const resolved = path.resolve(path.dirname(file), id);
      // The network boundary: swap the real Supabase layer for the fake.
      if (/(^|[\\/])chat$/.test(resolved)) return chatFake;
      if (/\.(png|jpe?g|webp)$/.test(resolved)) return resolved;
      const source = [resolved, `${resolved}.ts`, `${resolved}.tsx`].find(
        existsSync,
      );
      if (source) return load(source);
    }
    return require(id);
  };
  const output = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  vm.runInThisContext(`(function(require,module,exports){${output}}\n)`, {
    filename: file,
  })(localRequire, module, module.exports);
  return module.exports;
}
const {
  useFable: fable,
  dbProfileToPerson,
  groupAdminIds,
  groupDisplayName,
  getGroup,
  isGroupAdmin,
} = load(path.join(root, "src/cookbooks/fable/data/store.ts"));

const s = () => fable.getState();

/** Reset the store and the fake backend between tests. */
function fresh() {
  chatFake._reset();
  s().reset();
  s().dismissAlert();
}

const CHAT = {
  id: "chat-1",
  type: "direct",
  name: "Mara",
  avatarUrl: null,
  otherUserId: "user-mara",
  memberIds: ["user-me", "user-mara"],
  memberCount: 2,
  preview: "",
  previewAt: "now",
  previewAtMs: Date.now(),
  previewFromMe: false,
  unread: 0,
  muted: false,
  pinned: false,
  disappearingMs: 0,
  lastReadAt: null,
  roles: {},
};

/** Put a signed-in user and one direct chat into the store. */
function signedIn() {
  fable.setState({
    myId: "user-me",
    chats: [{ ...CHAT }],
    threadsLoaded: { "chat-1": true },
    people: {
      "user-mara": {
        id: "user-mara",
        name: "Mara",
        first: "Mara",
        avatar: 1,
        photoUrl: null,
      },
    },
  });
}

test("append: sends through the backend, keeps stable id", async () => {
  fresh();
  signedIn();
  await s().append("chat-1", "  hello world  ");
  const msgs = s().threads["chat-1"];
  assert.equal(msgs.length, 1);
  assert.equal(msgs[0].text, "hello world");
  assert.equal(msgs[0].from, "me");
  assert.equal(msgs[0].status, "sent");
  // The temp id stays as the React key (no re-animation); the real db id
  // is stashed in serverId for backend ops.
  assert.ok(msgs[0].id.startsWith("pending-"));
  assert.ok(msgs[0].serverId && !msgs[0].serverId.startsWith("pending-"));
  // Inbox preview follows immediately.
  assert.equal(s().chats[0].preview, "hello world");
  assert.equal(s().chats[0].previewFromMe, true);
});

test("append: blank text and unknown senders are ignored", async () => {
  fresh();
  signedIn();
  await s().append("chat-1", "   ");
  await s().append("chat-1", "hi", "them");
  assert.deepEqual(s().threads, {});
  // Signed out: nothing sends.
  fable.setState({ myId: null });
  await s().append("chat-1", "nope");
  assert.deepEqual(s().threads, {});
});

test("append: backend failure rolls back the optimistic message", async () => {
  fresh();
  signedIn();
  chatFake._fail("sendMessage");
  await s().append("chat-1", "doomed");
  assert.deepEqual(s().threads["chat-1"] ?? [], []);
  assert.equal(s().alert?.title, "Couldn't send");
  chatFake._unfail("sendMessage");
});

test("append: photo with reply quote and document name fallback", async () => {
  fresh();
  signedIn();
  // The quote survives only when the quoted message is in the loaded thread.
  fable.setState({
    threads: {
      "chat-1": [
        {
          id: "m1",
          from: "them",
          text: "Are you still up?",
          at: "now",
          createdAtMs: Date.now(),
          photo: false,
        },
      ],
    },
  });
  await s().append("chat-1", "Look at this", "me", false, {
    replyTo: { id: "m1", from: "them", text: "Are you still up?", photo: false },
  });
  const quoted = s().threads["chat-1"].at(-1);
  assert.equal(quoted.text, "Look at this");
  assert.deepEqual(quoted.replyTo, {
    id: "m1",
    from: "them",
    text: "Are you still up?",
    photo: false,
  });
  await s().append("chat-1", "", "me", true, { photoUri: "file:///tmp/p.jpg" });
  const photo = s().threads["chat-1"].at(-1);
  assert.equal(photo.photo, true);
  assert.ok(photo.photoUri.startsWith("https://cdn.test/photo-"));
  // Document with no caption falls back to the file name.
  await s().append("chat-1", "", "me", false, {
    document: { name: "deck.pdf", size: 10, mimeType: "application/pdf", uri: "file:///d.pdf" },
  });
  const doc = s().threads["chat-1"].at(-1);
  assert.equal(doc.text, "deck.pdf");
  assert.equal(doc.document.name, "deck.pdf");
});

test("messages: edit marks edited; blank edits ignored; delete scopes", async () => {
  fresh();
  signedIn();
  await s().append("chat-1", "hello world");
  const id = s().threads["chat-1"].at(-1).id;
  await s().editMessage("chat-1", id, "hello edited");
  assert.equal(s().threads["chat-1"].at(-1).text, "hello edited");
  assert.equal(s().threads["chat-1"].at(-1).edited, true);
  await s().editMessage("chat-1", id, "   ");
  assert.equal(s().threads["chat-1"].at(-1).text, "hello edited");
  // Delete for me removes the row.
  await s().deleteMessage("chat-1", id, "me");
  assert.ok(!s().threads["chat-1"].some((m) => m.id === id));
  // Delete for everyone leaves a tombstone.
  await s().append("chat-1", "retract me");
  const id2 = s().threads["chat-1"].at(-1).id;
  await s().deleteMessage("chat-1", id2, "everyone");
  const tomb = s().threads["chat-1"].find((m) => m.id === id2);
  assert.equal(tomb.deletedForEveryone, true);
  assert.equal(tomb.text, "");
});

test("reactions: toggling adds then removes the emoji", async () => {
  fresh();
  signedIn();
  await s().append("chat-1", "react to this");
  const id = s().threads["chat-1"].at(-1).id;
  await s().toggleReaction("chat-1", id, "❤️");
  assert.deepEqual(s().threads["chat-1"].at(-1).reactions, ["❤️"]);
  await s().toggleReaction("chat-1", id, "👍");
  assert.deepEqual(s().threads["chat-1"].at(-1).reactions, ["❤️", "👍"]);
  await s().toggleReaction("chat-1", id, "❤️");
  assert.deepEqual(s().threads["chat-1"].at(-1).reactions, ["👍"]);
});

test("reactions: missing backend table surfaces the migration hint", async () => {
  fresh();
  signedIn();
  await s().append("chat-1", "react to this");
  const id = s().threads["chat-1"].at(-1).id;
  chatFake._fail("toggleReactionDb");
  await s().toggleReaction("chat-1", id, "❤️");
  assert.equal(s().alert?.title, "Reactions aren't available yet");
  assert.deepEqual(s().threads["chat-1"].at(-1).reactions, undefined);
  chatFake._unfail("toggleReactionDb");
});

test("markRead and toggleRead move the read marker", async () => {
  fresh();
  signedIn();
  await s().append("chat-1", "one");
  // An incoming message from the peer (seeded straight into the fake DB).
  chatFake._db.messages.get("chat-1").push({
    id: "msg-peer",
    chat_id: "chat-1",
    sender_id: "user-mara",
    kind: "text",
    body: "two",
    media_url: null,
    media_name: null,
    media_size: null,
    mime_type: null,
    reply_to: null,
    edited_at: null,
    deleted_for_everyone: false,
    created_at: new Date().toISOString(),
  });
  // Force a reload so the peer message is picked up.
  fable.setState({ threadsLoaded: {} });
  await s().ensureThread("chat-1");
  const msgs = s().threads["chat-1"];
  assert.equal(msgs.length, 2);
  s().markRead("chat-1");
  assert.equal(s().lastRead["chat-1"], "msg-peer");
  s().toggleRead("chat-1"); // mark unread: rewinds before the incoming one
  assert.equal(s().lastRead["chat-1"], msgs[0].id);
  s().toggleRead("chat-1"); // mark read again
  assert.equal(s().lastRead["chat-1"], "msg-peer");
});

test("ensureThread: loads history once and maps senders", async () => {
  fresh();
  signedIn();
  chatFake._seedMessages("chat-1", [
    {
      id: "m-old",
      chat_id: "chat-1",
      sender_id: "user-mara",
      kind: "text",
      body: "hey",
      media_url: null,
      media_name: null,
      media_size: null,
      mime_type: null,
      reply_to: null,
      edited_at: null,
      deleted_for_everyone: false,
      created_at: new Date(Date.now() - 60000).toISOString(),
    },
  ]);
  fable.setState({ threadsLoaded: {} });
  await s().ensureThread("chat-1");
  const msgs = s().threads["chat-1"];
  assert.equal(msgs.length, 1);
  assert.equal(msgs[0].from, "them");
  assert.equal(msgs[0].senderId, "user-mara");
  // Second call is a no-op (already loaded).
  await s().ensureThread("chat-1");
  assert.equal(s().threads["chat-1"].length, 1);
});

test("setMessageStatus advances outgoing ticks", async () => {
  fresh();
  signedIn();
  await s().append("chat-1", "ticks");
  const id = s().threads["chat-1"].at(-1).id;
  s().setMessageStatus("chat-1", id, "delivered");
  assert.equal(s().threads["chat-1"].at(-1).status, "delivered");
  s().setMessageStatus("chat-1", id, "read");
  assert.equal(s().threads["chat-1"].at(-1).status, "read");
});

test("forwardMessage: forwards text to another chat", async () => {
  fresh();
  signedIn();
  fable.setState({
    chats: [{ ...CHAT }, { ...CHAT, id: "chat-2", name: "Jonas" }],
  });
  await s().append("chat-1", "pass it on");
  const m = s().threads["chat-1"].at(-1);
  await s().forwardMessage("chat-2", m);
  assert.equal(s().threads["chat-2"].at(-1).text, "pass it on");
});

test("dbProfileToPerson: maps a profile row to the UI shape", () => {
  const p = dbProfileToPerson({
    id: "u-1",
    display_name: "Mara Chen",
    avatar_url: "https://cdn.test/a.jpg",
    username: "mara",
    about: "hi",
  });
  assert.equal(p.id, "u-1");
  assert.equal(p.first, "Mara");
  assert.equal(p.photoUrl, "https://cdn.test/a.jpg");
  const face = dbProfileToPerson({
    id: "u-2",
    display_name: "Jonas",
    avatar_url: "face:jonas",
    username: null,
    about: null,
  });
  assert.equal(face.photoUrl, null);
  // In the app Metro resolves bundled faces to asset ids; the test harness
  // resolves them to paths. Either way a face asset is present.
  assert.ok(face.avatar);
});

test("groups: admin math and prototype-safe lookup", () => {
  const groups = {
    g1: {
      id: "g1",
      name: "Weekend plan",
      memberIds: ["user-me", "user-mara"],
      adminIds: ["user-me"],
      createdAt: 1,
    },
  };
  assert.deepEqual(groupAdminIds(groups.g1), ["user-me"]);
  assert.ok(isGroupAdmin(groups.g1, "user-me"));
  assert.ok(!isGroupAdmin(groups.g1, "user-mara"));
  assert.equal(
    groupDisplayName(groups.g1, { "user-mara": { first: "Mara" } }, "user-me"),
    "Weekend plan",
  );
  const nameless = { ...groups.g1, name: "   " };
  assert.equal(
    groupDisplayName(
      nameless,
      { "user-mara": { first: "Mara" } },
      "user-me",
    ),
    "You, Mara",
  );
  // Prototype-named ids never match.
  assert.equal(getGroup(groups, "constructor"), undefined);
  assert.equal(getGroup(groups, "__proto__"), undefined);
});

test("scheduled: queue validates, flushes due messages, cancels", async () => {
  fresh();
  signedIn();
  const future = Date.now() + 3600_000;
  await s().scheduleMessage("chat-1", "later gator", future);
  assert.equal(s().scheduled.length, 1);
  // Past times and blank text are ignored.
  await s().scheduleMessage("chat-1", "past", Date.now() - 1000);
  await s().scheduleMessage("chat-1", "   ", future);
  assert.equal(s().scheduled.length, 1);
  // Nothing due yet: the queue keeps it.
  await s().flushScheduled();
  assert.equal(s().scheduled.length, 1);
  // Force it due: flushScheduled sends it via the backend queue and it
  // leaves the local queue (delivery itself arrives via realtime).
  const qid = s().scheduled[0].id;
  chatFake._db.scheduled.find((x) => x.id === qid).at = new Date(
    Date.now() - 1000,
  );
  await s().flushScheduled();
  assert.equal(s().scheduled.length, 0);
  assert.equal(chatFake._db.scheduled.length, 0);
  // Cancel removes a queued message.
  await s().scheduleMessage("chat-1", "never", future);
  const queuedId = s().scheduled.at(-1).id;
  await s().cancelScheduled(queuedId);
  assert.equal(s().scheduled.length, 0);
});

test("disappearing: timer set/clear, expiresAt on new messages, sweep", async () => {
  fresh();
  signedIn();
  await s().append("chat-1", "kept forever");
  assert.equal(s().threads["chat-1"].at(-1).expiresAt, undefined);
  await s().setDisappearing("chat-1", 86_400_000);
  assert.equal(s().disappearing["chat-1"], 86_400_000);
  await s().append("chat-1", "ephemeral hello");
  const last = s().threads["chat-1"].at(-1);
  // Expiry is anchored to the backend timestamp, like the real mapping.
  const expected = last.createdAtMs + 86_400_000;
  assert.equal(last.expiresAt, expected);
  const clock = Date.now;
  try {
    // Before expiry the sweep keeps everything.
    Date.now = () => expected - 1;
    s().sweepExpired();
    assert.ok(s().threads["chat-1"].some((m) => m.id === last.id));
    // Past expiry the message is gone but the kept one survives.
    Date.now = () => expected + 1;
    s().sweepExpired();
    assert.ok(!s().threads["chat-1"].some((m) => m.id === last.id));
    assert.equal(s().threads["chat-1"].length, 1);
  } finally {
    Date.now = clock;
  }
  await s().setDisappearing("chat-1", 0);
  assert.equal(s().disappearing["chat-1"], undefined);
});

test("deleteThread clears the thread and its timer", async () => {
  fresh();
  signedIn();
  await s().setDisappearing("chat-1", 86_400_000);
  await s().append("chat-1", "bye");
  await s().deleteThread("chat-1");
  assert.equal(s().threads["chat-1"], undefined);
  assert.equal(s().disappearing["chat-1"], undefined);
});

test("app lock: PIN set/unlock round-trips in memory", () => {
  fresh();
  assert.equal(s().appPin, null);
  s().setAppPin("1234");
  assert.equal(s().appPin, "1234");
  assert.equal(s().appUnlocked, false);
  s().setAppUnlocked(true);
  assert.equal(s().appUnlocked, true);
  s().setAppUnlocked(false);
  assert.equal(s().appUnlocked, false);
  s().setAppPin(null);
  assert.equal(s().appPin, null);
});

test("persistence: live data is not persisted, prefs are", async () => {
  fresh();
  signedIn();
  await s().append("chat-1", "ephemeral thread");
  s().setDraft("chat-1", "draft text");
  const disk = disks.get("fable-local-v1");
  const raw = disk.get("fable-state");
  assert.ok(!raw.includes("ephemeral thread"), "threads must not persist");
  assert.ok(raw.includes("draft text"), "drafts persist");
  // Simulate a fresh launch: clear in-memory state (this wipes the disk
  // snapshot via the persist subscriber), restore the snapshot, rehydrate.
  fable.setState({ threads: {}, chats: [], drafts: {}, people: {} });
  disk.set("fable-state", raw);
  await fable.persist.rehydrate();
  assert.deepEqual(s().threads, {});
  assert.deepEqual(s().chats, []);
  assert.equal(s().drafts["chat-1"], "draft text");
});

test("shutdown: clears session state", async () => {
  fresh();
  signedIn();
  await s().append("chat-1", "x");
  s().shutdown();
  assert.equal(s().myId, null);
  assert.equal(s().bootstrapped, false);
  assert.deepEqual(s().chats, []);
  assert.deepEqual(s().threads, {});
});

/* ------------------------------------------------------------------ */
/* Pure helpers (unchanged behavior, still live-data compatible)        */
/* ------------------------------------------------------------------ */
const { unreadCount, firstUnreadId, seedLastReadId } = load(
  path.join(root, "src/cookbooks/fable/data/unread.ts"),
);

test("unread: counts incoming messages after the last-read marker", () => {
  const msgs = [
    { id: "a", from: "me" },
    { id: "b", from: "them" },
    { id: "c", from: "them" },
  ];
  assert.equal(unreadCount(msgs, "a"), 2);
  assert.equal(unreadCount(msgs, "c"), 0);
  assert.equal(firstUnreadId(msgs, "a"), "b");
});

test("unread: seed converts a legacy unread count into a marker", () => {
  const msgs = [
    { id: "a", from: "me" },
    { id: "b", from: "them" },
    { id: "c", from: "them" },
  ];
  // 1 unread (c): the marker is the message before the unread run.
  assert.equal(seedLastReadId(msgs, 1), "b");
  // Everything unread: no marker.
  assert.equal(seedLastReadId(msgs, 2), undefined);
  // Nothing unread: the last message.
  assert.equal(seedLastReadId(msgs, 0), "c");
});

const { splitMentions } = load(
  path.join(root, "src/cookbooks/fable/data/mentions.ts"),
);

test("mentions: splits @tokens that match member names", () => {
  const parts = splitMentions("hey @mara and @Jonas!", ["Mara", "Jonas"]);
  assert.ok(parts.some((p) => p.name === "mara" && p.text === "@mara"),
    JSON.stringify(parts),
  );
  assert.ok(parts.some((p) => p.name === "Jonas"));
  assert.ok(parts.some((p) => p.name === undefined && p.text.includes("hey")));
});

const { schedulePresets, scheduledLabel } = load(
  path.join(root, "src/cookbooks/fable/data/scheduled.ts"),
);

test("scheduled: presets and labels", () => {
  const now = Date.now();
  const presets = schedulePresets(now);
  assert.equal(presets.length, 3);
  assert.ok(presets.every((p) => p.at > now));
  assert.equal(presets[0].label, "In 1 hour");
  const noonToday = new Date();
  noonToday.setHours(12, 0, 0, 0);
  assert.match(scheduledLabel(noonToday.getTime()), /Today/);
  assert.match(scheduledLabel(now + 86400_000), /Tomorrow/);
});
