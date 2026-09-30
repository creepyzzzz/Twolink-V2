import { BlurView } from "expo-blur";
import type { ReactNode } from "react";
import {
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

/**
 * Frosted menu card. Unlike the whisper-light `Glass` used elsewhere, this
 * carries a real blur backdrop — the same frosted read as the native
 * long-press menu. Used for the Send Later and @mention popups.
 */
export function MenuCard({
  style,
  children,
}: {
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  return (
    <View style={[styles.card, style]}>
      <BlurView
        intensity={90}
        tint="light"
        style={StyleSheet.absoluteFill}
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderCurve: "continuous",
    overflow: "hidden",
  },
});
