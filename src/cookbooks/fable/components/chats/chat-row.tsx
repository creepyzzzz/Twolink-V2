import { router } from "expo-router";
import { memo } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { SFIcon } from "../../../../ui/SFIcon";
import { Avatar } from "../ui/avatar";
import { Accent, Space, Type } from "../../constants/theme";
import { avatarSource, faceForUserId, type Person } from "../../data/people";
import { useFable } from "../../data/store";
import type { ChatRow as ChatRowData } from "../../../../lib/chat";
import { scheduledLabel } from "../../data/scheduled";
import { useTheme } from "../../hooks/use-theme";

export const ROW_AVATAR = 60;

/** Avatar, name, preview, and an unread indicator. Long-press offers pinning. */
export const ChatRow = memo(function ChatRow({
  chat,
  onLongPressRow,
}: {
  chat: ChatRowData;
  onLongPressRow: (id: string) => void;
}) {
  const theme = useTheme();
  const people = useFable((state) => state.people);
  // The profile map may not have this user yet — fall back to the row's own
  // name and a deterministic face so the chat never renders nameless.
  const person: Person = (
    chat.otherUserId ? people[chat.otherUserId] : undefined
  ) ?? {
    id: chat.otherUserId ?? chat.id,
    name: chat.name,
    first: chat.name,
    avatar: faceForUserId(chat.otherUserId ?? chat.id),
  };
  const stored = useFable((state) => state.threads[chat.id]);
  const last = stored?.at(-1);
  const muted = chat.muted;
  const pinned = chat.pinned;
  const n = chat.unread;
  const unread = n > 0;
  const draftText = (useFable((state) => state.drafts[chat.id]) ?? "").trim();
  const scheduledNext = useFable((state) =>
    state.scheduled
      .filter((m) => m.threadId === chat.id)
      .sort((a, b) => a.at - b.at)
      .at(0),
  );
  const preview = last
    ? last.deletedForEveryone
      ? last.from === "me"
        ? "You deleted this message"
        : "This message was deleted"
      : last.photo
        ? "Shared a photo"
        : last.text
    : chat.preview;
  const fromMe = last ? last.from === "me" : chat.previewFromMe;

  return (
    <View>
      <Pressable
          testID={`fable-chat-${chat.id}`}
          accessibilityRole="button"
          accessibilityLabel={`${person.name}${unread ? ", unread" : ""}${muted ? ", muted" : ""}${pinned ? ", pinned" : ""}. ${preview}`}
          onPress={() =>
            router.push({
              pathname: "/fable/chat/[id]",
              params: { id: chat.id },
            })
          }
          onLongPress={() => onLongPressRow(chat.id)}
          unstable_pressDelay={90}
          style={({ pressed }) => [
            styles.row,
            { backgroundColor: pressed ? theme.rowPressed : "transparent" },
          ]}
        >
          <Avatar source={avatarSource(person)} size={ROW_AVATAR} />
          <View style={styles.body}>
            <Text numberOfLines={1} style={[Type.name, { color: theme.label }]}>
              {person.name}
            </Text>
            <Text
              numberOfLines={1}
              style={[
                Type.preview,
                { color: unread ? theme.label : theme.secondary },
              ]}
            >
              {draftText ? (
                <>
                  <Text style={{ color: Accent }}>Draft: </Text>
                  <Text style={{ color: theme.secondary }}>{draftText}</Text>
                </>
              ) : scheduledNext ? (
                <>
                  <Text style={{ color: Accent }}>Scheduled: </Text>
                  <Text style={{ color: theme.secondary }}>
                    {scheduledLabel(scheduledNext.at)}
                  </Text>
                </>
              ) : (
                <>
                  {fromMe ? "You: " : ""}
                  {preview}
                </>
              )}
            </Text>
          </View>
          <View style={styles.meta}>
            {pinned && (
              <SFIcon name="pin.fill" size={13} color={theme.tertiary} rotation={45} />
            )}
            {unread && (
              <View
                style={styles.badge}
                accessibilityLabel={`${n} unread messages`}
              >
                <Text style={styles.badgeText}>
                  {n > 99 ? "99+" : n}
                </Text>
              </View>
            )}
            {muted && (
              <SFIcon name="bell.slash.fill" size={13} color={theme.tertiary} />
            )}
            <Text style={[Type.meta, styles.time, { color: theme.secondary }]}>
              {chat.previewAt}
            </Text>
          </View>
        </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Space[4],
    paddingHorizontal: Space[5],
    paddingVertical: Space[3],
    borderRadius: 28,
    borderCurve: "continuous",
    marginHorizontal: Space[2],
  },
  body: {
    flex: 1,
    gap: 3,
  },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingLeft: Space[2],
  },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Accent,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  badgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  time: {
    fontVariant: ["tabular-nums"],
  },
});
