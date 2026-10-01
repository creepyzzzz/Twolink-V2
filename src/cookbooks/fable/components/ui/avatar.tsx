import { Image } from "expo-image";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { Orb } from "./orb";
import { Accent } from "../../constants/theme";
import { useTheme } from "../../hooks/use-theme";

type Props = {
  /** Bundled face asset, or a remote photo URI (renders as a plain circle). */
  source: number | { uri: string };
  size: number;
  ring?: "unread" | "seen" | "none";
  ringWidth?: number;
  style?: StyleProp<ViewStyle>;
};

export function Avatar({
  source,
  size,
  ring = "none",
  ringWidth: ringWidthProp,
  style,
}: Props) {
  const theme = useTheme();
  const ringWidth =
    ring === "none" ? 0 : (ringWidthProp ?? Math.max(2, size * 0.04));
  const gap = ring === "none" ? 0 : Math.max(2, size * 0.035);
  const inner = size - 2 * (ringWidth + gap);
  // A real photo needs no glass orb — plain iOS-style circle, same as MyAvatar.
  const body =
    typeof source === "number" ? (
      <Orb source={source} size={inner} />
    ) : (
      <Image
        source={source}
        style={{
          width: inner,
          height: inner,
          borderRadius: inner / 2,
          backgroundColor: "rgba(23,25,27,0.08)",
        }}
        contentFit="cover"
      />
    );
  return (
    <View
      style={[
        styles.ring,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: ringWidth,
          borderColor:
            ring === "unread"
              ? Accent
              : ring === "seen"
                ? theme.seenRing
                : "transparent",
        },
        style,
      ]}
    >
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    alignItems: "center",
    justifyContent: "center",
  },
});
