import type { Message } from "./messages";

/**
 * Unread tracking is derived from `lastReadId`: the id of the last message
 * the user has read in a thread. Anything after it counts as unread.
 * Message ids are stable under history prepends and survive alongside the
 * mock data, unlike positional indexes.
 */

/** Incoming ("them") messages after `lastReadId`. 0 when all caught up. */
export function unreadCount(
  messages: Message[],
  lastReadId?: string,
): number {
  const idx = lastReadId
    ? messages.findIndex((m) => m.id === lastReadId)
    : -1;
  let n = 0;
  for (let i = idx + 1; i < messages.length; i++) {
    if (messages[i].from !== "me") n++;
  }
  return n;
}

/** Id of the first unread incoming message, for jump-to-first-unread. */
export function firstUnreadId(
  messages: Message[],
  lastReadId?: string,
): string | undefined {
  const idx = lastReadId
    ? messages.findIndex((m) => m.id === lastReadId)
    : -1;
  for (let i = idx + 1; i < messages.length; i++) {
    if (messages[i].from !== "me") return messages[i].id;
  }
  return undefined;
}

/**
 * Converts a legacy unread count (the mock `Chat.unread`) into a lastReadId:
 * the message just before the last `unread` incoming messages. Returns
 * undefined when every incoming message is unread.
 */
export function seedLastReadId(
  messages: Message[],
  unread: number,
): string | undefined {
  if (unread <= 0) return messages[messages.length - 1]?.id;
  let seen = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].from !== "me") {
      seen++;
      if (seen > unread) return messages[i].id;
    }
  }
  return undefined;
}
