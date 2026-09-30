import { Tabs } from "expo-router";
import {
  AndroidGlassBottomTabs,
  AndroidGlassMenuProvider,
  AndroidGlassTab,
} from "expo-android-glass-view";
import { MessageCircle, Sparkles, Settings } from "lucide-react-native";
import { StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenBackground } from "../../ui/ScreenBackground";
import { useTheme as useAstraTheme } from "../../cookbooks/astra/theme";

const TABS = [
  { name: "chats", label: "Chats", Icon: MessageCircle },
  { name: "stories", label: "Stories", Icon: Sparkles },
  { name: "settings", label: "Settings", Icon: Settings },
] as const;

const ACCENT = "#8ab4ff";
const ICON_IDLE_DARK = "rgba(232,234,237,0.72)";
const ICON_IDLE_LIGHT = "rgba(24,26,32,0.68)";

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
  const system = useAstraTheme();
  // The settings tab is fixed-dark by design; chats/stories follow the
  // system theme, so the bar always matches the surface it floats over.
  const dark =
    state.routes[state.index]?.name === "settings" ? true : system.dark;
  const idle = dark ? ICON_IDLE_DARK : ICON_IDLE_LIGHT;
  return (
    <AndroidGlassBottomTabs
      selectedIndex={state.index}
      onTabSelected={(index) => {
        const route = state.routes[index];
        if (route && index !== state.index) navigation.navigate(route.name);
      }}
      theme={dark ? "dark" : "light"}
      accentColor={ACCENT}
      // Light glass brightens the backdrop to near-white, which vanishes
      // over the light inbox — a translucent veil keeps the capsule frosted.
      containerColor={dark ? undefined : "rgba(255,255,255,0.78)"}
      blurRadius={30}
      refractionHeight={9}
      refractionAmount={16}
      style={[styles.bar, { bottom: Math.max(insets.bottom, 16) + 8 }]}
    >
      {TABS.map(({ label, Icon }) => (
        <AndroidGlassTab
          key={label}
          label={label}
          labelStyle={[styles.label, { color: idle }]}
          icon={<Icon size={22} color={idle} strokeWidth={2} />}
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
