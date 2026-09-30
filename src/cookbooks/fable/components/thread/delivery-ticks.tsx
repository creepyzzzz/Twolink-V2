import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  createAnimatedComponent,
  interpolateColor,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { Path, Svg } from "react-native-svg";

import type { Message, MessageStatus } from "../../data/messages";
import { useTheme } from "../../hooks/use-theme";

const AnimatedPath = createAnimatedComponent(Path);

/**
 * WhatsApp-style delivery ticks for outgoing messages, tucked underneath
 * the bubble: one tick sent, two delivered, two blue read. Each tick draws
 * itself in (stroke formation) when it appears, and the pair turns blue
 * when the message is read. Plus an "Edited" marker when the text changed
 * after sending.
 *
 * Kept in its own file: sibling components trip the v6 hooks linter when
 * they share a file with Bubble's gesture hooks.
 */
const TICK_1 = "M2.5 8 L7 12.5 L15.5 3";
const TICK_2 = "M8 8 L12.5 12.5 L21 3";
/** Measured path length of each tick (both are identical). */
const TICK_LEN = 19.12;
const READ_BLUE = "#34B7F1";
const DRAW_MS = 350;

export function DeliveryTicks({ message }: { message: Message }) {
  const theme = useTheme();
  const gray = theme.secondary;
  const status: MessageStatus = message.status ?? "sent";
  const delivered = status === "delivered" || status === "read";
  const read = status === "read";

  // 1 = undrawn, 0 = fully drawn. A fresh message draws its first tick on
  // appear; history mounts with its ticks already drawn.
  const drawFirst = useSharedValue(status === "sent" ? 1 : 0);
  const drawSecond = useSharedValue(delivered ? 0 : 1);
  const blueMix = useSharedValue(read ? 1 : 0);

  useEffect(() => {
    drawFirst.value = withTiming(0, { duration: DRAW_MS });
  }, [drawFirst]);

  useEffect(() => {
    if (delivered) drawSecond.value = withTiming(0, { duration: DRAW_MS });
  }, [delivered, drawSecond]);

  useEffect(() => {
    blueMix.value = withTiming(read ? 1 : 0, { duration: 300 });
  }, [read, blueMix]);

  const firstProps = useAnimatedProps(() => ({
    strokeDashoffset: drawFirst.value * TICK_LEN,
    stroke: interpolateColor(blueMix.value, [0, 1], [gray, READ_BLUE]),
  }));
  const secondProps = useAnimatedProps(() => ({
    strokeDashoffset: drawSecond.value * TICK_LEN,
    stroke: interpolateColor(blueMix.value, [0, 1], [gray, READ_BLUE]),
  }));

  return (
    <View style={styles.statusRow}>
      {message.edited && (
        <Text style={[styles.editedLabel, { color: gray }]}>Edited</Text>
      )}
      <Svg
        width={34}
        height={22}
        viewBox="0 0 22 14"
        fill="none"
        accessibilityLabel={
          read ? "Read" : delivered ? "Delivered" : "Sent"
        }
      >
        <AnimatedPath
          d={TICK_1}
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={TICK_LEN}
          animatedProps={firstProps}
        />
        {delivered && (
          <AnimatedPath
            d={TICK_2}
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={TICK_LEN}
            animatedProps={secondProps}
          />
        )}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  statusRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 4,
    marginTop: 3,
    paddingRight: 6,
  },
  editedLabel: {
    fontSize: 10,
    fontStyle: "italic",
  },
});
