import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { test } from "node:test";
import vm from "node:vm";
import ts from "typescript";

// Exercise the actual Zustand stores. Only the native MMKV boundary and bitmap
// loader are replaced; reducers and persistence middleware run unchanged.
const root = path.resolve(import.meta.dirname, "..");
const cache = new Map();
const disks = new Map();
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
    if (id.startsWith(".")) {
      const resolved = path.resolve(path.dirname(file), id);
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
  vm.runInThisContext(`(function(require,module,exports){${output}\n})`, {
    filename: file,
  })(localRequire, module, module.exports);
  return module.exports;
}
const { useFable: fable } = load(
  path.join(root, "src/cookbooks/fable/data/store.ts"),
);

// The shared store-behavior suite. (Astra's copy was removed with the dead
// cookbook; only Fable remains.)
{
  const name = "Fable";
  const store = fable;
  const id = "mara";
  const send = (state, id, text) => state.append(id, text);
  test(`${name}: blank and unknown-recipient submissions do not create threads`, () => {
    store.getState().reset();
    send(store.getState(), id, "   ");
    for (const invalid of [
      "missing-person",
      "constructor",
      "__proto__",
      "toString",
    ])
      send(store.getState(), invalid, "Hello");
    assert.deepEqual(store.getState().threads, {});
  });
  test(`${name}: two submissions in one millisecond have distinct IDs and retain the sample history`, () => {
    store.getState().reset();
    const clock = Date.now;
    Date.now = () => 12345;
    try {
      send(store.getState(), id, "First");
      send(store.getState(), id, "Second");
    } finally {
      Date.now = clock;
    }
    const messages = store.getState().threads[id];
    assert.ok(messages.length > 2);
    assert.equal(messages.at(-2).text, "First");
    assert.equal(messages.at(-1).text, "Second");
    assert.notEqual(messages.at(-2).id, messages.at(-1).id);
  });
  test(`${name}: reading twice is idempotent and reset preserves appearance`, () => {
    store.getState().markRead(id);
    const lastRead = store.getState().lastRead?.[id];
    store.getState().markRead(id);
    assert.equal(store.getState().lastRead?.[id], lastRead);
    store.getState().setTheme("dark");
    store.getState().reset();
    assert.deepEqual(store.getState().threads, {});
    assert.deepEqual(store.getState().lastRead ?? {}, {});
    assert.equal(store.getState().theme, "dark");
  });
  test(`${name}: toggleRead flips between read and unread`, () => {
    const s = () => store.getState();
    s().append(id, "First", "me");
    s().append(id, "Second", "them");
    const messages = s().threads[id] ?? [];
    assert.ok(messages.length >= 2);
    s().toggleRead(id); // unread -> mark read
    assert.equal(s().lastRead[id], messages.at(-1).id);
    s().toggleRead(id); // mark unread: rewinds before the last incoming
    assert.equal(s().lastRead[id], messages.at(-2).id);
    s().toggleRead(id); // mark read again
    assert.equal(s().lastRead[id], messages.at(-1).id);
  });
}
test("Fable: toggling a reaction adds/removes it without mutating the sample", () => {
  const { messagesFor } = load(
    path.join(root, "src/cookbooks/fable/data/messages.ts"),
  );
  fable.getState().reset();
  const original = JSON.stringify(messagesFor("mara", "Mara"));
  const firstId = messagesFor("mara", "Mara")[0].id;
  fable.getState().toggleReaction("mara", firstId, "❤️");
  assert.deepEqual(fable.getState().threads.mara[0].reactions, ["❤️"]);
  fable.getState().toggleReaction("mara", firstId, "👍");
  assert.deepEqual(fable.getState().threads.mara[0].reactions, ["❤️", "👍"]);
  fable.getState().toggleReaction("mara", firstId, "❤️");
  assert.deepEqual(fable.getState().threads.mara[0].reactions, ["👍"]);
  assert.equal(JSON.stringify(messagesFor("mara", "Mara")), original);
  fable.getState().toggleReaction("missing", "x", "❤️");
  assert.equal(fable.getState().threads.missing, undefined);
});
test("Fable persistence survives store hydration", async () => {
  fable.getState().append("mara", "Fable only");
  const fableDisk = disks.get("fable-local-v1").get("fable-state");
  assert.ok(fableDisk.includes("Fable only"));
  await fable.persist.rehydrate();
  assert.equal(fable.getState().threads.mara.at(-1).text, "Fable only");
});
test("Fable: appending a photo with a URI and a reply quote persists both", () => {
  fable.getState().reset();
  const target = fable.getState().threads.mara ?? null;
  fable
    .getState()
    .append("mara", "Look at this", "me", false, {
      replyTo: { id: "m1", from: "them", text: "Are you still up?", photo: false },
    });
  const withQuote = fable.getState().threads.mara.at(-1);
  assert.equal(withQuote.text, "Look at this");
  assert.deepEqual(withQuote.replyTo, {
    id: "m1",
    from: "them",
    text: "Are you still up?",
    photo: false,
  });
  assert.equal(withQuote.photoUri, undefined);
  fable
    .getState()
    .append("mara", "", "me", true, { photoUri: "file:///tmp/picked.jpg" });
  const photo = fable.getState().threads.mara.at(-1);
  assert.equal(photo.photo, true);
  assert.equal(photo.photoUri, "file:///tmp/picked.jpg");
  assert.equal(photo.replyTo, undefined);
  assert.equal(target, null);
});
test("Fable: appending a document falls back to the file name and stores the attachment", () => {
  fable.getState().reset();
  fable
    .getState()
    .append("mara", "", "me", false, {
      document: {
        name: "deck.pdf",
        size: 1234567,
        mimeType: "application/pdf",
        uri: "",
      },
    });
  const doc = fable.getState().threads.mara.at(-1);
  assert.equal(doc.text, "deck.pdf");
  assert.deepEqual(doc.document, {
    name: "deck.pdf",
    size: 1234567,
    mimeType: "application/pdf",
    uri: "",
  });
  // An explicit caption wins over the file-name fallback.
  fable
    .getState()
    .append("mara", "Q3 numbers", "me", false, {
      document: {
        name: "q3.xlsx",
        size: 2048,
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        uri: "",
      },
    });
  const captioned = fable.getState().threads.mara.at(-1);
  assert.equal(captioned.text, "Q3 numbers");
  assert.equal(captioned.document.name, "q3.xlsx");
});

const { unreadCount, firstUnreadId, seedLastReadId } = load(
  path.join(root, "src/cookbooks/fable/data/unread.ts"),
);

test("unread: counts incoming messages after the last-read marker", () => {
  const msgs = [
    { id: "a", from: "them" },
    { id: "b", from: "me" },
    { id: "c", from: "them" },
    { id: "d", from: "them" },
  ];
  assert.equal(unreadCount(msgs), 3);
  assert.equal(unreadCount(msgs, "a"), 2);
  assert.equal(unreadCount(msgs, "d"), 0);
  assert.equal(unreadCount(msgs, "missing"), 3);
  assert.equal(firstUnreadId(msgs, "a"), "c");
  assert.equal(firstUnreadId(msgs, "d"), undefined);
  assert.equal(firstUnreadId([]), undefined);
});

test("unread: seed converts a legacy unread count into a marker", () => {
  const msgs = [
    { id: "a", from: "them" },
    { id: "b", from: "me" },
    { id: "c", from: "them" },
    { id: "d", from: "them" },
  ];
  assert.equal(seedLastReadId(msgs, 2), "a");
  assert.equal(seedLastReadId(msgs, 0), "d");
  assert.equal(seedLastReadId(msgs, 9), undefined);
  assert.equal(seedLastReadId([], 0), undefined);
});

test("Fable: group polls create and take single-choice votes", () => {
  const s = () => fable.getState();
  const gid = s().createGroup("Trip planners", ["mara", "theo"]);
  assert.equal(s().createPoll(gid, "", ["a", "b"]), "");
  assert.equal(s().createPoll(gid, "Q?", ["only"]), "");
  const mid = s().createPoll(gid, "Beach or hills?", ["Beach", "Hills", ""]);
  assert.ok(mid);
  const msg = s().threads[gid].at(-1);
  assert.equal(msg.poll.question, "Beach or hills?");
  assert.deepEqual(
    msg.poll.options.map((o) => o.text),
    ["Beach", "Hills"],
  );
  s().votePoll(gid, mid, "opt-0", "me");
  s().votePoll(gid, mid, "opt-1", "mara");
  let opts = s().threads[gid].at(-1).poll.options;
  assert.deepEqual(opts[0].votes, ["me"]);
  assert.deepEqual(opts[1].votes, ["mara"]);
  s().votePoll(gid, mid, "opt-1", "me"); // change vote
  opts = s().threads[gid].at(-1).poll.options;
  assert.deepEqual(opts[0].votes, []);
  assert.deepEqual(opts[1].votes, ["mara", "me"]);
});

const { splitMentions, mentionedIds } = load(
  path.join(root, "src/cookbooks/fable/data/mentions.ts"),
);

test("mentions: splits @tokens that match member names", () => {
  const spans = splitMentions("hey @mara and @Theo, sup @unknown", [
    "Mara",
    "Theo",
  ]);
  assert.deepEqual(
    spans.filter((s) => s.name).map((s) => s.text),
    ["@mara", "@Theo"],
  );
  assert.deepEqual(
    mentionedIds("yo @theo", [{ id: "theo", first: "Theo" }]),
    ["theo"],
  );
  assert.deepEqual(
    mentionedIds("no mentions here", [{ id: "theo", first: "Theo" }]),
    [],
  );
  assert.deepEqual(
    mentionedIds("@theodore hi", [{ id: "theo", first: "Theo" }]),
    [],
  );
});

const { schedulePresets, scheduledLabel } = load(
  path.join(root, "src/cookbooks/fable/data/scheduled.ts"),
);

test("scheduled: queue validates, flushes due messages, cancels", () => {
  fable.getState().reset();
  const future = Date.now() + 3600_000;
  fable.getState().scheduleMessage("mara", "later gator", future);
  assert.equal(fable.getState().scheduled.length, 1);
  // Past times and blank text are ignored.
  fable.getState().scheduleMessage("mara", "past", Date.now() - 1000);
  fable.getState().scheduleMessage("mara", "   ", future);
  assert.equal(fable.getState().scheduled.length, 1);
  // Nothing due yet: nothing lands in the thread.
  fable.getState().flushScheduled();
  assert.equal((fable.getState().threads["mara"] ?? []).length, 0);
  assert.equal(fable.getState().scheduled.length, 1);
  // Force it due: it sends as an outgoing message and leaves the queue.
  fable.setState((st) => ({
    scheduled: st.scheduled.map((m) => ({ ...m, at: Date.now() - 1 })),
  }));
  fable.getState().flushScheduled();
  assert.equal(fable.getState().scheduled.length, 0);
  const messages = fable.getState().threads["mara"];
  assert.equal(messages.at(-1).text, "later gator");
  assert.equal(messages.at(-1).from, "me");
  // Cancel removes a queued message.
  fable.getState().scheduleMessage("mara", "never", future);
  const queuedId = fable.getState().scheduled.at(-1).id;
  fable.getState().cancelScheduled(queuedId);
  assert.equal(fable.getState().scheduled.length, 0);
  fable.getState().reset();
});

test("scheduled: presets and labels", () => {
  const now = Date.now();
  const presets = schedulePresets(now);
  assert.equal(presets.length, 3);
  assert.ok(presets.every((p) => p.at > now));
  assert.equal(presets[0].label, "In 1 hour");
  assert.match(scheduledLabel(now + 3600_000), /Today/);
  assert.match(scheduledLabel(now + 86400_000), /Tomorrow/);
});

test("disappearing: WhatsApp-style presets and timer set/clear", () => {
  const { DISAPPEARING_OPTIONS } = load(
    path.join(root, "src/cookbooks/fable/data/store.ts"),
  );
  assert.deepEqual(
    DISAPPEARING_OPTIONS.map((o) => o.label),
    ["Off", "24 hours", "7 days", "90 days"],
  );
  const s = () => fable.getState();
  s().reset();
  s().setDisappearing("mara", 86_400_000);
  assert.equal(s().disappearing["mara"], 86_400_000);
  s().setDisappearing("mara", 0);
  assert.equal(s().disappearing["mara"], undefined);
  s().reset();
});

test("disappearing: new messages carry expiresAt only while the timer is on", () => {
  const s = () => fable.getState();
  s().reset();
  const clock = Date.now;
  try {
    Date.now = () => 1_000_000;
    s().append("mara", "kept forever");
    assert.equal(s().threads["mara"].at(-1).expiresAt, undefined);
    s().setDisappearing("mara", 86_400_000);
    s().append("mara", "ephemeral hello");
    const last = s().threads["mara"].at(-1);
    assert.equal(last.expiresAt, 1_000_000 + 86_400_000);
  } finally {
    Date.now = clock;
  }
  s().reset();
});

test("disappearing: sweepExpired removes only expired messages", () => {
  const s = () => fable.getState();
  s().reset();
  const clock = Date.now;
  try {
    Date.now = () => 1_000_000;
    s().setDisappearing("mara", 86_400_000);
    s().append("mara", "ephemeral hello");
    const gone = s().threads["mara"].at(-1);
    const seedCount = s().threads["mara"].length - 1;
    // Before expiry the sweep keeps everything.
    Date.now = () => 1_000_000 + 86_400_000 - 1;
    s().sweepExpired();
    assert.ok(s().threads["mara"].some((m) => m.id === gone.id));
    // Past expiry the message is gone but the seed history survives.
    Date.now = () => 1_000_000 + 86_400_000 + 1;
    s().sweepExpired();
    assert.ok(!s().threads["mara"].some((m) => m.id === gone.id));
    assert.equal(s().threads["mara"].length, seedCount);
  } finally {
    Date.now = clock;
  }
  s().reset();
});

test("disappearing: sweepExpired repairs lastRead markers", () => {
  const s = () => fable.getState();
  s().reset();
  const clock = Date.now;
  try {
    Date.now = () => 2_000_000;
    s().setDisappearing("mara", 1000);
    s().append("mara", "gone soon");
    const goneId = s().threads["mara"].at(-1).id;
    s().markRead("mara");
    assert.equal(s().lastRead["mara"], goneId);
    Date.now = () => 2_000_001;
    s().sweepExpired();
    const after = s().threads["mara"];
    assert.ok(after.length > 0);
    assert.equal(s().lastRead["mara"], after.at(-1).id);
  } finally {
    Date.now = clock;
  }
  s().reset();
});

test("disappearing: deleteThread and reset clear the timer", () => {
  const s = () => fable.getState();
  s().reset();
  s().setDisappearing("mara", 86_400_000);
  s().deleteThread("mara");
  assert.equal(s().disappearing["mara"], undefined);
  s().setDisappearing("mara", 86_400_000);
  s().reset();
  assert.deepEqual(s().disappearing, {});
});

test("app lock: PIN set/unlock round-trips in memory", () => {
  const s = () => fable.getState();
  s().reset();
  assert.equal(s().appPin, null);
  s().setAppPin("1234");
  assert.equal(s().appPin, "1234");
  assert.equal(s().appUnlocked, false);
  s().setAppUnlocked(true);
  assert.equal(s().appUnlocked, true);
  // Backgrounding re-locks.
  s().setAppUnlocked(false);
  assert.equal(s().appUnlocked, false);
  s().setAppPin(null);
  assert.equal(s().appPin, null);
  s().setAppUnlocked(true);
  s().reset();
});
