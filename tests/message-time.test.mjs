import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { test } from "node:test";
import vm from "node:vm";
import ts from "typescript";

// message-time.ts is dependency-free; transpile and load it directly.
const root = path.resolve(import.meta.dirname, "..");
const file = path.join(root, "src/cookbooks/fable/data/message-time.ts");
const output = ts.transpileModule(readFileSync(file, "utf8"), {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const module = { exports: {} };
const require = createRequire(import.meta.url);
vm.runInThisContext(`(function(require,module,exports){${output}\n})`, {
  filename: file,
})(require, module, module.exports);
const { atToDate, formatGapLabel, GAP_MS } = module.exports;

test("message-time: gap threshold is one hour", () => {
  assert.equal(GAP_MS, 3_600_000);
});

test("message-time: parses the mock at-shapes", () => {
  const now = new Date();
  const parsedNow = atToDate("now");
  assert.ok(Math.abs(parsedNow - now) < 60_000);

  const morning = atToDate("9:41");
  assert.equal(morning.getHours(), 9);
  assert.equal(morning.getMinutes(), 41);
  assert.equal(morning.toDateString(), now.toDateString());

  const yesterday = atToDate("Yesterday 21:05");
  const dayAgo = new Date(now);
  dayAgo.setDate(dayAgo.getDate() - 1);
  assert.equal(yesterday.toDateString(), dayAgo.toDateString());
  assert.equal(yesterday.getHours(), 21);
  assert.equal(yesterday.getMinutes(), 5);

  const tuesday = atToDate("Tuesday 14:02");
  assert.equal(tuesday.getDay(), 2);
  assert.equal(tuesday.getHours(), 14);
  assert.equal(tuesday.getMinutes(), 2);
  assert.ok(tuesday.getTime() <= Date.now());

  assert.equal(atToDate("garbage"), null);
});

test("message-time: gap labels read like iMessage", () => {
  const d = new Date(2026, 8, 30, 9, 41);
  assert.equal(formatGapLabel(d), "9:41 AM");
  assert.equal(formatGapLabel(new Date(2026, 8, 30, 14, 5)), "2:05 PM");
  assert.equal(formatGapLabel(new Date(2026, 8, 30, 0, 0)), "12:00 AM");
  assert.equal(formatGapLabel(new Date(2026, 8, 30, 12, 30)), "12:30 PM");
});

// messages.ts is dependency-free too; load it the same way.
const messagesFile = path.join(
  root,
  "src/cookbooks/fable/data/messages.ts",
);
const messagesOutput = ts.transpileModule(
  readFileSync(messagesFile, "utf8"),
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  },
).outputText;
const messagesModule = { exports: {} };
vm.runInThisContext(
  `(function(require,module,exports){${messagesOutput}\n})`,
  { filename: messagesFile },
)(require, messagesModule, messagesModule.exports);
const { messagesFor, olderMessagesFor } = messagesModule.exports;

/**
 * Mirrors the gap rule in Conversation.tsx: same-day messages separated
 * by >= GAP_MS earn a centered label showing the newer message's time.
 */
function gapLabels(messages) {
  const dayOf = (at) =>
    at.startsWith("Yesterday") ? "Yesterday" : at.includes(" ") ? at.split(" ")[0] : "Today";
  const out = [];
  messages.forEach((msg, i) => {
    const prev = messages[i - 1];
    if (!prev || dayOf(prev.at) !== dayOf(msg.at)) return;
    const a = atToDate(prev.at);
    const b = atToDate(msg.at);
    if (a && b && b.getTime() - a.getTime() >= GAP_MS)
      out.push(formatGapLabel(b));
  });
  return out;
}

test("message-time: mock seeds render iMessage gap headers", () => {
  // Mara: 9:44 -> 12:15 is the only same-day hour gap.
  assert.deepEqual(
    gapLabels(messagesFor("mara", "Mara")),
    ["12:15 PM"],
  );
  // Theo: 9:20 -> 14:05 is the only same-day hour gap.
  assert.deepEqual(
    gapLabels(messagesFor("theo", "Theo")),
    ["2:05 PM"],
  );
  // Mara's scroll-up history: 19:02 -> 20:35 earns one on every device,
  // even in threads whose seed snapshot is already stored.
  assert.deepEqual(
    gapLabels(olderMessagesFor("mara", "Mara", 0)),
    ["8:35 PM"],
  );
});
