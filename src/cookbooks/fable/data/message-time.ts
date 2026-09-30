/**
 * Parses the mock `Message.at` shapes ("now", "9:41", "Yesterday 21:05",
 * "Tuesday 14:02") into real dates so the thread can render iMessage-style
 * gap timestamps between message groups.
 */

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/** Gaps of an hour or more earn a centered timestamp, iMessage-style. */
export const GAP_MS = 60 * 60 * 1000;

export function atToDate(at: string): Date | null {
  if (at === "now") return new Date();
  const m = at.match(
    /^(?:(Yesterday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s+)?(\d{1,2}):(\d{2})$/,
  );
  if (!m) return null;
  const [, dayWord, hh, mm] = m;
  const d = new Date();
  d.setHours(Number(hh), Number(mm), 0, 0);
  if (!dayWord) return d;
  if (dayWord === "Yesterday") {
    d.setDate(d.getDate() - 1);
    return d;
  }
  const target = WEEKDAYS.indexOf(dayWord);
  let delta = (d.getDay() - target + 7) % 7;
  // Same weekday named today but the clock time is still ahead: last week.
  if (delta === 0 && d.getTime() > Date.now()) delta = 7;
  d.setDate(d.getDate() - delta);
  return d;
}

/** "9:41 AM" — the centered gap label iMessage shows between groups. */
export function formatGapLabel(date: Date): string {
  const h24 = date.getHours();
  const h = h24 % 12 || 12;
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${h}:${mm} ${h24 >= 12 ? "PM" : "AM"}`;
}
