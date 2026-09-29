import { LinearGradient } from "expo-linear-gradient";
import type { ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

/**
 * Shared TwoLink backdrop: a deep indigo-to-black gradient with a soft
 * violet glow up top. Glass surfaces need busy, luminous content behind
 * them to refract — a flat background makes even real refraction
 * invisible, so every glass screen sits on this.
 */
export function ScreenBackground({
  children,
  style,
}: {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.root, style]}>
      <LinearGradient
        colors={["#232347", "#14142b", "#0b0b18"]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* Soft glow top-left, gives the tab bar and bubbles something to bend. */}
      <LinearGradient
        colors={["rgba(124,93,250,0.28)", "rgba(124,93,250,0)"]}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.6, y: 0.45 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={["rgba(56,189,248,0.14)", "rgba(56,189,248,0)"]}
        start={{ x: 0.85, y: 0.35 }}
        end={{ x: 0.5, y: 0.75 }}
        style={StyleSheet.absoluteFill}
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0b0b18" },
});
