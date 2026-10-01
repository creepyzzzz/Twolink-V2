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
import { SFIcon } from "../../../../ui/SFIcon";

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
const TICK_1 = "M1.09 7.70 L1.45 7.76 L1.62 7.83 L1.78 7.90 L1.97 7.95 L2.13 7.99 L2.31 8.03 L2.46 8.07 L2.63 8.10 L2.76 8.15 L2.90 8.21 L3.03 8.28 L3.16 8.36 L3.28 8.44 L3.42 8.53 L3.54 8.61 L3.67 8.72 L3.80 8.81 L3.93 8.93 L4.05 9.04 L4.19 9.17 L4.32 9.30 L4.44 9.43 L4.58 9.58 L4.70 9.71 L4.83 9.88 L4.96 10.04 L5.09 10.23 L5.21 10.42 L5.41 10.91 L5.68 9.35 L5.82 9.00 L5.94 8.70 L6.08 8.40 L6.21 8.15 L6.35 7.90 L6.48 7.68 L6.62 7.45 L6.75 7.24 L6.89 7.03 L7.02 6.83 L7.16 6.62 L7.30 6.41 L7.42 6.23 L7.56 6.03 L7.69 5.85 L7.83 5.66 L7.96 5.48 L8.10 5.30 L8.23 5.13 L8.37 4.95 L8.50 4.78 L8.64 4.62 L8.79 4.48 L8.97 4.35 L9.14 4.22 L9.33 4.09 L9.52 3.95 L9.73 3.79 L9.92 3.63 L10.13 3.44 L10.32 3.26 L10.51 3.06 L11.08 2.80";
const TICK_2 = "M7.29 7.70 L7.65 7.76 L7.82 7.83 L7.98 7.90 L8.17 7.95 L8.33 7.99 L8.51 8.03 L8.66 8.07 L8.83 8.10 L8.96 8.15 L9.10 8.21 L9.23 8.28 L9.36 8.36 L9.48 8.44 L9.62 8.53 L9.74 8.61 L9.87 8.72 L10.00 8.81 L10.13 8.93 L10.25 9.04 L10.39 9.17 L10.52 9.30 L10.64 9.43 L10.78 9.58 L10.90 9.71 L11.03 9.88 L11.16 10.04 L11.29 10.23 L11.41 10.42 L11.61 10.91 L11.88 9.35 L12.02 9.00 L12.14 8.70 L12.28 8.40 L12.41 8.15 L12.55 7.90 L12.68 7.68 L12.82 7.45 L12.95 7.24 L13.09 7.03 L13.22 6.83 L13.36 6.62 L13.50 6.41 L13.62 6.23 L13.76 6.03 L13.89 5.85 L14.03 5.66 L14.16 5.48 L14.30 5.30 L14.43 5.13 L14.57 4.95 L14.70 4.78 L14.84 4.62 L14.99 4.48 L15.17 4.35 L15.34 4.22 L15.53 4.09 L15.72 3.95 L15.93 3.79 L16.12 3.63 L16.33 3.44 L16.52 3.26 L16.71 3.06 L17.28 2.80";
/** Measured path length of each tick (both are identical). Traced from
 *  Tariq's hand-drawn check; tick 2 is tick 1 shifted +5.2 x for the
 *  overlapped double-tick look. */
const TICK_LEN = 15.95;
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

  if (status === "failed") {
    return (
      <View style={styles.statusRow}>
        <SFIcon name="exclamationmark.circle.fill" size={14} color="#FF3B30" />
      </View>
    );
  }

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
