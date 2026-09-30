import { Tabs } from "expo-router";
import {
  AndroidGlassMenuProvider,
  MinimizeOnScrollProvider,
} from "expo-android-glass-view";
import { ScreenBackground } from "../../ui/ScreenBackground";

export default function TabsLayout() {
  return (
    <AndroidGlassMenuProvider>
      {/* Minimize state kept mounted (harmless with no bar) so the tab
          screens' scroll hooks keep working while we debug the bar. */}
      <MinimizeOnScrollProvider>
        <ScreenBackground>
          <Tabs
            // Bottom tab bar removed completely (debugging step).
            tabBar={() => null}
            screenOptions={{
              headerShown: false,
              // Scenes are transparent — the shared ScreenBackground sits behind.
              sceneStyle: { backgroundColor: "transparent" },
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
