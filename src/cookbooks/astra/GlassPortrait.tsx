import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, View } from "react-native";
import { portraits } from "./data";

/**
 * Portrait avatar: the photo in a circle with a glass-dome treatment —
 * a bright crown highlight up top, a soft lower shade for depth, and a
 * faint edge light. Previously this was a Skia RuntimeEffect lens, but the
 * custom shader renders incorrectly on some Android GPUs (left half of the
 * photo drawn black), so the effect is now built from plain gradients that
 * render identically everywhere. The exported API is unchanged.
 */
export function GlassPortrait({
  index,
  size,
  dark,
  visible = true,
}: {
  index: number;
  size: number;
  motion?: unknown;
  dark?: boolean;
  visible?: boolean;
}) {
  const source =
    index === 4
      ? require("../../../assets/cookbooks/astra/photos/coast.png")
      : portraits[index % portraits.length];
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: "hidden",
        backgroundColor: dark ? "#2b2e33" : "#dde1e6",
      }}
    >
      {visible && (
        <Image
          source={source}
          style={{ width: size, height: size }}
          contentFit="cover"
          transition={150}
        />
      )}
      {/* Window light bent across the dome's crown. */}
      <LinearGradient
        pointerEvents="none"
        colors={["rgba(255,255,255,0.55)", "rgba(255,255,255,0.08)", "rgba(255,255,255,0)"]}
        locations={[0, 0.45, 0.75]}
        start={{ x: 0.3, y: 0 }}
        end={{ x: 0.5, y: 0.6 }}
        style={[StyleSheet.absoluteFill, { borderRadius: size / 2 }]}
      />
      {/* Gentle lower shade so the sphere reads as a volume. */}
      <LinearGradient
        pointerEvents="none"
        colors={["rgba(8,12,20,0)", "rgba(8,12,20,0.16)"]}
        start={{ x: 0.5, y: 0.55 }}
        end={{ x: 0.5, y: 1 }}
        style={[StyleSheet.absoluteFill, { borderRadius: size / 2 }]}
      />
      {/* Bright return light along the lower-left rim. */}
      <LinearGradient
        pointerEvents="none"
        colors={["rgba(255,255,255,0)", "rgba(255,255,255,0.35)"]}
        start={{ x: 0.75, y: 0.35 }}
        end={{ x: 0.1, y: 0.95 }}
        style={[StyleSheet.absoluteFill, { borderRadius: size / 2 }]}
      />
    </View>
  );
}
