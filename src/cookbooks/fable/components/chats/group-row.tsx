import { AndroidGlassMenu } from "expo-android-glass-view";
import { router } from "expo-router";
import { memo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { SFIcon } from "../../../../ui/SFIcon";
import { Avatar } from "../ui/avatar";
import { Accent, Space, Type } from "../../constants/theme";
import { PEOPLE_BY_ID } from "../../data/people";
import { useFable, type Group } from "../../data/store";
import { useTheme } from "../../hooks/use-theme";

export const ROW_AVATAR = 60;

/** Two overlapping member orbs, iMessage-style. */
export function GroupAvatar({
  memberIds,
  size,
}: {
  memberIds: string[];
  size: number;
}) {
  const theme = useTheme();
  const shown = memberIds.slice(0, 2);
  const orb = size * 0.66;
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
  return (
    <View style={{ width: size, height: size }}>
      {shown.map((id, index) => {
        const person = PEOPLE_BY_ID[id];
        if (!person) return null;
        return (
          <View
            key={id}
            style={{
              position: "absolute",
              left: index === 0 ? 0 : size - orb,
              top: index === 0 ? 0 : size - orb,
            }}
          >
            <Avatar source={person.avatar} size={orb} />
          </View>
        );
      })}
    </View>
  );
}

/** Avatar cluster, name, preview, and an unread indicator — mirrors ChatRow. */
export const GroupRow = memo(function GroupRow({ group }: { group: Group }) {
  const theme = useTheme();
  const read = useFable((state) => state.read.includes(group.id));
  const last = useFable((state) => state.threads[group.id]?.at(-1));
  const muted = useFable((state) => !!state.muted[group.id]);
  const pinned = useFable((state) => state.pinned.includes(group.id));
  const togglePin = useFable((state) => state.togglePin);
  const anchorRef = useRef<View>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const unread = !!last && last.from !== "me" && !read;
  const draftText = (useFable((state) => state.drafts[group.id]) ?? "").trim();
  const senderName =
    last && last.from !== "me" && last.senderId
      ? (PEOPLE_BY_ID[last.senderId]?.first ?? "")
      : "";
  const preview = last
    ? `${senderName ? `${senderName}: ` : ""}${
        last.photo ? "Shared a photo" : last.text
      }`
    : `${group.memberIds.length} members`;

  return (
    <>
      <View ref={anchorRef} collapsable={false}>
        <Pressable
          testID={`fable-group-${group.id}`}
          accessibilityRole="button"
          accessibilityLabel={`${group.name}${unread ? ", unread" : ""}${muted ? ", muted" : ""}${pinned ? ", pinned" : ""}. ${preview}`}
          onPress={() =>
            router.push({
              pathname: "/fable/chat/[id]",
              params: { id: group.id },
            })
          }
          onLongPress={() => setMenuOpen(true)}
          unstable_pressDelay={90}
          style={({ pressed }) => [
            styles.row,
            { backgroundColor: pressed ? theme.rowPressed : "transparent" },
          ]}
        >
          <GroupAvatar memberIds={group.memberIds} size={ROW_AVATAR} />
          <View style={styles.body}>
            <Text numberOfLines={1} style={[Type.name, { color: theme.label }]}>
              {group.name}
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
              ) : (
                preview
              )}
            </Text>
          </View>
          <View style={styles.meta}>
            {pinned && (
              <SFIcon name="pin.fill" size={13} color={theme.tertiary} />
            )}
            {unread && <View style={styles.dot} accessibilityLabel="Unread" />}
            {muted && (
              <SFIcon name="bell.slash.fill" size={13} color={theme.tertiary} />
            )}
            <Text style={[Type.meta, styles.time, { color: theme.secondary }]}>
              {last ? "now" : ""}
            </Text>
          </View>
        </Pressable>
      </View>
      <AndroidGlassMenu
        visible={menuOpen}
        anchorRef={anchorRef}
        placement="below"
        items={[
          {
            id: "pin",
            title: pinned ? "Unpin chat" : "Pin chat",
            icon: (
              <SFIcon
                name={pinned ? "pin.slash" : "pin"}
                size={19}
                color={theme.label}
              />
            ),
          },
        ]}
        onSelect={(id) => {
          if (id === "pin") togglePin(group.id);
        }}
        onDismiss={() => setMenuOpen(false)}
      />
    </>
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
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Accent,
  },
  fallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(120,120,128,0.16)",
  },
});
