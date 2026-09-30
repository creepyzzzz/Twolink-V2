import { Pressable, StyleSheet, Text, View } from "react-native";

import { SFIcon } from "../../../../ui/SFIcon";
import { Radius, Space, Type } from "../../constants/theme";
import { scheduledLabel, type ScheduledMessage } from "../../data/scheduled";
import { useTheme } from "../../hooks/use-theme";

/**
 * A queued message rendered at the bottom of its thread: the usual outgoing
 * bubble at half strength, stamped with a clock and its send time. Tapping
 * asks whether to cancel the send.
 */
export function ScheduledBubble({
  item,
  first = true,
  onCancel,
}: {
  item: ScheduledMessage;
  /** First bubble of the sender's run: gets the wider top gap, like Bubble. */
  first?: boolean;
  onCancel: () => void;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.row, { marginTop: first ? Space[5] : Space[2] }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Scheduled for ${scheduledLabel(item.at)}. Cancel the send?`}
        onPress={onCancel}
        onLongPress={onCancel}
        style={({ pressed }) => [
          styles.card,
          {
            backgroundColor: theme.outgoing,
            borderCurve: "continuous",
            opacity: pressed ? 0.4 : 0.55,
          },
        ]}
      >
        <Text style={[Type.body, { color: theme.outgoingText }]}>
          {item.text}
        </Text>
        <View style={styles.meta}>
          <SFIcon name="clock" size={11} color="rgba(255,255,255,0.75)" />
          <Text
            style={[Type.caption, { color: "rgba(255,255,255,0.75)" }]}
          >
            {scheduledLabel(item.at)}
          </Text>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: 16,
  },
  card: {
    maxWidth: "78%",
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: Radius.bubble,
  },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    gap: Space[1],
    marginTop: 5,
  },
});
