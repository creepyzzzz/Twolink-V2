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
const { useChat: astra, initialMessages } = load(
  path.join(root, "src/cookbooks/astra/data.ts"),
);
const { useFable: fable } = load(
  path.join(root, "src/cookbooks/fable/data/store.ts"),
);

for (const [name, store, id, send] of [
  ["Astra", astra, "mira", (state, id, text) => state.send(id, text)],
  ["Fable", fable, "mara", (state, id, text) => state.append(id, text)],
]) {
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
    if (!s().toggleRead) return; // Astra keeps the legacy read list.
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
test("Astra: reacting twice restores a sample message without mutating the sample", () => {
  const original = JSON.stringify(initialMessages("mira"));
  astra.getState().heart("mira", "m1");
  assert.equal(astra.getState().threads.mira[0].heart, true);
  astra.getState().heart("mira", "m1");
  assert.equal(astra.getState().threads.mira[0].heart, false);
  assert.equal(JSON.stringify(initialMessages("mira")), original);
});
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
test("Astra: unknown initial messages are empty and mute toggles independently", () => {
  assert.deepEqual(initialMessages("missing"), []);
  astra.getState().toggleMute("mira");
  assert.ok(astra.getState().muted.includes("mira"));
  astra.getState().toggleMute("mira");
  assert.ok(!astra.getState().muted.includes("mira"));
});
test("Cookbook persistence uses separate namespaces and survives store hydration", async () => {
  astra.getState().send("mira", "Astra only");
  fable.getState().append("mara", "Fable only");
  assert.equal(disks.size, 2);
  const astraDisk = disks.get("astra-local-v1").get("astra-state");
  const fableDisk = disks.get("fable-local-v1").get("fable-state");
  assert.ok(
    astraDisk.includes("Astra only") && !astraDisk.includes("Fable only"),
  );
  assert.ok(
    fableDisk.includes("Fable only") && !fableDisk.includes("Astra only"),
  );
  await astra.persist.rehydrate();
  await fable.persist.rehydrate();
  assert.equal(astra.getState().threads.mira.at(-1).text, "Astra only");
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
