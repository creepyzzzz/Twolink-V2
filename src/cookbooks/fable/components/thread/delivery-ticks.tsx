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
const TICK_1 = "M1.09 7.70 L1.75 7.69 L1.88 7.74 L2.00 7.78 L2.14 7.83 L2.26 7.89 L2.39 7.95 L2.51 8.00 L2.65 8.07 L2.77 8.14 L2.90 8.21 L3.03 8.28 L3.16 8.36 L3.28 8.44 L3.42 8.53 L3.54 8.61 L3.67 8.72 L3.80 8.81 L3.93 8.93 L4.05 9.04 L4.19 9.17 L4.32 9.30 L4.44 9.43 L4.58 9.58 L4.70 9.71 L4.83 9.88 L4.96 10.04 L5.09 10.23 L5.21 10.42 L5.41 10.91 L5.68 9.35 L5.82 9.00 L5.94 8.70 L6.08 8.40 L6.21 8.15 L6.35 7.90 L6.48 7.68 L6.62 7.45 L6.75 7.24 L6.89 7.03 L7.02 6.83 L7.16 6.62 L7.30 6.41 L7.42 6.23 L7.56 6.03 L7.69 5.85 L7.83 5.66 L7.96 5.48 L8.10 5.30 L8.23 5.13 L8.37 4.95 L8.50 4.78 L8.64 4.61 L8.76 4.45 L8.90 4.29 L9.03 4.14 L9.17 3.98 L9.30 3.83 L9.44 3.67 L9.57 3.52 L9.71 3.36 L9.84 3.22 L9.98 3.08 L11.08 2.80";
const TICK_2 = "M8.09 7.70 L8.75 7.69 L8.88 7.74 L9.00 7.78 L9.14 7.83 L9.26 7.89 L9.39 7.95 L9.51 8.00 L9.65 8.07 L9.77 8.14 L9.90 8.21 L10.03 8.28 L10.16 8.36 L10.28 8.44 L10.42 8.53 L10.54 8.61 L10.67 8.72 L10.80 8.81 L10.93 8.93 L11.05 9.04 L11.19 9.17 L11.32 9.30 L11.44 9.43 L11.58 9.58 L11.70 9.71 L11.83 9.88 L11.96 10.04 L12.09 10.23 L12.21 10.42 L12.41 10.91 L12.68 9.35 L12.82 9.00 L12.94 8.70 L13.08 8.40 L13.21 8.15 L13.35 7.90 L13.48 7.68 L13.62 7.45 L13.75 7.24 L13.89 7.03 L14.02 6.83 L14.16 6.62 L14.30 6.41 L14.42 6.23 L14.56 6.03 L14.69 5.85 L14.83 5.66 L14.96 5.48 L15.10 5.30 L15.23 5.13 L15.37 4.95 L15.50 4.78 L15.64 4.61 L15.76 4.45 L15.90 4.29 L16.03 4.14 L16.17 3.98 L16.30 3.83 L16.44 3.67 L16.57 3.52 L16.71 3.36 L16.84 3.22 L16.98 3.08 L18.08 2.80";
/** Measured path length of each tick (both are identical). Traced from
 *  Tariq's hand-drawn check; tick 2 is tick 1 shifted +5.2 x for the
 *  overlapped double-tick look. */
const TICK_LEN = 16.09;
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
        width={20}
        height={12}
        viewBox="0 0 24 14"
        fill="none"
        accessibilityLabel={
          read ? "Read" : delivered ? "Delivered" : "Sent"
        }
      >
        <AnimatedPath
          d={TICK_1}
          strokeWidth={1.2}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={TICK_LEN}
          animatedProps={firstProps}
        />
        {delivered && (
          <AnimatedPath
            d={TICK_2}
            strokeWidth={1.2}
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
    fontSize: 11,
    // Fixed line height keeps the row's height stable next to the ticks.
    lineHeight: 14,
  },
});
