import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState } from "react";
import { StyleSheet, Text, Pressable, View } from "react-native";
import {
  Gesture,
  GestureDetector,
} from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { SFIcon } from "../../../../ui/SFIcon";
import { Accent, Space } from "../../constants/theme";
import { Glass } from "../ui/glass";

/**
 * Liquid-glass welcome, inspired by the interaction grammar of Appllama's
 * liquid-glass-screens studies (read-only research — this composition,
 * copy, and artwork are original): a great glass dome sits on the bottom
 * edge; swiping up carries it toward the middle while it shrinks into a
 * round button, a plume of chat bubbles breathes above it, and the copy
 * wipes in. Drag back down to reverse.
 */

const DOME = 300;
const BUTTON = 92;
const RISE = 240;
const SWIPE = 280;

const PLUME = [
  { text: "hey!", x: -110, y: -130 },
  { text: "on my way", x: 96, y: -170 },
  { text: "see you at 7", x: -70, y: -230 },
  { text: "that was amazing", x: 80, y: -280 },
];

function PlumeBubble({
  progress,
  index,
  text,
  x,
  y,
}: {
  progress: SharedValue<number>;
  index: number;
  text: string;
  x: number;
  y: number;
}) {
  const float = useSharedValue(0);
  useEffect(() => {
    float.value = withRepeat(
      withTiming(1, { duration: 2200 + index * 350 }),
      -1,
      true,
    );
  }, [float, index]);
  const appear = useAnimatedStyle(() => {
    const t = interpolate(
      progress.value,
      [0.55 + index * 0.09, 0.95],
      [0, 1],
      Extrapolation.CLAMP,
    );
    return {
      opacity: t,
      transform: [
        { translateX: x },
        { translateY: y + (1 - t) * 40 },
        { scale: 0.75 + t * 0.25 },
      ],
    };
  });
  const breathe = useAnimatedStyle(() => ({
    transform: [{ translateY: float.value * 10 }],
  }));
  return (
    <Animated.View style={[styles.plumeWrap, breathe]}>
      <Animated.View style={appear}>
        <Glass style={styles.plumeBubble}>
          <Text style={styles.plumeText}>{text}</Text>
        </Glass>
      </Animated.View>
    </Animated.View>
  );
}

export function Welcome({ onDone }: { onDone: () => void }) {
  const insets = useSafeAreaInsets();
  const progress = useSharedValue(0);
  const startP = useSharedValue(0);
  const [open, setOpen] = useState(false);

  const go = (to: 0 | 1, duration = 480) => {
    progress.value = withTiming(to, { duration });
    setOpen(to === 1);
  };

  const pan = Gesture.Pan()
    .onStart(() => {
      startP.value = progress.value;
    })
    .onUpdate((e) => {
      progress.value = Math.min(
        1,
        Math.max(0, startP.value - e.translationY / SWIPE),
      );
    })
    .onEnd(() => {
      const to: 0 | 1 = progress.value > 0.45 ? 1 : 0;
      progress.value = withTiming(to, { duration: 420 });
      runOnJS(setOpen)(to === 1);
    });
  const tap = Gesture.Tap().onEnd(() => {
    runOnJS(go)(1);
  });
  const composed = Gesture.Race(tap, pan);

  const domeStyle = useAnimatedStyle(() => {
    const size = interpolate(progress.value, [0, 1], [DOME, BUTTON]);
    return {
      width: size,
      height: size,
      borderRadius: size / 2,
      transform: [
        { translateY: interpolate(progress.value, [0, 1], [0, -RISE]) },
      ],
    };
  });
  const markStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.4], [1, 0], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(progress.value, [0, 1], [0, -60]) }],
  }));
  const copyStyle = useAnimatedStyle(() => {
    const t = interpolate(
      progress.value,
      [0.55, 1],
      [0, 1],
      Extrapolation.CLAMP,
    );
    return {
      opacity: t,
      transform: [{ translateY: (1 - t) * 36 }],
    };
  });
  const hintStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.25], [1, 0], Extrapolation.CLAMP),
  }));
  const ctaStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0.8, 1], [0, 1], Extrapolation.CLAMP),
    transform: [
      { translateY: interpolate(progress.value, [0.8, 1], [16, 0], Extrapolation.CLAMP) },
    ],
  }));

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={["#8FC3EE", "#C9E6FA", "#F4FAFF"]}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />
      {/* Soft sun + drifting-feeling clouds */}
      <View style={styles.sun} />
      <View style={[styles.cloud, { top: "18%", left: -40, width: 220, height: 64 }]} />
      <View style={[styles.cloud, { top: "30%", right: -60, width: 280, height: 80 }]} />

      <Animated.View
        style={[styles.wordmark, { paddingTop: insets.top + Space[6] }, markStyle]}
      >
        <Text style={styles.wordmarkText}>TwoLink</Text>
        <Animated.View style={hintStyle}>
          <View style={styles.hint}>
            <SFIcon name="chevron.up" size={16} color="rgba(17,17,19,0.55)" />
            <Text style={styles.hintText}>Swipe up</Text>
          </View>
        </Animated.View>
      </Animated.View>

      <Animated.View style={[styles.copy, copyStyle]} pointerEvents="none">
        <Text style={styles.headline}>Your people,{"\n"}a little closer.</Text>
        <Text style={styles.sub}>
          Fast, private chats with the people who matter — wrapped in glass.
        </Text>
      </Animated.View>

      {/* Sticker plume: sample chat bubbles breathing above the button */}
      <View style={styles.plumeAnchor} pointerEvents="none">
        {PLUME.map((b, i) => (
          <PlumeBubble
            key={b.text}
            progress={progress}
            index={i}
            text={b.text}
            x={b.x}
            y={b.y}
          />
        ))}
      </View>

      <GestureDetector gesture={composed}>
        <Animated.View
          style={[styles.domeAnchor, domeStyle]}
          accessibilityRole="button"
          accessibilityLabel="Swipe up or tap to continue"
        >
          <Glass style={styles.domeGlass} interactive>
            <Text style={styles.domeGlyph}>✦</Text>
          </Glass>
        </Animated.View>
      </GestureDetector>

      {open && (
        <Animated.View style={[styles.ctaWrap, ctaStyle]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Start chatting"
            onPress={onDone}
            style={({ pressed }) => [
              styles.cta,
              { opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Text style={styles.ctaText}>Start chatting</Text>
            <SFIcon name="chevron.right" size={16} color="#FFFFFF" />
          </Pressable>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    zIndex: 90,
    overflow: "hidden",
  },
  sun: {
    position: "absolute",
    top: "8%",
    right: "12%",
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: "rgba(255,255,255,0.85)",
  },
  cloud: {
    position: "absolute",
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.55)",
  },
  wordmark: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  wordmarkText: {
    fontSize: 40,
    fontFamily: "SFProText-Bold",
    letterSpacing: -0.8,
    color: "#111113",
  },
  hint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 10,
  },
  hintText: {
    fontSize: 14,
    fontFamily: "SFProText-Medium",
    color: "rgba(17,17,19,0.55)",
  },
  copy: {
    position: "absolute",
    top: "24%",
    left: 0,
    right: 0,
    alignItems: "center",
    paddingHorizontal: 40,
  },
  headline: {
    fontSize: 34,
    lineHeight: 40,
    fontFamily: "SFProText-Bold",
    letterSpacing: -0.6,
    color: "#111113",
    textAlign: "center",
  },
  sub: {
    marginTop: 12,
    fontSize: 16,
    lineHeight: 22,
    fontFamily: "SFProText-Regular",
    color: "rgba(17,17,19,0.6)",
    textAlign: "center",
  },
  plumeAnchor: {
    position: "absolute",
    left: "50%",
    bottom: 190,
    width: 0,
    height: 0,
  },
  plumeWrap: {
    position: "absolute",
    left: 0,
    top: 0,
  },
  plumeBubble: {
    borderRadius: 18,
    borderCurve: "continuous",
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  plumeText: {
    fontSize: 14,
    fontFamily: "SFProText-Medium",
    color: "#111113",
  },
  domeAnchor: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: -DOME * 0.42,
    alignItems: "center",
  },
  domeGlass: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  domeGlyph: {
    fontSize: 44,
    color: "rgba(10,132,255,0.85)",
    marginBottom: DOME * 0.18,
  },
  ctaWrap: {
    position: "absolute",
    bottom: 90,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Accent,
    borderRadius: 999,
    paddingHorizontal: 28,
    paddingVertical: 16,
  },
  ctaText: {
    fontSize: 17,
    fontFamily: "SFProText-Semibold",
    color: "#FFFFFF",
  },
});
