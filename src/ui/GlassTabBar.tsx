import { StyleSheet, View } from "react-native";
import {
  AndroidGlassBottomTabs,
  AndroidGlassTab,
} from "expo-android-glass-view";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SFIcon } from "./SFIcon";

/** Structural subset of the tab-bar props — avoids the vendored types. */
type TabBarProps = {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: { navigate: (name: string) => void };
};

const TABS = [
  { name: "chats", label: "Chats", icon: "message" },
  { name: "settings", label: "Settings", icon: "gear" },
] as const;

const ACCENT = "#3D92E9";
const ICON_IDLE = "rgba(60,60,67,0.55)";

/**
 * kagantemizkan's iOS 26 bottom tab bar: a floating glass capsule with a
 * liquid selection droplet you can drag between tabs. The bar background
 * stays transparent like our old pill — containerColor is transparent and
 * the tint whisper-light (0.20), so lists scrolling underneath visibly blur
 * through it. The droplet's resting solid fill was removed in our
 * patch-package patch, so at rest it's pure refraction + rim.
 * Minimize-on-scroll is handled natively inside MinimizeOnScrollProvider.
 */
export function GlassTabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const selectedIndex = Math.max(
    0,
    TABS.findIndex((t) => t.name === state.routes[state.index]?.name),
  );

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { bottom: Math.max(insets.bottom, 12) + 8 }]}
    >
      <AndroidGlassBottomTabs
        theme="light"
        selectedIndex={selectedIndex}
        onTabSelected={(i) => {
          const tab = TABS[i];
          if (tab && i !== selectedIndex) navigation.navigate(tab.name);
        }}
        accentColor={ACCENT}
        tintColor="rgba(255,255,255,0.20)"
        containerColor="transparent"
        style={styles.bar}
      >
        {TABS.map((tab) => (
          <AndroidGlassTab
            key={tab.name}
            icon={
              <SFIcon name={tab.icon} size={24} color={ICON_IDLE} />
            }
          />
        ))}
      </AndroidGlassBottomTabs>
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
  bar: {
    width: 176,
    height: 64,
  },
});
