import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { GroupAvatar } from "../chats/group-row";
import { GlassButton } from "../ui/glass-button";
import { ChatMenu } from "./chat-menu";
import { Space, Type } from "../../constants/theme";
import type { Group } from "../../data/store";
import { groupDisplayName, useFable } from "../../data/store";
import { useTheme } from "../../hooks/use-theme";

export const THREAD_NAV_H = 64;

/**
 * Group twin of ThreadHeader: back, a tappable identity (opens the group
 * card), and the ••• menu (search, wallpaper, clear chat).
 * No call buttons — group calls are out of scope. The panel begins beneath.
 */
export function GroupHeader({
  group,
  insetTop,
  onSearch,
}: {
  group: Group;
  insetTop: number;
  onSearch: () => void;
}) {
  const theme = useTheme();
  const people = useFable((s) => s.people);
  const myId = useFable((s) => s.myId);
  const name = groupDisplayName(group, people, myId);
  return (
    <View
      pointerEvents="box-none"
      style={[styles.bar, { top: insetTop, height: THREAD_NAV_H }]}
    >
      <GlassButton
        symbol="chevron.left"
        iconSize={17}
        accessibilityLabel="Back"
        onPress={() => router.back()}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${name} — group info`}
        onPress={() =>
          router.push({
            pathname: "/fable/group/[id]",
            params: { id: group.id },
          })
        }
        style={styles.center}
      >
        <GroupAvatar memberIds={group.memberIds} size={44} />
        <Text
          numberOfLines={1}
          style={[Type.caption, { color: theme.secondary, marginTop: 4 }]}
        >
          {name} · {group.memberIds.length}
        </Text>
      </Pressable>
      <View style={styles.right}>
        <ChatMenu threadId={group.id} onSearch={onSearch} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Space[4],
  },
  center: {
    position: "absolute",
    left: 60,
    right: 60,
    top: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  right: {
    flexDirection: "row",
    alignItems: "center",
  },
});
