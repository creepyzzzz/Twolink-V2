import { Tabs } from "expo-router";
import {
  AndroidGlassMenuProvider,
  MinimizeOnScrollProvider,
} from "expo-android-glass-view";
import { ScreenBackground } from "../../ui/ScreenBackground";
import { GlassTabBar } from "../../ui/GlassTabBar";
import { GlassAlertHost } from "../../cookbooks/fable/components/ui/glass-alert";

/** Structural subset of the tab-bar props — avoids the vendored types. */
type TabBarProps = {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: { navigate: (name: string) => void };
};

export default function TabsLayout() {
  return (
    <AndroidGlassMenuProvider>
      {/* Minimize state kept mounted (harmless with no bar) so the tab
          screens' scroll hooks keep working while we debug the bar. */}
      <MinimizeOnScrollProvider>
        <ScreenBackground>
          <Tabs
            // iOS-style floating pill — icons only, selection is icon color.
            tabBar={(props: TabBarProps) => <GlassTabBar {...props} />}
            screenOptions={{
              headerShown: false,
              // Scenes are transparent — the shared ScreenBackground sits behind.
              // No bottom clearance: the lists scroll UNDER the floating glass
              // buttons (iOS-style), so content visibly blurs through them.
              // Each screen keeps its own safe-area inset padding.
              sceneStyle: { backgroundColor: "transparent" },
            }}
          >
            <Tabs.Screen name="chats" />
            <Tabs.Screen name="stories" />
            <Tabs.Screen name="settings" />
          </Tabs>
        </ScreenBackground>
        <GlassAlertHost />
      </MinimizeOnScrollProvider>
    </AndroidGlassMenuProvider>
  );
}
