import { memo } from "react";
import { Dimensions, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { ZoomIn } from "react-native-reanimated";

import { Radius, Space } from "../../constants/theme";
import { useTheme } from "../../hooks/use-theme";

/** iMessage-style quick tapbacks. */
export const REACTION_EMOJIS = ["❤️", "👍", "👎", "😂", "😮", "😢"];

export type ReactionTarget = {
  /** Window rect of the long-pressed bubble. */
  x: number;
  y: number;
  width: number;
};

const PILL_W = 268;
const PILL_H = 52;

type Props = {
  target: ReactionTarget;
  /** Emojis already on this message (highlighted; tapping removes). */
  selected: string[];
  onPick: (emoji: string) => void;
  onClose: () => void;
};

/**
 * Floating reaction bar. Rendered at the conversation root (above the panel,
 * which clips overflow) and positioned from the bubble's window rect.
 * Idle UI is untouched — this only exists while a finger is choosing.
 */
export const ReactionOverlay = memo(function ReactionOverlay({
  target,
  selected,
  onPick,
  onClose,
}: Props) {
  const theme = useTheme();
  const screenW = Dimensions.get("window").width;
  const centerX = target.x + target.width / 2;
  const left = Math.min(Math.max(Space[3], centerX - PILL_W / 2), screenW - PILL_W - Space[3]);
  const top = Math.max(Space[3], target.y - PILL_H - 10);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dismiss reactions"
        onPress={onClose}
        style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(10,10,12,0.22)" }]}
      />
      <Animated.View
        entering={ZoomIn.duration(160)}
        style={[
          styles.pill,
          {
            top,
            left,
            width: PILL_W,
            backgroundColor: theme.surface,
            boxShadow: "0 10px 32px rgba(16, 16, 18, 0.18)",
          },
        ]}
      >
        {REACTION_EMOJIS.map((emoji) => {
          const active = selected.includes(emoji);
          return (
            <Pressable
              key={emoji}
              accessibilityRole="button"
              accessibilityLabel={`React with ${emoji}`}
              onPress={() => onPick(emoji)}
              style={[
                styles.emojiBtn,
                active && { backgroundColor: theme.chip },
              ]}
            >
              <Text style={styles.emoji}>{emoji}</Text>
            </Pressable>
          );
        })}
      </Animated.View>
    </View>
  );
});

const styles = StyleSheet.create({
  pill: {
    position: "absolute",
    height: PILL_H,
    borderRadius: Radius.bubble,
    borderCurve: "continuous",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-evenly",
    paddingHorizontal: 8,
  },
  emojiBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  emoji: {
    fontSize: 26,
    lineHeight: 32,
  },
});
