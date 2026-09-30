import { memo } from "react";
import type { Swipeable } from "react-native-gesture-handler";

import { ChatRow } from "./chat-row";
import { SwipeableRow, type RowSwipeAction } from "./swipeable-row";
import type { Chat } from "../../data/chats";
import { messagesFor } from "../../data/messages";
import { PEOPLE_BY_ID } from "../../data/people";
import { useFable } from "../../data/store";
import { unreadCount } from "../../data/unread";

/**
 * ChatRow with iOS-style swipe actions. Swipe left reveals Pin, Mute and
 * Delete; swipe right reveals Mark read/unread. The long-press glass menu
 * keeps working on top of the swipe.
 */
export const SwipeableChatRow = memo(function SwipeableChatRow({
  chat,
  onLongPressRow,
  onDelete,
  registerRef,
  onOpen,
}: {
  chat: Chat;
  onLongPressRow: (id: string) => void;
  onDelete: (id: string, label: string) => void;
  registerRef: (id: string, ref: Swipeable | null) => void;
  onOpen: (id: string) => void;
}) {
  const togglePin = useFable((s) => s.togglePin);
  const toggleMute = useFable((s) => s.toggleMute);
  const toggleRead = useFable((s) => s.toggleRead);
  const pinned = useFable((s) => s.pinned.includes(chat.id));
  const muted = useFable((s) => !!s.muted[chat.id]);
  const person = PEOPLE_BY_ID[chat.personId];
  const stored = useFable((s) => s.threads[chat.id]);
  const lastReadId = useFable((s) => s.lastRead[chat.id]);
  const messages = stored ?? messagesFor(chat.id, person.first);
  const isUnread = unreadCount(messages, lastReadId) > 0;
  const label = person.first || person.name;

  const rightActions: RowSwipeAction[] = [
    {
      id: "pin",
      title: pinned ? "Unpin" : "Pin",
      icon: pinned ? "pin.slash" : "pin.fill",
      iconRotation: pinned ? 0 : 45,
      backgroundColor: "#FF9F0A",
      onPress: () => togglePin(chat.id),
    },
    {
      id: "mute",
      title: muted ? "Unmute" : "Mute",
      icon: muted ? "speaker.slash.fill" : "speaker.fill",
      backgroundColor: "#8E8E93",
      onPress: () => toggleMute(chat.id),
    },
    {
      id: "delete",
      title: "Delete",
      icon: "trash",
      backgroundColor: "#FF3B30",
      onPress: () => onDelete(chat.id, label),
    },
  ];
  const leftActions: RowSwipeAction[] = [
    {
      id: "read",
      title: isUnread ? "Read" : "Unread",
      icon: isUnread ? "envelope.open.fill" : "envelope.badge.fill",
      backgroundColor: "#0A84FF",
      onPress: () => toggleRead(chat.id),
    },
  ];

  return (
    <SwipeableRow
      id={chat.id}
      leftActions={leftActions}
      rightActions={rightActions}
      registerRef={registerRef}
      onOpen={onOpen}
    >
      <ChatRow chat={chat} onLongPressRow={onLongPressRow} />
    </SwipeableRow>
  );
});
