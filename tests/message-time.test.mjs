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

test("message-time: parses the inbox at-shapes", () => {
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

// The gap rule mirrors Conversation.tsx: same-day messages separated by
// >= GAP_MS earn a centered label showing the newer message's time.
// Synthetic fixtures stand in for thread data (no app seed content).
function gapLabels(times) {
  const out = [];
  times.forEach((at, i) => {
    const prev = times[i - 1];
    if (!prev) return;
    const a = atToDate(prev);
    const b = atToDate(at);
    if (a && b && b.getTime() - a.getTime() >= GAP_MS)
      out.push(formatGapLabel(b));
  });
  return out;
}

test("message-time: threads render iMessage gap headers", () => {
  // 9:44 -> 12:15 is the only same-day hour gap.
  assert.deepEqual(gapLabels(["9:44", "12:15"]), ["12:15 PM"]);
  // 9:20 -> 14:05 likewise.
  assert.deepEqual(gapLabels(["9:20", "14:05"]), ["2:05 PM"]);
  // Sub-hour gaps earn no header.
  assert.deepEqual(gapLabels(["19:02", "19:30"]), []);
  // Scroll-up history: 19:02 -> 20:35 earns one.
  assert.deepEqual(gapLabels(["19:02", "20:35"]), ["8:35 PM"]);
});
