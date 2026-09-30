import { LinearGradient } from "expo-linear-gradient";
import type { ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

/**
 * Shared Poffu backdrop: a soft light gradient with pastel glows.
 * Glass surfaces need busy, luminous content behind them to refract — a
 * flat background makes even real refraction invisible, so every glass
 * screen sits on this. Poffu is light-theme only.
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
        colors={["#F7F8FA", "#EEF0F4", "#E3E6EC"]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* Soft glow top-left, gives the tab bar and bubbles something to bend. */}
      <LinearGradient
        colors={["rgba(124,93,250,0.14)", "rgba(124,93,250,0)"]}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.6, y: 0.45 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={["rgba(56,189,248,0.12)", "rgba(56,189,248,0)"]}
        start={{ x: 0.85, y: 0.35 }}
        end={{ x: 0.5, y: 0.75 }}
        style={StyleSheet.absoluteFill}
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F2F3F6" },
});
