import type { ReactNode } from "react";
import { StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { AdaptiveGlassView } from "../../../../ui/GlassView";

/**
 * Frosted menu card with a real native-glass backdrop — the same frosted
 * read as the native long-press inbox menu. Used for the Send Later and
 * @mention popups, and the message long-press reaction bar + actions menu.
 *
 * Built on AdaptiveGlassView (expo-android-glass-view), NOT expo-blur:
 * BlurView renders only its tint with no backdrop blur inside the
 * composer's KeyboardStickyView on-device.
 */
export function MenuCard({
  style,
  children,
}: {
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  return (
    <AdaptiveGlassView
      tintColor="rgba(255,255,255,0.55)"
      blurRadius={14}
      style={[styles.card, style]}
    >
      {children}
    </AdaptiveGlassView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderCurve: "continuous",
    overflow: "hidden",
  },
});
