import { memo } from "react";
import type { Swipeable } from "react-native-gesture-handler";

import { GroupRow } from "./group-row";
import { SwipeableRow, type RowSwipeAction } from "./swipeable-row";
import { useFable, type Group } from "../../data/store";
import { unreadCount } from "../../data/unread";

/**
 * GroupRow with the same iOS-style swipe actions as 1:1 chats. Swipe left
 * reveals Pin, Mute and Delete; swipe right reveals Mark read/unread.
 */
export const SwipeableGroupRow = memo(function SwipeableGroupRow({
  group,
  onLongPressRow,
  onDelete,
  registerRef,
  onOpen,
}: {
  group: Group;
  onLongPressRow: (id: string) => void;
  onDelete: (id: string, label: string) => void;
  registerRef: (id: string, ref: Swipeable | null) => void;
  onOpen: (id: string) => void;
}) {
  const togglePin = useFable((s) => s.togglePin);
  const toggleMute = useFable((s) => s.toggleMute);
  const toggleRead = useFable((s) => s.toggleRead);
  const pinned = useFable((s) => s.pinned.includes(group.id));
  const muted = useFable((s) => !!s.muted[group.id]);
  const stored = useFable((s) => s.threads[group.id]);
  const lastReadId = useFable((s) => s.lastRead[group.id]);
  const messages = stored ?? [];
  const isUnread = unreadCount(messages, lastReadId) > 0;

  const rightActions: RowSwipeAction[] = [
    {
      id: "pin",
      title: pinned ? "Unpin" : "Pin",
      icon: pinned ? "pin.slash" : "pin.fill",
      iconRotation: pinned ? 0 : 45,
      backgroundColor: "#FF9F0A",
      onPress: () => togglePin(group.id),
    },
    {
      id: "mute",
      title: muted ? "Unmute" : "Mute",
      icon: muted ? "speaker.slash.fill" : "speaker.fill",
      backgroundColor: "#8E8E93",
      onPress: () => toggleMute(group.id),
    },
    {
      id: "delete",
      title: "Delete",
      icon: "trash",
      backgroundColor: "#FF3B30",
      onPress: () => onDelete(group.id, group.name),
    },
  ];
  const leftActions: RowSwipeAction[] = [
    {
      id: "read",
      title: isUnread ? "Read" : "Unread",
      icon: isUnread ? "envelope.open.fill" : "envelope.badge.fill",
      backgroundColor: "#0A84FF",
      onPress: () => toggleRead(group.id),
    },
  ];

  return (
    <SwipeableRow
      id={group.id}
      leftActions={leftActions}
      rightActions={rightActions}
      registerRef={registerRef}
      onOpen={onOpen}
    >
      <GroupRow group={group} onLongPressRow={onLongPressRow} />
    </SwipeableRow>
  );
});
