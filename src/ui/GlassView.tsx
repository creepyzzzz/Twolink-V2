import { BlurView } from "expo-blur";
import {
  GlassContainer as NativeGlassContainer,
  GlassView as NativeGlassView,
  isGlassEffectAPIAvailable,
  isLiquidGlassAvailable,
  type GlassColorScheme,
} from "expo-glass-effect";
import { AndroidGlassView } from "expo-android-glass-view";
import { LinearGradient } from "expo-linear-gradient";
import type { ReactNode } from "react";
import {
  Platform,
  StyleSheet,
  View,
  type StyleProp,
  type ViewProps,
  type ViewStyle,
} from "react-native";

/**
 * Poffu glass abstraction.
 *
 * - iOS 26+ with the liquid-glass APIs available: Apple's native material
 *   through expo-glass-effect (pixel-faithful with the upstream
 *   liquid-glass-chat-ui cookbooks).
 * - Android: real-time native refraction through expo-android-glass-view
 *   (Jetpack Compose + AGSL on API 33+; the library's own graceful fallbacks
 *   below that). This is the big v2 upgrade — every surface routed through
 *   here now genuinely refracts on Tariq's phone instead of faking it
 *   with blur.
 * - Older iOS / web: composed fallback (expo-blur + tint wash + sheen +
 *   hairline border).
 *
 * Both cookbooks route their glass surfaces through here.
 */
export const isNativeGlassSupported =
  process.env.EXPO_OS === "ios" &&
  isGlassEffectAPIAvailable() &&
  isLiquidGlassAvailable();

export type GlassEffectStyle = "regular" | "clear";

type AdaptiveGlassViewProps = ViewProps & {
  style?: StyleProp<ViewStyle>;
  glassEffectStyle?: GlassEffectStyle;
  tintColor?: string;
  isInteractive?: boolean;
  /** "auto" follows the system; maps to undefined for the fallback tint logic. */
  colorScheme?: GlassColorScheme;
  /** Used only for the Android fallback when colorScheme is "auto"/undefined. */
  fallbackScheme?: "light" | "dark";
  /** Android-only knobs for the native refraction (ignored on iOS). */
  blurRadius?: number;
  refractionHeight?: number;
  refractionAmount?: number;
  children?: ReactNode;
};

/**
 * Drop-in replacement for expo-glass-effect's GlassView.
 * Never give it opacity 0 — that silently disables the native glass.
 */
export function AdaptiveGlassView({
  style,
  glassEffectStyle = "regular",
  tintColor,
  isInteractive = false,
  colorScheme,
  fallbackScheme = "light",
  blurRadius,
  refractionHeight,
  refractionAmount,
  children,
  ...rest
}: AdaptiveGlassViewProps) {
  // Android: real native refraction via expo-android-glass-view. The library
  // reads cornerRadius from style.borderRadius itself and handles its own
  // graceful fallbacks on older Android versions.
  if (Platform.OS === "android") {
    return (
      <AndroidGlassView
        tintColor={tintColor}
        blurRadius={blurRadius}
        refractionHeight={refractionHeight}
        refractionAmount={refractionAmount}
        style={style}
        {...rest}
      >
        {children}
      </AndroidGlassView>
    );
  }

  if (isNativeGlassSupported) {
    return (
      <NativeGlassView
        colorScheme={colorScheme}
        glassEffectStyle={glassEffectStyle}
        tintColor={tintColor}
        isInteractive={isInteractive}
        style={style}
        {...rest}
      >
        {children}
      </NativeGlassView>
    );
  }

  const flat = StyleSheet.flatten(style) ?? {};
  const radius = flat.borderRadius as number | undefined;
  // "auto"/undefined -> fall back to the explicit fallbackScheme ("light").
  const scheme = colorScheme === "dark" ? "dark" : colorScheme === "light" ? "light" : fallbackScheme;

  return (
    <View style={[styles.base, style, { overflow: "hidden" }]} {...rest}>
      <BlurView
        intensity={glassEffectStyle === "clear" ? 25 : 40}
        tint={scheme === "dark" ? "dark" : "light"}
        style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
      />
      {/* Translucent tint wash, approximates the native material's tint. */}
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            borderRadius: radius,
            backgroundColor:
              tintColor ??
              (scheme === "dark"
                ? "rgba(28,28,32,0.45)"
                : "rgba(255,255,255,0.45)"),
          },
        ]}
      />
      {/* Top-edge sheen: the cheap cue that sells "glass" on Android. */}
      <LinearGradient
        pointerEvents="none"
        colors={["rgba(255,255,255,0.32)", "rgba(255,255,255,0)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 0.35 }}
        style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
      />
      {/* Hairline edge so the surface reads against busy backgrounds. */}
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            borderRadius: radius,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor:
              scheme === "dark"
                ? "rgba(255,255,255,0.22)"
                : "rgba(255,255,255,0.65)",
          },
        ]}
      />
      {children}
    </View>
  );
}

type AdaptiveGlassContainerProps = ViewProps & {
  style?: StyleProp<ViewStyle>;
  /** Spacing between merged glass children. Native iOS only; ignored on Android. */
  spacing?: number;
  children?: ReactNode;
};

/**
 * Drop-in replacement for expo-glass-effect's GlassContainer.
 *
 * iOS 26+: merges overlapping native glass views into one continuous surface.
 * Android: there is no merged-glass equivalent, so the children are wrapped in
 * a single continuous blurred surface instead — the same layout, one surface.
 * Nested AdaptiveGlassView children keep their own fallback blur inside it,
 * which is visually fine.
 */
export function AdaptiveGlassContainer({
  style,
  spacing = 0,
  children,
  ...rest
}: AdaptiveGlassContainerProps) {
  if (isNativeGlassSupported) {
    return (
      <NativeGlassContainer spacing={spacing} style={style} {...rest}>
        {children}
      </NativeGlassContainer>
    );
  }
  return (
    <View style={[styles.base, style, { overflow: "hidden" }]} {...rest}>
      <BlurView
        intensity={40}
        tint="default"
        style={StyleSheet.absoluteFill}
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderCurve: "continuous",
  },
});
