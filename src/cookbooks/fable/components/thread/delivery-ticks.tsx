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
const TICK_1 = "M2.01 7.62 L2.12 7.62 L2.23 7.62 L2.35 7.62 L2.45 7.63 L2.57 7.65 L2.68 7.67 L2.80 7.70 L2.91 7.73 L3.02 7.77 L3.13 7.81 L3.24 7.86 L3.36 7.91 L3.47 7.98 L3.59 8.05 L3.70 8.13 L3.81 8.21 L3.92 8.32 L4.03 8.42 L4.15 8.54 L4.26 8.67 L4.38 8.82 L4.49 8.96 L4.59 9.11 L4.71 9.29 L4.82 9.47 L4.94 9.69 L5.05 9.91 L5.19 10.23 L5.50 10.23 L5.72 8.50 L5.84 8.07 L5.95 7.73 L6.06 7.40 L6.17 7.13 L6.29 6.87 L6.40 6.66 L6.51 6.46 L6.63 6.25 L6.73 6.07 L6.85 5.88 L6.96 5.71 L7.08 5.53 L7.19 5.36 L7.30 5.21 L7.42 5.05 L7.52 4.90 L7.64 4.75 L7.75 4.61 L7.87 4.47 L7.98 4.35 L8.09 4.22 L8.20 4.09 L8.31 3.98 L8.43 3.88 L8.54 3.78 L8.66 3.67 L8.77 3.58 L8.88 3.48 L8.99 3.37 L9.10 3.28 L9.22 3.19 L9.33 3.11 L9.45 3.07";
const TICK_2 = "M7.21 7.62 L7.32 7.62 L7.43 7.62 L7.55 7.62 L7.65 7.63 L7.77 7.65 L7.88 7.67 L8.00 7.70 L8.11 7.73 L8.22 7.77 L8.33 7.81 L8.44 7.86 L8.56 7.91 L8.67 7.98 L8.79 8.05 L8.90 8.13 L9.01 8.21 L9.12 8.32 L9.23 8.42 L9.35 8.54 L9.46 8.67 L9.58 8.82 L9.69 8.96 L9.79 9.11 L9.91 9.29 L10.02 9.47 L10.14 9.69 L10.25 9.91 L10.39 10.23 L10.70 10.23 L10.92 8.50 L11.04 8.07 L11.15 7.73 L11.26 7.40 L11.37 7.13 L11.49 6.87 L11.60 6.66 L11.71 6.46 L11.83 6.25 L11.93 6.07 L12.05 5.88 L12.16 5.71 L12.28 5.53 L12.39 5.36 L12.50 5.21 L12.62 5.05 L12.72 4.90 L12.84 4.75 L12.95 4.61 L13.07 4.47 L13.18 4.35 L13.29 4.22 L13.40 4.09 L13.51 3.98 L13.63 3.88 L13.74 3.78 L13.86 3.67 L13.97 3.58 L14.08 3.48 L14.19 3.37 L14.30 3.28 L14.42 3.19 L14.53 3.11 L14.65 3.07";
/** Measured path length of each tick (both are identical). Traced from
 *  Tariq's hand-drawn check; tick 2 is tick 1 shifted +5.2 x for the
 *  overlapped double-tick look. */
const TICK_LEN = 13.2;
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
