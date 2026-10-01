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
import { avatarSource } from "../../data/people";
import { useFable, groupDisplayName, type Group } from "../../data/store";
import { unreadCount } from "../../data/unread";
import { scheduledLabel } from "../../data/scheduled";
import { useTheme } from "../../hooks/use-theme";

export const ROW_AVATAR = 60;

/** Up to three overlapping member orbs, iMessage-style. */
export function GroupAvatar({
  memberIds,
  size,
}: {
  memberIds: string[];
  size: number;
}) {
  const theme = useTheme();
  const people = useFable((s) => s.people);
  const shown = memberIds.slice(0, 3);
  if (shown.length === 0)
    return (
      <View
        style={[
          styles.fallback,
          { width: size, height: size, borderRadius: size / 2 },
        ]}
      >
        <SFIcon name="person.2" size={size * 0.44} color={theme.secondary} />
      </View>
    );
  const orb =
    shown.length === 1 ? size * 0.72 : shown.length === 2 ? size * 0.66 : size * 0.58;
  const spots =
    shown.length === 1
      ? [{ left: (size - orb) / 2, top: (size - orb) / 2 }]
      : shown.length === 2
        ? [
            { left: 0, top: 0 },
            { left: size - orb, top: size - orb },
          ]
        : [
            { left: 0, top: 0 },
            { left: size - orb, top: 0 },
            { left: (size - orb) / 2, top: size - orb },
          ];
  return (
    <View style={{ width: size, height: size }}>
      {shown.map((id, index) => {
        const person = people[id];
        if (!person) return null;
        return (
          <View
            key={id}
            style={{
              position: "absolute",
              left: spots[index].left,
              top: spots[index].top,
            }}
          >
            <Avatar source={avatarSource(person)} size={orb} />
          </View>
        );
      })}
    </View>
  );
}

/** Avatar cluster, name, preview, and an unread indicator — mirrors ChatRow. */
export const GroupRow = memo(function GroupRow({
  group,
  onLongPressRow,
}: {
  group: Group;
  onLongPressRow: (id: string) => void;
}) {
  const theme = useTheme();
  const people = useFable((s) => s.people);
  const myId = useFable((s) => s.myId);
  const stored = useFable((state) => state.threads[group.id]);
  const lastReadId = useFable((state) => state.lastRead[group.id]);
  const messages = stored ?? [];
  const last = messages.at(-1);
  const name = groupDisplayName(group, people, myId);
  const muted = useFable((state) => !!state.muted[group.id]);
  const pinned = useFable((state) => state.pinned.includes(group.id));
  const n = unreadCount(messages, lastReadId);
  const unread = n > 0;
  const draftText = (useFable((state) => state.drafts[group.id]) ?? "").trim();
  const scheduledNext = useFable((state) =>
    state.scheduled
      .filter((m) => m.threadId === group.id)
      .sort((a, b) => a.at - b.at)
      .at(0),
  );
  const senderName =
    last && last.from !== "me" && last.senderId
      ? (people[last.senderId]?.first ?? "")
      : "";
  const preview = last
    ? last.deletedForEveryone
      ? last.from === "me"
        ? "You deleted this message"
        : "This message was deleted"
      : `${senderName ? `${senderName}: ` : ""}${
          last.photo ? "Shared a photo" : last.text
        }`
    : `${group.memberIds.length} members`;

  return (
    <View>
      <Pressable
          testID={`fable-group-${group.id}`}
          accessibilityRole="button"
          accessibilityLabel={`${name}${unread ? ", unread" : ""}${muted ? ", muted" : ""}${pinned ? ", pinned" : ""}. ${preview}`}
          onPress={() =>
            router.push({
              pathname: "/fable/chat/[id]",
              params: { id: group.id },
            })
          }
          onLongPress={() => onLongPressRow(group.id)}
          unstable_pressDelay={90}
          style={({ pressed }) => [
            styles.row,
            { backgroundColor: pressed ? theme.rowPressed : "transparent" },
          ]}
        >
          <GroupAvatar memberIds={group.memberIds} size={ROW_AVATAR} />
          <View style={styles.body}>
            <Text numberOfLines={1} style={[Type.name, { color: theme.label }]}>
              {name}
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
                preview
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
              {last ? "now" : ""}
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
  },
  body: { flex: 1, gap: 2 },
  meta: {
    alignItems: "flex-end",
    justifyContent: "center",
    gap: 6,
    minWidth: 44,
  },
  time: { fontVariant: ["tabular-nums"] },
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
  fallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(120,120,128,0.16)",
  },
});
