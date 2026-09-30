import { Tabs } from "expo-router";
import {
  AndroidGlassMenuProvider,
  MinimizeOnScrollProvider,
} from "expo-android-glass-view";
import { ScreenBackground } from "../../ui/ScreenBackground";
import { GlassTabBar } from "../../ui/GlassTabBar";

/** Structural subset of the tab-bar props — avoids the vendored types. */
type TabBarProps = {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: { navigate: (name: string) => void };
};

export default function TabsLayout() {
  return (
    <AndroidGlassMenuProvider>
      {/* Shares one minimize state between the tab bar and the tab screens:
          scrolling down tucks the pill, scrolling up or reaching the top
          expands it again. */}
      <MinimizeOnScrollProvider>
        <ScreenBackground>
          <Tabs
            tabBar={(props: TabBarProps) => <GlassTabBar {...props} />}
            screenOptions={{
              headerShown: false,
              // Scenes are transparent — the shared ScreenBackground sits behind.
              // Keep content clear of the floating pill.
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
