import type { ReactNode } from "react";
import {
  StyleSheet,
  type StyleProp,
  type ViewProps,
  type ViewStyle,
} from "react-native";

import {
  AdaptiveGlassView,
  isNativeGlassSupported,
} from "../../../../ui/GlassView";
import { useScheme } from "../../hooks/use-theme";

export const GLASS = isNativeGlassSupported;

type GlassProps = ViewProps & {
  style?: StyleProp<ViewStyle>;
  effect?: "regular" | "clear";
  tint?: string;
  interactive?: boolean;
  children?: ReactNode;
};

/**
 * Liquid glass surface on iOS 26+, a blurred translucent surface elsewhere.
 * Never give it opacity 0 — that silently disables the glass.
 */
export function Glass({
  style,
  effect = "regular",
  tint,
  interactive = false,
  children,
  ...rest
}: GlassProps) {
  const scheme = useScheme();
  return (
    <AdaptiveGlassView
      colorScheme={scheme}
      glassEffectStyle={effect}
      tintColor={tint}
      isInteractive={interactive}
      style={[styles.base, style]}
      {...rest}
    >
      {children}
    </AdaptiveGlassView>
  );
}

const styles = StyleSheet.create({
  base: {
    borderCurve: "continuous",
  },
});
