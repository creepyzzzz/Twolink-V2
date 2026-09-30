import { memo } from "react";
import { Dimensions, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, ZoomIn } from "react-native-reanimated";

import { AdaptiveGlassView } from "../../../../ui/GlassView";
import { Glass } from "../ui/glass";
import { Space } from "../../constants/theme";
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
  /** Optional context menu (reply/forward/delete) under the reaction bar. */
  actions?: React.ReactNode;
};

/**
 * Floating reaction bar in the same liquid glass as the chat input box.
 * Rendered at the conversation root (above the panel, which clips overflow)
 * and positioned from the bubble's window rect. Idle UI is untouched —
 * this only exists while a finger is choosing.
 */
export const ReactionOverlay = memo(function ReactionOverlay({
  target,
  selected,
  onPick,
  onClose,
  actions,
}: Props) {
  const theme = useTheme();
  const screenW = Dimensions.get("window").width;
  const centerX = target.x + target.width / 2;
  const left = Math.min(
    Math.max(Space[3], centerX - PILL_W / 2),
    screenW - PILL_W - Space[3],
  );
  const top = Math.max(Space[3], target.y - PILL_H - 10);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View entering={FadeIn.duration(180)} style={StyleSheet.absoluteFill}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss reactions"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        >
          {/* Real native refraction on Android (same engine as the composer
              card) tinted dark blue — a frosted backdrop, not a flat dim. */}
          <AdaptiveGlassView
            tintColor="rgba(105, 118, 155, 0.22)"
            blurRadius={6}
            style={StyleSheet.absoluteFill}
          />
        </Pressable>
      </Animated.View>
      <Animated.View
        entering={ZoomIn.duration(160)}
        style={[styles.position, { top, left, boxShadow: theme.lift }]}
      >
        <Glass style={styles.pill}>
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
        </Glass>
      </Animated.View>
      {actions ? (
        <Animated.View
          entering={FadeIn.duration(160).delay(40)}
          style={[styles.menuPosition, { top: top + PILL_H + 8, left }]}
        >
          {actions}
        </Animated.View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  position: {
    position: "absolute",
    width: PILL_W,
  },
  menuPosition: {
    position: "absolute",
    width: PILL_W,
  },
  pill: {
    height: PILL_H,
    borderRadius: PILL_H / 2,
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
