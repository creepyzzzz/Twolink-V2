import { useMinimizeOnScroll } from "expo-android-glass-view";
import { useEffect } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AdaptiveGlassView } from "./GlassView";
import { SFIcon } from "./SFIcon";

const ACCENT = "#3D92E9";
const ICON_IDLE = "rgba(24,26,32,0.68)";

const TABS = [
  { name: "chats", label: "Chats", icon: "message" },
  { name: "settings", label: "Settings", icon: "gear" },
] as const;

// Geometry (pt).
const PAD_H = 14;
const PAD_V = 10;
const SLOT_W = 60;
const SLOT_GAP = 4;
const STEP = SLOT_W + SLOT_GAP;
const CAPSULE_W = 52;
const CAPSULE_H = 40;
const CAPSULE_LEFT = PAD_H + (SLOT_W - CAPSULE_W) / 2;

type TabBarProps = {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: { navigate: (name: string) => void };
};

/**
 * TwoLink's own bottom tab bar: a floating, centered, icons-only liquid-glass
 * pill. It replaces the library's AndroidGlassBottomTabs, whose baked-in iOS
 * material fill and native selection droplet kept needing native rebuilds to
 * verify — this one is pure JS over our AdaptiveGlassView, so what Tariq sees
 * in the dev client is exactly what ships.
 *
 * The selection capsule slides between tabs on a spring; scrolling a tab's
 * list tucks the whole pill via the shared minimize state.
 */
export function GlassTabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const { minimized } = useMinimizeOnScroll();

  const capsuleX = useSharedValue(state.index * STEP);
  useEffect(() => {
    capsuleX.value = withSpring(state.index * STEP, {
      damping: 24,
      stiffness: 340,
    });
  }, [state.index, capsuleX]);

  const capsuleStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: capsuleX.value }],
  }));
  const tuckStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: withSpring(minimized ? 0.9 : 1, { damping: 20, stiffness: 300 }),
      },
      {
        translateY: withSpring(minimized ? 6 : 0, {
          damping: 20,
          stiffness: 300,
        }),
      },
    ],
  }));

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { bottom: Math.max(insets.bottom, 12) + 8 }]}
    >
      <Animated.View style={tuckStyle}>
        <AdaptiveGlassView
          tintColor="rgba(255,255,255,0.55)"
          blurRadius={24}
          refractionHeight={8}
          refractionAmount={14}
          style={styles.pill}
        >
          {/* Selection capsule sits under the icons. */}
          <Animated.View style={[styles.capsule, capsuleStyle]} />
          <View style={styles.row}>
            {TABS.map((tab, i) => {
              const active = i === state.index;
              return (
                <Pressable
                  key={tab.name}
                  accessibilityRole="tab"
                  accessibilityLabel={tab.label}
                  accessibilityState={{ selected: active }}
                  onPress={() => {
                    const route = state.routes[i];
                    if (route && i !== state.index)
                      navigation.navigate(route.name);
                  }}
                  style={styles.slot}
                >
                  <SFIcon
                    name={tab.icon}
                    size={22}
                    color={active ? ACCENT : ICON_IDLE}
                  />
                </Pressable>
              );
            })}
          </View>
        </AdaptiveGlassView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 10,
  },
  pill: {
    borderRadius: 30,
    paddingHorizontal: PAD_H,
    paddingVertical: PAD_V,
  },
  row: {
    flexDirection: "row",
    gap: SLOT_GAP,
  },
  slot: {
    width: SLOT_W,
    height: CAPSULE_H,
    alignItems: "center",
    justifyContent: "center",
  },
  capsule: {
    position: "absolute",
    left: CAPSULE_LEFT,
    top: PAD_V,
    width: CAPSULE_W,
    height: CAPSULE_H,
    borderRadius: CAPSULE_H / 2,
    // Whisper-light: a flat translucent fill here stacks over the pill's own
    // tint and reads as a solid container (~73% white at 0.55). At 0.18 it
    // stays a soft glass highlight marking the active tab.
    backgroundColor: "rgba(255,255,255,0.18)",
  },
});
