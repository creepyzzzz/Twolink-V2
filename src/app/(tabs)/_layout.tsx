import { Tabs } from "expo-router";
import {
  AndroidGlassBottomTabs,
  AndroidGlassMenuProvider,
  AndroidGlassTab,
} from "expo-android-glass-view";
import { SFIcon } from "../../ui/SFIcon";
import { StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenBackground } from "../../ui/ScreenBackground";

const TABS = [
  { name: "chats", label: "Chats", icon: "message" },
  { name: "settings", label: "Settings", icon: "gear" },
] as const;

const ACCENT = "#3D92E9";
const ICON_IDLE = "rgba(24,26,32,0.68)";

/** Structural subset of the tab-bar props — avoids the vendored types. */
type TabBarProps = {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: { navigate: (name: string) => void };
};

/**
 * The TwoLink tab bar: a floating liquid-glass capsule with the iOS 26-style
 * draggable selection droplet, rendered natively on Android.
 */
function GlassTabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  // TwoLink is light-theme only — the bar always matches the light surface.
  return (
    <AndroidGlassBottomTabs
      selectedIndex={state.index}
      onTabSelected={(index) => {
        const route = state.routes[index];
        if (route && index !== state.index) navigation.navigate(route.name);
      }}
      theme="light"
      accentColor={ACCENT}
      // Pure floating glass: no fill color, no drop shadow — only the
      // native refraction, blur and rim highlight define the capsule.
      // fallbackColor transparent: on old Androids without RenderEffect the
      // library would otherwise paint a flat 70%-white capsule.
      shadow={false}
      fallbackColor="transparent"
      blurRadius={30}
      refractionHeight={9}
      refractionAmount={16}
      style={[styles.bar, { bottom: Math.max(insets.bottom, 16) + 8 }]}
    >
      {TABS.map(({ label, icon }) => (
        <AndroidGlassTab
          key={label}
          label={label}
          labelStyle={[styles.label, { color: ICON_IDLE }]}
          icon={<SFIcon name={icon} size={22} color={ICON_IDLE} />}
        />
      ))}
    </AndroidGlassBottomTabs>
  );
}

export default function TabsLayout() {
  return (
    <AndroidGlassMenuProvider>
      <ScreenBackground>
        <Tabs
          tabBar={(props: TabBarProps) => <GlassTabBar {...props} />}
          screenOptions={{
            headerShown: false,
            // Scenes are transparent — the shared ScreenBackground sits behind.
            // Keep content clear of the floating capsule.
            sceneStyle: { backgroundColor: "transparent", paddingBottom: 112 },
          }}
        >
          <Tabs.Screen name="chats" />
          <Tabs.Screen name="stories" />
          <Tabs.Screen name="settings" />
        </Tabs>
      </ScreenBackground>
    </AndroidGlassMenuProvider>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    left: 20,
    right: 20,
  },
  label: {
    fontSize: 11,
    fontWeight: "600",
  },
});
