import { Tabs } from "expo-router";
import {
  AndroidGlassMenuProvider,
  MinimizeOnScrollProvider,
} from "expo-android-glass-view";
import { ScreenBackground } from "../../ui/ScreenBackground";
import { FloatingTabButtons } from "../../ui/FloatingTabButtons";

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
            // Each tab is its own floating glass button — no pill container.
            tabBar={(props: TabBarProps) => <FloatingTabButtons {...props} />}
            screenOptions={{
              headerShown: false,
              // Scenes are transparent — the shared ScreenBackground sits behind.
              // Keep content clear of the floating buttons.
              sceneStyle: { backgroundColor: "transparent", paddingBottom: 100 },
            }}
          >
            <Tabs.Screen name="chats" />
            <Tabs.Screen name="stories" />
            <Tabs.Screen name="settings" />
          </Tabs>
        </ScreenBackground>
      </MinimizeOnScrollProvider>
    </AndroidGlassMenuProvider>
  );
}
