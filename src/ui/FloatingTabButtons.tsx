import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  withSpring,
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

const BTN = 56;
const GAP = 12;

/**
 * Floating tab bar buttons: each tab is its own circular liquid-glass
 * button floating above the content — no pill, no capsule, no container.
 * Selection is icon color only (blue = active). Tint stays whisper-light:
 * the native side paints tint as a flat wash over the blur, and anything
 * heavy buries the glass into a solid-looking disc.
 */
export function FloatingTabButtons({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const { minimized } = useMinimizeOnScroll();

  // Tuck the row while scrolling down: shrink slightly and drop, then
  // spring back when scrolling up or reaching the top.
  const tuckStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: withSpring(minimized ? 0.9 : 1, { damping: 20, stiffness: 260 }),
      },
      {
        translateY: withSpring(minimized ? 8 : 0, {
          damping: 20,
          stiffness: 260,
        }),
      },
    ],
  }));

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { bottom: Math.max(insets.bottom, 12) + 8 }]}
    >
      <Animated.View style={[styles.row, tuckStyle]}>
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
                if (route && i !== state.index) navigation.navigate(route.name);
              }}
              style={styles.btn}
            >
              <AdaptiveGlassView
                tintColor="rgba(255,255,255,0.20)"
                blurRadius={24}
                refractionHeight={8}
                refractionAmount={14}
                style={styles.glass}
              >
                <View style={styles.iconWrap}>
                  <SFIcon
                    name={tab.icon}
                    size={22}
                    color={active ? ACCENT : ICON_IDLE}
                  />
                </View>
              </AdaptiveGlassView>
            </Pressable>
          );
        })}
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
  row: {
    flexDirection: "row",
    gap: GAP,
  },
  btn: {
    width: BTN,
    height: BTN,
  },
  glass: {
    width: BTN,
    height: BTN,
    borderRadius: BTN / 2,
  },
  iconWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
