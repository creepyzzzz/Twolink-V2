import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMinimizeOnScroll } from "expo-android-glass-view";
import { AdaptiveGlassView } from "./GlassView";
import { SFIcon } from "./SFIcon";

/** Structural subset of the tab-bar props — avoids the vendored types. */
type TabBarProps = {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: { navigate: (name: string) => void };
};

const TABS = [
  { label: "Chats", icon: "message" },
  { label: "Settings", icon: "gear" },
] as const;

const ACCENT = "#3D92E9";
const ICON_IDLE = "rgba(60,60,67,0.55)";

const PAD_H = 14;
const PAD_V = 16;
const SLOT_W = 60;
const SLOT_GAP = 4;

// Timing (not spring): a spring overshoots and the pill visibly bounces
// every time the minimize state flips while scrolling. Ease-out timing
// can never oscillate.
const TUCK_MS = 220;
const TUCK_EASING = Easing.out(Easing.cubic);

/**
 * iOS-style floating pill tab bar: compact, centered, icons-only liquid
 * glass. Selection is icon color only (blue = active) — no capsule, no
 * container inside the pill. Tint stays whisper-light (0.20): the native
 * side paints tint as a flat wash over the blur, and anything heavy buries
 * the glass into a solid-looking capsule. The tab screens scroll UNDER the
 * pill so content visibly blurs through it — glass over a flat empty
 * background reads as a solid disc, so the pill must have a backdrop.
 */
export function GlassTabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const { minimized } = useMinimizeOnScroll();

  // Tuck the pill while scrolling down: shrink slightly and drop, then
  // glide back when scrolling up or reaching the top. Timing-based so it
  // never bounces/oscillates as the scroll direction changes.
  const tuckStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: withTiming(minimized ? 0.9 : 1, {
          duration: TUCK_MS,
          easing: TUCK_EASING,
        }),
      },
      {
        translateY: withTiming(minimized ? 6 : 0, {
          duration: TUCK_MS,
          easing: TUCK_EASING,
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
          tintColor="rgba(255,255,255,0.20)"
          blurRadius={24}
          refractionHeight={8}
          refractionAmount={14}
          style={styles.pill}
        >
          <View style={styles.row}>
            {TABS.map((tab, i) => {
              const active = i === state.index;
              return (
                <Pressable
                  key={tab.label}
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
    alignItems: "center",
    justifyContent: "center",
  },
});
