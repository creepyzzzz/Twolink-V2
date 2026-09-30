import type { ReplyQuote } from "./messages";

/** A message queued to send later. */
export type ScheduledMessage = {
  id: string;
  threadId: string;
  text: string;
  /** Epoch ms when it should send. */
  at: number;
  replyTo?: ReplyQuote;
};

/** "Today 9:00 PM" / "Tomorrow 9:00 AM" / "Oct 3, 9:00 AM". */
export function scheduledLabel(at: number): string {
  const d = new Date(at);
  const time = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  const startOfDay = (x: Date) =>
    new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round(
    (startOfDay(d) - startOfDay(new Date())) / 86400000,
  );
  if (diffDays <= 0) return `Today ${time}`;
  if (diffDays === 1) return `Tomorrow ${time}`;
  return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })} ${time}`;
}

/** Preset send times for the long-press send menu. No native picker needed. */
export function schedulePresets(
  now = Date.now(),
): { label: string; at: number }[] {
  const d = new Date(now);
  const evening = new Date(d);
  evening.setHours(21, 0, 0, 0);
  const eveningPast = evening.getTime() <= now;
  if (eveningPast) evening.setDate(evening.getDate() + 1);
  const morning = new Date(d);
  morning.setDate(morning.getDate() + 1);
  morning.setHours(9, 0, 0, 0);
  return [
    { label: "In 1 hour", at: now + 3600_000 },
    {
      label: `${eveningPast ? "Tomorrow" : "Tonight"} 9 PM`,
      at: evening.getTime(),
    },
    { label: "Tomorrow 9 AM", at: morning.getTime() },
  ];
}
